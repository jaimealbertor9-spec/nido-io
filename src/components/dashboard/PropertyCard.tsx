import { Inmueble, formatCOP, EstadoInmueble } from '@/lib/supabase';

interface PropertyCardProps {
    inmueble: Inmueble;
}

// Status badge configuration
const statusConfig: Record<EstadoInmueble, { label: string; className: string }> = {
    publicado: {
        label: 'Publicado',
        className: 'bg-nido-100 text-nido-700 border-nido-200',
    },
    borrador: {
        label: 'Borrador',
        className: 'bg-accent-100 text-accent-700 border-accent-200',
    },
    pendiente_pago: {
        label: 'Pendiente Pago',
        className: 'bg-orange-100 text-orange-700 border-orange-200',
    },
    en_revision: {
        label: 'En Revisión',
        className: 'bg-amber-100 text-amber-700 border-amber-200',
    },
    pausado: {
        label: 'Pausado',
        className: 'bg-gray-100 text-gray-600 border-gray-200',
    },
    expirado: {
        label: 'Expirado',
        className: 'bg-red-100 text-red-700 border-red-200',
    },
    rechazado: {
        label: 'Rechazado',
        className: 'bg-red-100 text-red-700 border-red-200',
    },
    vendido: {
        label: 'Vendido',
        className: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    },
    alquilado: {
        label: 'Alquilado',
        className: 'bg-blue-100 text-blue-700 border-blue-200',
    },
};

const tipoNegocioLabels: Record<string, string> = {
    arriendo: '/mes',
    venta: '',
    dias: '/día',
};

export default function PropertyCard({ inmueble }: PropertyCardProps) {
    const status = statusConfig[inmueble.estado] || statusConfig.borrador;
    const priceLabel = tipoNegocioLabels[inmueble.tipo_negocio] || '';

    // Truncate title if too long
    const displayTitle = inmueble.titulo.length > 40
        ? inmueble.titulo.slice(0, 40) + '...'
        : inmueble.titulo;

    return (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1 group">
            {/* Image */}
            <div className="relative h-40 bg-gradient-to-br from-nido-400 via-nido-500 to-nido-600 overflow-hidden">
                {/* Decorative elements */}
                <div className="absolute inset-0 opacity-20">
                    <div className="absolute top-1/4 left-1/4 w-20 h-20 bg-white rounded-full blur-2xl" />
                    <div className="absolute bottom-1/4 right-1/4 w-16 h-16 bg-accent-300 rounded-full blur-xl" />
                </div>

                {/* Placeholder icon */}
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-5xl opacity-80 group-hover:scale-110 transition-transform duration-300">🏠</span>
                </div>

                {/* Status badge (positioned on image) */}
                <div className="absolute top-3 right-3">
                    <span className={`
                        inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide
                        border backdrop-blur-sm
                        ${status.className}
                    `}>
                        {status.label}
                    </span>
                </div>
            </div>

            {/* Content */}
            <div className="p-4">
                {/* Title */}
                <h3 className="font-bold text-gray-800 text-lg leading-tight mb-2 line-clamp-1">
                    {displayTitle}
                </h3>

                {/* Price */}
                <p className="text-xl font-extrabold text-nido-600 mb-2">
                    {formatCOP(inmueble.precio)}
                    {priceLabel && (
                        <span className="text-sm font-medium text-gray-400 ml-1">
                            {priceLabel}
                        </span>
                    )}
                </p>

                {/* Location */}
                <p className="text-gray-500 text-sm flex items-center gap-1">
                    <span>📍</span>
                    {inmueble.barrio || 'Sin ubicación'}, Líbano
                </p>

                {/* Property specs */}
                <div className="flex gap-3 mt-3 text-gray-500 text-sm">
                    {inmueble.habitaciones && (
                        <span className="flex items-center gap-1">
                            <span>🛏️</span> {inmueble.habitaciones}
                        </span>
                    )}
                    {inmueble.banos && (
                        <span className="flex items-center gap-1">
                            <span>🚿</span> {inmueble.banos}
                        </span>
                    )}
                    {inmueble.area_m2 && (
                        <span className="flex items-center gap-1">
                            <span>📐</span> {inmueble.area_m2}m²
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}
