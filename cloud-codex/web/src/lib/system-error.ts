import type { RunView, StepView } from '../types/ir';

type ErrorPayload = {
    summary?: string;
    details?: string;
    source?: string;
    ts?: number;
    threadId?: string;
    turnId?: string;
};

export function createSystemErrorStep(payload: ErrorPayload): StepView {
    return {
        stepId: `sys_err_${Date.now()}`,
        kind: 'systemNote',
        status: 'failed',
        tsStart: payload.ts ?? Date.now(),
        threadId: payload.threadId,
        turnId: payload.turnId,
        stream: payload.summary ?? '系统错误',
        meta: {
            summary: payload.summary ?? '系统错误',
            details: payload.details,
            source: payload.source,
        },
    };
}

export function mergeRunWithSystemErrors(run: RunView, errors: StepView[]): RunView {
    return {
        ...run,
        steps: [...run.steps, ...errors],
    };
}

export function appendSystemErrorStep(run: RunView | null, payload: ErrorPayload): RunView {
    const baseRun: RunView = run ?? {
        runId: payload.threadId ?? 'local',
        steps: [],
    };
    const step = createSystemErrorStep(payload);
    return mergeRunWithSystemErrors(baseRun, [step]);
}
