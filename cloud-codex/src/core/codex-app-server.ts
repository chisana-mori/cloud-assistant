import { spawn, ChildProcess } from 'child_process';
import readline from 'readline';
import { EventEmitter } from 'events';
import type {
    JsonRpcMessage,
    JsonRpcRequest,
    JsonRpcResponse,
    JsonRpcNotification,
    InitializeParams,
    ThreadStartParams,
    TurnStartParams,
    ApprovalRequest,
    ApprovalResponse,
} from '../types/protocol.js';

/**
 * Codex App Server 进程封装
 * 负责启动 codex app-server 进程并处理 JSONL 通信
 */
export class CodexAppServer extends EventEmitter {
    private process: ChildProcess | null = null;
    private rl: readline.Interface | null = null;
    private requestId = 0;
    private pendingRequests = new Map<number | string, {
        resolve: (value: any) => void;
        reject: (error: Error) => void;
    }>();

    constructor(
        private workingDirectory: string,
        private env?: Record<string, string>
    ) {
        super();
    }

    /**
     * 启动 codex app-server 进程
     */
    async start(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.process = spawn('codex', [
                'app-server',
                '-c', 'base_instructions = "你是一名杰出的运维管理专家，熟知应用关联资产以及应用属性"'
            ], {
                cwd: this.workingDirectory,
                stdio: ['pipe', 'pipe', 'pipe'],
                env: {
                    ...process.env,
                    ...this.env,
                },
            });

            if (!this.process.stdout || !this.process.stdin) {
                reject(new Error('Failed to create process stdio'));
                return;
            }

            // 监听 stdout
            this.rl = readline.createInterface({
                input: this.process.stdout,
            });

            this.rl.on('line', (line) => {
                try {
                    const message = JSON.parse(line) as JsonRpcMessage;
                    this.handleMessage(message);
                } catch (error) {
                    console.error('Failed to parse JSONL:', line, error);
                }
            });

            // 监听 stderr
            this.process.stderr?.on('data', (data) => {
                console.error('Codex stderr:', data.toString());
            });

            // 监听进程退出
            this.process.on('exit', (code) => {
                this.emit('exit', code);
            });

            this.process.on('error', (error) => {
                this.emit('error', error);
                reject(error);
            });

            resolve();
        });
    }

    /**
     * 初始化握手
     */
    async initialize(clientInfo: InitializeParams['clientInfo']): Promise<any> {
        const result = await this.sendRequest('initialize', { clientInfo });
        await this.sendNotification('initialized', {});
        return result;
    }

    /**
     * 发送请求并等待响应
     */
    private sendRequest(method: string, params?: any): Promise<any> {
        return new Promise((resolve, reject) => {
            const id = ++this.requestId;
            const request: JsonRpcRequest = { method, id, params };

            this.pendingRequests.set(id, { resolve, reject });
            this.send(request);

            // 设置超时
            setTimeout(() => {
                if (this.pendingRequests.has(id)) {
                    this.pendingRequests.delete(id);
                    reject(new Error(`Request timeout: ${method}`));
                }
            }, 60000); // 60s 超时
        });
    }

    /**
     * 发送通知（不等待响应）
     */
    private sendNotification(method: string, params?: any): void {
        const notification: JsonRpcNotification = { method, params };
        this.send(notification);
    }

    /**
     * 发送消息到进程
     */
    private send(message: JsonRpcMessage): void {
        if (!this.process?.stdin) {
            throw new Error('Process not started');
        }
        const line = JSON.stringify(message) + '\n';
        this.process.stdin.write(line);
    }

    /**
     * 处理接收到的消息
     */
    private handleMessage(message: JsonRpcMessage): void {
        // 响应消息
        if ('id' in message && ('result' in message || 'error' in message)) {
            const response = message as JsonRpcResponse;
            const pending = this.pendingRequests.get(response.id);

            if (pending) {
                this.pendingRequests.delete(response.id);
                if (response.error) {
                    pending.reject(new Error(response.error.message));
                } else {
                    pending.resolve(response.result);
                }
            }
            return;
        }

        // 请求消息（Approval 请求）
        if ('id' in message && 'method' in message) {
            const request = message as JsonRpcRequest;

            if (request.method === 'item/commandExecution/requestApproval' ||
                request.method === 'item/fileChange/requestApproval') {
                this.emit('approval-request', request);
            }
            return;
        }

        // 通知消息（事件）
        if ('method' in message && !('id' in message)) {
            const notification = message as JsonRpcNotification;
            this.emit('event', notification);
        }
    }

    /**
     * 响应 Approval 请求
     */
    respondToApproval(requestId: number | string, response: ApprovalResponse): void {
        const rpcResponse: JsonRpcResponse = {
            id: requestId,
            result: response,
        };
        this.send(rpcResponse);
    }

    /**
     * Thread API
     */
    async startThread(params: ThreadStartParams): Promise<any> {
        return this.sendRequest('thread/start', params);
    }

    async resumeThread(threadId: string): Promise<any> {
        return this.sendRequest('thread/resume', { threadId });
    }

    /**
     * Turn API
     */
    async startTurn(params: TurnStartParams): Promise<any> {
        return this.sendRequest('turn/start', params);
    }

    async interruptTurn(turnId: string): Promise<any> {
        return this.sendRequest('turn/interrupt', { turnId });
    }

    /**
     * 停止进程
     */
    async stop(): Promise<void> {
        if (this.process) {
            this.process.kill();
            this.process = null;
        }
        if (this.rl) {
            this.rl.close();
            this.rl = null;
        }
    }
}
