'use client';

import { SearchIntent, POI_CATEGORY_META, FILTER_ICONS } from './types';

interface FilterChipsProps {
    filters: SearchIntent;
    isLatest: boolean; // Only the latest message's chips are interactive
    onRemoveFilter?: (key: string, value?: string) => void;
}

type ChipData = {
    key: string;
    icon: string;
    label: string;
    isNew?: boolean;
};

function buildChips(filters: SearchIntent): ChipData[] {
    const chips: ChipData[] = [];

    if (filters.tipo_inmueble) {
        chips.push({
            key: 'tipo_inmueble',
            icon: FILTER_ICONS.tipo_inmueble,
            label: filters.tipo_inmueble.charAt(0).toUpperCase() + filters.tipo_inmueble.slice(1),
        });
    }

    if (filters.tipo_negocio) {
        const labels: Record<string, string> = { arriendo: 'Arriendo', venta: 'Venta', dias: 'Por días' };
        chips.push({
            key: 'tipo_negocio',
            icon: FILTER_ICONS.tipo_negocio,
            label: labels[filters.tipo_negocio] || filters.tipo_negocio,
        });
    }

    if (filters.ciudad) {
        chips.push({
            key: 'ciudad',
            icon: FILTER_ICONS.ciudad,
            label: filters.ciudad,
        });
    }

    if (filters.barrio) {
        chips.push({
            key: 'barrio',
            icon: '🏘️',
            label: filters.barrio,
        });
    }

    if (filters.precio_max) {
        chips.push({
            key: 'precio_max',
            icon: FILTER_ICONS.precio_max,
            label: `≤ $${(filters.precio_max / 1000000).toFixed(1)}M`,
        });
    }

    if (filters.precio_min) {
        chips.push({
            key: 'precio_min',
            icon: FILTER_ICONS.precio_min,
            label: `≥ $${(filters.precio_min / 1000000).toFixed(1)}M`,
        });
    }

    if (filters.habitaciones_min) {
        chips.push({
            key: 'habitaciones_min',
            icon: FILTER_ICONS.habitaciones_min,
            label: `${filters.habitaciones_min}+ hab.`,
        });
    }

    if (filters.banos_min) {
        chips.push({
            key: 'banos_min',
            icon: FILTER_ICONS.banos_min,
            label: `${filters.banos_min}+ baños`,
        });
    }

    // POI filters — the multi-POI chips
    if (filters.poi_filters) {
        for (const pf of filters.poi_filters) {
            const meta = POI_CATEGORY_META[pf.category];
            chips.push({
                key: `poi_${pf.category}`,
                icon: meta?.icon || '📍',
                label: `${meta?.label || pf.category} ≤${pf.max_distance_m}m`,
            });
        }
    }

    if (filters.sort_by) {
        const sortLabels: Record<string, string> = {
            precio_asc: 'Más baratos',
            precio_desc: 'Más caros',
            distancia: 'Más cercanos',
            reciente: 'Más recientes',
        };
        chips.push({
            key: 'sort_by',
            icon: FILTER_ICONS.sort_by,
            label: sortLabels[filters.sort_by] || filters.sort_by,
        });
    }

    return chips;
}

export default function FilterChips({ filters, isLatest, onRemoveFilter }: FilterChipsProps) {
    const chips = buildChips(filters);

    if (chips.length === 0) return null;

    return (
        <div className="mb-3">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                Filtros activos
            </p>
            <div className="flex flex-wrap gap-1.5">
                {chips.map((chip) => (
                    <span
                        key={chip.key}
                        className={`
                            inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium
                            border transition-all duration-200
                            ${chip.key.startsWith('poi_')
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-nido-50 text-nido-700 border-nido-200'
                            }
                        `}
                    >
                        <span className="text-sm">{chip.icon}</span>
                        {chip.label}
                        {isLatest && onRemoveFilter && (
                            <button
                                onClick={() => onRemoveFilter(chip.key)}
                                className="ml-0.5 w-4 h-4 inline-flex items-center justify-center rounded-full
                                    hover:bg-black/10 transition-colors text-current opacity-60 hover:opacity-100"
                                aria-label={`Quitar filtro: ${chip.label}`}
                            >
                                ×
                            </button>
                        )}
                    </span>
                ))}
            </div>
        </div>
    );
}
