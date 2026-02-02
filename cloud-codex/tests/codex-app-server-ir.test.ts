import { describe, it, expect } from 'vitest';
import { CodexAppServer } from '../src/core/codex-app-server.js';

describe('CodexAppServer IR emission', () => {
    it('emits ir/update when receiving item/started', () => {
        const server = new CodexAppServer(process.cwd());
        let emitted: any = null;
        server.on('ir/update', (run) => {
            emitted = run;
        });

        (server as any).handleMessage({
            method: 'item/started',
            params: {
                threadId: 'thr1',
                turnId: 't1',
                item: { id: 'i1', type: 'agentMessage', text: '' },
            },
        });

        expect(emitted).not.toBeNull();
        expect(emitted.runId).toBe('thr1');
        expect(emitted.steps.length).toBe(1);
        expect(emitted.steps[0].kind).toBe('assistantMessage');
    });
});
