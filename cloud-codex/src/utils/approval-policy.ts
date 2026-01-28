/**
 * Approval 策略配置和引擎
 */

export interface ApprovalConfig {
    timeoutMs: number;          // 默认 5 分钟
    defaultAction: 'accept' | 'decline';  // 超时默认动作
    autoApprove?: {
        commands?: string[];      // 自动批准的命令
        paths?: string[];         // 自动批准的路径模式
    };
}

export interface ApprovalRequest {
    itemId: string;
    threadId: string;
    turnId: string;
    method: 'item/commandExecution/requestApproval' | 'item/fileChange/requestApproval';
}

export interface CommandApprovalRequest extends ApprovalRequest {
    command: string;
    cwd: string;
    reason?: string;
    risk?: string;
}

export interface FileChangeApprovalRequest extends ApprovalRequest {
    changes: Array<{
        path: string;
        kind: 'add' | 'delete' | 'update';
        diff?: string;
    }>;
    reason?: string;
}

/**
 * Approval 策略引擎
 */
export class ApprovalPolicyEngine {
    private readOnlyCommands = new Set([
        'ls', 'cat', 'grep', 'find', 'head', 'tail', 'less', 'more',
        'pwd', 'echo', 'date', 'whoami', 'which', 'git log', 'git status',
        'git diff', 'git show', 'npm list', 'yarn list'
    ]);

    constructor(private config: ApprovalConfig) { }

    /**
     * 评估是否需要人工审批
     */
    evaluate(request: CommandApprovalRequest | FileChangeApprovalRequest): 'accept' | 'decline' | 'manual' {
        // 检查自动批准规则
        if (request.method === 'item/commandExecution/requestApproval') {
            const cmdRequest = request as CommandApprovalRequest;

            // 只读命令自动批准
            if (this.isReadOnlyCommand(cmdRequest.command)) {
                return 'accept';
            }

            // 白名单命令
            if (this.config.autoApprove?.commands?.some(cmd => cmdRequest.command.startsWith(cmd))) {
                return 'accept';
            }

            // 白名单路径
            if (this.config.autoApprove?.paths?.some(pattern => this.matchPath(cmdRequest.cwd, pattern))) {
                return 'accept';
            }
        }

        // 默认需要人工审批
        return 'manual';
    }

    private isReadOnlyCommand(command: string): boolean {
        // 检查是否包含重定向符号（写入操作）
        if (command.includes('>') || command.includes('>>')) {
            return false;
        }

        const firstWord = command.trim().split(/\s+/)[0];
        return this.readOnlyCommands.has(firstWord);
    }

    private matchPath(path: string, pattern: string): boolean {
        // 简单的通配符匹配
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        return regex.test(path);
    }
}

/**
 * Approval 审计日志
 */
export interface ApprovalAuditLog {
    timestamp: Date;
    userId: string;
    sessionId: string;
    threadId: string;
    turnId: string;
    action: 'command_execution' | 'file_change';
    command?: string;
    changes?: Array<{ path: string; kind: string }>;
    decision: 'accept' | 'decline' | 'timeout';
    approver: string;  // 'user' | 'policy_engine' | 'timeout'
    reason?: string;
    autoApproved: boolean;
}

export class ApprovalAuditor {
    private logs: ApprovalAuditLog[] = [];

    log(entry: ApprovalAuditLog): void {
        this.logs.push(entry);
        // TODO: 持久化到数据库或日志文件
        console.log('[AUDIT]', JSON.stringify(entry));
    }

    getLogs(userId?: string): ApprovalAuditLog[] {
        if (userId) {
            return this.logs.filter(log => log.userId === userId);
        }
        return this.logs;
    }
}
