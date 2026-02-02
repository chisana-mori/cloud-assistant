import { useEffect, useRef, useState, useCallback } from 'react';
import { useLatest } from 'ahooks';
import { nanoid } from 'nanoid';
import type { ChatMessage, CodexItem } from '../types/chat';
import type { RunView } from '../types/ir';

interface UseCodexStreamOptions {
    userId: string;
    onEvent?: (event: any) => void;
}

export function useCodexStream({ userId, onEvent }: UseCodexStreamOptions) {
    const wsRef = useRef<WebSocket | null>(null);
    const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [runView, setRunView] = useState<RunView | null>(null);
    const latestMessages = useLatest(messages);
    const pendingRequests = useRef(new Map<string, { resolve: (value: any) => void; reject: (error: Error) => void; }>());
    const [isThinking, setIsThinking] = useState(false);

    // 连接 WebSocket
    const connect = useCallback(() => {
        if (wsRef.current) return;

        setStatus('connecting');
        // 在 Vite 中代理 /ws 到后端，或者直接指定全路径
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = 'localhost:3000'; // 开发环境硬编码，生产环境应从配置读取
        const url = `${protocol}//${host}/ws?userId=${userId}`;

        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
            console.log('✅ Connected to Cloud Codex');
            setStatus('connected');
        };

        ws.onclose = () => {
            console.log('❌ Disconnected');
            setStatus('disconnected');
            wsRef.current = null;
            // 简单的重连逻辑
            setTimeout(connect, 3000);
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                handleMessage(data);
            } catch (err) {
                console.error('Failed to parse message:', err);
            }
        };
    }, [userId]);

    // 处理消息
    const handleMessage = (data: any) => {
        if (data.type === 'response' || data.type === 'error') {
            const { requestId } = data;
            if (requestId && pendingRequests.current.has(requestId)) {
                const { resolve, reject } = pendingRequests.current.get(requestId)!;
                pendingRequests.current.delete(requestId);

                if (data.type === 'error') {
                    reject(new Error(data.payload.message || 'Unknown error'));
                } else {
                    resolve(data.payload);
                }
            }
        } else if (data.type === 'event') {
            const event = data.payload;
            onEvent?.(event);
            processCodexEvent(event);
        } else if (data.type === 'ir/update') {
            setRunView(data.payload as RunView);
        } else if (data.type === 'approval/request') {
            processApprovalRequest(data.payload);
        }
    };

    // 处理 Codex 事件并更新消息状态
    const processCodexEvent = (event: any) => {
        const currentMessages = [...latestMessages.current];

        // 工具函数：查找或创建消息
        const getOrCreateMessage = (threadId: string, turnId: string, role: 'assistant' | 'user') => {
            // 简单起见，我们将所有非 userMessage 的 item 归类到 assistant 消息
            // 在实际实现中，需要根据 turnId 关联
            let msg = currentMessages.find(m => m.id === turnId); // 用 turnId 作为消息 ID
            if (!msg) {
                msg = {
                    id: turnId,
                    role,
                    content: '',
                    items: [],
                };
                currentMessages.push(msg);
            }
            return msg;
        };

        // 工具函数：查找或创建 Item
        const getOrCreateItem = (msg: ChatMessage, itemId: string, type: any): CodexItem => {
            let item = msg.items.find(i => i.id === itemId);
            if (!item) {
                item = {
                    id: itemId,
                    type,
                    content: null,
                    status: 'pending',
                };
                msg.items.push(item);
            }
            return item;
        };

        switch (event.method) {
            case 'turn/started':
                // 新的一轮对话
                break;

            case 'item/started': {
                const { threadId, turnId, item } = event.params;
                const msg = getOrCreateMessage(threadId, turnId, item.type === 'userMessage' ? 'user' : 'assistant');
                const newItem = getOrCreateItem(msg, item.id, item.type);
                newItem.status = 'inProgress';

                if (item.type === 'commandExecution') {
                    newItem.command = item.command;
                    newItem.cwd = item.cwd;
                } else if (item.type === 'fileChange') {
                    newItem.changes = item.changes;
                } else if (item.type === 'mcpToolCall') {
                    newItem.server = item.server;
                    newItem.tool = item.tool;
                    newItem.arguments = item.arguments;
                }
                break;
            }

            case 'item/agentMessage/delta': {
                const { threadId, turnId, itemId, delta } = event.params;
                const msg = getOrCreateMessage(threadId, turnId, 'assistant');
                const item = getOrCreateItem(msg, itemId, 'agentMessage');
                // 更新 item 内容
                item.content = (item.content || '') + delta;
                // 同时也更新消息的主要内容（如果是纯文本）
                msg.content = (msg.content || '') + delta;
                setIsThinking(false); // 收到内容，停止思考状态
                break;
            }

            case 'item/completed': {
                const { threadId, turnId, item } = event.params;
                const msg = getOrCreateMessage(threadId, turnId, item.type === 'userMessage' ? 'user' : 'assistant');
                const existingItem = getOrCreateItem(msg, item.id, item.type);
                existingItem.status = 'completed';
                if (item.type === 'commandExecution') {
                    existingItem.content = item.aggregatedOutput; // 保存命令输出
                } else if (item.type === 'mcpToolCall') {
                    existingItem.result = item.result;
                    existingItem.error = item.error;
                }
                break;
            }
        }

        setMessages([...currentMessages]);
    };

    // 处理 Approval 请求
    const processApprovalRequest = (payload: any) => {
        const currentMessages = [...latestMessages.current];
        const { threadId, turnId, itemId, approvalId, method } = payload;

        const msg = currentMessages.find(m => m.id === turnId);
        if (!msg) return;

        const item = msg.items.find(i => i.id === itemId);
        if (item) {
            item.approvalId = approvalId;
            item.status = 'pending'; // 等待审批
        }
        setMessages([...currentMessages]);
    };

    // 发送请求
    const sendRequest = (type: string, payload: any): Promise<any> => {
        return new Promise((resolve, reject) => {
            if (wsRef.current?.readyState === WebSocket.OPEN) {
                const requestId = nanoid();
                pendingRequests.current.set(requestId, { resolve, reject });

                try {
                    wsRef.current.send(JSON.stringify({
                        type,
                        payload,
                        requestId,
                    }));
                } catch (error) {
                    pendingRequests.current.delete(requestId);
                    reject(error);
                }
            } else {
                reject(new Error('WebSocket not connected'));
            }
        });
    };

    // 发送消息 (Legacy / Fire-and-forget)
    const sendMessage = (type: string, payload: any) => {
        sendRequest(type, payload).catch(err => console.error('Failed to send message:', err));
    };

    // 启动线程
    const initThread = async (params: any = {}) => {
        return sendRequest('thread/start', params);
    };

    // 启动 Turn
    const startTurn = (threadId: string, prompt: string) => {
        // 乐观更新：立即添加用户消息
        const tempId = nanoid();
        const optimisticMsg: ChatMessage = {
            id: tempId,
            role: 'user',
            content: prompt,
            items: [],
        };
        setMessages(prev => [...prev, optimisticMsg]);
        setIsThinking(true);

        // Server 会返回 turn/started
        sendMessage('turn/start', {
            threadId,
            input: [{ type: 'text', text: prompt }],
        });
    };

    // 响应 Approval
    const respondApproval = (approvalId: string, decision: 'accept' | 'decline') => {
        sendMessage('approval/respond', {
            approvalId,
            decision,
        });

        // 乐观更新 UI 状态
        const currentMessages = [...latestMessages.current];
        for (const msg of currentMessages) {
            for (const item of msg.items) {
                if (item.approvalId === approvalId) {
                    item.status = decision === 'accept' ? 'inProgress' : 'declined';
                    item.approvalId = undefined; // 清除 approvalId
                }
            }
        }
        setMessages([...currentMessages]);
    };

    useEffect(() => {
        connect();
        return () => {
            wsRef.current?.close();
        };
    }, [connect]);

    return {
        status,
        messages,
        runView,
        isThinking,
        sendMessage,
        sendRequest,
        initThread,
        startTurn,
        respondApproval,
    };
}
