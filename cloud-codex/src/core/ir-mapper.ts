import {
    createEmptyRunView,
    type ApprovalView,
    type RawEvent,
    type RunView,
    type StepKind,
    type StepView,
} from '../types/ir.js';

type ItemPayload = {
    id: string;
    type: string;
    status?: string;
    content?: Array<{ type: string; text?: string; url?: string; path?: string }>;
    command?: string;
    cwd?: string;
    aggregatedOutput?: string;
    exitCode?: number;
    durationMs?: number;
    changes?: Array<{ path: string; kind: string; diff?: string }>;
    server?: string;
    tool?: string;
    arguments?: unknown;
    result?: unknown;
    error?: { message: string };
    query?: string;
    text?: string;
};

type AnyPayload = Record<string, any> | undefined;

export class IrMapper {
    private rawEvents: RawEvent[] = [];
    private runs = new Map<string, RunView>();
    private steps = new Map<string, StepView>();

    consume(event: RawEvent): RunView | undefined {
        this.rawEvents.push(event);

        const payload = event.payload as AnyPayload;
        const threadId = event.threadId ?? this.extractThreadId(payload);
        if (!threadId) {
            return undefined;
        }
        const turnId = event.turnId ?? this.extractTurnId(payload);
        const run = this.getOrCreateRun(threadId);

        switch (event.type) {
            case 'thread/started': {
                const startedThreadId = payload?.thread?.id ?? threadId;
                const startedRun = this.getOrCreateRun(startedThreadId);
                startedRun.createdAt = event.ts;
                break;
            }
            case 'turn/started': {
                run.status = 'inProgress';
                run.meta = { ...run.meta, lastTurnId: payload?.turn?.id ?? turnId };
                break;
            }
            case 'turn/completed': {
                run.status = payload?.turn?.status ?? run.status ?? 'completed';
                run.meta = { ...run.meta, lastTurnId: payload?.turn?.id ?? turnId };
                if (turnId) {
                    for (const step of run.steps) {
                        if (step.turnId === turnId && step.kind === 'reasoning' && step.status === 'inProgress') {
                            step.status = 'completed';
                            step.tsEnd = event.ts;
                        }
                    }
                }
                break;
            }
            case 'turn/plan/updated': {
                const plan = payload?.plan ?? [];
                const updatedAt = event.ts;
                if (run.plan) {
                    run.plan.history = run.plan.history ?? [];
                    run.plan.history.push({
                        updatedAt: run.plan.updatedAt,
                        steps: run.plan.steps,
                    });
                }
                run.plan = {
                    turnId,
                    updatedAt,
                    explanation: payload?.explanation,
                    steps: plan,
                    history: run.plan?.history,
                };
                break;
            }
            case 'turn/diff/updated': {
                run.diff = {
                    turnId,
                    updatedAt: event.ts,
                    diff: payload?.diff ?? '',
                };
                break;
            }
            case 'thread/tokenUsage/updated': {
                run.tokenUsage = {
                    updatedAt: event.ts,
                    inputTokens: payload?.inputTokens,
                    outputTokens: payload?.outputTokens,
                    totalTokens: payload?.totalTokens,
                };
                break;
            }
            case 'item/started': {
                const item = payload?.item as ItemPayload | undefined;
                if (!item?.id) {
                    break;
                }
                if (item.type !== 'reasoning' && turnId) {
                    for (const step of run.steps) {
                        if (step.turnId === turnId && step.kind === 'reasoning' && step.status === 'inProgress') {
                            step.status = 'completed';
                            step.tsEnd = event.ts;
                        }
                    }
                }
                const step = this.getOrCreateStep(threadId, item.id, this.mapStepKind(item.type), turnId);
                step.status = 'inProgress';
                step.tsStart = event.ts;
                step.meta = { ...step.meta, ...this.extractItemMeta(item) };
                this.appendRawEvent(step, event.id);
                break;
            }
            case 'item/completed': {
                const item = payload?.item as ItemPayload | undefined;
                if (!item?.id) {
                    break;
                }
                const step = this.getOrCreateStep(threadId, item.id, this.mapStepKind(item.type), turnId);
                step.status = item.type === 'reasoning' ? 'completed' : this.mapStatus(item.status);
                step.tsEnd = event.ts;
                step.result = this.extractItemResult(item);
                this.appendRawEvent(step, event.id);
                break;
            }
            case 'item/agentMessage/delta':
            case 'item/reasoning/summaryTextDelta':
            case 'item/reasoning/summaryPartAdded':
            case 'item/reasoning/textDelta':
            case 'item/commandExecution/outputDelta':
            case 'item/fileChange/outputDelta': {
                const itemId = payload?.itemId;
                if (!itemId) {
                    break;
                }
                const kind = this.inferKindFromDelta(event.type);
                const step = this.getOrCreateStep(threadId, itemId, kind, turnId);
                const delta = payload?.delta ?? payload?.text ?? '';
                step.stream = (step.stream ?? '') + String(delta);
                this.appendRawEvent(step, event.id);
                break;
            }
            case 'item/commandExecution/requestApproval':
            case 'item/fileChange/requestApproval': {
                const itemId = payload?.itemId;
                if (!itemId) {
                    break;
                }
                const step = this.getOrCreateStep(threadId, itemId, this.mapApprovalKind(event.type), turnId);
                step.approval = this.buildApproval(event, payload);
                step.status = 'pending';
                this.appendRawEvent(step, event.id);
                break;
            }
            default:
                break;
        }

        return run;
    }

