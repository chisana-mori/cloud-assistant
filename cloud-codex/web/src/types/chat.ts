export interface CodexItem {
    id: string;
    type: 'userMessage' | 'agentMessage' | 'commandExecution' | 'fileChange' | 'reasoning' | 'mcpToolCall';
    content: any;
    status: 'pending' | 'inProgress' | 'completed' | 'failed' | 'declined';
    approvalId?: string;
    command?: string;
    cwd?: string;
    changes?: FileChange[];
    // MCP Tool Call properties
    server?: string;
    tool?: string;
    arguments?: unknown;
    result?: unknown;
    error?: { message: string };
}

export interface FileChange {
    path: string;
    kind: 'add' | 'delete' | 'update';
    diff?: string;
}

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    items: CodexItem[];
}
