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
        <div className="flex flex-col h-full bg-gray-50">
            {/* Header with toggle */}
            <div className="flex items-center justify-between px-4 py-3 bg-white/80 backdrop-blur-xl border-b border-gray-100">
                <div className="flex items-center gap-3">
                    {/* Back button (mobile fullscreen only) */}
                    {isMobileFullscreen && onBackToChat && (
                        <button
                            onClick={onBackToChat}
                            className="p-2 -ml-1 rounded-xl text-gray-500 hover:bg-gray-100 transition-colors md:hidden"
                            aria-label="Volver al chat"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                    )}
                    <h2 className="text-sm font-semibold text-gray-700">
                        Resultados
                        {results.length > 0 && (
                            <span className="ml-1.5 text-xs font-normal text-gray-400">
                                ({results.length})
                            </span>
                        )}
                    </h2>
                </div>

                {/* View Toggle */}
                <div className="flex bg-gray-100 rounded-lg p-0.5">
                    <button
                        onClick={() => onViewModeChange('map')}
                        className={`
                            flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium
                            transition-all duration-200
                            ${viewMode === 'map'
                                ? 'bg-white text-nido-700 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                            }
                        `}
                    >
                        <Map className="w-3.5 h-3.5" />
                        Mapa
                    </button>
                    <button
                        onClick={() => onViewModeChange('list')}
                        className={`
                            flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium
                            transition-all duration-200
                            ${viewMode === 'list'
                                ? 'bg-white text-nido-700 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                            }
                        `}
                    >
                        <List className="w-3.5 h-3.5" />
                        Lista
                    </button>
                </div>
            </div>

            {/* Content */}
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
