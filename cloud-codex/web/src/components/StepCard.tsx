import { Check, FileDiff, Search, Terminal, X, MessageSquare, Lightbulb, Image as ImageIcon, Link2, Shield } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import type { StepView } from '../types/ir';

interface StepCardProps {
    step: StepView;
    onApprove: (id: string) => void;
    onDecline: (id: string) => void;
}

function formatKind(kind: StepView['kind']): string {
    switch (kind) {
        case 'assistantMessage':
            return 'Assistant Message';
        case 'userMessage':
            return 'User Message';
        case 'reasoning':
            return 'Reasoning';
        case 'commandExecution':
            return 'Command Execution';
        case 'fileChange':
            return 'File Change';
        case 'mcpToolCall':
            return 'MCP Tool Call';
        case 'collabToolCall':
            return 'Collab Tool Call';
        case 'webSearch':
            return 'Web Search';
        case 'imageView':
            return 'Image View';
        case 'reviewMode':
            return 'Review Mode';
        case 'compacted':
            return 'Context Compaction';
        default:
            return 'System';
    }
}

function StatusBadge({ status }: { status: StepView['status'] }) {
    const colors = {
        pending: 'bg-amber-100 text-amber-700',
        inProgress: 'bg-sky-100 text-sky-700',
        completed: 'bg-emerald-100 text-emerald-700',
        failed: 'bg-rose-100 text-rose-700',
        declined: 'bg-rose-100 text-rose-700',
    }[status];

    return (
        <span className={`px-2 py-0.5 rounded-full text-[11px] font-mono ${colors}`}>
            {status}
        </span>
    );
}

function KindIcon({ kind }: { kind: StepView['kind'] }) {
    switch (kind) {
        case 'assistantMessage':
            return <MessageSquare size={16} className="text-emerald-600" />;
        case 'userMessage':
            return <MessageSquare size={16} className="text-slate-500" />;
        case 'reasoning':
            return <Lightbulb size={16} className="text-amber-500" />;
        case 'commandExecution':
            return <Terminal size={16} className="text-slate-500" />;
        case 'fileChange':
            return <FileDiff size={16} className="text-indigo-600" />;
        case 'mcpToolCall':
        case 'collabToolCall':
            return <Link2 size={16} className="text-purple-600" />;
        case 'webSearch':
            return <Search size={16} className="text-sky-600" />;
        case 'imageView':
            return <ImageIcon size={16} className="text-pink-500" />;
        case 'reviewMode':
            return <Shield size={16} className="text-amber-600" />;
        default:
            return <MessageSquare size={16} className="text-slate-500" />;
    }
}

function kindAccent(kind: StepView['kind']) {
    switch (kind) {
        case 'assistantMessage':
            return 'border-emerald-300/60 bg-emerald-50/40';
        case 'reasoning':
            return 'border-amber-300/60 bg-amber-50/40';
        case 'commandExecution':
            return 'border-slate-300/60 bg-slate-50/40';
        case 'fileChange':
            return 'border-indigo-300/60 bg-indigo-50/40';
        case 'mcpToolCall':
        case 'collabToolCall':
            return 'border-purple-300/60 bg-purple-50/40';
        case 'webSearch':
            return 'border-sky-300/60 bg-sky-50/40';
        case 'imageView':
            return 'border-pink-300/60 bg-pink-50/40';
        case 'reviewMode':
            return 'border-amber-300/60 bg-amber-50/40';
        case 'userMessage':
            return 'border-slate-300/60 bg-white';
        default:
            return 'border-slate-200 bg-white';
    }
}

