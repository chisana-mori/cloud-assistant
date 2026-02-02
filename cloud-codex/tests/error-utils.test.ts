import { describe, it, expect } from 'vitest';
import { summarizeError } from '../src/core/error-utils.js';

describe('summarizeError', () => {
    it('extracts 401 invalid api key as summary', () => {
        const details = 'ERROR ... http 401 Unauthorized: ... invalid_api_key ...';
        const summary = summarizeError(details);
        expect(summary).toContain('鉴权失败');
        expect(summary).toContain('API Key');
    });

    it('falls back to generic message', () => {
        const summary = summarizeError('some other error');
        expect(summary).toBe('Codex 进程错误');
    });
});
