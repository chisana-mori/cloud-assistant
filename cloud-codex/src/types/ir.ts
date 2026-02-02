export type RawEvent = {
    id: string;
    ts: number;
    threadId?: string;
    turnId?: string;
    type: string;
    payload: unknown;
    rpcId?: number | string;
};

export type StepKind =
    | 'userMessage'
    | 'assistantMessage'
    | 'reasoning'
    | 'commandExecution'
    | 'fileChange'
    | 'mcpToolCall'
    | 'collabToolCall'
    | 'webSearch'
    | 'imageView'
    | 'reviewMode'
    | 'compacted'
    | 'systemNote';

export type ApprovalView = {
    approvalId: string;
    status: 'pending' | 'accepted' | 'declined';
    reason?: string;
    risk?: string;
};

export type StepView = {
    stepId: string;
    kind: StepKind;
    threadId?: string;
    turnId?: string;
    itemId?: string;
    tsStart?: number;
    tsEnd?: number;
    status: 'pending' | 'inProgress' | 'completed' | 'failed' | 'declined';
    title?: string;
    summary?: string;
    stream?: string;
    result?: any;
    approval?: ApprovalView;
    meta?: Record<string, any>;
    rawEventIds?: string[];
};

export type PlanView = {
    turnId?: string;
    updatedAt: number;
    explanation?: string;
    steps: Array<{ step: string; status: 'pending' | 'inProgress' | 'completed' }>;
    history?: Array<{
        updatedAt: number;
        steps: Array<{ step: string; status: 'pending' | 'inProgress' | 'completed' }>;
    }>;
};

export type TurnDiffView = {
    turnId?: string;
    updatedAt: number;
    diff: string;
};

export type TokenUsage = {
    updatedAt: number;
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
};

export type RunView = {
    runId: string;
    createdAt?: number;
    status?: 'inProgress' | 'completed' | 'failed' | 'interrupted';
    meta?: Record<string, any>;
    steps: StepView[];
    plan?: PlanView;
    diff?: TurnDiffView;
    tokenUsage?: TokenUsage;
};

export function createEmptyRunView(runId: string): RunView {
    return { runId, steps: [] };
}
