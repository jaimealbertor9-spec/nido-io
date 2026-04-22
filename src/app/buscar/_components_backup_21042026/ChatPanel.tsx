'use client';

import { ChatMessage } from './types';
import MessageList from './MessageList';
import QuickFilters from './QuickFilters';

interface ChatPanelProps {
    messages: ChatMessage[];
    isLoading: boolean;
    showQuickFilters: boolean;
    onSendMessage: (text: string) => void;
    onAudioCapture: (base64: string) => void;
    onRemoveFilter?: (key: string) => void;
    onSuggestionClick?: (text: string) => void;
    isChatFirst?: boolean;
    hasUserMessages?: boolean;
}

export default function ChatPanel({
    messages,
    isLoading,
    showQuickFilters,
    onSendMessage,
    onRemoveFilter,
    onSuggestionClick,
    hasUserMessages,
}: ChatPanelProps) {
    return (
        <div className="flex flex-col h-full pb-2">

            {/* ── Welcome Hero — only before first message ── */}
            {!hasUserMessages && (
                <div className="flex flex-col items-center justify-center text-center mt-10 mb-8 flex-shrink-0 animate-in fade-in duration-500 px-4">
                    <h1 className="font-headline text-4xl md:text-5xl font-bold tracking-tight text-on-surface mb-3">
                        Hola. Soy Nido.
                    </h1>
                    <p className="font-body text-on-surface-variant text-base max-w-md">
                        Estoy aquí para ayudarte a encontrar tu espacio ideal. ¿Qué estás buscando hoy?
                    </p>
                </div>
            )}

            {/* ── Messages ── */}
            <div className="flex flex-1 overflow-hidden justify-center w-full">
                <div className="w-full flex flex-col max-w-3xl">
                    <MessageList
                        messages={messages}
                        isLoading={isLoading}
                        onRemoveFilter={onRemoveFilter}
                        onSuggestionClick={onSuggestionClick}
                    />
                </div>
            </div>

            {/* ── Quick Filters ── */}
            <QuickFilters onSelect={onSendMessage} visible={showQuickFilters} />
        </div>
    );
}
