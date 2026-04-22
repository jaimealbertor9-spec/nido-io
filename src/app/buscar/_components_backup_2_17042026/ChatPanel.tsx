'use client';

import { ChatMessage } from './types';
import MessageList from './MessageList';
import ChatInput from './ChatInput';
import QuickFilters from './QuickFilters';
import Image from 'next/image';

interface ChatPanelProps {
    messages: ChatMessage[];
    isLoading: boolean;
    showQuickFilters: boolean;
    onSendMessage: (text: string) => void;
    onAudioCapture: (base64: string) => void;
    onRemoveFilter?: (key: string) => void;
    onSuggestionClick?: (text: string) => void;
}

export default function ChatPanel({
    messages,
    isLoading,
    showQuickFilters,
    onSendMessage,
    onAudioCapture,
    onRemoveFilter,
    onSuggestionClick,
}: ChatPanelProps) {
    return (
        <div className="flex flex-col h-full">
            {/* ── Serenity Chat Header ── */}
            <div className="flex items-center gap-3 px-5 py-3.5 border-b border-white/30 flex-shrink-0">
                <div className="w-9 h-9 relative">
                    <Image
                        src="/Logo solo Nido.png"
                        alt="Nido IA"
                        fill
                        sizes="36px"
                        className="object-contain"
                    />
                </div>
                <div>
                    <h1 className="text-sm font-bold text-on-surface tracking-tight">Nido IA</h1>
                </div>
            </div>

            {/* ── Messages ── */}
            <MessageList
                messages={messages}
                isLoading={isLoading}
                onRemoveFilter={onRemoveFilter}
                onSuggestionClick={onSuggestionClick}
            />

            {/* ── Quick Filters (visible only before first user message) ── */}
            <QuickFilters
                onSelect={onSendMessage}
                visible={showQuickFilters}
            />

            {/* ── Floating Input ── */}
            <ChatInput
                onSendMessage={onSendMessage}
                onAudioCapture={onAudioCapture}
                isLoading={isLoading}
            />
        </div>
    );
}
