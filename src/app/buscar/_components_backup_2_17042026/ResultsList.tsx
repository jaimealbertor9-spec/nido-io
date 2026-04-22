'use client';

import { SearchResult } from './types';
import SearchPropertyCard from './SearchPropertyCard';
import { Search } from 'lucide-react';

interface ResultsListProps {
    results: SearchResult[];
    selectedPropertyId?: string | null;
    onSelectProperty?: (id: string) => void;
}

export default function ResultsList({ results, selectedPropertyId, onSelectProperty }: ResultsListProps) {
    // ── Empty State ─────────────────────────────────────────────
    if (results.length === 0) {
        return (
            <div className="flex-1 flex items-center justify-center p-8">
                <div className="text-center max-w-sm">
                    {/* Animated decorative icon */}
                    <div className="relative w-24 h-24 mx-auto mb-6">
                        <div className="absolute inset-0 bg-gradient-to-br from-nido-100 to-nido-200/50 rounded-[28px] rotate-6 transition-transform" />
                        <div className="absolute inset-0 bg-white rounded-[28px] shadow-xl shadow-nido-100/50 flex items-center justify-center border border-nido-100/80">
                            <Search className="w-10 h-10 text-nido-400" strokeWidth={1.5} />
                        </div>
                    </div>

                    <h3 className="text-xl font-bold text-gray-800 mb-2 tracking-tight">
                        Tu hogar ideal te espera
                    </h3>
                    <p className="text-sm text-gray-400 leading-relaxed max-w-xs mx-auto">
                        Describe lo que buscas en el chat y te mostraremos las mejores opciones con su ubicación, precio y cercanía a lo que importa.
                    </p>

                    {/* Decorative dots */}
                    <div className="flex items-center justify-center gap-1.5 mt-6">
                        <span className="w-1.5 h-1.5 rounded-full bg-nido-200 animate-pulse" />
                        <span className="w-1.5 h-1.5 rounded-full bg-nido-300 animate-pulse [animation-delay:200ms]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-nido-400 animate-pulse [animation-delay:400ms]" />
                    </div>
                </div>
            </div>
        );
    }

    // ── Results Grid ────────────────────────────────────────────
    return (
        <div className="flex-1 overflow-y-auto">
            {/* Sticky header bar */}
            <div className="sticky top-0 z-10 bg-gray-50/80 backdrop-blur-xl px-5 py-3 border-b border-gray-100">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="w-6 h-6 bg-nido-100 rounded-lg flex items-center justify-center text-xs font-bold text-nido-700">
                            {results.length}
                        </span>
                        <p className="text-sm font-semibold text-gray-700">
                            resultado{results.length !== 1 ? 's' : ''}
                        </p>
                    </div>
                    <p className="text-xs text-gray-400 font-medium">
                        Ordenado por relevancia
                    </p>
                </div>
            </div>

            {/* Grid */}
            <div className="p-4 md:p-6">
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6">
                    {results.map((result) => (
                        <SearchPropertyCard
                            key={result.id}
                            property={result}
                            isSelected={selectedPropertyId === result.id}
                            onSelect={onSelectProperty}
                        />
                    ))}
                </div>

                {/* Bottom spacer for mobile FAB clearance */}
                <div className="pb-20 md:pb-6" />
            </div>
        </div>
    );
}
