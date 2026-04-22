'use client';

import { SearchResult } from './types';

interface SearchPropertyCardProps {
    property: SearchResult;
    isSelected?: boolean;
    onSelect?: (id: string) => void;
}

const tipoNegocioLabels: Record<string, string> = {
    arriendo: '/mes',
    venta: '',
    dias: '/noche',
};

const tipoInmuebleIcons: Record<string, string> = {
    apartamento: '🏢',
    casa: '🏠',
    finca: '🏡',
    local: '🏪',
    lote: '📐',
};

function formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value);
}

export default function SearchPropertyCard({ property, isSelected, onSelect }: SearchPropertyCardProps) {
    const priceLabel = tipoNegocioLabels[property.tipo_negocio] || '';
    const typeIcon = tipoInmuebleIcons[property.tipo_inmueble] || '🏠';

    return (
        <button
            onClick={() => onSelect?.(property.id)}
            className={`
                group w-full text-left
                glass-panel rounded-2xl overflow-hidden
                ambient-shadow hover:ambient-shadow-lg
                transition-all duration-300 ease-out
                hover:-translate-y-1
                border
                ${isSelected
                    ? 'border-surface-tint/40 ring-4 ring-primary-container/50 shadow-lg'
                    : 'border-white/40 hover:border-surface-tint/20'
                }
            `}
        >
            {/* ── Image Area ─────────────────────────────────────── */}
            <div className="relative h-44 sm:h-48 bg-gradient-to-br from-iris/20 via-surface-tint/20 to-rose-mist/20 overflow-hidden">
                {/* Decorative ambient blurs */}
                <div className="absolute inset-0 opacity-30">
                    <div className="absolute -top-4 -left-4 w-32 h-32 bg-iris/40 rounded-full blur-3xl" />
                    <div className="absolute bottom-0 right-0 w-40 h-40 bg-surface-tint/30 rounded-full blur-3xl" />
                </div>

                {/* Center icon */}
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-20 h-20 rounded-3xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30 group-hover:scale-110 transition-transform duration-500">
                        <span className="text-4xl">{typeIcon}</span>
                    </div>
                </div>

                {/* Top row: type badge + POI badge */}
                <div className="absolute top-3 left-3 right-3 flex items-start justify-between">
                    <span className="bg-white/80 backdrop-blur-sm text-on-surface text-[11px] font-semibold px-2.5 py-1 rounded-lg capitalize">
                        {property.tipo_inmueble}
                    </span>
                    {property.closest_poi_name && property.closest_poi_distance_m !== undefined && (
                        <span className="bg-emerald-500/80 backdrop-blur-sm text-white text-[11px] font-semibold px-2.5 py-1 rounded-lg flex items-center gap-1">
                            🌳 {property.closest_poi_distance_m}m
                        </span>
                    )}
                </div>

                {/* Bottom: price pill */}
                <div className="absolute bottom-3 left-3">
                    <div className="bg-white/90 backdrop-blur-sm rounded-xl px-3 py-1.5 shadow-lg">
                        <span className="text-lg font-extrabold text-on-surface tracking-tight">
                            {formatCurrency(property.precio)}
                        </span>
                        {priceLabel && (
                            <span className="text-xs font-medium text-on-surface-variant ml-1">
                                {priceLabel}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Content Area ────────────────────────────────────── */}
            <div className="p-4">
                {/* Title */}
                <h4 className="font-bold text-on-surface text-[15px] leading-snug mb-1.5 line-clamp-2 group-hover:text-surface-tint transition-colors">
                    {property.titulo}
                </h4>

                {/* Location */}
                <p className="text-on-surface-variant text-sm flex items-center gap-1.5 mb-3">
                    <span className="text-surface-tint">📍</span>
                    {property.barrio}, {property.ciudad}
                </p>

                {/* Specs row */}
                <div className="flex items-center gap-1 flex-wrap">
                    {property.habitaciones > 0 && (
                        <span className="inline-flex items-center gap-1 bg-primary-container/30 text-on-primary-container text-xs font-medium px-2.5 py-1 rounded-lg">
                            🛏️ {property.habitaciones} hab.
                        </span>
                    )}
                    {property.banos > 0 && (
                        <span className="inline-flex items-center gap-1 bg-primary-container/30 text-on-primary-container text-xs font-medium px-2.5 py-1 rounded-lg">
                            🚿 {property.banos} baño{property.banos !== 1 ? 's' : ''}
                        </span>
                    )}
                    {property.area_m2 > 0 && (
                        <span className="inline-flex items-center gap-1 bg-primary-container/30 text-on-primary-container text-xs font-medium px-2.5 py-1 rounded-lg">
                            📐 {property.area_m2}m²
                        </span>
                    )}
                </div>

                {/* Amenities */}
                {property.amenities.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                        {property.amenities.slice(0, 3).map((amenity) => (
                            <span
                                key={amenity}
                                className="text-[11px] text-surface-tint bg-primary-container/20 px-2 py-0.5 rounded-md font-medium"
                            >
                                {amenity}
                            </span>
                        ))}
                        {property.amenities.length > 3 && (
                            <span className="text-[11px] text-on-surface-variant/50 px-1 py-0.5 font-medium">
                                +{property.amenities.length - 3}
                            </span>
                        )}
                    </div>
                )}

                {/* POI proximity detail */}
                {property.closest_poi_name && (
                    <div className="mt-3 pt-3 border-t border-outline-variant/20">
                        <p className="text-xs text-emerald-600 font-medium flex items-center gap-1.5">
                            <span className="w-5 h-5 bg-emerald-50 rounded-full flex items-center justify-center text-[10px]">🌳</span>
                            A {property.closest_poi_distance_m}m de {property.closest_poi_name}
                        </p>
                    </div>
                )}
            </div>
        </button>
    );
}
