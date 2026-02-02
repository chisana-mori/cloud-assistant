import { describe, it, expect } from 'vitest';
import { WebSocketGateway } from '../src/gateway/websocket-gateway.js';

describe('WebSocketGateway session-error forwarding', () => {
    it('sends error message to user when session-error is emitted', () => {
        const listeners = new Map<string, Function[]>();
        const sessionManager = {
            on(event: string, listener: Function) {
                if (!listeners.has(event)) listeners.set(event, []);
                listeners.get(event)!.push(listener);
            },
        } as any;

        const gateway = new WebSocketGateway(sessionManager);

        const sent: any[] = [];
        const socket = {
            send: (data: string) => sent.push(JSON.parse(data)),
        } as any;

        const connectionId = 'conn1';
        const userId = 'user1';

        (gateway as any).connections.set(connectionId, {
            id: connectionId,
            userId,
            socket,
            createdAt: new Date(),
        });
        (gateway as any).userConnections.set(userId, connectionId);

        const payload = { summary: '鉴权失败：API Key 无效', details: '401', source: 'stderr', ts: Date.now() };
        const handlers = listeners.get('session-error') || [];
        handlers.forEach((fn) => fn({ userId, error: payload }));

        expect(sent.length).toBe(1);
        expect(sent[0].type).toBe('error');
        expect(sent[0].payload.summary).toContain('鉴权失败');
    });
});
