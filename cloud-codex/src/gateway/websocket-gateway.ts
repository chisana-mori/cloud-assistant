import type { WebSocket } from 'ws';
import { nanoid } from 'nanoid';
import type { SessionManager } from '../session/session-manager.js';
import type { ApprovalResponse } from '../types/protocol.js';
import { ApprovalPolicyEngine, ApprovalAuditor, type ApprovalConfig, type CommandApprovalRequest, type FileChangeApprovalRequest } from '../utils/approval-policy.js';

/**
 * 客户端连接信息
 */
export interface ClientConnection {
    id: string;
    userId: string;
    sessionId?: string;
    socket: WebSocket;
    createdAt: Date;
}

/**
 * 客户端消息类型
 */
export interface ClientMessage {
    type: 'thread/start' | 'thread/resume' | 'turn/start' | 'turn/interrupt' | 'approval/respond';
    payload: any;
    requestId?: string;
}

/**
 * 服务端消息类型
 */
export interface ServerMessage {
    type: 'event' | 'approval/request' | 'response' | 'error';
    payload: any;
    requestId?: string;
}

/**
 * Approval 请求管理
 */
interface PendingApproval {
    requestId: number | string;
    sessionId: string;
    userId: string;
    request: CommandApprovalRequest | FileChangeApprovalRequest;
    createdAt: Date;
    timeout: NodeJS.Timeout;
}

/**
 * WebSocket 网关
 * 负责客户端连接管理和消息路由
 */
export class WebSocketGateway {
    private connections = new Map<string, ClientConnection>();
    private userConnections = new Map<string, string>(); // userId -> connectionId
    private pendingApprovals = new Map<string, PendingApproval>(); // approvalId -> pending
    private policyEngine: ApprovalPolicyEngine;
    private auditor: ApprovalAuditor;

    constructor(
        private sessionManager: SessionManager,
        private approvalConfig: ApprovalConfig = {
            timeoutMs: 5 * 60 * 1000, // 5 分钟
            defaultAction: 'decline',
            autoApprove: {
                commands: ['ls', 'cat', 'grep', 'git status', 'git log'],
                paths: ['/tmp/*'],
            },
        }
    ) {
        this.policyEngine = new ApprovalPolicyEngine(approvalConfig);
        this.auditor = new ApprovalAuditor();
        this.setupSessionListeners();
    }

    /**
     * 设置 Session 事件监听
     */
    private setupSessionListeners(): void {
        // 监听会话事件
        this.sessionManager.on('session-event', ({ userId, event }: any) => {
            this.sendToUser(userId, {
                type: 'event',
                payload: event,
            });
        });

        // 监听 Approval 请求
        this.sessionManager.on('approval-request', ({ userId, sessionId, request }: any) => {
            this.handleApprovalRequest(userId, sessionId, request);
        });
    }

    /**
     * 处理新连接
     */
    async handleConnection(socket: WebSocket, userId: string): Promise<void> {
        const connectionId = nanoid();

        const connection: ClientConnection = {
            id: connectionId,
            userId,
            socket,
            createdAt: new Date(),
        };

        this.connections.set(connectionId, connection);
        this.userConnections.set(userId, connectionId);

        // 获取或创建会话
        try {
            const session = await this.sessionManager.getOrCreateSession(userId);
            connection.sessionId = session.id;

            // 发送连接成功消息
            this.sendToConnection(connectionId, {
                type: 'response',
                payload: {
                    status: 'connected',
                    sessionId: session.id,
                },
            });
        } catch (error) {
            this.sendToConnection(connectionId, {
                type: 'error',
                payload: {
                    message: 'Failed to create session',
                    error: error instanceof Error ? error.message : String(error),
                },
            });
            socket.close();
            return;
        }

        // 监听消息
        socket.on('message', (data) => {
            this.handleMessage(connectionId, data.toString());
        });

        // 监听关闭
        socket.on('close', () => {
            this.handleDisconnection(connectionId);
        });

        // 监听错误
        socket.on('error', (error) => {
            console.error(`WebSocket error for connection ${connectionId}:`, error);
        });
    }

    /**
     * 处理客户端消息
     */
    private async handleMessage(connectionId: string, data: string): Promise<void> {
        const connection = this.connections.get(connectionId);
        if (!connection || !connection.sessionId) return;

        try {
            const message: ClientMessage = JSON.parse(data);
            const session = this.sessionManager.getSession(connection.sessionId);

            if (!session) {
                this.sendToConnection(connectionId, {
                    type: 'error',
                    payload: { message: 'Session not found' },
                    requestId: message.requestId,
                });
                return;
            }

            // 路由消息到对应的处理器
            switch (message.type) {
                case 'thread/start':
                    const threadResult = await session.appServer.startThread(message.payload);
                    this.sendToConnection(connectionId, {
                        type: 'response',
                        payload: threadResult,
                        requestId: message.requestId,
                    });
                    break;

                case 'thread/resume':
                    const resumeResult = await session.appServer.resumeThread(message.payload.threadId);
                    this.sendToConnection(connectionId, {
                        type: 'response',
                        payload: resumeResult,
                        requestId: message.requestId,
                    });
                    break;

                case 'turn/start':
                    const turnResult = await session.appServer.startTurn(message.payload);
                    this.sendToConnection(connectionId, {
                        type: 'response',
                        payload: turnResult,
                        requestId: message.requestId,
                    });
                    break;

                case 'turn/interrupt':
                    const interruptResult = await session.appServer.interruptTurn(message.payload.turnId);
                    this.sendToConnection(connectionId, {
                        type: 'response',
                        payload: interruptResult,
                        requestId: message.requestId,
                    });
                    break;

                case 'approval/respond':
                    this.handleApprovalResponse(connection.sessionId, message.payload);
                    break;

                default:
                    this.sendToConnection(connectionId, {
                        type: 'error',
                        payload: { message: `Unknown message type: ${message.type}` },
                        requestId: message.requestId,
                    });
            }
        } catch (error) {
            this.sendToConnection(connectionId, {
                type: 'error',
                payload: {
                    message: 'Failed to process message',
                    error: error instanceof Error ? error.message : String(error),
                },
            });
        }
    }

