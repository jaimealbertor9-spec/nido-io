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
                SIDEBAR — floating pill, 80% height, centered
                White-glass, independent from the content area
            ══════════════════════════════════════════════ */}
            <aside className="fixed left-4 z-20 flex flex-col items-center py-6"
                style={{
                    top: '5vh',
                    height: '90vh',
                    width: '60px',
                    background: 'rgba(255, 255, 255, 0.62)',
                    backdropFilter: 'blur(28px)',
                    WebkitBackdropFilter: 'blur(28px)',
                    borderRadius: '20px',
                    border: '1px solid rgba(255, 255, 255, 0.85)',
                    boxShadow: '0 8px 32px rgba(180, 160, 220, 0.12), 0 2px 8px rgba(255, 182, 193, 0.10)',
                }}>

                {/* Logo — top of bar */}
                <div className="relative flex-shrink-0" style={{ width: '38px', height: '38px', background: 'none' }}>
                    <Image
                        src="/Logo solo Nido.png"
                        alt="Nido"
                        fill
                        sizes="56px"
                        className="object-contain"
                        style={{ mixBlendMode: 'multiply' }}
                    />
                </div>

                {/* Spacer — pushes nav to vertical center */}
                <div className="flex-1" />

                {/* Nav icons — vertically centered */}
                <nav className="flex flex-col items-center gap-3">

                    <button
                        onClick={handleNewChat}
                        title="Nueva búsqueda"
                        className="w-11 h-11 rounded-full flex items-center justify-center text-on-surface/40 hover:text-on-surface/70 hover:bg-white/50 transition-all duration-200"
                    >
                        <Plus className="w-5 h-5" />
                    </button>

                    <button
                        onClick={() => setLayoutMode('chat')}
                        title="Chat IA"
                        className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 ${
                            layoutMode === 'chat'
                                ? 'bg-white/80 text-surface-tint shadow-sm border border-white/90'
                                : 'text-on-surface/40 hover:text-on-surface/70 hover:bg-white/50'
                        }`}
                    >
                        <MessageSquare className="w-5 h-5" />
                    </button>

                    <button
                        onClick={() => setLayoutMode('map')}
                        title="Ver en el mapa"
                        className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 relative ${
                            layoutMode === 'map'
                                ? 'bg-white/80 text-surface-tint shadow-sm border border-white/90'
                                : 'text-on-surface/40 hover:text-on-surface/70 hover:bg-white/50'
                        }`}
                    >
                        <Map className="w-5 h-5" />
                        {results.length > 0 && (
                            <span className="absolute top-1 right-1 w-2 h-2 bg-surface-tint rounded-full ring-2 ring-white/60" />
                        )}
                    </button>
                </nav>

                {/* Spacer — keeps nav centered, pushes recent to bottom */}
                <div className="flex-1" />

                {hasUserMessages && (
                    <button
                        title="Búsqueda reciente"
                        className="w-11 h-11 rounded-full flex items-center justify-center text-on-surface/30 hover:text-on-surface/60 hover:bg-white/50 transition-all duration-200 mt-auto"
                    >
                        <Search className="w-5 h-5" />
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

