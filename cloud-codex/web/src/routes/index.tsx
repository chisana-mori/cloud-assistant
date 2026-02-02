import { useState, useEffect, useRef } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useCodexStream } from '@/hooks/useCodexStream'
import { StepCard } from '@/components/StepCard'
import { nanoid } from 'nanoid'
import { Send, Bot, Settings, Loader, LayoutList, SquarePen, ChevronUp, ChevronDown, Package, Server, HardDrive, Database, Network, Terminal } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

export const Route = createFileRoute('/')({
    component: Index,
})

function Index() {
    const [inputValue, setInputValue] = useState('')
    const [userId] = useState(() => localStorage.getItem('userId') || nanoid())
    const messagesEndRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        localStorage.setItem('userId', userId)
    }, [userId])

    const { status, startTurn, respondApproval, initThread: initThreadApi, isThinking, runView } = useCodexStream({
        userId,
    })

    const [currentThreadId, setCurrentThreadId] = useState<string | null>(null)

    // 当连接成功时自动初始化线程
    useEffect(() => {
        if (status === 'connected' && !currentThreadId) {
            console.log('Initializing new thread...');
            initThreadApi({
                // Let backend use default model from ~/.codex/config.toml
            }).then((result: any) => {
                console.log('Thread initialized:', result);
                if (result && result.thread && result.thread.id) {
                    setCurrentThreadId(result.thread.id);
                }
            }).catch(err => {
                console.error('Failed to initialize thread:', err);
            });
        }
    }, [status, currentThreadId, initThreadApi])

    const [isPlanCollapsed, setIsPlanCollapsed] = useState(false)
    const [tempUserMessage, setTempUserMessage] = useState<string | null>(null)

    // Clear temp message when real message appears or thinking stops
    useEffect(() => {
        if (!isThinking) {
            setTempUserMessage(null)
        } else if (runView?.steps?.length) {
            const lastStep = runView.steps[runView.steps.length - 1]
            if (lastStep.kind === 'userMessage') {
                setTempUserMessage(null)
            }
        }
    }, [runView, isThinking])

    const isResponding = isThinking || !!runView?.steps?.some((step) =>
        step.status === 'inProgress' && (step.kind === 'assistantMessage' || step.kind === 'reasoning')
    )

    // 自动滚动到底部
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [runView])

    const sendMessage = (text: string) => {
        if (!text.trim()) return
        if (!currentThreadId) {
            console.warn('Thread not initialized yet');
            return;
        }
        setTempUserMessage(text)
        startTurn(currentThreadId, text)
        setInputValue('')
    }

    const handleSend = () => sendMessage(inputValue)

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    // 手动重置线程
    const handleResetThread = () => {
        initThreadApi({
            // Use default model from config
        }).then((result: any) => {
            if (result && result.thread && result.thread.id) {
                setCurrentThreadId(result.thread.id);
            }
        });
    }

    return (
        <div className="flex h-screen w-full bg-background text-foreground overflow-hidden">
            {/* Sidebar */}
            <aside className="hidden md:flex w-[280px] flex-col border-r bg-muted/10">
                {/* Sidebar Header - Aligned with Main Header */}
                <div className="h-14 flex items-center px-4 border-b">
                    <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-lg bg-primary flex items-center justify-center">
                            <Bot className="h-4 w-4 text-primary-foreground" />
                        </div>
                        <span className="font-bold text-lg tracking-tight">Cloud Codex</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent text-accent-foreground font-medium">v1.0</span>
                    </div>
                </div>

                <div className="flex-1 overflow-hidden py-4">
                    <div className="px-4 mb-2 flex items-center justify-between group">
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Recent Activity
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-foreground"
                            onClick={handleResetThread}
                            title="New Chat"
                        >
                            <SquarePen className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                    <ScrollArea className="h-full px-2">
                        <Button variant="ghost" className="w-full justify-start h-auto py-3 px-3 mb-1 text-left font-normal bg-accent/50">
                            <div className="flex flex-col gap-1 w-full overflow-hidden">
                                <span className="font-medium text-sm truncate">Default Thread</span>
                                <span className="text-xs text-muted-foreground truncate">
                                    {runView?.steps?.length
                                        ? (runView.steps[runView.steps.length - 1].summary || runView.steps[runView.steps.length - 1].stream || 'System Activity').toString().slice(0, 30)
                                        : 'No messages yet...'}
                                </span>
                            </div>
                        </Button>
                    </ScrollArea>
                </div>

                <div className="p-4 border-t px-4 min-h-[162px] flex flex-col justify-end">
                    <Button variant="ghost" className="w-full justify-start gap-2">
                        <Settings className="h-4 w-4" />
                        Settings
                    </Button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col h-full relative">
                {/* Header */}
                <header className="h-14 flex items-center justify-between px-6 border-b bg-background/50 backdrop-blur supports-[backdrop-filter]:bg-background/20 sticky top-0 z-10 w-full">
                    <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">Default Session</span>
                        <div className={cn("h-1.5 w-1.5 rounded-full animate-pulse", status === 'connected' ? 'bg-emerald-500' : 'bg-destructive')} />
                    </div>

                    <div className="flex items-center gap-2">
                        {!runView?.steps?.length && status === 'connected' && (
                            <Button variant="outline" size="sm" onClick={handleResetThread} className="h-8 text-xs">
                                Reset
                            </Button>
                        )}
                    </div>
                </header>

                {/* Messages Area */}
                <div className="flex-1 overflow-hidden w-full relative">
                    <ScrollArea className="h-full w-full">
                        <div className="max-w-3xl mx-auto p-4 md:p-8 flex flex-col gap-6 pb-4">
                            {(!runView || runView.steps.length === 0) && !isThinking && (
                                <div className="h-[50vh] flex flex-col items-center justify-center text-muted-foreground/50 gap-4">
                                    <div className="h-16 w-16 rounded-2xl bg-muted/30 flex items-center justify-center">
                                        <Bot className="h-8 w-8" />
                                    </div>
                                    <p className="text-sm font-medium">How can I help you today?</p>
                                </div>
                            )}

                            {runView && (
                                <div className="space-y-6">


                                    {runView.steps.map((step) => (
                                        <StepCard
                                            key={step.stepId}
                                            step={step}
                                            onApprove={(id) => respondApproval(id, 'accept')}
                                            onDecline={(id) => respondApproval(id, 'decline')}
                                        />
                                    ))}

                                    {/* Optimistic User Message */}
                                    {isThinking && tempUserMessage && (
                                        (!runView?.steps?.length || runView.steps[runView.steps.length - 1].kind !== 'userMessage') && (
                                            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                                                <StepCard
                                                    step={{
                                                        stepId: 'temp-user-msg',
                                                        kind: 'userMessage',
                                                        status: 'completed',
                                                        meta: { text: tempUserMessage },
                                                        items: []
                                                    } as any}
                                                    onApprove={() => { }}
                                                    onDecline={() => { }}
                                                />
                                            </div>
                                        )
                                    )}

                                    {isResponding && (
                                        <div className="flex items-center gap-3 p-4 text-muted-foreground animate-in fade-in duration-300">
                                            <div className="relative flex h-3 w-3">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                                            </div>
                                            <div className="text-sm font-maple font-medium tracking-wide">
                                                Codex is thinking...
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div ref={messagesEndRef} className="h-1" />
                        </div>
                    </ScrollArea>
                </div>

                <div className="p-4 pt-0 z-20"> {/* Removed border-t and bg logic to look seamless */}
                    <div className="max-w-3xl mx-auto relative group flex flex-col gap-2">

                        {/* Floating Plan Widget */}
                        {runView?.plan && (
                            <div className={cn(
                                "rounded-xl border border-border/30 shadow-sm backdrop-blur-md transition-all duration-300 overflow-hidden",
                                "bg-background/40 hover:bg-background/60",
                                isPlanCollapsed ? "" : "mb-1"
                            )}>
                                {/* Header / Toggle */}
                                <div
                                    className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-muted/10 transition-colors select-none"
                                    onClick={() => setIsPlanCollapsed(!isPlanCollapsed)}
                                >
                                    <div className="flex items-center gap-2">
                                        <LayoutList className="h-3.5 w-3.5 text-primary/70" />
                                        <span className="text-xs font-medium text-muted-foreground">Implementation Plan</span>
                                        {runView.plan.updatedAt && (
                                            <span className="text-[10px] text-muted-foreground/50 hidden sm:inline">
                                                Updated {new Date(runView.plan.updatedAt).toLocaleTimeString()}
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-muted-foreground/50">
                                        {isPlanCollapsed ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                                    </div>
                                </div>

                                {/* Expanded Content */}
                                {!isPlanCollapsed && (
                                    <div className="px-4 pb-3 pt-0 max-h-[30vh] overflow-y-auto">
                                        {/* Explanation */}
                                        {runView.plan.explanation && (
                                            <div className="p-2 mb-3 bg-muted/20 rounded text-[11px] text-muted-foreground leading-relaxed border border-border/10">
                                                {runView.plan.explanation}
                                            </div>
                                        )}

                                        {/* Minimal Timeline */}
                                        <div className="space-y-3 relative pl-4 before:absolute before:left-[5px] before:top-1 before:bottom-1 before:w-[1px] before:bg-border/30">
                                            {runView.plan.steps?.map((p, idx) => (
                                                <div key={`${p.step}-${idx}`} className="relative pl-3 text-xs group/item">
                                                    <div className={cn(
                                                        "absolute left-[-15px] top-[5px] h-2.5 w-2.5 rounded-full border-[2px] z-10 bg-background transition-colors",
                                                        p.status === 'completed' ? "border-emerald-500/30 text-emerald-500" :
                                                            p.status === 'inProgress' ? "border-primary/30 text-primary" :
                                                                "border-border/40 text-muted-foreground"
                                                    )}>
                                                        {p.status === 'completed' && <div className="h-full w-full rounded-full bg-emerald-500/80" />}
                                                        {p.status === 'inProgress' && <div className="h-full w-full rounded-full bg-primary/80 animate-pulse" />}
                                                    </div>

                                                    <div className={cn(
                                                        "transition-opacity duration-200",
                                                        p.status === 'completed' ? "text-muted-foreground/60 line-through" :
                                                            p.status === 'inProgress' ? "text-foreground font-medium" :
                                                                "text-muted-foreground/80"
                                                    )}>
                                                        {p.step}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Domain Expert Chips */}
                        {!runView?.steps?.length && !isThinking && (
                            <div className="animate-in slide-in-from-bottom-5 fade-in duration-500 mb-4 px-1">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="h-1 w-1 rounded-full bg-primary/70" />
                                    <span className="text-[11px] font-medium text-muted-foreground/80 tracking-wide uppercase">
                                        选择一个领域进行专家SOP生成吧
                                    </span>
                                    {!currentThreadId && (
                                        <span className="text-[10px] text-muted-foreground/50 flex items-center gap-1">
                                            <Loader className="h-3 w-3 animate-spin" />
                                            Connecting...
                                        </span>
                                    )}
                                </div>
                                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                                    {[
                                        { id: 'container', label: '容器', icon: Package },
                                        { id: 'kvm', label: 'KVM', icon: Server },
                                        { id: 'storage', label: '存储', icon: HardDrive },
                                        { id: 'database', label: '数据库', icon: Database },
                                        { id: 'network', label: '网络', icon: Network },
                                        { id: 'ops', label: '应用运维', icon: Terminal },
                                    ].map((domain) => (
                                        <button
                                            key={domain.id}
                                            onClick={() => sendMessage(`使用头脑风暴技能，在当前${domain.label}领域下，引导专家进行领域专家知识挖掘，通过以点到面的方式，最终输出一个操作性和质量极高的文档。`)}
                                            disabled={isResponding || !currentThreadId}
                                            className={cn(
                                                "flex flex-col items-center justify-center gap-2 p-3 rounded-xl transition-all duration-300 group cursor-pointer",
                                                "bg-background/50 border border-border/40 shadow-sm",
                                                "hover:bg-primary/5 hover:border-primary/20 hover:scale-[1.02] hover:shadow-md",
                                                "active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
                                            )}
                                        >
                                            <div className="p-1.5 rounded-lg bg-muted/50 group-hover:bg-background transition-colors">
                                                <domain.icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                            </div>
                                            <span className="text-[11px] font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                                                {domain.label}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="relative">
                            <Textarea
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder={isResponding ? "Codex is thinking..." : "Ask Cloud Codex something..."}
                                disabled={isResponding}
                                className="min-h-[60px] max-h-[200px] resize-none pr-14 pl-4 py-3.5 bg-muted/40 border-muted-foreground/20 focus-visible:ring-1 focus-visible:ring-primary/50 text-base md:text-sm shadow-sm transition-all rounded-xl"
                                rows={1}
                            />
                            <Button
                                size="icon"
                                onClick={handleSend}
                                disabled={!inputValue.trim() || isResponding}
                                className="absolute right-2 bottom-2 h-8 w-8 rounded-lg shadow-none transition-all"
                            >
                                {isResponding ? <Loader className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                            </Button>
                        </div>
                    </div>
                    <div className="text-center mt-3">
                        <p className="text-[10px] text-muted-foreground/60">
                            AI-generated responses may be inaccurate.
                        </p>
                    </div>
                </div>
            </main>
        </div>
    )
}
