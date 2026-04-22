'use client';

import { ChatMessage } from './types';
import MessageList from './MessageList';
import ChatInput from './ChatInput';
import QuickFilters from './QuickFilters';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

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
            {/* Chat Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-white/80 backdrop-blur-xl border-b border-gray-100 flex-shrink-0">
                <div className="flex items-center gap-3">
                    <Link
                        href="/bienvenidos"
                        className="p-1.5 rounded-xl text-gray-400 hover:text-nido-600 hover:bg-nido-50 transition-all"
                        aria-label="Volver al inicio"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
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
                        <h1 className="text-sm font-bold text-gray-800 tracking-tight">Nido IA</h1>
                        <p className="text-[11px] text-emerald-500 font-medium flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                            En línea
                        </p>
                    </div>
                </div>
            </div>

            {/* Messages */}
            <MessageList
                messages={messages}
                isLoading={isLoading}
                onRemoveFilter={onRemoveFilter}
                onSuggestionClick={onSuggestionClick}
            />

            {/* Quick Filters (visible only before first user message) */}
            <QuickFilters
                onSelect={onSendMessage}
                visible={showQuickFilters}
            />

            {/* Input */}
            <ChatInput
                onSendMessage={onSendMessage}
                onAudioCapture={onAudioCapture}
                isLoading={isLoading}
            />
        </div>
    );
}
