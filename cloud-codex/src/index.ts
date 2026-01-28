import Fastify from 'fastify';
import * as os from 'os';
import * as path from 'path';
import websocket from '@fastify/websocket';
import { SessionManager } from './session/session-manager.js';
import { WebSocketGateway } from './gateway/websocket-gateway.js';

/**
 * 云端 Codex 服务器
 */
export class CloudCodexServer {
    private fastify = Fastify({ logger: true });
    private sessionManager: SessionManager;
    private wsGateway: WebSocketGateway;

    constructor(
        private port: number = 3000,
        private workspaceRoot: string = path.join(os.homedir(), '.cloud-codex', 'workspaces')
    ) {
        this.sessionManager = new SessionManager(workspaceRoot);
        this.wsGateway = new WebSocketGateway(this.sessionManager);
    }

    /**
     * 初始化服务器
     */
    async initialize(): Promise<void> {
        // 注册 WebSocket 插件
        await this.fastify.register(websocket);

        // 健康检查
        this.fastify.get('/health', async () => {
            return {
                status: 'ok',
                sessions: this.sessionManager.getStats(),
                connections: this.wsGateway.getStats(),
            };
        });

        // WebSocket 端点
        this.fastify.register(async (fastify) => {
            fastify.get('/ws', { websocket: true }, (socket, req) => {
                // 简单的认证：从查询参数获取 userId
                const userId = (req.query as any).userId || 'anonymous';

                console.log(`New WebSocket connection from user: ${userId}`);
                this.wsGateway.handleConnection(socket, userId);
            });
        });

        // REST API - Session 管理
        this.fastify.get('/api/sessions/stats', async () => {
            return this.sessionManager.getStats();
        });

        // REST API - Thread 管理（可选）
        this.fastify.post('/api/threads', async (request, reply) => {
            const { userId, ...params } = request.body as any;

            try {
                const session = await this.sessionManager.getOrCreateSession(userId);
                const result = await session.appServer.startThread(params);
                return result;
            } catch (error) {
                reply.code(500).send({
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        });
    }

    /**
     * 启动服务器
     */
    async start(): Promise<void> {
        await this.initialize();

        await this.fastify.listen({
            port: this.port,
            host: '0.0.0.0',
        });

        console.log(`Cloud Codex Server started on port ${this.port}`);
        console.log(`WebSocket endpoint: ws://localhost:${this.port}/ws?userId=<your-user-id>`);
        console.log(`Health check: http://localhost:${this.port}/health`);
    }

    /**
     * 停止服务器
     */
    async stop(): Promise<void> {
        await this.fastify.close();
    }
}

// 启动服务器
if (import.meta.url === `file://${process.argv[1]}`) {
    const server = new CloudCodexServer(
        parseInt(process.env.PORT || '3000'),
        process.env.WORKSPACE_ROOT || path.join(os.homedir(), '.cloud-codex', 'workspaces')
    );

    server.start().catch((error) => {
        console.error('Failed to start server:', error);
        process.exit(1);
    });

    // 优雅关闭
    process.on('SIGINT', async () => {
        console.log('Shutting down...');
        await server.stop();
        process.exit(0);
    });
}
