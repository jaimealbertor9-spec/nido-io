'use client';

import { useState, useRef, useEffect } from 'react';
import { InmuebleFormData } from '@/lib/supabase';

interface StepUbicacionProps {
    formData: InmuebleFormData;
    onChange: (data: Partial<InmuebleFormData>) => void;
    barrios: string[];
}

export default function StepUbicacion({ formData, onChange, barrios }: StepUbicacionProps) {
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [filteredBarrios, setFilteredBarrios] = useState<string[]>([]);
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Filtrar barrios según lo que escribe el usuario
    useEffect(() => {
        if (formData.barrio.trim()) {
            const filtered = barrios.filter(b =>
                b.toLowerCase().includes(formData.barrio.toLowerCase())
            );
            setFilteredBarrios(filtered);
        } else {
            setFilteredBarrios(barrios);
        }
    }, [formData.barrio, barrios]);

    // Cerrar sugerencias al hacer clic fuera
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setShowSuggestions(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectBarrio = (barrio: string) => {
        onChange({ barrio });
        setShowSuggestions(false);
    };

    return (
        <div className="space-y-6 animate-slide-up">
            <div className="text-center mb-8">
                <span className="text-5xl mb-4 block">📍</span>
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-800">¿Dónde está tu inmueble?</h2>
                <p className="text-gray-500 mt-2">Escribe el barrio y la dirección</p>
            </div>

            {/* Barrio con autocomplete */}
            <div ref={wrapperRef} className="relative">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Barrio *
                </label>
                <input
                    type="text"
                    value={formData.barrio}
                    onChange={(e) => onChange({ barrio: e.target.value })}
                    onFocus={() => setShowSuggestions(true)}
                    placeholder="Escribe el nombre del barrio..."
                    className="input-base text-lg py-4"
                    autoComplete="off"
                />

                {/* Dropdown de sugerencias */}
                {showSuggestions && filteredBarrios.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                        {filteredBarrios.map((barrio) => (
                            <button
                                key={barrio}
                                type="button"
                                onClick={() => selectBarrio(barrio)}
                                className={`w-full text-left px-4 py-3 hover:bg-nido-50 transition-colors flex items-center gap-2 ${formData.barrio === barrio ? 'bg-nido-50 text-nido-700' : 'text-gray-700'
                                    }`}
                            >
                                <span className="text-nido-500">📍</span>
                                {barrio}
                            </button>
                        ))}
                    </div>
                )}

                <p className="text-xs text-gray-400 mt-1">
                    💡 Selecciona de la lista o escribe uno nuevo
                </p>
            </div>

            {/* Dirección */}
            <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Dirección o referencia
                </label>
                <input
                    type="text"
                    value={formData.direccion}
                    onChange={(e) => onChange({ direccion: e.target.value })}
                    placeholder="Ej: Calle 5 #12-34, frente al parque..."
                    className="input-base text-lg py-4"
                />
                <p className="text-xs text-gray-400 mt-1">
                    Puedes agregar referencias para que te encuentren más fácil
                </p>
            </div>

            {/* Mapa placeholder con animación */}
            <div className="bg-gradient-to-br from-nido-50 to-accent-50 rounded-2xl p-8 text-center border-2 border-dashed border-nido-200 transition-all duration-300">
                <span className="text-4xl">🗺️</span>
                <p className="text-gray-500 mt-2 text-sm">
                    Ubicación en Líbano, Tolima
                </p>
                {formData.barrio && (
                    <div className="mt-4 inline-flex items-center gap-2 bg-white px-5 py-3 rounded-full shadow-md animate-fade-in">
                        <span className="text-nido-600 text-xl">📍</span>
                        <span className="font-semibold text-gray-700">{formData.barrio}</span>
                        <span className="text-gray-400">• Líbano, Tolima</span>
                    </div>
                )}
            </div>
        </div>
    );
}
