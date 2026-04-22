'use client';

import { useState, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { ChatMessage, SearchResult, SearchIntent } from './types';
import { generateMockResponse } from './mockData';
import ChatPanel from './ChatPanel';
import ResultsPanel from './ResultsPanel';
import MobileViewToggle from './MobileViewToggle';

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
    // ── Core State ─────────────────────────────────────────────
    const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
    const [isLoading, setIsLoading] = useState(false);
    const [results, setResults] = useState<SearchResult[]>([]);
    const [activeFilters, setActiveFilters] = useState<SearchIntent>({});

    // ── View State ─────────────────────────────────────────────
    const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
    const [mobileView, setMobileView] = useState<'chat' | 'results'>('chat');

    // ── Selection ──────────────────────────────────────────────
    const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);

    // ── Geolocation ───────
    const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

    useEffect(() => {
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setUserLocation({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    });
                },
                (error) => {
                    console.error("Error obteniendo ubicación:", error);
                }
            );
        }
    }, []);

    // ── Derived ────────────────────────────────────────────────
    const hasUserMessages = messages.some(m => m.role === 'user');

    // ═══════════════════════════════════════════════════════════
    // SEND MESSAGE HANDLER
    // ═══════════════════════════════════════════════════════════
    const handleSendMessage = useCallback((text: string) => {
        if (!text.trim() || isLoading) return;

        const userMessage: ChatMessage = {
            id: uuidv4(),
            role: 'user',
            content: text.trim(),
            timestamp: new Date(),
            isNew: true,
        };

        setMessages(prev => [...prev, userMessage]);
        setIsLoading(true);

        setTimeout(() => {
            const { message: aiMessage, intent, results: newResults } = generateMockResponse(
                text,
                activeFilters
            );

            setMessages(prev => [...prev, aiMessage]);
            setActiveFilters(intent);
            setResults(newResults);
            setIsLoading(false);
        }, 1200);
    }, [isLoading, activeFilters]);

    // ═══════════════════════════════════════════════════════════
    // AUDIO CAPTURE (Phase A: Mock response)
    // ═══════════════════════════════════════════════════════════
    const handleAudioCapture = useCallback((base64: string) => {
        console.log('[BuscarClient] Audio captured, length:', base64.length);

        const voiceMessage: ChatMessage = {
            id: uuidv4(),
            role: 'user',
            content: '🎙️ Búsqueda por voz',
            timestamp: new Date(),
            isNew: true,
        };
        setMessages(prev => [...prev, voiceMessage]);
        setIsLoading(true);

        setTimeout(() => {
            const { message, intent, results: newResults } = generateMockResponse(
                'Apartamentos en Bogotá cerca de un parque',
                activeFilters
            );

            const voiceResponse: ChatMessage = {
                ...message,
                content: '🎙️ He procesado tu búsqueda por voz. ' + message.content,
            };

            setMessages(prev => [...prev, voiceResponse]);
            setActiveFilters(intent);
            setResults(newResults);
            setIsLoading(false);
        }, 1500);
    }, [activeFilters]);

    // ═══════════════════════════════════════════════════════════
    // FILTER REMOVAL
    // ═══════════════════════════════════════════════════════════
    const handleRemoveFilter = useCallback((filterKey: string) => {
        const newFilters = { ...activeFilters };

        if (filterKey.startsWith('poi_')) {
            const category = filterKey.replace('poi_', '');
            newFilters.poi_filters = (newFilters.poi_filters || []).filter(
                pf => pf.category !== category
            );
        } else {
            delete (newFilters as Record<string, unknown>)[filterKey];
        }

        setActiveFilters(newFilters);
        handleSendMessage(`Quitar filtro: ${filterKey.replace('poi_', '').replace('_', ' ')}`);
    }, [activeFilters, handleSendMessage]);

    // ═══════════════════════════════════════════════════════════
    // SUGGESTION CLICK
    // ═══════════════════════════════════════════════════════════
    const handleSuggestionClick = useCallback((text: string) => {
        handleSendMessage(text);
    }, [handleSendMessage]);

    // ═══════════════════════════════════════════════════════════
    // MOBILE VIEW TOGGLE
    // ═══════════════════════════════════════════════════════════
    const toggleMobileView = useCallback(() => {
        setMobileView(prev => prev === 'chat' ? 'results' : 'chat');
    }, []);

    // ═══════════════════════════════════════════════════════════
    // RENDER — Serenity Liquid Design
    // ═══════════════════════════════════════════════════════════
    return (
        <div className="flex flex-col h-[100dvh] bg-iridescent overflow-hidden">
            {/* ── FLOATING TOP APP BAR ─────────────────────────── */}
            <header className="flex items-center justify-between px-4 lg:px-6 py-3 flex-shrink-0 z-30">
                <div className="flex items-center gap-6">
                    {/* Logo */}
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-iris to-surface-tint flex items-center justify-center shadow-lg shadow-iris/20">
                            <span className="text-white text-sm font-bold">N</span>
                        </div>
                        <span className="text-lg font-bold text-on-surface tracking-tight hidden sm:block">
                            Nido<span className="text-surface-tint">.io</span>
                        </span>
                    </div>

                    {/* Nav Links (desktop) */}
                    <nav className="hidden lg:flex items-center gap-1">
                        <a href="/bienvenidos" className="px-3 py-1.5 rounded-full text-sm text-on-surface-variant hover:bg-white/50 hover:text-on-surface transition-all duration-200">
                            Inicio
                        </a>
                        <span className="px-3 py-1.5 rounded-full text-sm font-semibold text-surface-tint bg-primary-container/40">
                            Buscar
                        </span>
                    </nav>
                </div>

                {/* Right side: Consult AI CTA */}
                <div className="flex items-center gap-3">
                    <button className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-full bg-surface-tint text-white text-sm font-semibold shadow-lg shadow-surface-tint/25 hover:shadow-xl hover:shadow-surface-tint/30 hover:-translate-y-0.5 transition-all duration-300">
                        <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
                        Consultar IA
                    </button>
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-serenity-200 to-serenity-300 flex items-center justify-center">
                        <span className="text-xs font-bold text-serenity-700">U</span>
                    </div>
                </div>
            </header>

            {/* ── MAIN CONTENT ─────────────────────────────────── */}
            <div className="flex flex-1 min-h-0 px-2 lg:px-4 pb-2 lg:pb-4 gap-3">
                {/* ── CHAT PANEL ─────────────────────────────── */}
                <div className={`
                    w-full lg:w-[38%] lg:max-w-[480px]
                    flex-shrink-0
                    glass-panel rounded-2xl lg:rounded-3xl
                    ambient-shadow
                    ${mobileView === 'results' ? 'hidden lg:flex' : 'flex'}
                    flex-col
                    overflow-hidden
                `}>
                    <ChatPanel
                        messages={messages}
                        isLoading={isLoading}
                        showQuickFilters={!hasUserMessages}
                        onSendMessage={handleSendMessage}
                        onAudioCapture={handleAudioCapture}
                        onRemoveFilter={handleRemoveFilter}
                        onSuggestionClick={handleSuggestionClick}
                    />
                </div>

                {/* ── RESULTS PANEL ──────────────────────────── */}
                <div className={`
                    flex-1
                    ${mobileView === 'chat' ? 'hidden lg:flex' : 'flex'}
                    flex-col
                    min-w-0
                    rounded-2xl lg:rounded-3xl
                    overflow-hidden
                    ambient-shadow
                `}>
                    <ResultsPanel
                        results={results}
                        viewMode={viewMode}
                        onViewModeChange={setViewMode}
                        selectedPropertyId={selectedPropertyId}
                        onSelectProperty={setSelectedPropertyId}
                        userLocation={userLocation}
                        isMobileFullscreen={mobileView === 'results'}
                        onBackToChat={() => setMobileView('chat')}
                    />
                </div>
            </div>

            {/* ── MOBILE FAB ─────────────────────────────────── */}
            <MobileViewToggle
                currentView={mobileView}
                onToggle={toggleMobileView}
                resultCount={results.length}
            />
        </div>
    );
}