    /**
     * 处理 Approval 请求（带策略引擎和超时）
     */
    private handleApprovalRequest(userId: string, sessionId: string, request: any): void {
        const approvalId = nanoid();
        const approvalRequest: CommandApprovalRequest | FileChangeApprovalRequest = {
            itemId: request.params.itemId,
            threadId: request.params.threadId,
            turnId: request.params.turnId,
            method: request.method,
            ...request.params,
        };

        // 策略引擎评估
        const decision = this.policyEngine.evaluate(approvalRequest);

        if (decision === 'accept' || decision === 'decline') {
            // 自动批准/拒绝
            const session = this.sessionManager.getSession(sessionId);
            if (session) {
                session.appServer.respondToApproval(request.id, { decision });

                // 审计日志
                this.auditor.log({
                    timestamp: new Date(),
                    userId,
                    sessionId,
                    threadId: approvalRequest.threadId,
                    turnId: approvalRequest.turnId,
                    action: request.method === 'item/commandExecution/requestApproval' ? 'command_execution' : 'file_change',
                    command: (approvalRequest as CommandApprovalRequest).command,
                    changes: (approvalRequest as FileChangeApprovalRequest).changes,
                    decision,
                    approver: 'policy_engine',
                    autoApproved: true,
                });
            }
            return;
        }

        // 需要人工审批 - 设置超时
        const timeout = setTimeout(() => {
            this.handleApprovalTimeout(approvalId);
        }, this.approvalConfig.timeoutMs);

        this.pendingApprovals.set(approvalId, {
            requestId: request.id,
            sessionId,
            userId,
            request: approvalRequest,
            createdAt: new Date(),
            timeout,
        });

        this.sendToUser(userId, {
            type: 'approval/request',
            payload: {
                approvalId,
                ...request.params,
                method: request.method,
            },
        });
    }

    /**
     * 处理 Approval 超时
     */
    private handleApprovalTimeout(approvalId: string): void {
        const pending = this.pendingApprovals.get(approvalId);
        if (!pending) return;

        const session = this.sessionManager.getSession(pending.sessionId);
        if (session) {
            session.appServer.respondToApproval(pending.requestId, {
                decision: this.approvalConfig.defaultAction,
            });

            // 审计日志
            this.auditor.log({
                timestamp: new Date(),
                userId: pending.userId,
                sessionId: pending.sessionId,
                threadId: pending.request.threadId,
                turnId: pending.request.turnId,
                action: pending.request.method === 'item/commandExecution/requestApproval' ? 'command_execution' : 'file_change',
                command: (pending.request as CommandApprovalRequest).command,
                changes: (pending.request as FileChangeApprovalRequest).changes,
                decision: 'timeout',
                approver: 'timeout',
                reason: 'Approval timeout',
                autoApproved: false,
            });
        }

        this.pendingApprovals.delete(approvalId);
    }

    /**
     * 处理 Approval 响应
     */
    private handleApprovalResponse(sessionId: string, payload: any): void {
        const { approvalId, decision, acceptSettings } = payload;
        const pending = this.pendingApprovals.get(approvalId);

        if (!pending || pending.sessionId !== sessionId) {
            console.error(`Invalid approval response: ${approvalId}`);
            return;
        }

        // 清除超时
        clearTimeout(pending.timeout);

        const session = this.sessionManager.getSession(sessionId);
        if (!session) return;

        const response: ApprovalResponse = {
            decision,
            acceptSettings,
        };

        session.appServer.respondToApproval(pending.requestId, response);

        // 审计日志
        this.auditor.log({
            timestamp: new Date(),
            userId: pending.userId,
            sessionId: pending.sessionId,
            threadId: pending.request.threadId,
            turnId: pending.request.turnId,
            action: pending.request.method === 'item/commandExecution/requestApproval' ? 'command_execution' : 'file_change',
            command: (pending.request as CommandApprovalRequest).command,
            changes: (pending.request as FileChangeApprovalRequest).changes,
            decision,
            approver: `user_${pending.userId}`,
            autoApproved: false,
        });

        this.pendingApprovals.delete(approvalId);
    }

    /**
     * 处理断开连接
     */
    private handleDisconnection(connectionId: string): void {
        const connection = this.connections.get(connectionId);
        if (!connection) return;

        this.connections.delete(connectionId);
        this.userConnections.delete(connection.userId);

        console.log(`Client disconnected: ${connectionId}`);
    }

    /**
     * 发送消息给指定连接
     */
    private sendToConnection(connectionId: string, message: ServerMessage): void {
        const connection = this.connections.get(connectionId);
        if (!connection) return;

        try {
            connection.socket.send(JSON.stringify(message));
        } catch (error) {
            console.error(`Failed to send message to ${connectionId}:`, error);
        }
    }

    /**
     * 发送消息给指定用户
     */
    private sendToUser(userId: string, message: ServerMessage): void {
        const connectionId = this.userConnections.get(userId);
        if (connectionId) {
            this.sendToConnection(connectionId, message);
        }
    }

    /**
     * 获取统计信息
     */
    getStats() {
        return {
            totalConnections: this.connections.size,
            pendingApprovals: this.pendingApprovals.size,
        };
    }
}
