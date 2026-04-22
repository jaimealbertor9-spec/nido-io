'use client';

import { ChatMessage } from './types';
import FilterChips from './FilterChips';
import SearchPropertyCard from './SearchPropertyCard';

interface MessageBubbleProps {
    message: ChatMessage;
    isLatest: boolean;
    onRemoveFilter?: (key: string) => void;
    onSuggestionClick?: (text: string) => void;
}

function renderContent(text: string): React.ReactNode[] {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
        }
        return <span key={i}>{part}</span>;
    });
}

export default function MessageBubble({ message, isLatest, onRemoveFilter, onSuggestionClick }: MessageBubbleProps) {
    const isUser = message.role === 'user';
    const isSystem = message.role === 'system';
    const isAssistant = message.role === 'assistant';

    // ── System ──
    if (isSystem) {
        return (
            <div className="flex justify-center py-2">
                <p className="text-xs text-on-surface-variant/60 bg-white/40 backdrop-blur-sm px-4 py-2 rounded-full">
                    {message.content}
                </p>
            </div>
        );
    }

    // ── User — dark pill, right-aligned (like Claude/iMessage) ──
    if (isUser) {
        return (
            <div className="flex justify-end w-full mb-6 px-6 animate-in slide-in-from-right-2 duration-300">
                <div className="px-5 py-3.5 rounded-2xl rounded-tr-sm max-w-2xl shadow-sm"
                    style={{
                        background: 'rgba(45, 45, 55, 0.85)',
                        color: '#f5f5f5',
                    }}>
                    <p className="font-body leading-relaxed text-[15px]">{message.content}</p>
                </div>
            </div>
        );
    }

    // ── Assistant — no avatar, text directly on canvas ──
    if (isAssistant) {
        const resultCount = message.results?.length ?? 0;
        const isWelcome = message.id === 'welcome-msg-001';

        if (isWelcome) {
            return (
                <div className="flex justify-center w-full mb-6 px-6 animate-in fade-in duration-500">
                    <div className="glass-panel px-6 py-5 rounded-3xl ambient-shadow max-w-2xl w-full text-center">
                        <p className="font-body text-on-surface leading-relaxed">
                            {renderContent(message.content)}
                        </p>
                        <p suppressHydrationWarning className="text-[10px] text-on-surface-variant/30 mt-3">
                            {message.timestamp.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                    </div>
                </div>
            );
        }

        // Regular AI response — NO avatar, NO bubble
        // Text flows directly, cards unified below
        return (
            <div className="flex justify-start w-full mb-6 px-6 animate-in slide-in-from-left-2 duration-300">
                <div className="max-w-3xl w-full">

                    {/* Filter Chips — if any */}
                    {message.appliedFilters && (
                        <div className="mb-2">
                            <FilterChips
                                filters={message.appliedFilters}
                                isLatest={isLatest}
                                onRemoveFilter={onRemoveFilter}
                            />
                        </div>
                    )}

                    {/* AI text response — direct on canvas, no bubble */}
                    <p className="font-body text-on-surface/85 leading-relaxed text-[15px]">
                        {renderContent(message.content)}
                    </p>

                    {/* Property count + cards — unified block */}
                    {resultCount > 0 && message.results && (
                        <div className="mt-4 rounded-2xl px-4 py-4"
                            style={{
                                background: 'rgba(255,255,255,0.35)',
                                backdropFilter: 'blur(12px)',
                                border: '1px solid rgba(255,255,255,0.55)',
                            }}>
                            {/* Count badge */}
                            <div className="flex items-center gap-2 text-xs text-surface-tint font-medium mb-3">
                                <span className="w-5 h-5 bg-primary-container rounded-full flex items-center justify-center text-[10px] font-bold text-on-primary-container">
                                    {resultCount}
                                </span>
                                <span>{resultCount === 1 ? 'propiedad encontrada' : 'propiedades encontradas'}</span>
                            </div>

                            {/* Carousel — compact cards, with scroll fade */}
                            <div className="carousel-fade">
                                <div className="flex gap-3 overflow-x-auto snap-x pb-2 pr-6 no-scrollbar">
                                    {message.results.map((r) => (
                                        <div key={r.id} className="snap-start shrink-0 w-[231px] sm:w-[264px]">
                                            <SearchPropertyCard property={r} compact />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Suggestion chips */}
                    {message.suggestions && message.suggestions.length > 0 && isLatest && (
                        <div className="flex flex-wrap gap-2 mt-3">
                            {message.suggestions.map((s) => (
                                <button
                                    key={s}
                                    onClick={() => onSuggestionClick?.(s)}
                                    className="text-sm px-4 py-2 rounded-full bg-white/60 backdrop-blur-sm border border-white/50 text-on-surface-variant hover:border-surface-tint/30 hover:text-surface-tint hover:bg-primary-container/20 transition-all duration-200 hover:-translate-y-0.5 active:scale-95 shadow-sm"
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    )}

                    <p suppressHydrationWarning className="text-[10px] text-on-surface-variant/30 mt-2 min-h-[14px]">
                        {message.timestamp.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                </div>
            </div>
        );
    }

    return null;
}