export function StepCard({ step, onApprove, onDecline }: StepCardProps) {
    const meta = step.meta ?? {};
    const result = step.result ?? {};
    const stream = step.stream;

    const changes = result.changes ?? meta.changes ?? [];

    return (
        <div className={`my-3 rounded-2xl border-l-4 border border-slate-200 dark:border-slate-800 shadow-sm ${kindAccent(step.kind)} dark:bg-[#2a2a2a]`}>
            <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-white/80 dark:bg-black/30 flex items-center justify-center border border-white/60 dark:border-white/10">
                            <KindIcon kind={step.kind} />
                        </div>
                        <span className="font-semibold text-sm">{formatKind(step.kind)}</span>
                    </div>
                    <StatusBadge status={step.status} />
                </div>

                {step.kind === 'userMessage' && (meta.text || meta.content) && (
                    <div className="mt-1 text-sm bg-slate-100 dark:bg-slate-800 rounded-xl px-3 py-2">
                        {meta.text ? meta.text : JSON.stringify(meta.content, null, 2)}
                    </div>
                )}

                {step.kind === 'commandExecution' && meta.command && (
                    <div className="bg-slate-900 text-emerald-300 p-2 rounded font-mono text-xs overflow-x-auto">
                        $ {meta.command}
                    </div>
                )}

                {step.kind === 'commandExecution' && meta.cwd && (
                    <div className="text-xs text-slate-500 mt-1">
                        CWD: <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">{meta.cwd}</code>
                    </div>
                )}

                {stream && (
                    <div className="mt-2 ir-markdown">
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm, remarkMath]}
                            rehypePlugins={[rehypeHighlight, rehypeKatex]}
                        >
                            {stream}
                        </ReactMarkdown>
                    </div>
                )}

                {step.kind === 'fileChange' && Array.isArray(changes) && changes.length > 0 && (
                    <div className="mt-3 space-y-2">
                        {changes.map((change: any, idx: number) => (
                            <div key={idx} className="bg-white/80 dark:bg-black/40 p-2 rounded border dark:border-white/10">
                                <div className="flex items-center gap-2 text-xs mb-1">
                                    <span className={`
                                        px-1.5 py-0.5 rounded font-mono uppercase font-bold
                                        ${change.kind === 'add' ? 'bg-green-100 text-green-700' :
                                        change.kind === 'delete' ? 'bg-red-100 text-red-700' :
                                            'bg-blue-100 text-blue-700'}
                                    `}>
                                        {change.kind}
                                    </span>
                                    <span className="font-mono text-slate-600 dark:text-slate-300">{change.path}</span>
                                </div>
                                {change.diff && (
                                    <pre className="text-xs font-mono overflow-x-auto text-slate-600 dark:text-slate-400">
                                        {change.diff}
                                    </pre>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {step.kind === 'mcpToolCall' && (
                    <div className="mt-2 text-xs space-y-1">
                        {meta.server && (
                            <div>
                                <span className="font-semibold text-slate-500">Server:</span>{' '}
                                <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded font-mono text-purple-600 dark:text-purple-400">
                                    {meta.server}
                                </code>
                            </div>
                        )}
                        {meta.tool && (
                            <div>
                                <span className="font-semibold text-slate-500">Tool:</span>{' '}
                                <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded font-mono text-purple-600 dark:text-purple-400">
                                    {meta.tool}
                                </code>
                            </div>
                        )}
                    </div>
                )}

                {step.kind === 'webSearch' && meta.query && (
                    <div className="mt-2 text-xs text-slate-600">
                        Query: <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">{meta.query}</code>
                    </div>
                )}

                {step.result && Object.keys(result).length > 0 && step.kind !== 'fileChange' && (
                    <div className="mt-3 text-xs">
                        <div className="font-semibold mb-1 text-slate-500">RESULT:</div>
                        <pre className="bg-slate-900 text-green-300 p-2 rounded max-h-40 overflow-y-auto whitespace-pre-wrap font-mono text-xs">
                            {typeof result === 'string' ? result : JSON.stringify(result, null, 2)}
                        </pre>
                    </div>
                )}

                {step.approval?.approvalId && step.status === 'pending' && (
                    <div className="flex gap-2 mt-3">
                        <button
                            onClick={() => onApprove(step.approval!.approvalId)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs transition-colors"
                        >
                            <Check size={14} /> Approve
                        </button>
                        <button
                            onClick={() => onDecline(step.approval!.approvalId)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs transition-colors"
                        >
                            <X size={14} /> Decline
                        </button>
                    </div>
                )}

                {step.status === 'declined' && (
                    <div className="text-rose-500 text-sm mt-2 flex items-center gap-1">
                        <X size={14} /> Declined by user
                    </div>
                )}
            </div>
        </div>
    );
}
