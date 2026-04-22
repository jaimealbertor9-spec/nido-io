'use client';

import { Sparkles, MapPin, Home, TrendingUp } from 'lucide-react';

interface QuickFiltersProps {
    onSelect: (text: string) => void;
    visible: boolean; // Only show before first user message
}

const QUICK_CHIPS = [
    { icon: <Home className="w-3.5 h-3.5" />, label: 'Apartamentos en Bogotá', color: 'bg-nido-50 text-nido-700 border-nido-200 hover:bg-nido-100' },
    { icon: <MapPin className="w-3.5 h-3.5" />, label: 'Cerca de un parque', color: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' },
    { icon: <TrendingUp className="w-3.5 h-3.5" />, label: 'Arriendos baratos en Líbano', color: 'bg-accent-50 text-accent-700 border-accent-200 hover:bg-accent-100' },
    { icon: <Sparkles className="w-3.5 h-3.5" />, label: 'Finca con piscina por días', color: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100' },
];

export default function QuickFilters({ onSelect, visible }: QuickFiltersProps) {
    if (!visible) return null;

    return (
        <div className="px-4 py-3">
            <p className="text-xs text-gray-400 mb-2 font-medium">Prueba algo como:</p>
            <div className="flex flex-wrap gap-2">
                {QUICK_CHIPS.map((chip) => (
                    <button
                        key={chip.label}
                        onClick={() => onSelect(chip.label)}
                        className={`
                            inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full
                            text-xs font-medium border transition-all duration-200
                            hover:-translate-y-0.5 hover:shadow-sm active:scale-95
                            ${chip.color}
                        `}
                    >
                        {chip.icon}
                        {chip.label}
                    </button>
                ))}
            </div>
        </div>
    );
}
