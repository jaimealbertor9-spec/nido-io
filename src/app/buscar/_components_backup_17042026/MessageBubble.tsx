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
                <p className="text-xs text-gray-400 bg-gray-50 px-4 py-2 rounded-full">
                    {message.content}
                </p>
            </div>
        );
    }

    // ── User Messages (right-aligned, navy) ──
    if (isUser) {
        return (
            <div className="flex justify-end mb-4 px-4 animate-in slide-in-from-right-2 duration-300">
                <div className="max-w-[85%] md:max-w-[70%]">
                    <div className="bg-nido-700 text-white rounded-2xl rounded-br-md px-4 py-3 shadow-md">
                        <p className="text-sm leading-relaxed">{message.content}</p>
                    </div>
                    <p suppressHydrationWarning className="text-[10px] text-gray-300 mt-1 text-right min-h-[15px]">
                        {message.timestamp.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                </div>
            </div>
        );
    }

    // ── Assistant Messages (left-aligned, light — text + chips only, NO cards) ──
    if (isAssistant) {
        const resultCount = message.results?.length ?? 0;

        return (
            <div className="flex justify-start mb-4 px-4 animate-in slide-in-from-left-2 duration-300">
                {/* AI Avatar */}
                <div className="flex-shrink-0 mr-3 mt-1">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-nido-500 to-nido-700 flex items-center justify-center shadow-lg shadow-nido-500/20">
                        <span className="text-white text-sm font-bold">N</span>
                    </div>
                </div>

                <div className="max-w-[85%] md:max-w-[75%] min-w-0">
                    <div className="bg-gray-50 border border-gray-100 rounded-2xl rounded-bl-md px-4 py-3">
                        {/* Filter Chips */}
                        {message.appliedFilters && (
                            <FilterChips
                                filters={message.appliedFilters}
                                isLatest={isLatest}
                                onRemoveFilter={onRemoveFilter}
                            />
                        )}

                        {/* Text Content */}
                        <p className="text-sm text-gray-700 leading-relaxed">
                            {renderContent(message.content)}
                        </p>

                        {/* Result count indicator (directs user to the Results panel) */}
                        {resultCount > 0 && (
                            <div className="mt-3 flex items-center gap-2 text-xs text-nido-500 font-medium">
                                <span className="w-5 h-5 bg-nido-100 rounded-full flex items-center justify-center text-[10px] font-bold text-nido-700">
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
                                        bg-white border border-gray-200 text-gray-600
                                        hover:border-nido-300 hover:text-nido-600 hover:bg-nido-50
                                        transition-all duration-200 hover:-translate-y-0.5
                                        active:scale-95
                                    "
                                >
                                    {suggestion}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Timestamp */}
                    <p suppressHydrationWarning className="text-[10px] text-gray-300 mt-1 min-h-[15px]">
                        {message.timestamp.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                </div>
            </div>
        );
    }

    return null;
}
