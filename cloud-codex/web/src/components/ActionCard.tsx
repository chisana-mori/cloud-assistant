import { Terminal, FileDiff, Check, X } from 'lucide-react';
import type { CodexItem } from '../types/chat';

interface ActionCardProps {
    item: CodexItem;
    onApprove: (id: string) => void;
    onDecline: (id: string) => void;
}

export function ActionCard({ item, onApprove, onDecline }: ActionCardProps) {
    if (item.type === 'commandExecution') {
        return (
            <div className={`
        my-2 p-3 rounded-lg border text-sm
        ${item.status === 'completed' ? 'border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-900/20' :
                    item.status === 'failed' ? 'border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-900/20' :
                        'border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-900/20'}
      `}>
                <div className="flex items-center gap-2 mb-2">
                    <Terminal size={16} className="text-neutral-500" />
                    <span className="font-medium">Command Execution Attempt</span>
                </div>

                <div className="flex flex-col gap-2">
                    <div className="bg-white dark:bg-black/50 p-2 rounded font-mono text-xs overflow-x-auto border dark:border-white/10">
                        $ {item.command}
                    </div>

                    <div className="flex items-center gap-2 text-xs text-neutral-500">
                        <span className="font-semibold">CWD:</span>
                        <code className="bg-neutral-100 dark:bg-neutral-800 px-1 py-0.5 rounded">
                            {item.cwd}
                        </code>
                    </div>

                    {item.status === 'completed' && item.content && (
                        <div className="mt-2 text-xs">
                            <div className="font-semibold mb-1 text-neutral-500">OUTPUT:</div>
                            <pre className="bg-neutral-900 text-green-400 p-2 rounded max-h-32 overflow-y-auto whitespace-pre-wrap">
                                {item.content}
                            </pre>
                        </div>
                    )}

                    {item.approvalId && item.status === 'pending' && (
                        <div className="flex gap-2 mt-2">
                            <button
                                onClick={() => item.approvalId && onApprove(item.approvalId)}
                                className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-xs transition-colors"
                            >
                                <Check size={14} /> Approve & Run
                            </button>
                            <button
                                onClick={() => item.approvalId && onDecline(item.approvalId)}
                                className="flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs transition-colors"
                            >
                                <X size={14} /> Decline
                            </button>
                        </div>
                    )}

                    {item.status === 'declined' && (
                        <div className="text-red-500 text-sm mt-1 flex items-center gap-1">
                            <X size={14} /> Declined by user
                        </div>
                    )}
                </div>
            </div>
        );
    }

    if (item.type === 'fileChange') {
        return (
            <div className="my-2 p-3 rounded-lg border border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-900/20 text-sm">
                <div className="flex items-center gap-2 mb-2">
                    <FileDiff size={16} className="text-blue-500" />
                    <span className="font-medium">File Changes ({item.changes?.length || 0} files)</span>
                </div>

                <div className="flex flex-col gap-2">
                    <div className="max-h-48 overflow-y-auto space-y-2">
                        {item.changes?.map((change, idx) => (
                            <div key={idx} className="bg-white dark:bg-black/50 p-2 rounded border dark:border-white/10">
                                <div className="flex items-center gap-2 text-xs mb-1">
                                    <span className={`
                    px-1.5 py-0.5 rounded font-mono uppercase font-bold
                    ${change.kind === 'add' ? 'bg-green-100 text-green-700' :
                                            change.kind === 'delete' ? 'bg-red-100 text-red-700' :
                                                'bg-blue-100 text-blue-700'}
                  `}>
                                        {change.kind}
                                    </span>
                                    <span className="font-mono text-neutral-600 dark:text-neutral-300">{change.path}</span>
                                </div>
                                {change.diff && (
                                    <pre className="text-xs font-mono overflow-x-auto text-neutral-600 dark:text-neutral-400">
                                        {change.diff}
                                    </pre>
                                )}
                            </div>
                        ))}
                    </div>

                    {item.approvalId && item.status === 'pending' && (
                        <div className="flex gap-2 mt-2">
                            <button
                                onClick={() => item.approvalId && onApprove(item.approvalId)}
                                className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs transition-colors"
                            >
                                <Check size={14} /> Apply Changes
                            </button>
                            <button
                                onClick={() => item.approvalId && onDecline(item.approvalId)}
                                className="flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs transition-colors"
                            >
                                <X size={14} /> Decline
                            </button>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    if (item.type === 'mcpToolCall') {
        return (
            <div className={`
                my-2 p-3 rounded-lg border text-sm
                ${item.status === 'completed' ? 'border-purple-200 bg-purple-50/50 dark:border-purple-900 dark:bg-purple-900/20' :
                    item.status === 'failed' ? 'border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-900/20' :
                        'border-purple-200 bg-purple-50/50 dark:border-purple-900 dark:bg-purple-900/20'}
            `}>
                <div className="flex items-center gap-2 mb-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-500">
                        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                    </svg>
                    <span className="font-medium">MCP Tool Call</span>
                    <span className={`
                        px-1.5 py-0.5 rounded text-xs font-mono
                        ${item.status === 'completed' ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400' :
                            item.status === 'failed' ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400' :
                                'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-400'}
                    `}>
                        {item.status}
                    </span>
                </div>

                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-xs">
                        <span className="font-semibold text-neutral-500">Server:</span>
                        <code className="bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded font-mono text-purple-600 dark:text-purple-400">
                            {item.server}
                        </code>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                        <span className="font-semibold text-neutral-500">Tool:</span>
                        <code className="bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded font-mono text-purple-600 dark:text-purple-400">
                            {item.tool}
                        </code>
                    </div>

                    {item.arguments !== undefined && (
                        <div className="mt-1 text-xs">
                            <div className="font-semibold mb-1 text-neutral-500">ARGUMENTS:</div>
                            <pre className="bg-neutral-900 text-amber-400 p-2 rounded max-h-24 overflow-y-auto whitespace-pre-wrap font-mono text-xs">
                                {JSON.stringify(item.arguments, null, 2)}
                            </pre>
                        </div>
                    )}

                    {item.status === 'completed' && item.result !== undefined && (
                        <div className="mt-1 text-xs">
                            <div className="font-semibold mb-1 text-neutral-500">RESULT:</div>
                            <pre className="bg-neutral-900 text-green-400 p-2 rounded max-h-32 overflow-y-auto whitespace-pre-wrap font-mono text-xs">
                                {typeof item.result === 'string' ? String(item.result) : JSON.stringify(item.result, null, 2)}
                            </pre>
                        </div>
                    )}

                    {item.status === 'failed' && item.error && (
                        <div className="mt-1 text-xs">
                            <div className="font-semibold mb-1 text-red-500">ERROR:</div>
                            <pre className="bg-red-900/50 text-red-300 p-2 rounded max-h-24 overflow-y-auto whitespace-pre-wrap font-mono text-xs">
                                {item.error.message}
                            </pre>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return null;
}
