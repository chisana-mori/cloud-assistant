/**
 * App Server 协议类型定义
 * 基于 JSON-RPC 2.0 over JSONL
 */

// ============ 基础消息类型 ============

export interface JsonRpcRequest {
    method: string;
    id: number | string;
    params?: Record<string, any>;
}

export interface JsonRpcResponse {
    id: number | string;
    result?: any;
    error?: {
        code: number;
        message: string;
    };
}

export interface JsonRpcNotification {
    method: string;
    params?: Record<string, any>;
}

export type JsonRpcMessage = JsonRpcRequest | JsonRpcResponse | JsonRpcNotification;

// ============ 初始化 ============

export interface ClientInfo {
    name: string;
    title: string;
    version: string;
}

export interface InitializeParams {
    clientInfo: ClientInfo;
}

// ============ Thread 相关 ============

export interface Thread {
    id: string;
    model?: string;
    createdAt?: string;
}

export interface ThreadStartParams {
    model?: string;
    workingDirectory?: string;
    sandboxMode?: 'read-only' | 'workspace-write' | 'danger-full-access';
    approvalPolicy?: 'never' | 'on-request' | 'on-failure' | 'untrusted';
}

export interface ThreadResumeParams {
    threadId: string;
}

// ============ Turn 相关 ============

export type InputItem =
    | { type: 'text'; text: string }
    | { type: 'image'; url: string }
    | { type: 'localImage'; path: string };

export interface TurnStartParams {
    threadId: string;
    input: InputItem[];
    model?: string;
    cwd?: string;
}

export interface Turn {
    id: string;
    threadId: string;
    status: 'inProgress' | 'completed' | 'interrupted' | 'failed';
    items: ThreadItem[];
}

// ============ Item 类型 ============

export type ThreadItem =
    | UserMessageItem
    | AgentMessageItem
    | ReasoningItem
    | CommandExecutionItem
    | FileChangeItem
    | McpToolCallItem
    | WebSearchItem;

export interface UserMessageItem {
    id: string;
    type: 'userMessage';
    content: InputItem[];
}

export interface AgentMessageItem {
    id: string;
    type: 'agentMessage';
    text: string;
}

export interface ReasoningItem {
    id: string;
    type: 'reasoning';
    summary: string;
    content: string;
}

export interface CommandExecutionItem {
    id: string;
    type: 'commandExecution';
    command: string;
    cwd: string;
    status: 'inProgress' | 'completed' | 'failed' | 'declined';
    aggregatedOutput?: string;
    exitCode?: number;
    durationMs?: number;
}

export interface FileChangeItem {
    id: string;
    type: 'fileChange';
    changes: Array<{
        path: string;
        kind: 'add' | 'delete' | 'update';
        diff?: string;
    }>;
    status: 'inProgress' | 'completed' | 'failed' | 'declined';
}

export interface McpToolCallItem {
    id: string;
    type: 'mcpToolCall';
    server: string;
    tool: string;
    status: 'inProgress' | 'completed' | 'failed';
    arguments?: unknown;
    result?: unknown;
    error?: { message: string };
}

export interface WebSearchItem {
    id: string;
    type: 'webSearch';
    query: string;
}

// ============ 事件类型 ============

export interface ThreadStartedEvent {
    method: 'thread/started';
    params: {
        thread: Thread;
    };
}

export interface TurnStartedEvent {
    method: 'turn/started';
    params: {
        turn: Turn;
    };
}

export interface TurnCompletedEvent {
    method: 'turn/completed';
    params: {
        turn: Turn;
    };
}

export interface ItemStartedEvent {
    method: 'item/started';
    params: {
        threadId: string;
        turnId: string;
        item: ThreadItem;
    };
}

export interface ItemCompletedEvent {
    method: 'item/completed';
    params: {
        threadId: string;
        turnId: string;
        item: ThreadItem;
    };
}

export interface ItemDeltaEvent {
    method: 'item/agentMessage/delta' | 'item/reasoning/delta';
    params: {
        threadId: string;
        turnId: string;
        itemId: string;
        delta: string;
    };
}

// ============ Approval 相关 ============

export interface CommandApprovalRequest extends JsonRpcRequest {
    method: 'item/commandExecution/requestApproval';
    params: {
        threadId: string;
        turnId: string;
        itemId: string;
        command: string;
        cwd: string;
        reason?: string;
        risk?: string;
        parsedCmd?: {
            program: string;
            args: string[];
        };
    };
}

export interface FileChangeApprovalRequest extends JsonRpcRequest {
    method: 'item/fileChange/requestApproval';
    params: {
        threadId: string;
        turnId: string;
        itemId: string;
        changes: Array<{
            path: string;
            kind: 'add' | 'delete' | 'update';
            diff?: string;
        }>;
        reason?: string;
    };
}

export interface ApprovalResponse {
    decision: 'accept' | 'decline';
    acceptSettings?: {
        // 可选的接受设置
        [key: string]: any;
    };
}

export type ApprovalRequest = CommandApprovalRequest | FileChangeApprovalRequest;

// ============ 错误类型 ============

export interface ThreadError {
    message: string;
    codexErrorInfo?: {
        type: 'ContextWindowExceeded' | 'UsageLimitExceeded' | 'HttpConnectionFailed' |
        'ResponseStreamConnectionFailed' | 'ResponseStreamDisconnected' |
        'ResponseTooManyFailedAttempts' | 'BadRequest' | 'Unauthorized' |
        'SandboxError' | 'InternalServerError' | 'Other';
        httpStatusCode?: number;
    };
    additionalDetails?: string;
}
