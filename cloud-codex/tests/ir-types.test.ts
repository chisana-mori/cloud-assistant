import { describe, it, expect } from 'vitest';
import { createEmptyRunView } from '../src/types/ir.js';

describe('IR types', () => {
    it('creates an empty RunView', () => {
        const run = createEmptyRunView('thr_test');
        expect(run.runId).toBe('thr_test');
        expect(run.steps.length).toBe(0);
    });
});
