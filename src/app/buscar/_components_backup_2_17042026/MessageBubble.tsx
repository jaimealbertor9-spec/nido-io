'use client';

import { ChatMessage } from './types';
import FilterChips from './FilterChips';

interface MessageBubbleProps {
    message: ChatMessage;
    isLatest: boolean;
    onRemoveFilter?: (key: string) => void;
    onSuggestionClick?: (text: string) => void;
}

// Simple markdown bold parser: **text** → <strong>text</strong>
function renderContent(text: string): React.ReactNode[] {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
        }
        return <span key={i}>{part}</span>;
    });
}

export default function MessageBubble({
    message,
    isLatest,
    onRemoveFilter,
    onSuggestionClick,
}: MessageBubbleProps) {
    const isUser = message.role === 'user';
    const isSystem = message.role === 'system';
    const isAssistant = message.role === 'assistant';

    // ── System Messages (centered, muted) ──
    if (isSystem) {
        return (
            <div className="flex justify-center py-2">
                <p className="text-xs text-on-surface-variant/60 bg-white/40 backdrop-blur-sm px-4 py-2 rounded-full">
                    {message.content}
                </p>
            </div>
        );
    }

    // ── User Messages (right-aligned, surface-tint pill) ──
    if (isUser) {
        return (
            <div className="flex justify-end mb-4 px-4 animate-in slide-in-from-right-2 duration-300">
                <div className="max-w-[85%] md:max-w-[70%]">
                    <div className="bg-surface-tint text-white rounded-2xl rounded-br-md px-4 py-3 shadow-lg shadow-surface-tint/15">
                        <p className="text-sm leading-relaxed">{message.content}</p>
                    </div>
                    <p suppressHydrationWarning className="text-[10px] text-on-surface-variant/40 mt-1 text-right min-h-[15px]">
                        {message.timestamp.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                </div>
            </div>
        );
    }

    // ── Assistant Messages (left-aligned, glass panel) ──
    if (isAssistant) {
        const resultCount = message.results?.length ?? 0;

        return (
            <div className="flex justify-start mb-4 px-4 animate-in slide-in-from-left-2 duration-300">
                <div className="max-w-[85%] md:max-w-[75%] min-w-0">
                    <div className="glass-panel rounded-2xl rounded-bl-md px-4 py-3 ambient-shadow">
                        {/* Filter Chips */}
                        {message.appliedFilters && (
                            <FilterChips
                                filters={message.appliedFilters}
                                isLatest={isLatest}
                                onRemoveFilter={onRemoveFilter}
                            />
                        )}

                        {/* Text Content */}
                        <p className="text-sm text-on-surface leading-relaxed">
                            {renderContent(message.content)}
                        </p>

                        {/* Result count indicator */}
                        {resultCount > 0 && (
                            <div className="mt-3 flex items-center gap-2 text-xs text-surface-tint font-medium">
                                <span className="w-5 h-5 bg-primary-container rounded-full flex items-center justify-center text-[10px] font-bold text-on-primary-container">
                                    {resultCount}
                                </span>
                                <span>
                                    {resultCount === 1 ? 'propiedad encontrada' : 'propiedades encontradas'} — mira el panel de resultados →
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Suggestion chips */}
                    {message.suggestions && message.suggestions.length > 0 && isLatest && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                            {message.suggestions.map((suggestion) => (
                                <button
                                    key={suggestion}
                                    onClick={() => onSuggestionClick?.(suggestion)}
                                    className="
                                        text-xs px-3 py-1.5 rounded-full
                                        bg-white/60 backdrop-blur-sm border border-white/50
                                        text-on-surface-variant
                                        hover:border-surface-tint/30 hover:text-surface-tint hover:bg-primary-container/30
                                        transition-all duration-200 hover:-translate-y-0.5
                                        active:scale-95
                                        shadow-sm
                                    "
                                >
                                    {suggestion}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Timestamp */}
                    <p suppressHydrationWarning className="text-[10px] text-on-surface-variant/40 mt-1 min-h-[15px]">
                        {message.timestamp.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                </div>
            </div>
        );
    }

    return null;
}
