'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Inter } from 'next/font/google';
import {
    Loader2, ChevronLeft, ChevronRight, Sparkles,
    Phone, MessageCircle, Home, Key, DollarSign, Check, AlertCircle,
    ShieldCheck, CreditCard, FileText, Trash2, UserCheck, Save,
    Video, Link2, Upload, X
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

// ═══════════════════════════════════════════════════════════════
// CURRENCY FORMATTING HELPERS
// ═══════════════════════════════════════════════════════════════
function formatCurrency(value: string): string {
    const clean = value.replace(/\D/g, '');
    if (!clean) return '';
    return clean.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function cleanCurrency(formatted: string): string {
    return formatted.replace(/\./g, '');
}

// ═══════════════════════════════════════════════════════════════
// LABEL COMPONENT WITH OPTIONAL REQUIRED ASTERISK
// ═══════════════════════════════════════════════════════════════
function FieldLabel({ children, required = false }: { children: React.ReactNode; required?: boolean }) {
    return (
        <label className="block text-sm font-medium text-slate-700 mb-2">
            {children}
            {required && <span className="text-red-500 ml-1">*</span>}
        </label>
    );
}

const MAX_VIDEO_SIZE = 30 * 1024 * 1024; // 30MB

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
    const [isOwner, setIsOwner] = useState(true);

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
    const [price, setPrice] = useState('');             // Clean integer string
    const [priceDisplay, setPriceDisplay] = useState(''); // Formatted with dots
    const [adminFee, setAdminFee] = useState('');           // Clean integer string
    const [adminFeeDisplay, setAdminFeeDisplay] = useState(''); // Formatted with dots
    const [telefono, setTelefono] = useState('');
    const [whatsapp, setWhatsapp] = useState('');
    const [step1Data, setStep1Data] = useState<{ tipo_inmueble: string | null; area_m2: number | null; barrio: string | null; direccion: string | null; }>({
        tipo_inmueble: null, area_m2: null, barrio: null, direccion: null
    });

    // Video States
    const [videoUrl, setVideoUrl] = useState('');
    const [videoFile, setVideoFile] = useState('');    // Storage path
    const [videoFileName, setVideoFileName] = useState('');
    const [isUploadingVideo, setIsUploadingVideo] = useState(false);
    const [videoError, setVideoError] = useState<string | null>(null);

    // Payment States
    const [isInitiatingPayment, setIsInitiatingPayment] = useState(false);
    const [inmuebleEstado, setInmuebleEstado] = useState<string>('borrador');
    const [showPaymentSuccessMessage, setShowPaymentSuccessMessage] = useState(false);

    // Refs
    const hasLoadedRef = useRef(false);
    const isMountedRef = useRef(true);
    const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

    // Load Data Effect — uses loadId to prevent stale async from setting state
    useEffect(() => {
        isMountedRef.current = true;
        let cancelled = false; // local cancellation flag (immune to re-mount race)

        const loadData = async () => {
            setIsLoading(true);
            setError(null);
            setDraftNotFound(false);

            try {
                // 1. Fetch Property Details (server action — uses service role)
                const details = await getListingDetails(propertyId);
                if (cancelled) return;

                if (!details) {
                    console.warn('[Paso2] getListingDetails returned null — draft not found');
                    setDraftNotFound(true);
                    return; // finally will still fire
                }

                setTitle(details.title || '');
                setDescription(details.description || '');
                if (details.price > 0) {
                    const p = details.price.toString();
                    setPrice(p);
                    setPriceDisplay(formatCurrency(p));
                }
                setOfferType(details.offerType === 'arriendo' ? 'arriendo' : 'venta');

                // 2. Fetch full property row (client supabase — for extra fields)
                const { data: propData, error: propError } = await supabase
                    .from('inmuebles')
                    .select('*')
                    .eq('id', propertyId)
                    .single();
                if (cancelled) return;

                if (propError) {
                    console.warn('[Paso2] propData fetch error (non-fatal):', propError.message);
                }

                if (propData) {
                    setTelefono(propData.telefono_llamadas ?? '');
                    setWhatsapp(propData.whatsapp ?? '');
                    setInmuebleEstado(propData.estado ?? 'borrador');
                    setStep1Data({
                        tipo_inmueble: propData.tipo_inmueble ?? null,
                        area_m2: propData.area_m2 ?? null,
                        barrio: propData.barrio ?? null,
                        direccion: propData.direccion ?? null
                    });
                    // Load admin fee (null-safe)
                    const rawAdminFee = (propData as any).administracion;
                    if (rawAdminFee != null && rawAdminFee > 0) {
                        const af = rawAdminFee.toString();
                        setAdminFee(af);
                        setAdminFeeDisplay(formatCurrency(af));
                    }
                    // Load video fields (null-safe)
                    setVideoUrl((propData as any).video_url ?? '');
                    setVideoFile((propData as any).video_file ?? '');
                    if ((propData as any).video_file) {
                        const parts = ((propData as any).video_file as string).split('/');
                        setVideoFileName(parts[parts.length - 1] || 'video');
                    }
                }

                // 3. Fetch User & Documents
                const { data: { user } } = await supabase.auth.getUser();
                if (cancelled) return;
                if (user) {
                    setUserId(user.id);
                    setUserEmail(user.email ?? null);

                    const docs = await getUserVerificationDocuments(user.id);
                    if (cancelled) return;
                    setDocuments(docs);

                    const approval = await getUserVerificationApprovalStatus(user.id);
                    if (cancelled) return;
                    setUserVerificationApproval(approval);
                }

                hasLoadedRef.current = true;
            } catch (e: any) {
                if (e?.name === 'AbortError' || e?.message?.includes('aborted')) {
                    console.log('[Paso2] Request aborted (safe to ignore)');
                    return;
                }
                console.error('[Paso2] Data load error:', e);
                if (!cancelled) setError('Error cargando datos. Intenta recargar la página.');
            } finally {
                if (!cancelled) {
                    console.log('[Paso2] Data load complete, stopping spinner');
                    setIsLoading(false);
                }
            }
        };

        if (propertyId) loadData();

        return () => {
            cancelled = true;
            isMountedRef.current = false;
        };
    }, [propertyId]);

    // ═══════════════════════════════════════════════════════════════
    // AUTO-SAVE HELPERS
    // ═══════════════════════════════════════════════════════════════
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

    // ═══════════════════════════════════════════════════════════════
    // CURRENCY INPUT HANDLER
    // ═══════════════════════════════════════════════════════════════
    const handleCurrencyChange = (
        rawValue: string,
        setClean: (v: string) => void,
        setDisplay: (v: string) => void
    ) => {
        const clean = rawValue.replace(/\D/g, '');
        setClean(clean);
        setDisplay(formatCurrency(clean));
    };

    // ═══════════════════════════════════════════════════════════════
    // VIDEO UPLOAD HANDLER
    // ═══════════════════════════════════════════════════════════════
    const handleVideoUpload = async (file: File) => {
        if (!userId || !propertyId) return;

        // Client-side size check
        if (file.size > MAX_VIDEO_SIZE) {
            setVideoError(`El archivo excede 30MB (${(file.size / 1024 / 1024).toFixed(1)}MB)`);
            return;
        }

        // Validate MIME type
        const allowedTypes = ['video/mp4', 'video/quicktime', 'video/webm'];
        if (!allowedTypes.includes(file.type)) {
            setVideoError('Formato no soportado. Usa MP4, MOV o WebM.');
            return;
        }

        setIsUploadingVideo(true);
        setVideoError(null);

        try {
            const ext = file.name.split('.').pop() || 'mp4';
            const storagePath = `${userId}/${propertyId}/video.${ext}`;

            const { error: uploadError } = await supabase.storage
                .from('inmueble-videos')
                .upload(storagePath, file, { upsert: true });

            if (uploadError) throw uploadError;

            // Save path to DB
            setVideoFile(storagePath);
            setVideoFileName(file.name);
            await autoSaveField('video_file', storagePath);

            console.log('[Video] Upload successful:', storagePath);
        } catch (err: any) {
            console.error('[Video] Upload error:', err);
            setVideoError(err.message || 'Error al subir el video');
        } finally {
            setIsUploadingVideo(false);
        }
    };

    const handleRemoveVideo = async () => {
        if (!videoFile) return;

        try {
            await supabase.storage.from('inmueble-videos').remove([videoFile]);
            setVideoFile('');
            setVideoFileName('');
            await autoSaveField('video_file', null);
        } catch (err: any) {
            console.error('[Video] Remove error:', err);
        }
    };

    // ═══════════════════════════════════════════════════════════════
    // DOCUMENT HANDLERS
    // ═══════════════════════════════════════════════════════════════
    const handleDocumentUploaded = async () => {
        if (!userId || !isMountedRef.current) return;
        try {
            const docs = await getUserVerificationDocuments(userId);
            if (!isMountedRef.current) return;
            setDocuments(docs);
            await activatePaymentForInmueble(propertyId);
        } catch (e: any) {
            if (e?.name === 'AbortError' || e?.message?.includes('aborted')) return;
            console.error('Error in handleDocumentUploaded:', e);
        }
    };

    const handleDeleteDocument = async (tipo: string) => {
        if (!userId || !isMountedRef.current) return;
        if (!confirm(`¿Estás seguro de eliminar el documento: ${tipo}?`)) return;

        setDeletingType(tipo);
        try {
            const res = await deleteVerificationDocument(userId, tipo);
            if (!isMountedRef.current) return;
            if (res.success) {
                const docs = await getUserVerificationDocuments(userId);
                if (!isMountedRef.current) return;
                setDocuments(docs);
            } else {
                alert(res.error);
            }
        } catch (e: any) {
            if (e?.name === 'AbortError' || e?.message?.includes('aborted')) return;
            console.error('Error in handleDeleteDocument:', e);
        } finally {
            if (isMountedRef.current) setDeletingType(null);
        }
    };

    // ═══════════════════════════════════════════════════════════════
    // VALIDATION
    // ═══════════════════════════════════════════════════════════════
    const isPhoneValid = (value: string) => !value || value.length === 10;

    const getMissingFields = () => {
        const missing = [];
        if (!title.trim()) missing.push('Título');
        if (!price || parseInt(price) <= 0) missing.push('Precio');
        if (!telefono) missing.push('Teléfono');
        if (telefono && telefono.length !== 10) missing.push('Teléfono (10 dígitos)');

        if (!userVerificationApproval.isApproved) {
            const hasCedula = documents.some(d => d.tipo_documento === 'cedula');
            if (!hasCedula) missing.push('Documento de Identidad (Cédula)');
        }
        return missing;
    };

    // ═══════════════════════════════════════════════════════════════
    // COLLECT ALL FORM DATA FOR SAVING
    // ═══════════════════════════════════════════════════════════════
    const getFormPayload = () => ({
        titulo: title,
        descripcion: description,
        precio: parseInt(price) || 0,
        tipo_negocio: offerType,
        telefono_llamadas: telefono || null,
        whatsapp: whatsapp || null,
        administracion: adminFee ? parseInt(adminFee) : null,
        video_url: videoUrl.trim() || null,
        video_file: videoFile || null,
        updated_at: new Date().toISOString()
    });

    // ═══════════════════════════════════════════════════════════════
    // PAYMENT HANDLER
    // ═══════════════════════════════════════════════════════════════
    const handlePayment = async () => {
        console.log('💰 [Wompi] Starting payment process...');

        if (getMissingFields().length > 0) {
            setError('Faltan campos obligatorios');
            return;
        }

        if (!process.env.NEXT_PUBLIC_WOMPI_PUBLIC_KEY) {
            console.error('❌ [Wompi] Missing NEXT_PUBLIC_WOMPI_PUBLIC_KEY');
            alert('Falta configuración de pagos (Public Key)');
            return;
        }

        setIsInitiatingPayment(true);
        setError(null);

        try {
            console.log('📝 [Wompi] Saving property data before payment...');
            const { error: updateError } = await supabase
                .from('inmuebles')
                .update(getFormPayload())
                .eq('id', propertyId);

            if (updateError) throw new Error(`Error guardando datos: ${updateError.message}`);
            console.log('✅ [Wompi] Property data saved successfully');

            console.log('🔐 [Wompi] Generating integrity signature...');
            const res = await initiatePaymentSession(
                propertyId,
                userEmail!,
                userId!,
                `${window.location.origin}/publicar/exito?draftId=${propertyId}`
            );

            if (!res.success) throw new Error(res.error || 'Error iniciando sesión de pago');
            if (!res.data?.checkoutUrl) throw new Error('No se recibió URL de pago de Wompi');

            console.log('🚀 [Wompi] Redirecting to:', res.data.checkoutUrl);
            window.location.href = res.data.checkoutUrl;

        } catch (e: any) {
            console.error('❌ [Wompi] Payment error:', e);
            setError(e.message || 'Error procesando el pago. Intenta nuevamente.');
        } finally {
            setIsInitiatingPayment(false);
        }
    };

    // ═══════════════════════════════════════════════════════════════
    // EDIT MODE: Save without payment
    // ═══════════════════════════════════════════════════════════════
    const handleUpdateOnly = async () => {
        console.log('💾 [EditMode] Starting save process without payment...');
        setIsSaving(true);
        setError(null);

        try {
            const { error: updateError } = await supabase
                .from('inmuebles')
                .update(getFormPayload())
                .eq('id', propertyId);

            if (updateError) throw new Error(`Error guardando cambios: ${updateError.message}`);

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

    // ═══════════════════════════════════════════════════════════════
    // DOC CARD RENDERER
    // ═══════════════════════════════════════════════════════════════
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

    // ═══════════════════════════════════════════════════════════════
    // DRAFT NOT FOUND — Recovery UI
    // ═══════════════════════════════════════════════════════════════
    if (draftNotFound) {
        return (
            <div className="p-10 text-center space-y-4">
                <AlertCircle className="w-12 h-12 text-amber-500 mx-auto" />
                <h2 className="text-xl font-semibold text-slate-900">Borrador no encontrado</h2>
                <p className="text-slate-500 max-w-md mx-auto">
                    Este borrador no existe o fue eliminado. Puedes crear uno nuevo desde el panel.
                </p>
                <button
                    onClick={() => router.push('/mis-inmuebles')}
                    className="px-6 py-2.5 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 transition-colors"
                >
                    Ir a Mis Inmuebles
                </button>
            </div>
        );
    }

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

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* SECCIÓN 2: PRECIO Y OFERTA                                    */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            <section className="bg-white border border-gray-200 rounded-md p-6">
                <div className="flex items-center gap-2 mb-5">
                    <DollarSign className="w-5 h-5 text-slate-600" />
                    <h2 className="text-lg font-semibold text-slate-900">Precio y Oferta</h2>
                </div>
                <div className="grid md:grid-cols-2 gap-5">
                    {/* Offer Type */}
                    <div>
                        <FieldLabel required>Tipo de oferta</FieldLabel>
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={() => { setOfferType('venta'); autoSaveField('tipo_negocio', 'venta'); }} className={`h-11 rounded-md border font-medium transition-all ${offerType === 'venta' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 hover:border-slate-400'}`}>Venta</button>
                            <button onClick={() => { setOfferType('arriendo'); autoSaveField('tipo_negocio', 'arriendo'); }} className={`h-11 rounded-md border font-medium transition-all ${offerType === 'arriendo' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 hover:border-slate-400'}`}>Arriendo</button>
                        </div>
                    </div>

                    {/* Price with Currency Masking */}
                    <div>
                        <FieldLabel required>{offerType === 'arriendo' ? 'Canon Mensual' : 'Precio de Venta'}</FieldLabel>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">$</span>
                            <input
                                type="text"
                                value={priceDisplay}
                                onChange={e => handleCurrencyChange(e.target.value, setPrice, setPriceDisplay)}
                                onBlur={() => autoSaveField('precio', parseInt(price) || 0)}
                                placeholder="0"
                                className="w-full h-11 border border-gray-300 rounded-md pl-7 pr-14 text-right font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">COP</span>
                        </div>
                    </div>

                    {/* Admin Fee (Optional) */}
                    <div className="md:col-span-2">
                        <FieldLabel>Administración (Mensual)</FieldLabel>
                        <div className="relative max-w-sm">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">$</span>
                            <input
                                type="text"
                                value={adminFeeDisplay}
                                onChange={e => handleCurrencyChange(e.target.value, setAdminFee, setAdminFeeDisplay)}
                                onBlur={() => autoSaveField('administracion', adminFee ? parseInt(adminFee) : null)}
                                placeholder="0"
                                className="w-full h-11 border border-gray-300 rounded-md pl-7 pr-14 text-right font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">COP</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">Cuota de administración si aplica (condominios, conjuntos cerrados).</p>
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* SECCIÓN 3: DESCRIPCIÓN                                        */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            <section className="bg-white border border-gray-200 rounded-md p-6">
                <div className="flex justify-between mb-5">
                    <h2 className="text-lg font-semibold text-slate-900">Descripción</h2>
                    <button onClick={async () => {
                        setIsGenerating(true);
                        setError(null);
                        try {
                            const f = await getPropertyFeatures(propertyId);
                            if (!f) throw new Error('No se pudieron obtener las características del inmueble. Completa el Paso 1 primero.');
                            const res = await generatePropertyDescription(f);
                            if (res.titulo) { setTitle(res.titulo); autoSaveField('titulo', res.titulo); }
                            if (res.descripcion) { setDescription(res.descripcion); autoSaveField('descripcion', res.descripcion); }
                        } catch (err: any) {
                            console.error('❌ [AI Generation Error]:', err);
                            setError(err?.message || 'Error al generar descripción con IA. Intenta de nuevo.');
                        } finally {
                            setIsGenerating(false);
                        }
                    }} disabled={isGenerating} className="text-blue-600 text-sm font-medium flex items-center gap-1">
                        {isGenerating ? <Loader2 className="animate-spin w-4 h-4" /> : <Sparkles className="w-4 h-4" />} Generar con IA
                    </button>
                </div>
                <div className="space-y-4">
                    <div>
                        <FieldLabel required>Título del Inmueble</FieldLabel>
                        <input type="text" value={title} onChange={e => setTitle(e.target.value)} onBlur={() => autoSaveField('titulo', title)} placeholder="Ej: Hermosa casa con vista panorámica en Líbano" className="w-full h-11 border border-gray-300 rounded-md px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent" />
                    </div>
                    <div>
                        <FieldLabel required>Descripción</FieldLabel>
                        <textarea value={description} onChange={e => setDescription(e.target.value)} onBlur={() => autoSaveField('descripcion', description)} placeholder="Describe tu inmueble en detalle..." rows={5} className="w-full border border-gray-300 rounded-md p-3 resize-none text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent" />
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* SECCIÓN 4: CONTACTO                                           */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            <section className="bg-white border border-gray-200 rounded-md p-6">
                <div className="flex items-center gap-2 mb-5">
                    <Phone className="w-5 h-5 text-slate-600" />
                    <h2 className="text-lg font-semibold text-slate-900">Contacto</h2>
                </div>
                <div className="grid md:grid-cols-2 gap-5">
                    {/* Teléfono */}
                    <div>
                        <FieldLabel required>Teléfono de Contacto</FieldLabel>
                        <input
                            type="tel"
                            inputMode="numeric"
                            value={telefono}
                            maxLength={10}
                            onChange={e => setTelefono(e.target.value.replace(/\D/g, ''))}
                            onBlur={() => saveContactField('telefono_llamadas', telefono)}
                            placeholder="3001234567"
                            className={`w-full h-11 border rounded-md px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent ${telefono && telefono.length !== 10 ? 'border-red-400 focus:ring-red-500' : 'border-gray-300'}`}
                        />
                        {telefono && telefono.length !== 10 && (
                            <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                                <AlertCircle size={12} /> Debe tener exactamente 10 dígitos ({telefono.length}/10)
                            </p>
                        )}
                    </div>

                    {/* WhatsApp */}
                    <div>
                        <FieldLabel>WhatsApp</FieldLabel>
                        <input
                            type="tel"
                            inputMode="numeric"
                            value={whatsapp}
                            maxLength={10}
                            onChange={e => setWhatsapp(e.target.value.replace(/\D/g, ''))}
                            onBlur={() => saveContactField('whatsapp', whatsapp)}
                            placeholder="3001234567"
                            className={`w-full h-11 border rounded-md px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent ${whatsapp && whatsapp.length !== 10 ? 'border-red-400 focus:ring-red-500' : 'border-gray-300'}`}
                        />
                        {whatsapp && whatsapp.length !== 10 && (
                            <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                                <AlertCircle size={12} /> Debe tener exactamente 10 dígitos ({whatsapp.length}/10)
                            </p>
                        )}
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* SECCIÓN 5: VIDEO DEL INMUEBLE (OPCIONAL)                      */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            <section className="bg-white border border-gray-200 rounded-md p-6">
                <div className="flex items-center gap-2 mb-1">
                    <Video className="w-5 h-5 text-slate-600" />
                    <h2 className="text-lg font-semibold text-slate-900">Video del Inmueble</h2>
                    <span className="text-xs text-blue-500 font-medium bg-blue-50 px-2 py-0.5 rounded-full">Opcional</span>
                </div>
                <p className="text-xs text-slate-400 mb-5">Un video aumenta hasta un 40% las consultas. Puedes agregar un link y/o subir un archivo.</p>

                {videoError && (
                    <div className="p-3 mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-md flex items-center gap-2">
                        <AlertCircle size={16} /> {videoError}
                    </div>
                )}

                <div className="grid md:grid-cols-2 gap-5">
                    {/* Option A: YouTube/Vimeo Link */}
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <Link2 size={14} className="text-slate-500" />
                            <label className="text-sm font-medium text-slate-700">Link de YouTube / Vimeo</label>
                        </div>
                        <input
                            type="url"
                            value={videoUrl}
                            onChange={e => setVideoUrl(e.target.value)}
                            onBlur={() => autoSaveField('video_url', videoUrl.trim() || null)}
                            placeholder="https://youtube.com/watch?v=..."
                            className="w-full h-11 border border-gray-300 rounded-md px-3 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                        />
                    </div>

                    {/* Option B: File Upload */}
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <Upload size={14} className="text-slate-500" />
                            <label className="text-sm font-medium text-slate-700">Subir Video</label>
                        </div>

                        {videoFile ? (
                            // Uploaded file card
                            <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-md">
                                <div className="flex items-center gap-2 min-w-0">
                                    <Video size={18} className="text-green-600 flex-shrink-0" />
                                    <span className="text-sm text-green-800 font-medium truncate">{videoFileName}</span>
                                </div>
                                <button onClick={handleRemoveVideo} className="p-1.5 text-red-500 hover:bg-red-50 rounded-full flex-shrink-0" title="Eliminar video">
                                    <X size={16} />
                                </button>
                            </div>
                        ) : (
                            // Upload input
                            <div className="relative">
                                <input
                                    type="file"
                                    accept="video/mp4,video/quicktime,video/webm"
                                    onChange={e => {
                                        const file = e.target.files?.[0];
                                        if (file) handleVideoUpload(file);
                                        e.target.value = ''; // Reset to allow re-upload
                                    }}
                                    disabled={isUploadingVideo}
                                    className="hidden"
                                    id="video-upload"
                                />
                                <label
                                    htmlFor="video-upload"
                                    className={`flex items-center justify-center gap-2 w-full h-11 border-2 border-dashed rounded-md cursor-pointer transition-colors ${isUploadingVideo ? 'border-blue-300 bg-blue-50 cursor-wait' : 'border-gray-300 hover:border-slate-400 hover:bg-slate-50'}`}
                                >
                                    {isUploadingVideo ? (
                                        <>
                                            <Loader2 className="animate-spin w-4 h-4 text-blue-500" />
                                            <span className="text-sm text-blue-600 font-medium">Subiendo...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Upload size={16} className="text-slate-400" />
                                            <span className="text-sm text-slate-500">MP4, MOV, WebM · Max 30MB</span>
                                        </>
                                    )}
                                </label>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* SECCIÓN 6: VERIFICACIÓN                                       */}
            {/* ═══════════════════════════════════════════════════════════════ */}
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

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* MISSING FIELDS WARNING                                        */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            {getMissingFields().length > 0 && inmuebleEstado === 'borrador' && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-md">
                    <p className="text-sm font-semibold text-amber-800 mb-1 flex items-center gap-1">
                        <AlertCircle size={16} /> Campos faltantes para publicar:
                    </p>
                    <ul className="text-xs text-amber-700 list-disc list-inside">
                        {getMissingFields().map(f => <li key={f}>{f}</li>)}
                    </ul>
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* FOOTER ACTIONS                                                */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            <div className="flex justify-between pt-4 border-t">
                {inmuebleEstado === 'borrador' ? (
                    <button
                        onClick={async () => {
                            setIsSaving(true);
                            try {
                                await supabase.from('inmuebles').update(getFormPayload()).eq('id', propertyId);
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
                    <div />
                )}

                {inmuebleEstado === 'borrador' ? (
                    <button
                        onClick={handlePayment}
                        disabled={isInitiatingPayment || getMissingFields().length > 0}
                        className={`px-6 py-2.5 rounded-lg text-white font-medium flex items-center gap-2 transition-all ${getMissingFields().length > 0 ? 'bg-gray-300 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 shadow-lg shadow-green-500/25'}`}
                    >
                        {isInitiatingPayment ? <Loader2 className="animate-spin" size={18} /> : <CreditCard size={18} />}
                        Pagar y Publicar
                    </button>
                ) : (
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