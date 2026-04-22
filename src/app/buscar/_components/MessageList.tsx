'use client';

import { useRef, useEffect } from 'react';
import { ChatMessage } from './types';
import MessageBubble from './MessageBubble';

interface MessageListProps {
    messages: ChatMessage[];
    isLoading: boolean;
    onRemoveFilter?: (key: string) => void;
    onSuggestionClick?: (text: string) => void;
}

export default function MessageList({
    messages,
    isLoading,
    onRemoveFilter,
    onSuggestionClick,
}: MessageListProps) {
    const bottomRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages.length, isLoading]);

    return (
        <div className="flex-1 overflow-y-auto py-4">
            {messages.map((msg, index) => (
                <MessageBubble
                    key={msg.id}
                    message={msg}
                    isLatest={index === messages.length - 1 && msg.role === 'assistant'}
                    onRemoveFilter={onRemoveFilter}
                    onSuggestionClick={onSuggestionClick}
                />
            ))}

            {/* ── Thinking indicator — 3 silent bouncing dots ── */}
            {isLoading && (
                <div className="flex justify-start mb-4 px-6 animate-in fade-in duration-300">
                    <div className="flex items-center gap-1.5 px-5 py-3.5 rounded-2xl"
                        style={{
                            background: 'rgba(255,255,255,0.45)',
                            backdropFilter: 'blur(12px)',
                        }}>
                        <span className="thinking-dot text-on-surface-variant/60" style={{ animationDelay: '0ms' }} />
                        <span className="thinking-dot text-on-surface-variant/60" style={{ animationDelay: '160ms' }} />
                        <span className="thinking-dot text-on-surface-variant/60" style={{ animationDelay: '320ms' }} />
                    </div>
                </div>
            )}

            <div ref={bottomRef} />
        </div>
    );
}
