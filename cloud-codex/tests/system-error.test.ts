import { describe, it, expect } from 'vitest';
import { appendSystemErrorStep, createSystemErrorStep, mergeRunWithSystemErrors } from '../web/src/lib/system-error.js';


describe('appendSystemErrorStep', () => {
    it('creates a systemNote step when run is null', () => {
        const payload = {
            summary: '鉴权失败：API Key 无效',
            details: '401 Unauthorized',
            source: 'stderr',
            ts: 123,
            threadId: 'thr_1',
        };

        const run = appendSystemErrorStep(null, payload);

        expect(run.runId).toBe('thr_1');
        expect(run.steps.length).toBe(1);
        const step = run.steps[0];
        expect(step.kind).toBe('systemNote');
        expect(step.status).toBe('failed');
        expect(step.meta?.summary).toBe(payload.summary);
        expect(step.meta?.details).toBe(payload.details);
    });
});

describe('mergeRunWithSystemErrors', () => {
    it('appends system errors after existing steps', () => {
        const run = { runId: 'thr_1', steps: [{ stepId: 's1', kind: 'userMessage', status: 'completed' }] } as any;
        const err = createSystemErrorStep({
            summary: '鉴权失败：API Key 无效',
            details: '401 Unauthorized',
            source: 'stderr',
            ts: 123,
            threadId: 'thr_1',
        });

        const merged = mergeRunWithSystemErrors(run, [err]);

        expect(merged.steps.length).toBe(2);
        expect(merged.steps[1].kind).toBe('systemNote');
    });
});
