'use client';

import { Sparkles, MapPin, Home, TrendingUp } from 'lucide-react';

interface QuickFiltersProps {
    onSelect: (text: string) => void;
    visible: boolean; // Only show before first user message
}

const QUICK_CHIPS = [
    { icon: <Home className="w-3.5 h-3.5" />, label: 'Apartamentos en Bogotá', color: 'bg-primary-container/40 text-on-primary-container border-primary-container/60 hover:bg-primary-container/60' },
    { icon: <MapPin className="w-3.5 h-3.5" />, label: 'Cerca de un parque', color: 'bg-emerald-50/60 text-emerald-700 border-emerald-200/40 hover:bg-emerald-100/60' },
    { icon: <TrendingUp className="w-3.5 h-3.5" />, label: 'Arriendos baratos en Líbano', color: 'bg-amber-50/60 text-amber-700 border-amber-200/40 hover:bg-amber-100/60' },
    { icon: <Sparkles className="w-3.5 h-3.5" />, label: 'Finca con piscina por días', color: 'bg-iris/10 text-surface-tint border-iris/20 hover:bg-iris/20' },
];

export default function QuickFilters({ onSelect, visible }: QuickFiltersProps) {
    if (!visible) return null;

    return (
        <div className="px-4 py-3 flex flex-col items-center">
            <p className="text-xs text-on-surface-variant/50 mb-2 font-medium text-center">Prueba algo como:</p>
            <div className="flex flex-wrap justify-center gap-2">
                {QUICK_CHIPS.map((chip) => (
                    <button
                        key={chip.label}
                        onClick={() => onSelect(chip.label)}
                        className={`
                            inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full
                            text-xs font-medium border backdrop-blur-sm
                            transition-all duration-200
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
