'use client';

import { InmuebleFormData, TipoNegocio } from '@/lib/supabase';

interface StepDatosProps {
    formData: InmuebleFormData;
    onChange: (data: Partial<InmuebleFormData>) => void;
}

const TIPOS_INMUEBLE = [
    { value: 'apartamento', label: '🏢 Apartamento', emoji: '🏢' },
    { value: 'casa', label: '🏠 Casa', emoji: '🏠' },
    { value: 'habitacion', label: '🛏️ Habitación', emoji: '🛏️' },
    { value: 'local', label: '� Local', emoji: '🏪' },
    { value: 'lote', label: '📐 Lote', emoji: '📐' },
    { value: 'oficina', label: '�️ Oficina', emoji: '�️' },
    { value: 'apartaestudio', label: '🏨 Apartaestudio', emoji: '🏨' },
    { value: 'bodega', label: '� Bodega', emoji: '�' },
    { value: 'edificio', label: '🏗️ Edificio', emoji: '🏗️' },
    { value: 'casa_lote', label: '� Casa Lote', emoji: '�' },
];

const TIPOS_NEGOCIO: { value: TipoNegocio; label: string; descripcion: string }[] = [
    { value: 'arriendo', label: '🔑 Arriendo', descripcion: 'Canon mensual' },
    { value: 'venta', label: '💰 Venta', descripcion: 'Precio total' },
    { value: 'dias', label: '📅 Por días', descripcion: 'Precio por día' },
];

export default function StepDatos({ formData, onChange }: StepDatosProps) {
    return (
        <div className="space-y-6 animate-slide-up">
            <div className="text-center mb-8">
                <span className="text-4xl mb-4 block">🏠</span>
                <h2 className="text-2xl font-bold text-gray-800">Detalles del inmueble</h2>
                <p className="text-gray-500 mt-2">Cuéntanos más sobre tu propiedad</p>
            </div>

            {/* Tipo de negocio */}
            <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                    ¿Qué quieres hacer? *
                </label>
                <div className="grid grid-cols-3 gap-3">
                    {TIPOS_NEGOCIO.map((tipo) => (
                        <button
                            key={tipo.value}
                            type="button"
                            onClick={() => onChange({ tipo_negocio: tipo.value })}
                            className={`
                p-4 rounded-xl border-2 transition-all duration-200 text-left
                ${formData.tipo_negocio === tipo.value
                                    ? 'border-nido-500 bg-nido-50 shadow-lg shadow-nido-100'
                                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}
              `}
                        >
                            <span className="text-xl">{tipo.label.split(' ')[0]}</span>
                            <p className="font-semibold text-gray-800 mt-1">{tipo.label.split(' ').slice(1).join(' ')}</p>
                            <p className="text-xs text-gray-400">{tipo.descripcion}</p>
                        </button>
                    ))}
                </div>
            </div>

            {/* Tipo de inmueble */}
            <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Tipo de inmueble *
                </label>
                <div className="flex flex-wrap gap-2">
                    {TIPOS_INMUEBLE.map((tipo) => (
                        <button
                            key={tipo.value}
                            type="button"
                            onClick={() => onChange({ tipo_inmueble: tipo.value })}
                            className={`
                px-4 py-2 rounded-full border-2 transition-all duration-200 font-medium
                ${formData.tipo_inmueble === tipo.value
                                    ? 'border-nido-500 bg-nido-500 text-white'
                                    : 'border-gray-200 text-gray-600 hover:border-gray-300'}
              `}
                        >
                            {tipo.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Precio */}
            <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Precio {formData.tipo_negocio === 'venta' ? 'de venta' : formData.tipo_negocio === 'dias' ? 'por día' : 'mensual'} *
                </label>
                <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium">$</span>
                    <input
                        type="number"
                        value={formData.precio || ''}
                        onChange={(e) => onChange({ precio: parseInt(e.target.value) || 0 })}
                        placeholder="700000"
                        className="input-base pl-8"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">COP</span>
                </div>
            </div>

            {/* Habitaciones y Baños */}
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Habitaciones
                    </label>
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => onChange({ habitaciones: Math.max(0, formData.habitaciones - 1) })}
                            className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 text-lg font-bold"
                        >
                            −
                        </button>
                        <span className="text-2xl font-bold text-gray-800 w-8 text-center">
                            {formData.habitaciones}
                        </span>
                        <button
                            type="button"
                            onClick={() => onChange({ habitaciones: formData.habitaciones + 1 })}
                            className="w-10 h-10 rounded-full bg-nido-100 hover:bg-nido-200 text-nido-700 text-lg font-bold"
                        >
                            +
                        </button>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Baños
                    </label>
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => onChange({ banos: Math.max(0, formData.banos - 1) })}
                            className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 text-lg font-bold"
                        >
                            −
                        </button>
                        <span className="text-2xl font-bold text-gray-800 w-8 text-center">
                            {formData.banos}
                        </span>
                        <button
                            type="button"
                            onClick={() => onChange({ banos: formData.banos + 1 })}
                            className="w-10 h-10 rounded-full bg-nido-100 hover:bg-nido-200 text-nido-700 text-lg font-bold"
                        >
                            +
                        </button>
                    </div>
                </div>
            </div>

            {/* Área */}
            <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Área aproximada (opcional)
                </label>
                <div className="relative">
                    <input
                        type="number"
                        value={formData.area_m2 || ''}
                        onChange={(e) => onChange({ area_m2: parseInt(e.target.value) || 0 })}
                        placeholder="120"
                        className="input-base"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">m²</span>
                </div>
            </div>

            {/* Checkboxes de características */}
            <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                    ¿Qué tiene tu inmueble?
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {[
                        { key: 'tiene_garaje', label: '🚗 Garaje', emoji: '🚗' },
                        { key: 'tiene_local', label: '🏪 Local comercial', emoji: '🏪' },
                        { key: 'tiene_sala', label: '🛋️ Sala', emoji: '🛋️' },
                        { key: 'tiene_comedor', label: '🍽️ Comedor', emoji: '🍽️' },
                        { key: 'tiene_patio', label: '🌿 Patio', emoji: '🌿' },
                    ].map((item) => (
                        <label
                            key={item.key}
                            className={`
                flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all
                ${(formData as any)[item.key]
                                    ? 'border-nido-500 bg-nido-50'
                                    : 'border-gray-200 hover:border-gray-300'}
              `}
                        >
                            <input
                                type="checkbox"
                                checked={(formData as any)[item.key]}
                                onChange={(e) => onChange({ [item.key]: e.target.checked })}
                                className="w-5 h-5 rounded border-gray-300 text-nido-600 focus:ring-nido-500"
                            />
                            <span className="font-medium text-gray-700">{item.label}</span>
                        </label>
                    ))}
                </div>
            </div>
        </div>
    );
}
