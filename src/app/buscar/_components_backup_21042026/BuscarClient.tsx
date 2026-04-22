'use client';

import { useState, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import Image from 'next/image';
import { ChatMessage, SearchResult, SearchIntent } from './types';
import { generateMockResponse } from './mockData';
import ChatPanel from './ChatPanel';
import ResultsPanel from './ResultsPanel';
import ChatInput from './ChatInput';
import { Map, MessageSquare, Plus, Search } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════
// WELCOME MESSAGE
// ═══════════════════════════════════════════════════════════════
const WELCOME_MESSAGE: ChatMessage = {
    id: 'welcome-msg-001',
    role: 'assistant',
    content: '¡Hola! 👋 Soy **Nido IA**, tu asistente de búsqueda inmobiliaria. Cuéntame qué tipo de propiedad estás buscando: ubicación, precio, cercanía a parques, hospitales, transporte... ¡Lo que necesites!',
    timestamp: new Date(),
    suggestions: [
        'Apartamentos en Bogotá',
        'Cerca de un parque',
        'Arriendos en El Líbano',
        'Finca por días con piscina',
    ],
};

export default function BuscarClient() {
    const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
    const [isLoading, setIsLoading] = useState(false);
    const [results, setResults] = useState<SearchResult[]>([]);
    const [activeFilters, setActiveFilters] = useState<SearchIntent>({});
    const [layoutMode, setLayoutMode] = useState<'chat' | 'map'>('chat');
    const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
    const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

    useEffect(() => {
        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
                (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                () => {}
            );
        }
    }, []);

    const hasUserMessages = messages.some(m => m.role === 'user');

    const handleSendMessage = useCallback((text: string) => {
        if (!text.trim() || isLoading) return;
        const userMessage: ChatMessage = {
            id: uuidv4(), role: 'user', content: text.trim(),
            timestamp: new Date(), isNew: true,
        };
        setMessages(prev => [...prev, userMessage]);
        setIsLoading(true);
        setTimeout(() => {
            const { message: aiMessage, intent, results: newResults } = generateMockResponse(text, activeFilters);
            setMessages(prev => [...prev, aiMessage]);
            setActiveFilters(intent);
            setResults(newResults);
            setIsLoading(false);
        }, 1200);
    }, [isLoading, activeFilters]);

    const handleAudioCapture = useCallback((base64: string) => {
        console.log('[BuscarClient] Audio:', base64.length);
        const vm: ChatMessage = { id: uuidv4(), role: 'user', content: '🎙️ Búsqueda por voz', timestamp: new Date(), isNew: true };
        setMessages(prev => [...prev, vm]);
        setIsLoading(true);
        setTimeout(() => {
            const { message, intent, results: nr } = generateMockResponse('Apartamentos en Bogotá cerca de un parque', activeFilters);
            setMessages(prev => [...prev, { ...message, content: '🎙️ He procesado tu búsqueda por voz. ' + message.content }]);
            setActiveFilters(intent); setResults(nr); setIsLoading(false);
        }, 1500);
    }, [activeFilters]);

    const handleRemoveFilter = useCallback((filterKey: string) => {
        const newFilters = { ...activeFilters };
        if (filterKey.startsWith('poi_')) {
            const cat = filterKey.replace('poi_', '');
            newFilters.poi_filters = (newFilters.poi_filters || []).filter(pf => pf.category !== cat);
        } else { delete (newFilters as Record<string, unknown>)[filterKey]; }
        setActiveFilters(newFilters);
        handleSendMessage(`Quitar filtro: ${filterKey.replace('poi_', '').replace('_', ' ')}`);
    }, [activeFilters, handleSendMessage]);

    const handleSuggestionClick = useCallback((text: string) => handleSendMessage(text), [handleSendMessage]);

    const handleNewChat = useCallback(() => {
        setMessages([WELCOME_MESSAGE]);
        setResults([]); setActiveFilters({}); setLayoutMode('chat');
    }, []);

    return (
        /* ── Full screen iridescent canvas — NO inner cards ── */
        <div className="relative h-[100dvh] bg-iridescent overflow-hidden">

            {/* ══════════════════════════════════════════════
                SIDEBAR — fixed floating icons on the gradient
                No background panel. Icons float on the canvas.
            ══════════════════════════════════════════════ */}
            <aside className="fixed top-0 left-0 bottom-0 w-[68px] z-20 flex flex-col items-center py-6">

                {/* Logo — top */}
                <div className="relative w-8 h-8 mb-10 flex-shrink-0">
                    <Image src="/logo-nido-io.png" alt="Nido" fill sizes="32px" className="object-contain" />
                </div>

                {/* Nav icons — vertically centered */}
                <nav className="flex flex-col items-center gap-3 flex-1 justify-center">

                    {/* Nueva búsqueda */}
                    <button
                        onClick={handleNewChat}
                        title="Nueva búsqueda"
                        className="w-10 h-10 rounded-full flex items-center justify-center text-on-surface/40 hover:text-on-surface/70 hover:bg-white/30 transition-all duration-200"
                    >
                        <Plus className="w-[18px] h-[18px]" />
                    </button>

                    {/* Chat IA */}
                    <button
                        onClick={() => setLayoutMode('chat')}
                        title="Chat IA"
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 ${
                            layoutMode === 'chat'
                                ? 'bg-white/60 backdrop-blur-sm text-on-surface shadow-sm border border-white/70'
                                : 'text-on-surface/40 hover:text-on-surface/70 hover:bg-white/30'
                        }`}
                    >
                        <MessageSquare className="w-[18px] h-[18px]" />
                    </button>

                    {/* Ver en el mapa */}
                    <button
                        onClick={() => setLayoutMode('map')}
                        title="Ver en el mapa"
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 relative ${
                            layoutMode === 'map'
                                ? 'bg-white/60 backdrop-blur-sm text-on-surface shadow-sm border border-white/70'
                                : 'text-on-surface/40 hover:text-on-surface/70 hover:bg-white/30'
                        }`}
                    >
                        <Map className="w-[18px] h-[18px]" />
                        {results.length > 0 && (
                            <span className="absolute top-1 right-1 w-2 h-2 bg-surface-tint rounded-full ring-2 ring-white/60" />
                        )}
                    </button>
                </nav>

                {/* Recent — bottom */}
                {hasUserMessages && (
                    <button
                        title="Búsqueda reciente"
                        className="w-10 h-10 rounded-full flex items-center justify-center text-on-surface/30 hover:text-on-surface/60 hover:bg-white/30 transition-all duration-200 mt-auto"
                    >
                        <Search className="w-[18px] h-[18px]" />
                    </button>
                )}
            </aside>

            {/* ══════════════════════════════════════════════
                MAIN — sits directly on the gradient canvas
                No card, no border, no background
            ══════════════════════════════════════════════ */}
            <div className="absolute inset-0 left-[68px] flex flex-col overflow-hidden">
                {layoutMode === 'chat' ? (
                    <div className="flex-1 flex flex-col overflow-hidden">
                        {/* Messages */}
                        <div className="flex-1 overflow-hidden">
                            <ChatPanel
                                messages={messages}
                                isLoading={isLoading}
                                showQuickFilters={!hasUserMessages}
                                onSendMessage={handleSendMessage}
                                onAudioCapture={handleAudioCapture}
                                onRemoveFilter={handleRemoveFilter}
                                onSuggestionClick={handleSuggestionClick}
                                isChatFirst={true}
                                hasUserMessages={hasUserMessages}
                            />
                        </div>

                        {/* Input — floating glass pill, pinned at bottom */}
                        <div className="flex-shrink-0 px-6 pb-8 max-w-3xl w-full mx-auto">
                            <ChatInput
                                onSendMessage={handleSendMessage}
                                onAudioCapture={handleAudioCapture}
                                isLoading={isLoading}
                            />
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 overflow-hidden">
                        <ResultsPanel
                            results={results}
                            viewMode="map"
                            onViewModeChange={() => {}}
                            selectedPropertyId={selectedPropertyId}
                            onSelectProperty={setSelectedPropertyId}
                            userLocation={userLocation}
                            isMobileFullscreen={true}
                            onBackToChat={() => setLayoutMode('chat')}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}

