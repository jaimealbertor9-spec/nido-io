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
    // Phase A: Uses mock data. Phase B: Replace with API call.
    // ═══════════════════════════════════════════════════════════
    const handleSendMessage = useCallback((text: string) => {
        if (!text.trim() || isLoading) return;

        // Append user message
        const userMessage: ChatMessage = {
            id: uuidv4(),
            role: 'user',
            content: text.trim(),
            timestamp: new Date(),
            isNew: true,
        };

        setMessages(prev => [...prev, userMessage]);
        setIsLoading(true);

        // Simulate AI response delay (1.2s)
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

        // Append a system message acknowledging voice input
        const voiceMessage: ChatMessage = {
            id: uuidv4(),
            role: 'user',
            content: '🎙️ Búsqueda por voz',
            timestamp: new Date(),
            isNew: true,
        };
        setMessages(prev => [...prev, voiceMessage]);
        setIsLoading(true);

        // Mock: treat voice as a generic search
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

        // Inject a synthetic message confirming removal
        handleSendMessage(`Quitar filtro: ${filterKey.replace('poi_', '').replace('_', ' ')}`);
    }, [activeFilters, handleSendMessage]);

    // ═══════════════════════════════════════════════════════════
    // SUGGESTION CLICK — Just inject as user message
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
    // RENDER
    // ═══════════════════════════════════════════════════════════
    return (
        <div className="flex flex-col lg:flex-row h-[100dvh] bg-[#F3F4F6] overflow-hidden">
            {/* ── CHAT PANEL ─────────────────────────────────── */}
            <div className={`
                w-full lg:w-[40%] lg:max-w-[520px]
                h-[100dvh]
                flex-shrink-0
                bg-white
                border-r border-gray-200/50
                ${mobileView === 'results' ? 'hidden md:flex' : 'flex'}
                flex-col
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

            {/* ── RESULTS PANEL ──────────────────────────────── */}
            <div className={`
                flex-1
                h-[100dvh]
                ${mobileView === 'chat' ? 'hidden md:flex' : 'flex'}
                flex-col
                min-w-0
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

            {/* ── MOBILE FAB ─────────────────────────────────── */}
            <MobileViewToggle
                currentView={mobileView}
                onToggle={toggleMobileView}
                resultCount={results.length}
            />
        </div>
    );
}
