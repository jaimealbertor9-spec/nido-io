'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { savePropertyFeatures } from '@/app/actions/saveFeatures';

export default function CaracteristicasPage() {
    const router = useRouter();
    const params = useParams();
    const propertyId = params.id as string;

    const [loading, setLoading] = useState(false);

    // Manual States
    const [habitaciones, setHabitaciones] = useState(0);
    const [banos, setBanos] = useState(0);
    const [area, setArea] = useState(0);
    const [estrato, setEstrato] = useState(3);
    const [servicios, setServicios] = useState<string[]>([]);
    const [amenities, setAmenities] = useState<string[]>([]);

    const toggleItem = (item: string, list: string[], setList: React.Dispatch<React.SetStateAction<string[]>>) => {
        if (list.includes(item)) {
            setList(list.filter((i) => i !== item));
        } else {
            setList([...list, item]);
        }
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            // Call Server Action with individual params (matching existing signature)
            await savePropertyFeatures(
                propertyId,
                habitaciones,
                banos,
                area,
                estrato,
                amenities,
                servicios,
                undefined // No AI summary
            );
            // Redirect to next step
            router.push(`/publicar/crear/${propertyId}/multimedia`);
        } catch (error) {
            console.error('Error saving features:', error);
            alert('Error al guardar. Intenta de nuevo.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto p-6">
            <h1 className="text-3xl font-bold mb-2 text-slate-800">Características</h1>
            <p className="text-slate-500 mb-8">Selecciona los detalles de tu inmueble manualmente.</p>

            {/* CARD 1: BASIC INFO */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 mb-6">
                <h2 className="font-semibold text-lg mb-4">Distribución</h2>
                <div className="grid grid-cols-2 gap-6">
                    {/* Habitaciones */}
                    <div>
                        <label className="block text-sm font-medium mb-2">Habitaciones</label>
                        <div className="flex items-center gap-3">
                            <button onClick={() => setHabitaciones(Math.max(0, habitaciones - 1))} className="w-10 h-10 rounded-full bg-slate-100 font-bold">-</button>
                            <span className="text-xl font-bold w-8 text-center">{habitaciones}</span>
                            <button onClick={() => setHabitaciones(habitaciones + 1)} className="w-10 h-10 rounded-full bg-slate-900 text-white font-bold">+</button>
                        </div>
                    </div>
                    {/* Baños */}
                    <div>
                        <label className="block text-sm font-medium mb-2">Baños</label>
                        <div className="flex items-center gap-3">
                            <button onClick={() => setBanos(Math.max(0, banos - 1))} className="w-10 h-10 rounded-full bg-slate-100 font-bold">-</button>
                            <span className="text-xl font-bold w-8 text-center">{banos}</span>
                            <button onClick={() => setBanos(banos + 1)} className="w-10 h-10 rounded-full bg-slate-900 text-white font-bold">+</button>
                        </div>
                    </div>
                    {/* Área */}
                    <div>
                        <label className="block text-sm font-medium mb-2">Área (m²)</label>
                        <input
                            type="number"
                            value={area || ''}
                            onChange={(e) => setArea(Number(e.target.value))}
                            placeholder="85"
                            className="w-full p-3 bg-slate-50 rounded-xl border-none"
                        />
                    </div>
                    {/* Estrato */}
                    <div>
                        <label className="block text-sm font-medium mb-2">Estrato</label>
                        <select
                            value={estrato}
                            onChange={(e) => setEstrato(Number(e.target.value))}
                            className="w-full p-3 bg-slate-50 rounded-xl border-none"
                        >
                            {[1, 2, 3, 4, 5, 6].map(num => <option key={num} value={num}>{num}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {/* CARD 2: SERVICIOS */}
            <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 mb-6">
                <h2 className="font-semibold text-blue-900 mb-4">💧 Servicios Públicos</h2>
                <div className="flex flex-wrap gap-2">
                    {['Agua', 'Luz', 'Gas Natural', 'Internet', 'Telefonía', 'TV Cable'].map((item) => (
                        <button
                            key={item}
                            onClick={() => toggleItem(item, servicios, setServicios)}
                            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${servicios.includes(item)
                                    ? 'bg-blue-600 text-white shadow-md'
                                    : 'bg-white text-blue-900 hover:bg-blue-100'
                                }`}
                        >
                            {item}
                        </button>
                    ))}
                </div>
            </div>

            {/* CARD 3: AMENIDADES */}
            <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100 mb-8">
                <h2 className="font-semibold text-emerald-900 mb-4">🏡 Amenidades y Extras</h2>
                <div className="flex flex-wrap gap-2">
                    {['Piscina', 'Gimnasio', 'Cancha de Fútbol', 'Zona BBQ', 'Salón Comunal', 'Parqueadero', 'Balcón', 'Terraza', 'Vigilancia', 'Ascensor', 'Depósito', 'Cocina Integral', 'Patio'].map((item) => (
                        <button
                            key={item}
                            onClick={() => toggleItem(item, amenities, setAmenities)}
                            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${amenities.includes(item)
                                    ? 'bg-emerald-600 text-white shadow-md'
                                    : 'bg-white text-emerald-900 hover:bg-emerald-100'
                                }`}
                        >
                            {item}
                        </button>
                    ))}
                </div>
            </div>

            {/* FOOTER ACTION */}
            <button
                onClick={handleSave}
                disabled={loading}
                className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold text-lg hover:bg-slate-800 transition-all disabled:opacity-50"
            >
                {loading ? 'Guardando...' : 'Guardar y Continuar'}
            </button>
        </div>
    );
}
