import { useEffect, useState } from 'react';
import { Check, FileDiff, Search, Terminal, X, MessageSquare, Lightbulb, Image as ImageIcon, Link2, Shield, ChevronDown, ChevronRight } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import type { StepView } from '../types/ir';
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface StepCardProps {
    step: StepView;
    onApprove: (id: string) => void;
    onDecline: (id: string) => void;
}

function formatKind(kind: StepView['kind']): string {
    switch (kind) {
        case 'assistantMessage': return 'AI 助手';
        case 'userMessage': return '用户';
        case 'reasoning': return '思考中';
        case 'commandExecution': return '命令执行中';
        case 'fileChange': return '文件变更';
        case 'mcpToolCall': return '工具调用';
        case 'collabToolCall': return '协作调用';
        case 'webSearch': return '网络搜索';
        case 'imageView': return '查看图片';
        case 'reviewMode': return '审查模式';
        case 'compacted': return '历史压缩';
        case 'systemNote': return '系统错误';
        default: return '系统';
    }
}

function StatusBadge({ status }: { status: StepView['status'] }) {
    if (status === 'completed' || status === 'inProgress') return null;

    const styles: Record<string, string> = {
        pending: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
        failed: 'bg-destructive/10 text-destructive border-destructive/20',
        declined: 'bg-destructive/10 text-destructive border-destructive/20',
    };

    return (
        <span className={cn("px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border", styles[status])}>
            {status}
        </span>
    );
}

function KindIcon({ kind }: { kind: StepView['kind'] }) {
    const className = "h-3.5 w-3.5";
    switch (kind) {
        case 'assistantMessage': return <MessageSquare className={className} />;
        case 'userMessage': return <MessageSquare className={className} />;
        case 'reasoning': return <Lightbulb className={className} />;
        case 'commandExecution': return <Terminal className={className} />;
        case 'fileChange': return <FileDiff className={className} />;
        case 'mcpToolCall':
        case 'collabToolCall': return <Link2 className={className} />;
        case 'webSearch': return <Search className={className} />;
        case 'imageView': return <ImageIcon className={className} />;
        case 'reviewMode': return <Shield className={className} />;
        case 'systemNote': return <X className={className} />;
        default: return <MessageSquare className={className} />;
    }
}

