import { describe, it, expect } from 'vitest';
import { ApprovalPolicyEngine, type ApprovalConfig, type CommandApprovalRequest } from '../src/utils/approval-policy.js';

const config: ApprovalConfig = {
    timeoutMs: 5 * 60 * 1000,
    defaultAction: 'decline',
    autoApprove: {
        commands: ['npm install', 'git clone'],
        paths: ['/tmp/*', '/workspace/test/*'],
    },
};

const engine = new ApprovalPolicyEngine(config);

const testCases: Array<{
    name: string;
    request: CommandApprovalRequest;
    expected: 'accept' | 'decline' | 'manual';
}> = [
        {
            name: '只读命令 - ls',
            request: {
                itemId: '1',
                threadId: 't1',
                turnId: 'turn1',
                method: 'item/commandExecution/requestApproval',
                command: 'ls -la',
                cwd: '/home/user',
            },
            expected: 'accept',
        },
        {
            name: '只读命令 - cat',
            request: {
                itemId: '2',
                threadId: 't1',
                turnId: 'turn1',
                method: 'item/commandExecution/requestApproval',
                command: 'cat package.json',
                cwd: '/home/user',
            },
            expected: 'accept',
        },
        {
            name: '白名单命令 - npm install',
            request: {
                itemId: '3',
                threadId: 't1',
                turnId: 'turn1',
                method: 'item/commandExecution/requestApproval',
                command: 'npm install express',
                cwd: '/home/user',
            },
            expected: 'accept',
        },
        {
            name: '白名单路径 - /tmp',
            request: {
                itemId: '4',
                threadId: 't1',
                turnId: 'turn1',
                method: 'item/commandExecution/requestApproval',
                command: 'rm -rf test.txt',
                cwd: '/tmp/mytest',
            },
            expected: 'accept',
        },
        {
            name: '危险命令 - rm -rf',
            request: {
                itemId: '5',
                threadId: 't1',
                turnId: 'turn1',
                method: 'item/commandExecution/requestApproval',
                command: 'rm -rf /',
                cwd: '/home/user',
            },
            expected: 'manual',
        },
        {
            name: '写入命令 - echo',
            request: {
                itemId: '6',
                threadId: 't1',
                turnId: 'turn1',
                method: 'item/commandExecution/requestApproval',
                command: 'echo "test" > file.txt',
                cwd: '/home/user',
            },
            expected: 'manual',
        },
];

describe('ApprovalPolicyEngine', () => {
    it('evaluates approval decisions for known commands and paths', () => {
        for (const testCase of testCases) {
            const result = engine.evaluate(testCase.request);
            expect(result, testCase.name).toBe(testCase.expected);
        }
    });
});
