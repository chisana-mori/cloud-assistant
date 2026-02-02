import { nanoid } from 'nanoid';
import { CodexAppServer } from '../core/codex-app-server.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { Thread, ApprovalRequest } from '../types/protocol.js';

/**
 * 用户会话状态
 */
export interface Session {
    id: string;
    userId: string;
    appServer: CodexAppServer;
    threads: Map<string, Thread>;
    state: 'initializing' | 'ready' | 'busy' | 'closed';
    createdAt: Date;
    lastActiveAt: Date;
}

/**
 * Session 管理器
 * 负责为每个用户创建和管理独立的 Codex App Server 进程
 */
export class SessionManager {
    private sessions = new Map<string, Session>();
    private userSessions = new Map<string, string>(); // userId -> sessionId

    constructor(
        private workspaceRoot: string = path.join(os.homedir(), '.cloud-codex', 'workspaces'), // 默认改为用户主目录
        private sessionIdleTimeout: number = 30 * 60 * 1000 // 30分钟
    ) {
        // 定期清理空闲会话
        setInterval(() => this.cleanupIdleSessions(), 60000);
    }

    /**
     * 获取或创建用户会话
     */
    async getOrCreateSession(userId: string): Promise<Session> {
        const existingSessionId = this.userSessions.get(userId);

        if (existingSessionId) {
            const session = this.sessions.get(existingSessionId);
            if (session && session.state !== 'closed') {
                session.lastActiveAt = new Date();
                return session;
            }
        }

        return this.createSession(userId);
    }

    /**
     * 创建新会话
     */
    private async createSession(userId: string): Promise<Session> {
        const sessionId = nanoid();
        const workingDirectory = path.join(this.workspaceRoot, userId);  // 使用 path.join 更安全

        // 创建工作目录
        if (!fs.existsSync(workingDirectory)) {
            fs.mkdirSync(workingDirectory, { recursive: true });
        }

        // 创建 App Server 实例
        const appServer = new CodexAppServer(workingDirectory, {
            // Revert HOME override to use system global config (solving auth issues)
        });

        const session: Session = {
            id: sessionId,
            userId,
            appServer,
            threads: new Map(),
            state: 'initializing',
            createdAt: new Date(),
            lastActiveAt: new Date(),
        };

        this.sessions.set(sessionId, session);
        this.userSessions.set(userId, sessionId);

        try {
            // 启动进程
            await appServer.start();

            // 初始化
            await appServer.initialize({
                name: 'cloud_codex',
                title: 'Cloud Codex',
                version: '1.0.0',
            });

            session.state = 'ready';

            // 监听事件
            this.setupEventListeners(session);

            return session;
        } catch (error) {
            session.state = 'closed';
            this.sessions.delete(sessionId);
            this.userSessions.delete(userId);
            throw error;
        }
    }

    /**
     * 设置事件监听
     */
    private setupEventListeners(session: Session): void {
        const { appServer } = session;

        // 转发所有事件
        appServer.on('event', (event) => {
            session.lastActiveAt = new Date();
            // 这里可以通过 EventEmitter 转发给 WebSocket 网关
            this.emit('session-event', {
                sessionId: session.id,
                userId: session.userId,
                event,
            });
        });

        // IR 更新
        appServer.on('ir/update', (run) => {
            session.lastActiveAt = new Date();
            this.emit('ir-update', {
                sessionId: session.id,
                userId: session.userId,
                run,
            });
        });

        // Approval 请求
        appServer.on('approval-request', (request: ApprovalRequest) => {
            session.lastActiveAt = new Date();
            this.emit('approval-request', {
                sessionId: session.id,
                userId: session.userId,
                request,
            });
        });

        // 进程退出
        appServer.on('exit', (code) => {
            console.log(`Session ${session.id} exited with code ${code}`);
            session.state = 'closed';
        });

        // 错误
        appServer.on('error', (error) => {
            console.error(`Session ${session.id} error:`, error);
        });
    }

    /**
     * 获取会话
     */
    getSession(sessionId: string): Session | undefined {
        return this.sessions.get(sessionId);
    }

    /**
     * 获取用户会话
     */
    getUserSession(userId: string): Session | undefined {
        const sessionId = this.userSessions.get(userId);
        return sessionId ? this.sessions.get(sessionId) : undefined;
    }

    /**
     * 销毁会话
     */
    async destroySession(sessionId: string): Promise<void> {
        const session = this.sessions.get(sessionId);
        if (!session) return;

        // 停止进程
        await session.appServer.stop();
        session.state = 'closed';

        this.sessions.delete(sessionId);
        this.userSessions.delete(session.userId);

        // 清理文件系统
        try {
            const workingDirectory = path.join(this.workspaceRoot, session.userId);
            if (fs.existsSync(workingDirectory)) {
                console.log(`Removing workspace: ${workingDirectory}`);
                fs.rmSync(workingDirectory, { recursive: true, force: true });
            }
        } catch (error) {
            console.error(`Failed to cleanup workspace for session ${sessionId}:`, error);
        }
    }

    /**
     * 清理空闲会话
     */
    private cleanupIdleSessions(): void {
        const now = Date.now();

        for (const [sessionId, session] of this.sessions) {
            const idleTime = now - session.lastActiveAt.getTime();

            if (idleTime > this.sessionIdleTimeout && session.state !== 'busy') {
                console.log(`Cleaning up idle session: ${sessionId}`);
                this.destroySession(sessionId);
            }
        }
    }

    /**
     * 获取所有会话统计
     */
    getStats() {
        return {
            totalSessions: this.sessions.size,
            activeSessions: Array.from(this.sessions.values()).filter(s => s.state === 'ready').length,
            busySessions: Array.from(this.sessions.values()).filter(s => s.state === 'busy').length,
        };
    }

    // EventEmitter 方法（简化版）
    private listeners = new Map<string, Function[]>();

    on(event: string, listener: Function): void {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event)!.push(listener);
    }

    private emit(event: string, data: any): void {
        const listeners = this.listeners.get(event) || [];
        listeners.forEach(listener => listener(data));
    }
}
