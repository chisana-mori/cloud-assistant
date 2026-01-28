import { useState, useEffect, useRef } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useCodexStream } from '../hooks/useCodexStream'
import { ActionCard } from '../components/ActionCard'
import { nanoid } from 'nanoid'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Send, Bot, User, PlusCircle, Settings, MessageSquare, Loader } from 'lucide-react'

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

    const { messages, status, startTurn, respondApproval, sendMessage, initThread: initThreadApi, isThinking } = useCodexStream({
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

    // 自动滚动到底部
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    const handleSend = () => {
        if (!inputValue.trim()) return
        if (!currentThreadId) {
            console.warn('Thread not initialized yet');
            return;
        }
        startTurn(currentThreadId, inputValue)
        setInputValue('')
    }

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
        <div className="flex h-screen w-full bg-[#f9f9f9] dark:bg-[#1e1e1e] text-slate-900 dark:text-slate-100 font-sans">

            {/* Sidebar - NextChat Style */}
            <div className="w-[280px] flex-shrink-0 flex flex-col border-r bg-white dark:bg-[#1e1e1e] border-slate-200 dark:border-slate-800 hidden md:flex">
                <div className="p-5">
                    <div className="flex justify-between items-center mb-4">
                        <div className="font-bold text-xl">Cloud Codex</div>
                        <div className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">
                            v1.0
                        </div>
                    </div>
                    <div className="text-sm text-slate-500 mb-6">Build your own AI workspace.</div>

                    <button className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400 border border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors">
                        <PlusCircle size={18} />
                        <span className="font-medium">New Chat</span>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-3">
                    <div className="p-3 rounded-xl bg-white dark:bg-[#2a2a2a] border border-slate-100 dark:border-slate-700 shadow-sm cursor-pointer hover:border-green-500 transition-colors">
                        <div className="flex justify-between items-start mb-1">
                            <span className="font-medium text-sm">Default Thread</span>
                            <span className="text-[10px] text-slate-400">Just now</span>
                        </div>
                        <div className="text-xs text-slate-400 line-clamp-2">
                            {messages.length > 0 ? (messages[messages.length - 1].content || 'System Activity').slice(0, 50) : 'No messages yet...'}
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer text-slate-600 dark:text-slate-400">
                        <Settings size={18} />
                        <span className="text-sm font-medium">Settings</span>
                    </div>
                </div>
            </div>

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col h-full bg-white dark:bg-[#1e1e1e]">

                {/* Header */}
                <div className="h-16 flex items-center justify-between px-6 border-b border-slate-100 dark:border-slate-800 bg-white/80 dark:bg-[#1e1e1e]/80 backdrop-blur z-10 sticky top-0">
                    <div className="flex flex-col">
                        <span className="font-bold text-lg">Default Session</span>
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                            <span className={`w-1.5 h-1.5 rounded-full ${status === 'connected' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                            {status}
                        </span>
                    </div>
                    <div className="flex gap-2">
                        {messages.length === 0 && status === 'connected' && (
                            <button
                                onClick={handleResetThread}
                                className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded-full transition-colors"
                            >
                                Reset Thread
                            </button>
                        )}
                    </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 md:p-6 scroll-smooth">
                    <div className="max-w-3xl mx-auto flex flex-col gap-6 pb-4">
                        {messages.length === 0 && (
                            <div className="flex flex-col items-center justify-center mt-20 text-slate-300">
                                <MessageSquare size={48} className="mb-4 opacity-50" />
                                <span>Start a conversation with Cloud Codex</span>
                            </div>
                        )}

                        {messages.map((msg) => (
                            <div key={msg.id} className={`group flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                                <div className={`
                  w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm
                  ${msg.role === 'user' ? 'bg-slate-900 dark:bg-white' : 'bg-green-100 text-green-600 dark:bg-green-900/30'}
                `}>
                                    {msg.role === 'user' ?
                                        <User size={16} className="text-white dark:text-black" /> :
                                        <Bot size={18} />
                                    }
                                </div>

                                <div className={`flex flex-col gap-1 max-w-[85%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                    <div className="flex items-center gap-2 text-xs text-slate-400 px-1">
                                        <span>{msg.role === 'user' ? 'You' : 'Codex'}</span>
                                    </div>

                                    {msg.content && (
                                        <div className={`
                      px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm
                      prose prose-sm max-w-none break-words dark:prose-invert
                      ${msg.role === 'user'
                                                ? 'bg-slate-100 dark:bg-slate-800 rounded-tr-sm'
                                                : 'bg-white dark:bg-[#2a2a2a] border border-slate-100 dark:border-slate-800 rounded-tl-sm'}
                    `}>
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                {msg.content}
                                            </ReactMarkdown>
                                        </div>
                                    )}

                                    {msg.items.length > 0 && (
                                        <div className="flex flex-col gap-2 w-full mt-1">
                                            {msg.items.map(item => (
                                                <ActionCard
                                                    key={item.id}
                                                    item={item}
                                                    onApprove={(id) => respondApproval(id, 'accept')}
                                                    onDecline={(id) => respondApproval(id, 'decline')}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}

                        {isThinking && (
                            <div className="flex gap-4">
                                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm bg-green-100 text-green-600 dark:bg-green-900/30">
                                    <Bot size={18} />
                                </div>
                                <div className="flex flex-col gap-1 items-start">
                                    <div className="flex items-center gap-2 text-xs text-slate-400 px-1">
                                        <span>Codex</span>
                                    </div>
                                    <div className="px-4 py-3 rounded-2xl rounded-tl-sm text-sm bg-white dark:bg-[#2a2a2a] border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-2">
                                        <Loader className="animate-spin text-slate-400" size={14} />
                                        <span className="text-slate-400">Thinking...</span>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                </div>

                {/* Input Area */}
                <div className="p-4 bg-white dark:bg-[#1e1e1e]">
                    <div className="max-w-3xl mx-auto relative rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#2a2a2a] shadow-sm focus-within:ring-2 focus-within:ring-green-500/20 focus-within:border-green-500 transition-all">
                        <textarea
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={isThinking ? "Waiting for Codex..." : "Type a message to Cloud Codex..."}
                            disabled={isThinking}
                            className="w-full bg-transparent border-0 p-3 min-h-[50px] max-h-[200px] resize-none focus:ring-0 text-sm outline-none disabled:opacity-50"
                            rows={1}
                            style={{ height: 'auto', minHeight: '50px' }}
                        />
                        <div className="absolute right-2 bottom-2">
                            <button
                                onClick={handleSend}
                                disabled={!inputValue.trim() || isThinking}
                                className="p-1.5 rounded-lg bg-green-500 text-white hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <Send size={16} />
                            </button>
                        </div>
                    </div>
                    <div className="text-center text-[10px] text-slate-400 mt-2">
                        AI can make mistakes. Please check executing commands.
                    </div>
                </div>
            </div>
        </div>
    )
}
