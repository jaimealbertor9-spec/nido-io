'use client';

import { useRef, useEffect } from 'react';
import { ChatMessage } from './types';
import MessageBubble from './MessageBubble';
import { Loader2 } from 'lucide-react';

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

            {/* Typing indicator */}
            {isLoading && (
                <div className="flex justify-start mb-4 px-4 animate-in fade-in duration-300">
                    <div className="flex-shrink-0 mr-3 mt-1">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-nido-500 to-nido-700 flex items-center justify-center shadow-lg shadow-nido-500/20">
                            <span className="text-white text-sm font-bold">N</span>
                        </div>
                    </div>
                    <div className="bg-gray-50 border border-gray-100 rounded-2xl rounded-bl-md px-5 py-4">
                        <div className="flex items-center gap-1.5">
                            <Loader2 className="w-4 h-4 text-nido-400 animate-spin" />
                            <span className="text-xs text-gray-400">Nido IA está pensando...</span>
                        </div>
                    </div>
                </div>
            )}

            <div ref={bottomRef} />
        </div>
    );
}