export function StepCard({ step, onApprove, onDecline }: StepCardProps) {
    const meta = step.meta ?? {};
    const result = step.result ?? {};
    const stream = step.stream;
    const changes = result.changes ?? meta.changes ?? [];

    const isReasoning = step.kind === 'reasoning';
    const isCompacted = step.kind === 'compacted';
    const collapsedPreview = typeof stream === 'string' ? stream.split('\n').filter(Boolean)[0] : '';

    // Default collapsed if confirmed complete reasoning or compacted
    const [isCollapsed, setIsCollapsed] = useState(() => {
        if (isReasoning && step.status === 'completed') return true;
        if (isCompacted) return true;
        return false;
    });

    // Auto-collapse reasoning when it completes
    useEffect(() => {
        if (isReasoning && step.status === 'completed') {
            setIsCollapsed(true);
        }
    }, [step.status, isReasoning]);

    const toggleCollapse = () => setIsCollapsed(!isCollapsed);

    // Dynamic header click handler only for collapsible types
    const handleHeaderClick = () => {
        if (isReasoning || isCompacted) {
            toggleCollapse();
        }
    };

    return (
        <div className={cn(
            "group relative transition-all duration-300 mb-6",
            "font-maple"
        )}>
            {/* Header Line */}
            <div
                className={cn(
                    "flex items-center justify-between mb-2 px-1 select-none",
                    (isReasoning || isCompacted) && "cursor-pointer hover:opacity-80 transition-opacity"
                )}
                onClick={handleHeaderClick}
            >
                <div className="flex items-center gap-2">
                    <div className={cn(
                        "flex items-center justify-center h-6 w-6 rounded-md shadow-sm border transition-colors",
                        step.kind === 'assistantMessage' ? "bg-primary text-primary-foreground border-primary" :
                            step.kind === 'reasoning' ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
                                step.kind === 'systemNote' ? "bg-destructive/10 text-destructive border-destructive/20" :
                                step.kind === 'userMessage' ? "bg-muted text-muted-foreground border-border" :
                                    "bg-muted/50 text-muted-foreground border-border"
                    )}>
                        <KindIcon kind={step.kind} />
                    </div>
                    <span className="font-bold text-xs tracking-wide text-muted-foreground uppercase flex items-center gap-1">
                        {formatKind(step.kind)}
                        {step.status === 'inProgress' && (
                            <span className="flex gap-0.5 ml-0.5">
                                <span className="animate-bounce delay-75">.</span>
                                <span className="animate-bounce delay-150">.</span>
                                <span className="animate-bounce delay-300">.</span>
                            </span>
                        )}
                        {(isReasoning || isCompacted) && (
                            <span className="text-muted-foreground/50 ml-1">
                                {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                            </span>
                        )}
                    </span>
                </div>
                <StatusBadge status={step.status} />
            </div>

            {/* Collapsed view for compacted/reasoning just shows a summary hint */}
            {isCollapsed && (isReasoning || isCompacted) ? (
                <div
                    onClick={toggleCollapse}
                    className="mx-1 px-3 py-2 bg-muted/20 border border-dashed border-border/40 rounded-lg cursor-pointer hover:bg-muted/40 transition-colors text-xs text-muted-foreground"
                    title="点击展开"
                >
                    {isReasoning && collapsedPreview ? `思考过程: ${collapsedPreview}` : '已折叠'}
                </div>
            ) : (
                <Card className={cn(
                    "overflow-hidden transition-all duration-300 border shadow-sm animate-in fade-in slide-in-from-top-1",
                    step.kind === 'assistantMessage' ? "bg-card border-border/60" :
                        step.kind === 'reasoning' ? "bg-amber-500/5 border-amber-500/20" :
                            step.kind === 'userMessage' ? "bg-muted/30 border-border/40" :
                                "bg-card border-border/60"
                )}>
                    <div className="p-4">
                        {/* Content rendering logic ... (unchanged) */}
                        {step.kind === 'userMessage' && (meta.text || meta.content) && (
                            <div className="text-[13px] leading-relaxed text-foreground whitespace-pre-wrap">
                                {meta.text ? meta.text : JSON.stringify(meta.content, null, 2)}
                            </div>
                        )}

                        {step.kind === 'systemNote' && (
                            <div className="space-y-2">
                                <div className="text-[13px] leading-relaxed text-destructive font-medium">
                                    {meta.summary ?? '系统错误'}
                                </div>
                                {meta.details && (
                                    <details className="group/stream" open={false}>
                                        <summary className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 cursor-pointer hover:text-foreground transition-colors select-none">
                                            详情
                                        </summary>
                                        <div className="rounded-md bg-muted/50 border border-border/40 p-3 max-h-56 overflow-y-auto whitespace-pre-wrap font-mono text-[11px] text-foreground/90">
                                            {meta.details}
                                        </div>
                                    </details>
                                )}
                            </div>
                        )}

                        {step.kind === 'commandExecution' && meta.command && (
                            <div className="rounded-md bg-zinc-950 border border-zinc-800 p-3 font-mono text-[11px] overflow-x-auto text-zinc-300 shadow-inner">
                                <div className="flex select-none text-zinc-500 mb-1">$</div>
                                <span className="text-emerald-400">{meta.command}</span>
                                {meta.cwd && <div className="mt-2 text-zinc-500 text-[10px] border-t border-zinc-800 pt-1">in {meta.cwd}</div>}
                            </div>
                        )}

                        {stream && step.kind !== 'systemNote' && (
                            <div className="ir-markdown">
                                {step.kind === 'commandExecution' ? (
                                    <details className="group/stream mt-2" open={false}>
                                        <summary className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1 cursor-pointer hover:text-foreground transition-colors select-none">
                                            <div className="flex items-center gap-1">
                                                <MessageSquare className="h-3 w-3" /> 详情
                                            </div>
                                            <div className="ml-auto opacity-0 group-hover/stream:opacity-100 transition-opacity">
                                                <ChevronDown className="h-3 w-3 group-open/stream:rotate-180 transition-transform" />
                                            </div>
                                        </summary>
                                        <div className="animate-in fade-in slide-in-from-top-1 pl-2 border-l-2 border-border/30">
                                            <ReactMarkdown
                                                remarkPlugins={[remarkGfm, remarkMath]}
                                                rehypePlugins={[rehypeHighlight, rehypeKatex]}
                                            >
                                                {stream}
                                            </ReactMarkdown>
                                        </div>
                                    </details>
                                ) : (
                                    <ReactMarkdown
                                        remarkPlugins={[remarkGfm, remarkMath]}
                                        rehypePlugins={[rehypeHighlight, rehypeKatex]}
                                    >
                                        {stream}
                                    </ReactMarkdown>
                                )}
                            </div>
                        )}

                        {step.kind === 'fileChange' && Array.isArray(changes) && changes.length > 0 && (
                            <div className="space-y-1">
                                {changes.map((change: any, idx: number) => (
                                    <div key={idx} className="flex items-center justify-between bg-muted/40 p-1.5 rounded border border-border/50 text-xs">
                                        <div className="flex items-center gap-2 overflow-hidden">
                                            <span className={cn(
                                                "w-1.5 h-1.5 rounded-full shrink-0",
                                                change.kind === 'add' ? 'bg-emerald-500' :
                                                    change.kind === 'delete' ? 'bg-red-500' :
                                                        'bg-blue-500'
                                            )} />
                                            <span className="font-mono text-muted-foreground truncate" title={change.path}>{change.path}</span>
                                        </div>
                                        <span className={cn(
                                            "text-[10px] font-medium uppercase px-1 rounded",
                                            change.kind === 'add' ? 'text-emerald-500 bg-emerald-500/10' :
                                                change.kind === 'delete' ? 'text-red-500 bg-red-500/10' :
                                                    'text-blue-500 bg-blue-500/10'
                                        )}>{change.kind}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {step.kind === 'mcpToolCall' && (
                            <div className="flex items-center gap-2 text-[11px] text-muted-foreground bg-muted/30 p-2 rounded border border-border/40">
                                <Link2 className="h-3 w-3" />
                                <span>正在调用 </span>
                                <code className="text-foreground font-semibold bg-background px-1 rounded border">{meta.tool}</code>
                                <span> @ </span>
                                <code className="text-foreground bg-background px-1 rounded border">{meta.server}</code>
                            </div>
                        )}

                        {step.result && Object.keys(result).length > 0 && step.kind !== 'fileChange' && (
                            <div className="mt-4 pt-3 border-t border-border/40">
                                {step.kind === 'commandExecution' ? (
                                    <details className="group/details" open={false}>
                                        <summary className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1 cursor-pointer hover:text-foreground transition-colors select-none">
                                            <div className="flex items-center gap-1">
                                                <Terminal className="h-3 w-3" /> 执行结果
                                            </div>
                                            <div className="ml-auto opacity-0 group-hover/details:opacity-100 transition-opacity">
                                                <ChevronDown className="h-3 w-3 group-open/details:rotate-180 transition-transform" />
                                            </div>
                                        </summary>
                                        <div className="rounded-md bg-muted/50 border border-border/40 p-3 max-h-40 overflow-y-auto whitespace-pre-wrap font-mono text-[11px] text-foreground/90 animate-in fade-in slide-in-from-top-1">
                                            {typeof result === 'string' ? result : JSON.stringify(result, null, 2)}
                                        </div>
                                    </details>
                                ) : (
                                    <>
                                        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                                            <Terminal className="h-3 w-3" /> 执行结果
                                        </div>
                                        <div className="rounded-md bg-muted/50 border border-border/40 p-3 max-h-40 overflow-y-auto whitespace-pre-wrap font-mono text-[11px] text-foreground/90">
                                            {typeof result === 'string' ? result : JSON.stringify(result, null, 2)}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        {step.approval?.approvalId && step.status === 'pending' && (
                            <div className="flex gap-2 mt-4 pt-2 border-t border-border/40">
                                <Button
                                    size="sm"
                                    className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                                    onClick={() => onApprove(step.approval!.approvalId)}
                                >
                                    <Check className="mr-1 h-3 w-3" /> 批准
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs border-destructive/30 text-destructive hover:bg-destructive/10"
                                    onClick={() => onDecline(step.approval!.approvalId)}
                                >
                                    <X className="mr-1 h-3 w-3" /> 拒绝
                                </Button>
                            </div>
                        )}

                        {step.status === 'declined' && (
                            <div className="mt-3 flex items-center justify-center p-2 rounded bg-destructive/5 border border-destructive/10 text-xs text-destructive font-medium">
                                <X className="h-3 w-3 mr-1" /> 已拒绝
                            </div>
                        )}
                    </div>
                </Card>
            )}
        </div>
    );
}
