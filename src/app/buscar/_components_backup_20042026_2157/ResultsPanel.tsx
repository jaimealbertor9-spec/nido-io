'use client';

import { Map, List, ArrowLeft } from 'lucide-react';
import { SearchResult } from './types';
import ResultsMap from './ResultsMap';
import ResultsList from './ResultsList';

interface ResultsPanelProps {
    results: SearchResult[];
    viewMode: 'map' | 'list';
    onViewModeChange: (mode: 'map' | 'list') => void;
    selectedPropertyId?: string | null;
    onSelectProperty?: (id: string) => void;
    userLocation?: { lat: number; lng: number } | null;
    // Mobile-specific
    isMobileFullscreen?: boolean;
    onBackToChat?: () => void;
}

export default function ResultsPanel({
    results,
    viewMode,
    onViewModeChange,
    selectedPropertyId,
    onSelectProperty,
    userLocation,
    isMobileFullscreen,
    onBackToChat,
}: ResultsPanelProps) {
    return (
        <div className="flex flex-col h-full bg-white/40 backdrop-blur-sm rounded-2xl lg:rounded-3xl overflow-hidden">
            {/* ── Serenity Header with glass toggle ── */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/30 flex-shrink-0">
                <div className="flex items-center gap-3">
                    {/* Back button (mobile fullscreen only) */}
                    {isMobileFullscreen && onBackToChat && (
                        <button
                            onClick={onBackToChat}
                            className="p-2 -ml-1 rounded-xl text-on-surface-variant hover:bg-white/50 transition-colors lg:hidden"
                            aria-label="Volver al chat"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                    )}
                    <h2 className="text-sm font-semibold text-on-surface">
                        Resultados
                        {results.length > 0 && (
                            <span className="ml-1.5 text-xs font-normal text-on-surface-variant/60">
                                ({results.length})
                            </span>
                        )}
                    </h2>
                </div>

                {/* ── View Toggle (glass pill) ── */}
                <div className="flex bg-white/50 backdrop-blur-sm rounded-xl p-0.5 border border-white/40">
                    <button
                        onClick={() => onViewModeChange('map')}
                        className={`
                            flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                            transition-all duration-200
                            ${viewMode === 'map'
                                ? 'bg-white text-surface-tint shadow-sm'
                                : 'text-on-surface-variant hover:text-on-surface'
                            }
                        `}
                    >
                        <Map className="w-3.5 h-3.5" />
                        Mapa
                    </button>
                    <button
                        onClick={() => onViewModeChange('list')}
                        className={`
                            flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                            transition-all duration-200
                            ${viewMode === 'list'
                                ? 'bg-white text-surface-tint shadow-sm'
                                : 'text-on-surface-variant hover:text-on-surface'
                            }
                        `}
                    >
                        <List className="w-3.5 h-3.5" />
                        Lista
                    </button>
                </div>
            </div>

            {/* ── Content ── */}
            <div className="flex-1 min-h-0">
                {viewMode === 'map' ? (
                    <ResultsMap
                        results={results}
                        selectedPropertyId={selectedPropertyId}
                        onSelectProperty={onSelectProperty}
                        userLocation={userLocation}
                    />
                ) : (
                    <ResultsList
                        results={results}
                        selectedPropertyId={selectedPropertyId}
                        onSelectProperty={onSelectProperty}
                    />
                )}
            </div>
        </div>
    );
}
