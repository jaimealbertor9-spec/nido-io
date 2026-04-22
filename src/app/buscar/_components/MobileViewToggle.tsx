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
                lg:hidden
                w-14 h-14 rounded-full
                bg-surface-tint text-white
                shadow-2xl shadow-surface-tint/30
                flex items-center justify-center
                hover:bg-iris active:scale-95
                transition-all duration-300
                backdrop-blur-sm
            "
            aria-label={currentView === 'chat' ? 'Ver mapa' : 'Ver chat'}
        >
            {currentView === 'chat' ? (
                <div className="relative">
                    <Map className="w-6 h-6" />
                    {resultCount > 0 && (
                        <span className="absolute -top-2 -right-2 w-5 h-5 bg-rose-mist text-white text-[10px] font-bold rounded-full flex items-center justify-center">
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
