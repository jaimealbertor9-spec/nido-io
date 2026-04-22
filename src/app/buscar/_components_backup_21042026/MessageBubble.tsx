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

    // ── User — right-aligned glass pill (Stitch style) ──
    if (isUser) {
        return (
            <div className="flex justify-end w-full mb-8 px-4 animate-in slide-in-from-right-2 duration-300">
                <div className="glass-panel px-6 py-4 rounded-3xl rounded-tr-sm ambient-shadow max-w-2xl">
                    <p className="font-body text-on-surface leading-relaxed">{message.content}</p>
                </div>
            </div>
        );
    }

    // ── Assistant — left-aligned with spark avatar (Stitch style) ──
    if (isAssistant) {
        const resultCount = message.results?.length ?? 0;
        const isWelcome = message.id === 'welcome-msg-001';

        if (isWelcome) {
            // Welcome message: centered glass panel
            return (
                <div className="flex justify-center w-full mb-6 px-4 animate-in fade-in duration-500">
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

        // Regular AI response — with spark avatar
        return (
            <div className="flex justify-start w-full mb-8 px-4 animate-in slide-in-from-left-2 duration-300">
                <div className="flex gap-4 max-w-3xl w-full">
                    {/* Spark avatar */}
                    <div className="w-10 h-10 rounded-full bg-primary-container/40 flex items-center justify-center flex-shrink-0 mt-1">
                        <span className="material-symbols-outlined text-surface-tint text-xl">
                            colors_spark
                        </span>
                    </div>

                    <div className="flex-1 min-w-0">
                        {/* Glass bubble */}
                        <div className="glass-panel px-6 py-5 rounded-3xl rounded-tl-sm ambient-shadow">
                            {/* Filter Chips */}
                            {message.appliedFilters && (
                                <FilterChips
                                    filters={message.appliedFilters}
                                    isLatest={isLatest}
                                    onRemoveFilter={onRemoveFilter}
                                />
                            )}

                            <p className="font-body text-on-surface leading-relaxed">
                                {renderContent(message.content)}
                            </p>

                            {resultCount > 0 && (
                                <div className="mt-3 flex items-center gap-2 text-xs text-surface-tint font-medium">
                                    <span className="w-5 h-5 bg-primary-container rounded-full flex items-center justify-center text-[10px] font-bold text-on-primary-container">
                                        {resultCount}
                                    </span>
                                    <span>{resultCount === 1 ? 'propiedad encontrada' : 'propiedades encontradas'}</span>
                                </div>
                            )}
                        </div>

                        {/* Property Carousel */}
                        {resultCount > 0 && message.results && (
                            <div className="mt-4 flex gap-5 overflow-x-auto snap-x pb-4 no-scrollbar">
                                {message.results.map((r) => (
                                    <div key={r.id} className="snap-start shrink-0 w-[280px] sm:w-[320px]">
                                        <SearchPropertyCard property={r} />
                                    </div>
                                ))}
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
            </div>
        );
    }

    return null;
}