    getRunView(threadId: string): RunView {
        return this.getOrCreateRun(threadId);
    }

    getRawEvents(): RawEvent[] {
        return this.rawEvents;
    }

    private getOrCreateRun(threadId: string): RunView {
        const existing = this.runs.get(threadId);
        if (existing) {
            return existing;
        }
        const run = createEmptyRunView(threadId);
        this.runs.set(threadId, run);
        return run;
    }

    private getOrCreateStep(threadId: string, itemId: string, kind: StepKind, turnId?: string): StepView {
        const key = `${threadId}:${itemId}`;
        const existing = this.steps.get(key);
        if (existing) {
            if (!existing.turnId && turnId) {
                existing.turnId = turnId;
            }
            return existing;
        }
        const step: StepView = {
            stepId: itemId,
            itemId,
            kind,
            status: 'pending',
            threadId,
            turnId,
            rawEventIds: [],
        };
        this.steps.set(key, step);
        const run = this.getOrCreateRun(threadId);
        run.steps.push(step);
        return step;
    }

    private appendRawEvent(step: StepView, eventId: string): void {
        step.rawEventIds = step.rawEventIds ?? [];
        step.rawEventIds.push(eventId);
    }

    private extractThreadId(payload?: AnyPayload): string | undefined {
        return payload?.threadId ?? payload?.turn?.threadId ?? payload?.thread?.id;
    }

    private extractTurnId(payload?: AnyPayload): string | undefined {
        return payload?.turnId ?? payload?.turn?.id;
    }

    private mapStatus(status?: string): StepView['status'] {
        switch (status) {
            case 'completed':
            case 'failed':
            case 'declined':
                return status;
            case 'inProgress':
                return 'inProgress';
            default:
                return 'completed';
        }
    }

    private mapStepKind(itemType: string): StepKind {
        switch (itemType) {
            case 'userMessage':
                return 'userMessage';
            case 'agentMessage':
                return 'assistantMessage';
            case 'reasoning':
                return 'reasoning';
            case 'commandExecution':
                return 'commandExecution';
            case 'fileChange':
                return 'fileChange';
            case 'mcpToolCall':
                return 'mcpToolCall';
            case 'collabToolCall':
                return 'collabToolCall';
            case 'webSearch':
                return 'webSearch';
            case 'imageView':
                return 'imageView';
            case 'enteredReviewMode':
            case 'exitedReviewMode':
                return 'reviewMode';
            case 'compacted':
                return 'compacted';
            default:
                return 'systemNote';
        }
    }

    private mapApprovalKind(method: string): StepKind {
        if (method.includes('commandExecution')) {
            return 'commandExecution';
        }
        if (method.includes('fileChange')) {
            return 'fileChange';
        }
        return 'systemNote';
    }

    private inferKindFromDelta(method: string): StepKind {
        if (method.includes('agentMessage')) {
            return 'assistantMessage';
        }
        if (method.includes('reasoning')) {
            return 'reasoning';
        }
        if (method.includes('commandExecution')) {
            return 'commandExecution';
        }
        if (method.includes('fileChange')) {
            return 'fileChange';
        }
        return 'systemNote';
    }

    private buildApproval(event: RawEvent, payload?: AnyPayload): ApprovalView {
        const approvalId = payload?.approvalId ?? String(event.rpcId ?? event.id);
        return {
            approvalId,
            status: 'pending',
            reason: payload?.reason,
            risk: payload?.risk,
        };
    }

    private extractItemMeta(item: ItemPayload): Record<string, any> | undefined {
        switch (item.type) {
            case 'userMessage': {
                const text = this.flattenUserContent(item.content);
                return { content: item.content, text };
            }
            case 'commandExecution':
                return { command: item.command, cwd: item.cwd };
            case 'fileChange':
                return { changes: item.changes };
            case 'mcpToolCall':
            case 'collabToolCall':
                return { server: item.server, tool: item.tool, arguments: item.arguments };
            case 'webSearch':
                return { query: item.query };
            case 'enteredReviewMode':
            case 'exitedReviewMode':
                return { action: item.type };
            default:
                return undefined;
        }
    }

    private extractItemResult(item: ItemPayload): Record<string, any> | undefined {
        switch (item.type) {
            case 'commandExecution':
                return {
                    output: item.aggregatedOutput,
                    exitCode: item.exitCode,
                    durationMs: item.durationMs,
                };
            case 'fileChange':
                return { changes: item.changes };
            case 'mcpToolCall':
            case 'collabToolCall':
                return { result: item.result, error: item.error };
            default:
                return undefined;
        }
    }

    private flattenUserContent(content?: Array<{ type: string; text?: string }>): string | undefined {
        if (!content || content.length === 0) {
            return undefined;
        }
        const parts = content
            .filter((item) => item.type === 'text' && item.text)
            .map((item) => item.text);
        return parts.length ? parts.join('\n') : undefined;
    }
}
