'use client';

import { Map, MessageSquare } from 'lucide-react';

interface MobileViewToggleProps {
    currentView: 'chat' | 'results';
    onToggle: () => void;
    resultCount: number;
}

export default function MobileViewToggle({ currentView, onToggle, resultCount }: MobileViewToggleProps) {
    return (
        <button
            onClick={onToggle}
            className="
                fixed bottom-6 right-6 z-50
                md:hidden
                w-14 h-14 rounded-full
                bg-nido-700 text-white
                shadow-2xl shadow-nido-700/40
                flex items-center justify-center
                hover:bg-nido-600 active:scale-95
                transition-all duration-200
            "
            aria-label={currentView === 'chat' ? 'Ver mapa' : 'Ver chat'}
        >
            {currentView === 'chat' ? (
                <div className="relative">
                    <Map className="w-6 h-6" />
                    {resultCount > 0 && (
                        <span className="absolute -top-2 -right-2 w-5 h-5 bg-accent-500 text-[10px] font-bold rounded-full flex items-center justify-center">
                            {resultCount > 9 ? '9+' : resultCount}
                        </span>
                    )}
                </div>
            ) : (
                <MessageSquare className="w-6 h-6" />
            )}
        </button>
    );
}
