import { describe, it, expect } from 'vitest';
import { IrMapper } from '../src/core/ir-mapper.js';

describe('IrMapper', () => {
    it('maps item/started and item/completed into a StepView', () => {
        const mapper = new IrMapper();
        mapper.consume({
            id: 'evt1',
            ts: 1,
            threadId: 'thr1',
            turnId: 't1',
            type: 'item/started',
            payload: {
                threadId: 'thr1',
                turnId: 't1',
                item: { id: 'i1', type: 'commandExecution', command: 'ls', cwd: '/' },
            },
        });
        mapper.consume({
            id: 'evt2',
            ts: 2,
            threadId: 'thr1',
            turnId: 't1',
            type: 'item/completed',
            payload: {
                threadId: 'thr1',
                turnId: 't1',
                item: { id: 'i1', type: 'commandExecution', aggregatedOutput: 'ok', status: 'completed' },
            },
        });

        const run = mapper.getRunView('thr1');
        expect(run.steps.length).toBe(1);
        expect(run.steps[0].kind).toBe('commandExecution');
        expect(run.steps[0].status).toBe('completed');
        expect(run.steps[0].result.output).toBe('ok');
    });
});
