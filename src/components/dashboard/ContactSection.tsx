'use client';

import { useState } from 'react';
import { Phone, Sparkles, ArrowLeft, MessageSquare, Lock, CheckCircle, Send, Loader2 as Loader2Icon } from 'lucide-react';
import { submitLead } from '@/app/actions/submitLead';

interface ContactSectionProperty {
    id: string;
    telefono_llamadas: string | null;
    whatsapp: string | null;
}

export default function ContactSection({ property, isPremium }: { property: ContactSectionProperty; isPremium: boolean }) {
    const [nombre, setNombre] = useState('');
    const [telefono, setTelefono] = useState('');
    const [email, setEmail] = useState('');
    const [mensaje, setMensaje] = useState('');
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

    if (isPremium && (property.telefono_llamadas || property.whatsapp)) {
        return (
            <div className="bg-white/60 rounded-3xl border border-white/50 shadow-sm backdrop-blur-md p-6">
                <div className="flex items-center gap-2 mb-4 cursor-help" title="Beneficio Premium activo">
                    <Phone className="w-5 h-5 text-gray-700" />
                    <h3 className="font-bold text-gray-800">Contacto Directo</h3>
                    <Sparkles className="w-4 h-4 text-amber-500 ml-auto" />
                </div>
                <div className="space-y-3">
                    {property.telefono_llamadas && (
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-500">Teléfono</span>
                            <a href={`tel:${property.telefono_llamadas}`} className="font-semibold text-[#1A56DB] hover:underline bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100">
                                {property.telefono_llamadas}
                            </a>
                        </div>
                    )}
                    {property.whatsapp && (
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-500">WhatsApp</span>
                            <a href={`https://wa.me/${property.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-emerald-600 hover:underline bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100 flex items-center gap-1">
                                {property.whatsapp} <ArrowLeft className="w-3 h-3 -rotate-[135deg]" />
                            </a>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatus('loading');

        const res = await submitLead(property.id, nombre, telefono, email, mensaje);
        if (res.success) {
            setStatus('success');
            setNombre('');
            setTelefono('');
            setEmail('');
            setMensaje('');
        } else {
            setStatus('error');
        }
    };

    return (
        <div className="bg-white/60 rounded-3xl border border-white/50 shadow-sm backdrop-blur-md p-6">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-gray-700" />
                    <h3 className="font-bold text-gray-800">Contactar al Propietario</h3>
                </div>
                {/* Visual tooltip about locking */}
                <div className="group relative">
                    <Lock className="w-4 h-4 text-gray-400 cursor-help" />
                    <div className="absolute right-0 w-48 p-2 mt-2 bg-gray-800 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                        Los datos de contacto están protegidos. Envía un mensaje a través de esta plataforma.
                    </div>
                </div>
            </div>

            {status === 'success' ? (
                <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center">
                    <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
                    <p className="font-semibold text-green-800">¡Mensaje enviado!</p>
                    <p className="text-sm text-green-600 mt-1">El propietario te contactará pronto.</p>
                    <button onClick={() => setStatus('idle')} className="text-sm font-medium text-[#1A56DB] mt-3 hover:underline">
                        Enviar otro mensaje
                    </button>
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-3">
                    {status === 'error' && (
                        <div className="p-2 bg-red-50 text-red-600 text-xs rounded-lg border border-red-200">
                            Hubo un error al enviar tu mensaje. Intenta de nuevo.
                        </div>
                    )}
                    <div>
                        <input
                            type="text"
                            required
                            placeholder="Tu nombre completo"
                            value={nombre}
                            onChange={e => setNombre(e.target.value)}
                            className="w-full text-sm px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1A56DB] focus:border-transparent transition-all bg-white/80"
                        />
                    </div>
                    <div>
                        <input
                            type="tel"
                            required
                            placeholder="Tu teléfono (ej. 315 123 4567)"
                            value={telefono}
                            onChange={e => setTelefono(e.target.value)}
                            className="w-full text-sm px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1A56DB] focus:border-transparent transition-all bg-white/80"
                        />
                    </div>
                    <div>
                        <input
                            type="email"
                            placeholder="Tu correo (opcional)"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            className="w-full text-sm px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1A56DB] focus:border-transparent transition-all bg-white/80"
                        />
                    </div>
                    <div>
                        <textarea
                            placeholder="Hola, me interesa este inmueble..."
                            rows={3}
                            value={mensaje}
                            onChange={e => setMensaje(e.target.value)}
                            className="w-full text-sm px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1A56DB] focus:border-transparent transition-all bg-white/80 resize-none"
                        ></textarea>
                    </div>
                    <button
                        type="submit"
                        disabled={status === 'loading'}
                        className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-md
                            ${status === 'loading'
                                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                : 'bg-[#0c263b] text-white hover:bg-[#163c5a]'
                            }`}
                    >
                        {status === 'loading' ? (
                            <><Loader2Icon className="w-4 h-4 animate-spin" /> Enviando...</>
                        ) : (
                            <><Send className="w-4 h-4" /> Enviar Mensaje</>
                        )}
                    </button>
                    <p className="text-[10px] text-gray-400 text-center px-2">
                        Al enviar, aceptas nuestros términos y políticas de privacidad.
                    </p>
                </form>
            )}
        </div>
    );
}
