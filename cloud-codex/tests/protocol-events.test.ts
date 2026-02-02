import { describe, it, expect } from 'vitest';
import type { TurnPlanUpdatedEvent } from '../src/types/protocol.js';

describe('protocol event types', () => {
    it('includes turn/plan/updated', () => {
        const e: TurnPlanUpdatedEvent = {
            method: 'turn/plan/updated',
            params: {
                threadId: 'thr',
                turnId: 't',
                plan: [{ step: 'a', status: 'pending' }],
            },
        };
        expect(e.method).toBe('turn/plan/updated');
    });
});
