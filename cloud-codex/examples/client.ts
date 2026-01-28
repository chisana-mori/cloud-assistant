import WebSocket from 'ws';
import readline from 'readline';

/**
 * 云端 Codex 客户端示例
 */
class CloudCodexClient {
    private ws: WebSocket | null = null;
    private requestId = 0;
    private pendingRequests = new Map<string, {
        resolve: (value: any) => void;
        reject: (error: Error) => void;
    }>();

    constructor(
        private serverUrl: string,
        private userId: string
    ) { }

    /**
     * 连接到服务器
     */
    async connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(`${this.serverUrl}?userId=${this.userId}`);

            this.ws.on('open', () => {
                console.log('✅ Connected to Cloud Codex');
                resolve();
            });

            this.ws.on('message', (data) => {
                this.handleMessage(data.toString());
            });

            this.ws.on('error', (error) => {
                console.error('WebSocket error:', error);
                reject(error);
            });

            this.ws.on('close', () => {
                console.log('Disconnected from server');
            });
        });
    }

    /**
     * 处理服务器消息
     */
    private handleMessage(data: string): void {
        try {
            const message = JSON.parse(data);

            switch (message.type) {
                case 'response':
                    if (message.requestId) {
                        const pending = this.pendingRequests.get(message.requestId);
                        if (pending) {
                            pending.resolve(message.payload);
                            this.pendingRequests.delete(message.requestId);
                        }
                    } else {
                        console.log('📩 Response:', message.payload);
                    }
                    break;

                case 'event':
                    this.handleEvent(message.payload);
                    break;

                case 'approval/request':
                    this.handleApprovalRequest(message.payload);
                    break;

                case 'error':
                    console.error('❌ Error:', message.payload);
                    if (message.requestId) {
                        const pending = this.pendingRequests.get(message.requestId);
                        if (pending) {
                            pending.reject(new Error(message.payload.message));
                            this.pendingRequests.delete(message.requestId);
                        }
                    }
                    break;
            }
        } catch (error) {
            console.error('Failed to parse message:', error);
        }
    }

    /**
     * 处理事件
     */
    private handleEvent(event: any): void {
        switch (event.method) {
            case 'thread/started':
                console.log('🧵 Thread started:', event.params.thread.id);
                break;

            case 'turn/started':
                console.log('🔄 Turn started');
                break;

            case 'item/started':
                const item = event.params.item;
                console.log(`📝 Item started: ${item.type} (${item.id})`);
                break;

            case 'item/agentMessage/delta':
                process.stdout.write(event.params.delta);
                break;

            case 'item/completed':
                const completedItem = event.params.item;
                if (completedItem.type === 'agentMessage') {
                    console.log('\n✅ Agent response completed');
                } else if (completedItem.type === 'commandExecution') {
                    console.log(`\n✅ Command completed: ${completedItem.command}`);
                    if (completedItem.aggregatedOutput) {
                        console.log(completedItem.aggregatedOutput);
                    }
                } else if (completedItem.type === 'fileChange') {
                    console.log(`\n✅ File changes applied: ${completedItem.changes.length} files`);
                }
                break;

            case 'turn/completed':
                console.log('\n✅ Turn completed');
                break;

            default:
                console.log('📡 Event:', event.method);
        }
    }

    /**
     * 处理 Approval 请求
     */
    private async handleApprovalRequest(payload: any): Promise<void> {
        const { approvalId, method } = payload;

        if (method === 'item/commandExecution/requestApproval') {
            console.log('\n⚠️  Command Approval Required:');
            console.log(`   Command: ${payload.command}`);
            console.log(`   CWD: ${payload.cwd}`);
            if (payload.reason) console.log(`   Reason: ${payload.reason}`);
            if (payload.risk) console.log(`   Risk: ${payload.risk}`);

            const decision = await this.promptUser('Approve? (y/n): ');

            this.send({
                type: 'approval/respond',
                payload: {
                    approvalId,
                    decision: decision.toLowerCase() === 'y' ? 'accept' : 'decline',
                },
            });
        } else if (method === 'item/fileChange/requestApproval') {
            console.log('\n⚠️  File Change Approval Required:');
            payload.changes.forEach((change: any) => {
                console.log(`   ${change.kind.toUpperCase()}: ${change.path}`);
            });

            const decision = await this.promptUser('Approve? (y/n): ');

            this.send({
                type: 'approval/respond',
                payload: {
                    approvalId,
                    decision: decision.toLowerCase() === 'y' ? 'accept' : 'decline',
                },
            });
        }
    }

    /**
     * 提示用户输入
     */
    private promptUser(question: string): Promise<string> {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });

        return new Promise((resolve) => {
            rl.question(question, (answer) => {
                rl.close();
                resolve(answer);
            });
        });
    }

    /**
     * 发送消息
     */
    private send(message: any): void {
        if (!this.ws) {
            throw new Error('Not connected');
        }
        this.ws.send(JSON.stringify(message));
    }

    /**
     * 发送请求并等待响应
     */
    private sendRequest(type: string, payload: any): Promise<any> {
        return new Promise((resolve, reject) => {
            const requestId = `req_${++this.requestId}`;

            this.pendingRequests.set(requestId, { resolve, reject });
            this.send({ type, payload, requestId });

            // 超时
            setTimeout(() => {
                if (this.pendingRequests.has(requestId)) {
                    this.pendingRequests.delete(requestId);
                    reject(new Error('Request timeout'));
                }
            }, 60000);
        });
    }

    /**
     * 启动新线程
     */
    async startThread(params: any = {}): Promise<any> {
        return this.sendRequest('thread/start', params);
    }

    /**
     * 发起对话
     */
    async startTurn(threadId: string, prompt: string): Promise<any> {
        return this.sendRequest('turn/start', {
            threadId,
            input: [{ type: 'text', text: prompt }],
        });
    }

    /**
     * 关闭连接
     */
    close(): void {
        this.ws?.close();
    }
}

// CLI 示例
async function main() {
    const serverUrl = process.env.SERVER_URL || 'ws://localhost:3000/ws';
    const userId = process.env.USER_ID || 'test-user';

    const client = new CloudCodexClient(serverUrl, userId);

    try {
        await client.connect();

        // 启动线程
        const threadResult = await client.startThread({
            model: 'gpt-5.1-codex',
        });
        const threadId = threadResult.thread.id;
        console.log(`Thread ID: ${threadId}`);

        // 发起对话
        console.log('\n💬 Starting conversation...\n');
        await client.startTurn(threadId, 'List files in current directory');

        // 保持连接
        process.on('SIGINT', () => {
            console.log('\nClosing connection...');
            client.close();
            process.exit(0);
        });

    } catch (error) {
        console.error('Error:', error);
        client.close();
        process.exit(1);
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}

export { CloudCodexClient };
