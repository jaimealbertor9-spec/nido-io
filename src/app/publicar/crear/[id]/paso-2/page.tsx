'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Inter } from 'next/font/google';
import {
    Loader2, ChevronLeft, ChevronRight, Sparkles,
    Phone, MessageCircle, Home, Key, DollarSign, Check, AlertCircle,
    ShieldCheck, CreditCard, FileText, Trash2, UserCheck, Save
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { updateListingDetails, getListingDetails, getPropertyFeatures } from '@/app/actions/updateListingDetails';
import { generatePropertyDescription } from '@/app/actions/generateDescription';
import {
    getUserVerificationDocuments,
    submitVerificationDocument,
    deleteVerificationDocument,
    VerificationDocument,
    VerificationStatus
} from '@/app/actions/submitVerification';
import {
    activatePaymentForInmueble,
    hasRequiredDocument,
    getUserVerificationApprovalStatus,
    type UserVerificationStatusResult
} from '@/app/actions/inmuebleVerification';
import { initiatePaymentSession } from '@/app/actions/payment';
import StepFotos from '@/components/publicar/StepFotos';
import InmuebleVerificationForm from '@/components/IdentityVerificationForm';

const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600', '700'] });

export default function Paso2Page() {
    const router = useRouter();
    const params = useParams();
    const propertyId = params.id as string;

    // Basic States
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [draftNotFound, setDraftNotFound] = useState(false);

    // Verification & Owner Logic States
    const [documents, setDocuments] = useState<VerificationDocument[]>([]);
    const [deletingType, setDeletingType] = useState<string | null>(null);
    const [isOwner, setIsOwner] = useState(true); // Checkbox state (Default: True)

    const [userVerificationApproval, setUserVerificationApproval] = useState<UserVerificationStatusResult>({
        isApproved: false, status: 'not_found', hasAnyDocument: false
    });

    // Form Data States
    const [userId, setUserId] = useState<string | null>(null);
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [photosCompleted, setPhotosCompleted] = useState(false);
    const [offerType, setOfferType] = useState<'venta' | 'arriendo'>('venta');
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [price, setPrice] = useState('');
    const [telefono, setTelefono] = useState('');
    const [whatsapp, setWhatsapp] = useState('');
    const [step1Data, setStep1Data] = useState<{ tipo_inmueble: string | null; area_m2: number | null; barrio: string | null; direccion: string | null; }>({
        tipo_inmueble: null, area_m2: null, barrio: null, direccion: null
    });

    // Payment States
    const [isInitiatingPayment, setIsInitiatingPayment] = useState(false);
    const [inmuebleEstado, setInmuebleEstado] = useState<string>('borrador');
    const [showPaymentSuccessMessage, setShowPaymentSuccessMessage] = useState(false);

    // Refs
    const hasLoadedRef = useRef(false);
    const isMountedRef = useRef(true); // FIX: Track mount status to prevent state updates on unmounted component
    const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

    // Load Data Effect
    useEffect(() => {
        isMountedRef.current = true; // FIX: Mark as mounted

        const loadData = async () => {
            if (!isMountedRef.current) return;
            setIsLoading(true);
            try {
                // 1. Fetch Property Details
                const details = await getListingDetails(propertyId);
                if (!isMountedRef.current) return; // FIX: Guard after async
                if (!details) { setDraftNotFound(true); return; }

                setTitle(details.title || '');
                setDescription(details.description || '');
                setPrice(details.price > 0 ? details.price.toString() : '');
                setOfferType(details.offerType === 'arriendo' ? 'arriendo' : 'venta');

                const { data: propData } = await supabase.from('inmuebles').select('*').eq('id', propertyId).single();
                if (!isMountedRef.current) return; // FIX: Guard after async
                if (propData) {
                    setTelefono(propData.telefono_llamadas || '');
                    setWhatsapp(propData.whatsapp || '');
                    setInmuebleEstado(propData.estado || 'borrador'); // Populate estado for edit mode detection
                    setStep1Data({
                        tipo_inmueble: propData.tipo_inmueble, area_m2: propData.area_m2, barrio: propData.barrio, direccion: propData.direccion
                    });
                }

                // 2. Fetch User & Documents
                const { data: { user } } = await supabase.auth.getUser();
                if (!isMountedRef.current) return; // FIX: Guard after async
                if (user) {
                    setUserId(user.id);
                    setUserEmail(user.email || null);

                    // Fetch full list of docs (cedula + poder)
                    const docs = await getUserVerificationDocuments(user.id);
                    if (!isMountedRef.current) return; // FIX: Guard after async
                    setDocuments(docs);

                    const approval = await getUserVerificationApprovalStatus(user.id);
                    if (!isMountedRef.current) return; // FIX: Guard after async
                    setUserVerificationApproval(approval);
                }

                hasLoadedRef.current = true;
            } catch (e: any) {
                // FIX: Suppress AbortError (happens when component unmounts mid-request)
                if (e?.name === 'AbortError' || e?.message?.includes('aborted')) {
                    console.log('[Paso2Page] Request aborted (safe to ignore)');
                    return;
                }
                if (isMountedRef.current) setError('Error cargando datos');
            } finally {
                if (isMountedRef.current) setIsLoading(false);
            }
        };
        if (propertyId) loadData();

        // FIX: Cleanup function to mark as unmounted
        return () => {
            isMountedRef.current = false;
        };
    }, [propertyId]);

    // Helpers
    const autoSaveField = useCallback(async (field: string, value: any) => {
        if (!propertyId || !hasLoadedRef.current) return;
        setAutoSaveStatus('saving');
        await supabase.from('inmuebles').update({ [field]: value, updated_at: new Date().toISOString() }).eq('id', propertyId);
        setAutoSaveStatus('saved');
        setTimeout(() => setAutoSaveStatus('idle'), 2000);
    }, [propertyId]);

    const saveContactField = useCallback(async (field: string, value: string) => {
        if (!propertyId || !hasLoadedRef.current) return;
        await supabase.from('inmuebles').update({ [field]: value.trim() || null, updated_at: new Date().toISOString() }).eq('id', propertyId);
    }, [propertyId]);

    // Handlers
    const handleDocumentUploaded = async () => {
        if (!userId || !isMountedRef.current) return;
        try {
            // Refresh document list after upload
            const docs = await getUserVerificationDocuments(userId);
            if (!isMountedRef.current) return; // FIX: Guard after async
            setDocuments(docs);
            await activatePaymentForInmueble(propertyId);
        } catch (e: any) {
            // FIX: Suppress AbortError
            if (e?.name === 'AbortError' || e?.message?.includes('aborted')) {
                console.log('[Paso2Page] handleDocumentUploaded aborted (safe to ignore)');
                return;
            }
            console.error('Error in handleDocumentUploaded:', e);
        }
    };

    const handleDeleteDocument = async (tipo: string) => {
        if (!userId || !isMountedRef.current) return;
        if (!confirm(`¿Estás seguro de eliminar el documento: ${tipo}?`)) return;

        setDeletingType(tipo);
        try {
            const res = await deleteVerificationDocument(userId, tipo);
            if (!isMountedRef.current) return; // FIX: Guard after async
            if (res.success) {
                // Refresh list after delete to show upload form again
                const docs = await getUserVerificationDocuments(userId);
                if (!isMountedRef.current) return; // FIX: Guard after async
                setDocuments(docs);
            } else {
                alert(res.error);
            }
        } catch (e: any) {
            // FIX: Suppress AbortError
            if (e?.name === 'AbortError' || e?.message?.includes('aborted')) {
                console.log('[Paso2Page] handleDeleteDocument aborted (safe to ignore)');
                return;
            }
            console.error('Error in handleDeleteDocument:', e);
        } finally {
            if (isMountedRef.current) setDeletingType(null);
        }
    };

    const getMissingFields = () => {
        const missing = [];
        if (!title.trim()) missing.push('Título');
        if (!price || parseInt(price) <= 0) missing.push('Precio');
        if (!telefono) missing.push('Teléfono');

        // Validation: Cedula is mandatory if not approved yet
        if (!userVerificationApproval.isApproved) {
            const hasCedula = documents.some(d => d.tipo_documento === 'cedula');
            if (!hasCedula) missing.push('Documento de Identidad (Cédula)');

            // Note: Power of Attorney is optional if !isOwner, so we don't block validation on it.
        }
        return missing;
    };

    const handlePayment = async () => {
        console.log('💰 [Wompi] Starting payment process...');

        // Validation: Check missing fields first
        if (getMissingFields().length > 0) {
            setError('Faltan campos obligatorios');
            return;
        }

        // Environment Check: Validate Wompi Public Key
        if (!process.env.NEXT_PUBLIC_WOMPI_PUBLIC_KEY) {
            console.error('❌ [Wompi] Missing NEXT_PUBLIC_WOMPI_PUBLIC_KEY');
            alert('Falta configuración de pagos (Public Key)');
            return;
        }
        console.log('✅ [Wompi] Public Key found');

        setIsInitiatingPayment(true);
        setError(null); // Clear any previous errors

        try {
            // Step 1: Save current form data to database
            console.log('📝 [Wompi] Saving property data before payment...');
            const { error: updateError } = await supabase
                .from('inmuebles')
                .update({
                    titulo: title,
                    descripcion: description,
                    precio: parseInt(price),
                    tipo_negocio: offerType,
                    telefono_llamadas: telefono,
                    whatsapp
                })
                .eq('id', propertyId);

            if (updateError) {
                throw new Error(`Error guardando datos: ${updateError.message}`);
            }
            console.log('✅ [Wompi] Property data saved successfully');

            // Step 2: Initiate payment session
            console.log('🔐 [Wompi] Generating integrity signature...');
            const res = await initiatePaymentSession(
                propertyId,
                userEmail!,
                userId!,
                `${window.location.origin}/publicar/exito?draftId=${propertyId}`
            );

            if (!res.success) {
                throw new Error(res.error || 'Error iniciando sesión de pago');
            }

            if (!res.data?.checkoutUrl) {
                throw new Error('No se recibió URL de pago de Wompi');
            }

            console.log('🔐 [Wompi] Integrity signature generated successfully');
            console.log('🚀 [Wompi] Opening widget... Redirecting to:', res.data.checkoutUrl);

            // Step 3: Redirect to Wompi checkout
            window.location.href = res.data.checkoutUrl;

        } catch (e: any) {
            console.error('❌ [Wompi] Payment error:', e);
            setError(e.message || 'Error procesando el pago. Intenta nuevamente.');
        } finally {
            // ALWAYS reset loading state, even if redirect happens
            // (Browser will navigate away, but this ensures state is clean if something fails)
            setIsInitiatingPayment(false);
            console.log('🏁 [Wompi] Payment process finished (loading state reset)');
        }
    };

    // ═══════════════════════════════════════════════════════════════
    // EDIT MODE: Save without payment for already published/reviewed properties
    // ═══════════════════════════════════════════════════════════════
    const handleUpdateOnly = async () => {
        console.log('💾 [EditMode] Starting save process without payment...');
        setIsSaving(true);
        setError(null);

        try {
            const { error: updateError } = await supabase
                .from('inmuebles')
                .update({
                    titulo: title,
                    descripcion: description,
                    precio: parseInt(price) || 0,
                    tipo_negocio: offerType,
                    telefono_llamadas: telefono || null,
                    whatsapp: whatsapp || null,
                    updated_at: new Date().toISOString()
                })
                .eq('id', propertyId);

            if (updateError) {
                throw new Error(`Error guardando cambios: ${updateError.message}`);
            }

            console.log('✅ [EditMode] Property updated successfully');
            alert('¡Cambios guardados exitosamente!');
            router.push('/mis-inmuebles');

        } catch (e: any) {
            console.error('❌ [EditMode] Save error:', e);
            setError(e.message || 'Error guardando cambios. Intenta nuevamente.');
        } finally {
            setIsSaving(false);
        }
    };

    // Helper to render either the Upload Form or the File Card
    const renderDocCard = (tipo: string, label: string, isOptional: boolean = false) => {
        const doc = documents.find(d => d.tipo_documento === tipo);
        if (doc) {
            return (
                <div className="flex items-center justify-between bg-white p-3 rounded border border-blue-100 shadow-sm mb-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                            <FileText size={20} />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-slate-900 capitalize">{label}</p>
                            <p className="text-xs text-slate-500">Estado: {doc.estado}</p>
                        </div>
                    </div>
                    <button
                        onClick={() => handleDeleteDocument(tipo)}
                        disabled={deletingType === tipo}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-full transition-colors"
                        title="Eliminar documento"
                    >
                        {deletingType === tipo ? <Loader2 className="animate-spin" size={18} /> : <Trash2 size={18} />}
                    </button>
                </div>
            );
        }
        // If not found, show upload form
        return (
            <div className="mb-4">
                <p className="text-sm font-medium mb-2 text-slate-700">
                    Subir {label} {isOptional && <span className="text-blue-500 text-xs">(Opcional)</span>}
                </p>
                <InmuebleVerificationForm
                    inmuebleId={propertyId}
                    onDocumentUploaded={handleDocumentUploaded}
                    documentType={tipo as 'cedula' | 'poder'}
                    isOptional={isOptional}
                />
            </div>
        );
    };

    if (isLoading) return <div className="p-10 flex justify-center"><Loader2 className="animate-spin" /></div>;

    return (
        <div className={`${inter.className} space-y-8`} style={{ fontFamily: 'Lufga, sans-serif' }}>
            {/* Header */}
            <div>
                <h1 className="text-2xl font-semibold text-slate-900 mb-1">Detalles y Multimedia</h1>
                <p className="text-slate-500">Completa la información de tu inmueble.</p>
            </div>
            {error && <div className="p-4 bg-red-50 text-red-700 rounded-md">{error}</div>}

            {/* SECCIÓN 1: FOTOS */}
            <section className="bg-white border border-gray-200 rounded-md p-6">
                <StepFotos inmuebleId={propertyId} onNext={() => setPhotosCompleted(true)} />
            </section>

            {/* SECCIÓN 2: PRECIO */}
            <section className="bg-white border border-gray-200 rounded-md p-6">
                <h2 className="text-lg font-semibold text-slate-900 mb-5">Precio y Oferta</h2>
                <div className="grid md:grid-cols-2 gap-5">
                    <div>
                        <label className="block text-sm font-medium mb-2">Tipo de oferta</label>
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={() => { setOfferType('venta'); autoSaveField('tipo_negocio', 'venta'); }} className={`h-11 rounded-md border ${offerType === 'venta' ? 'bg-slate-900 text-white' : 'bg-white'}`}>Venta</button>
                            <button onClick={() => { setOfferType('arriendo'); autoSaveField('tipo_negocio', 'arriendo'); }} className={`h-11 rounded-md border ${offerType === 'arriendo' ? 'bg-slate-900 text-white' : 'bg-white'}`}>Arriendo</button>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-2">Valor</label>
                        <input type="text" value={price} onChange={e => setPrice(e.target.value.replace(/\D/g, ''))} onBlur={() => autoSaveField('precio', parseInt(price))} placeholder="0" className="w-full h-11 border rounded-md px-3" />
                    </div>
                </div>
            </section>

            {/* SECCIÓN 3: DESCRIPCIÓN */}
            <section className="bg-white border border-gray-200 rounded-md p-6">
                <div className="flex justify-between mb-5">
                    <h2 className="text-lg font-semibold text-slate-900">Descripción</h2>
                    <button onClick={async () => {
                        setIsGenerating(true);
                        const f = await getPropertyFeatures(propertyId);
                        if (f) {
                            const res = await generatePropertyDescription(f);
                            if (res.titulo) { setTitle(res.titulo); autoSaveField('titulo', res.titulo); }
                            if (res.descripcion) { setDescription(res.descripcion); autoSaveField('descripcion', res.descripcion); }
                        }
                        setIsGenerating(false);
                    }} disabled={isGenerating} className="text-blue-600 text-sm font-medium flex items-center gap-1">
                        {isGenerating ? <Loader2 className="animate-spin w-4 h-4" /> : <Sparkles className="w-4 h-4" />} Generar con IA
                    </button>
                </div>
                <div className="space-y-4">
                    <input type="text" value={title} onChange={e => setTitle(e.target.value)} onBlur={() => autoSaveField('titulo', title)} placeholder="Título" className="w-full h-11 border rounded-md px-3" />
                    <textarea value={description} onChange={e => setDescription(e.target.value)} onBlur={() => autoSaveField('descripcion', description)} placeholder="Descripción..." rows={5} className="w-full border rounded-md p-3 resize-none" />
                </div>
            </section>

            {/* SECCIÓN 4: CONTACTO */}
            <section className="bg-white border border-gray-200 rounded-md p-6">
                <h2 className="text-lg font-semibold text-slate-900 mb-5">Contacto</h2>
                <div className="grid md:grid-cols-2 gap-5">
                    <input type="tel" value={telefono} onChange={e => setTelefono(e.target.value.replace(/\D/g, ''))} onBlur={() => saveContactField('telefono_llamadas', telefono)} placeholder="Teléfono" className="w-full h-11 border rounded-md px-3" />
                    <input type="tel" value={whatsapp} onChange={e => setWhatsapp(e.target.value.replace(/\D/g, ''))} onBlur={() => saveContactField('whatsapp', whatsapp)} placeholder="WhatsApp" className="w-full h-11 border rounded-md px-3" />
                </div>
            </section>

            {/* SECCIÓN 5: VERIFICACIÓN (Adjusted Logic) */}
            <section className="bg-white border border-gray-200 rounded-md p-6">
                <div className="flex items-center gap-2 mb-5">
                    <ShieldCheck className="w-5 h-5 text-slate-600" />
                    <h2 className="text-lg font-semibold text-slate-900">Verificación de Identidad</h2>
                </div>

                {userVerificationApproval.isApproved ? (
                    <div className="p-4 bg-green-50 text-green-800 rounded flex gap-2">
                        <Check className="w-5 h-5" /> Cuenta Verificada
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Checkbox Owner */}
                        <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                            <input
                                type="checkbox"
                                id="isOwner"
                                checked={isOwner}
                                onChange={(e) => setIsOwner(e.target.checked)}
                                className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                            />
                            <label htmlFor="isOwner" className="cursor-pointer">
                                <span className="block font-medium text-slate-900">Soy el propietario del inmueble</span>
                                <span className="block text-xs text-slate-500">Marca esta casilla si eres el dueño legal.</span>
                            </label>
                        </div>

                        {/* 1. CEDULA (Always visible) */}
                        <div>
                            <h3 className="text-sm font-semibold text-slate-900 mb-2">1. Documento de Identidad (Obligatorio)</h3>
                            {renderDocCard('cedula', 'Cédula de Ciudadanía')}
                        </div>

                        {/* 2. PODER (Visible only if NOT Owner) */}
                        {!isOwner && (
                            <div className="pt-4 border-t animate-in fade-in slide-in-from-top-2">
                                <h3 className="text-sm font-semibold text-slate-900 mb-2">2. Poder de Representación (Opcional)</h3>
                                <p className="text-xs text-slate-500 mb-3">
                                    Al no ser el propietario directo, puedes adjuntar un poder (opcional).
                                </p>
                                {renderDocCard('poder', 'Poder Notarial', true)}
                            </div>
                        )}
                    </div>
                )}
            </section>

            <div className="flex justify-between pt-4 border-t">
                {/* Only show "Guardar y Volver" for drafts - edit mode already has "Guardar Cambios" */}
                {inmuebleEstado === 'borrador' ? (
                    <button
                        onClick={async () => {
                            // Auto-save current data before exiting
                            setIsSaving(true);
                            try {
                                await supabase
                                    .from('inmuebles')
                                    .update({
                                        titulo: title || null,
                                        descripcion: description || null,
                                        precio: parseInt(price) || null,
                                        tipo_negocio: offerType,
                                        telefono_llamadas: telefono || null,
                                        whatsapp: whatsapp || null,
                                        updated_at: new Date().toISOString()
                                    })
                                    .eq('id', propertyId);
                            } catch (e) {
                                console.warn('Auto-save on exit warning:', e);
                            } finally {
                                setIsSaving(false);
                            }
                            router.push('/mis-inmuebles');
                        }}
                        disabled={isSaving}
                        className="flex gap-2 items-center text-slate-600 hover:text-blue-600 transition-colors disabled:opacity-50"
                    >
                        {isSaving ? <Loader2 className="animate-spin" size={18} /> : <ChevronLeft size={18} />}
                        Guardar y Volver
                    </button>
                ) : (
                    <div /> /* Empty spacer for flex justify-between alignment */
                )}

                {/* CONDITIONAL: Show Payment OR Save based on property status */}
                {inmuebleEstado === 'borrador' ? (
                    // DRAFT: Show payment button (original Wompi flow)
                    <button
                        onClick={handlePayment}
                        disabled={isInitiatingPayment || getMissingFields().length > 0}
                        className={`px-6 py-2 rounded text-white font-medium ${getMissingFields().length > 0 ? 'bg-gray-300 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}
                    >
                        {isInitiatingPayment ? <Loader2 className="animate-spin" /> : 'Pagar y Publicar'}
                    </button>
                ) : (
                    // EDIT MODE: Show save button (no payment required)
                    <div className="flex flex-col items-end gap-3">
                        <div className="bg-blue-50 text-blue-800 px-4 py-2 rounded-lg text-sm flex items-center gap-2">
                            <Check size={16} />
                            Estás editando un inmueble existente. No es necesario realizar pago.
                        </div>
                        <button
                            onClick={handleUpdateOnly}
                            disabled={isSaving || !title.trim() || !price}
                            className={`px-6 py-2.5 rounded-lg text-white font-medium flex items-center gap-2 transition-all ${(isSaving || !title.trim() || !price) ? 'bg-gray-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/25'}`}
                        >
                            {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                            Guardar Cambios
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}