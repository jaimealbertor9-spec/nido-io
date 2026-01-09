'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Inter } from 'next/font/google';
import {
    Loader2, ChevronLeft, ChevronRight, Sparkles,
    Phone, MessageCircle, Home, Key, DollarSign, Check, AlertCircle,
    ShieldCheck, CreditCard, FileText, Trash2
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { updateListingDetails, getListingDetails, getPropertyFeatures } from '@/app/actions/updateListingDetails';
import { generatePropertyDescription } from '@/app/actions/generateDescription';
import {
    checkUserVerificationStatus,
    submitVerificationDocument,
    deleteVerificationDocument, // Importamos la nueva función
    VerificationStatus
} from '@/app/actions/submitVerification';
import {
    activatePaymentForInmueble,
    hasRequiredDocument,
    getUserVerificationApprovalStatus,
    checkUserDocumentsPendingApproval,
    type UserVerificationStatusResult
} from '@/app/actions/inmuebleVerification';
import { initiatePaymentSession } from '@/app/actions/payment';
import StepFotos from '@/components/publicar/StepFotos';
import InmuebleVerificationForm from '@/components/IdentityVerificationForm';

const inter = Inter({
    subsets: ['latin'],
    weight: ['400', '500', '600', '700']
});

export default function Paso2Page() {
    const router = useRouter();
    const params = useParams();
    const propertyId = params.id as string;

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [draftNotFound, setDraftNotFound] = useState(false);
    const [isDeletingDoc, setIsDeletingDoc] = useState(false); // Estado para el borrado

    // Auto-save state
    const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
    const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const priceDebounceRef = useRef<NodeJS.Timeout | null>(null);
    const titleDebounceRef = useRef<NodeJS.Timeout | null>(null);
    const descriptionDebounceRef = useRef<NodeJS.Timeout | null>(null);

    // Contact state
    const [contactSaveStatus, setContactSaveStatus] = useState<{
        telefono: 'idle' | 'saving' | 'saved' | 'error';
        whatsapp: 'idle' | 'saving' | 'saved' | 'error'
    }>({ telefono: 'idle', whatsapp: 'idle' });
    const contactSaveTimeoutRef = useRef<{ telefono: NodeJS.Timeout | null; whatsapp: NodeJS.Timeout | null }>({
        telefono: null,
        whatsapp: null
    });

    // Listing details state
    const [photosCompleted, setPhotosCompleted] = useState(false);
    const [offerType, setOfferType] = useState<'venta' | 'arriendo'>('venta');
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [price, setPrice] = useState('');
    const [telefono, setTelefono] = useState('');
    const [whatsapp, setWhatsapp] = useState('');

    // Trust & Verification state
    const [verificationStatus, setVerificationStatus] = useState<VerificationStatus | 'loading'>('loading');
    const [contactErrors, setContactErrors] = useState<{ telefono?: string; whatsapp?: string }>({});
    const [hasDocumentUploaded, setHasDocumentUploaded] = useState(false);

    // User verification approval state
    const [userVerificationApproval, setUserVerificationApproval] = useState<UserVerificationStatusResult>({
        isApproved: false,
        status: 'not_found',
        hasAnyDocument: false,
    });
    const [isUserDocsPending, setIsUserDocsPending] = useState(false);
    const [userPendingStatus, setUserPendingStatus] = useState<'pendiente' | 'pendiente_revision' | 'aprobado' | 'rechazado' | null>(null);

    // Payment state
    const [isInitiatingPayment, setIsInitiatingPayment] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [inmuebleEstado, setInmuebleEstado] = useState<string>('borrador');
    const [showPaymentSuccessMessage, setShowPaymentSuccessMessage] = useState(false);

    // Step 1 validation data
    const [step1Data, setStep1Data] = useState<{
        tipo_inmueble: string | null;
        area_m2: number | null;
        barrio: string | null;
        direccion: string | null;
    }>({ tipo_inmueble: null, area_m2: null, barrio: null, direccion: null });

    const hasLoadedRef = useRef(false);

    // ═══════════════════════════════════════════════════════════════
    // HELPERS & AUTO-SAVE
    // ═══════════════════════════════════════════════════════════════
    const autoSaveField = useCallback(async (field: 'tipo_negocio' | 'precio' | 'titulo' | 'descripcion', value: string | number) => {
        if (!propertyId || !hasLoadedRef.current) return;
        setAutoSaveStatus('saving');
        try {
            const updateData: Record<string, any> = { updated_at: new Date().toISOString() };
            updateData[field] = value;
            await supabase.from('inmuebles').update(updateData).eq('id', propertyId);
            setAutoSaveStatus('saved');
            if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
            autoSaveTimeoutRef.current = setTimeout(() => setAutoSaveStatus('idle'), 2000);
        } catch (err) {
            console.error('[AutoSave] Error:', err);
            setAutoSaveStatus('idle');
        }
    }, [propertyId]);

    const saveContactField = useCallback(async (field: 'telefono_llamadas' | 'whatsapp', value: string) => {
        if (!propertyId || !hasLoadedRef.current) return;
        const stateKey = field === 'telefono_llamadas' ? 'telefono' : 'whatsapp';
        setContactSaveStatus(prev => ({ ...prev, [stateKey]: 'saving' }));
        try {
            await supabase.from('inmuebles').update({ [field]: value.trim() || null, updated_at: new Date().toISOString() }).eq('id', propertyId);
            setContactSaveStatus(prev => ({ ...prev, [stateKey]: 'saved' }));
            setTimeout(() => setContactSaveStatus(prev => ({ ...prev, [stateKey]: 'idle' })), 2000);
        } catch (err) {
            setContactSaveStatus(prev => ({ ...prev, [stateKey]: 'error' }));
        }
    }, [propertyId]);

    // ═══════════════════════════════════════════════════════════════
    // DATA LOADING
    // ═══════════════════════════════════════════════════════════════
    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            try {
                const details = await getListingDetails(propertyId);
                if (!details) {
                    setDraftNotFound(true);
                    setIsLoading(false);
                    return;
                }
                setTitle(details.title || '');
                setDescription(details.description || '');
                setPrice(details.price > 0 ? details.price.toString() : '');
                setOfferType(details.offerType === 'arriendo' ? 'arriendo' : 'venta');

                const { data: propertyData } = await supabase.from('inmuebles').select('*').eq('id', propertyId).single();
                if (propertyData) {
                    setTelefono(propertyData.telefono_llamadas || '');
                    setWhatsapp(propertyData.whatsapp || '');
                    setStep1Data({
                        tipo_inmueble: propertyData.tipo_inmueble || null,
                        area_m2: propertyData.area_m2 || null,
                        barrio: propertyData.barrio || null,
                        direccion: propertyData.direccion || null,
                    });
                }
                hasLoadedRef.current = true;
            } catch (err) {
                setError('Error al cargar datos.');
            } finally {
                setIsLoading(false);
            }
        };
        if (propertyId) loadData();
    }, [propertyId]);

    // ═══════════════════════════════════════════════════════════════
    // VERIFICATION CHECK
    // ═══════════════════════════════════════════════════════════════
    const checkVerificationAndUser = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setUserId(user.id);
                setUserEmail(user.email || null);

                const status = await checkUserVerificationStatus(user.id);
                setVerificationStatus(status);

                const approvalStatus = await getUserVerificationApprovalStatus(user.id);
                setUserVerificationApproval(approvalStatus);

                const pendingDocsResult = await checkUserDocumentsPendingApproval(user.id);
                setIsUserDocsPending(pendingDocsResult.isPending);
                setUserPendingStatus(pendingDocsResult.status);
            } else {
                setVerificationStatus('NOT_FOUND');
            }
        } catch (err) {
            console.error('Error checking verification:', err);
        }
    };

    useEffect(() => {
        checkVerificationAndUser();
    }, []);

    // ═══════════════════════════════════════════════════════════════
    // DOCUMENT MANAGEMENT (UPLOAD / DELETE)
    // ═══════════════════════════════════════════════════════════════
    const handleDocumentUploaded = async () => {
        // Refrescar estado cuando se sube algo
        await checkVerificationAndUser();
        const hasDoc = await hasRequiredDocument(propertyId);
        setHasDocumentUploaded(hasDoc);
        if (hasDoc) await activatePaymentForInmueble(propertyId);
    };

    const handleDeleteDocument = async () => {
        if (!userId) return;
        if (!confirm('¿Estás seguro de que deseas eliminar este documento? Tendrás que subir uno nuevo.')) return;

        setIsDeletingDoc(true);
        try {
            const result = await deleteVerificationDocument(userId);
            if (result.success) {
                // Resetear estados locales para forzar que aparezca el formulario
                setVerificationStatus('NOT_FOUND');
                setUserPendingStatus(null);
                setIsUserDocsPending(false);
                setHasDocumentUploaded(false);
                alert('Documento eliminado. Por favor sube el correcto.');
            } else {
                alert('Error al eliminar: ' + result.error);
            }
        } catch (error) {
            console.error('Error delete:', error);
        } finally {
            setIsDeletingDoc(false);
        }
    };

    // ═══════════════════════════════════════════════════════════════
    // VALIDATION & NAVIGATION
    // ═══════════════════════════════════════════════════════════════
    const getMissingFields = useCallback((): string[] => {
        const missing: string[] = [];
        const colombianPhoneRegex = /^\d{10}$/;

        if (userPendingStatus === 'pendiente_revision') {
            missing.push('BLOQUEADO: Cuenta en revisión');
            return missing;
        }

        if (!step1Data.tipo_inmueble) missing.push('Tipo inmueble (Paso 1)');
        if (!step1Data.area_m2) missing.push('Área m² (Paso 1)');
        if (!photosCompleted) missing.push('Fotos obligatorias');
        if (!title.trim()) missing.push('Título');
        if (!description.trim()) missing.push('Descripción');
        if (!price || parseInt(price) <= 0) missing.push('Precio');
        if (!colombianPhoneRegex.test(telefono)) missing.push('Teléfono (10 dígitos)');
        if (!colombianPhoneRegex.test(whatsapp)) missing.push('WhatsApp (10 dígitos)');

        // Si ya está aprobado o tiene docs pendientes (cargados), no exigimos doc
        if (userVerificationApproval.isApproved || userPendingStatus === 'pendiente') {
            return missing;
        }

        // Si es nuevo y no ha subido nada
        if (!hasDocumentUploaded) missing.push('Documento de Identidad');

        return missing;
    }, [step1Data, photosCompleted, title, description, price, telefono, whatsapp, userPendingStatus, userVerificationApproval, hasDocumentUploaded]);

    const handleOfferTypeChange = (newType: 'venta' | 'arriendo') => {
        setOfferType(newType);
        autoSaveField('tipo_negocio', newType);
    };

    const handleGenerateDescription = async () => {
        setIsGenerating(true);
        try {
            const features = await getPropertyFeatures(propertyId);
            if (features) {
                const result = await generatePropertyDescription(features);
                if (result.titulo && result.descripcion) {
                    setTitle(result.titulo);
                    setDescription(result.descripcion);
                    autoSaveField('titulo', result.titulo);
                    autoSaveField('descripcion', result.descripcion);
                }
            }
        } catch (err) {
            setError('Error al generar descripción con IA');
        } finally {
            setIsGenerating(false);
        }
    };

    const handlePayment = async () => {
        if (getMissingFields().length > 0) {
            setError('Faltan campos obligatorios');
            return;
        }
        setIsInitiatingPayment(true);
        try {
            await supabase.from('inmuebles').update({
                titulo, descripcion, precio: parseInt(price), tipo_negocio: offerType,
                telefono_llamadas: telefono, whatsapp, updated_at: new Date().toISOString()
            }).eq('id', propertyId);

            const redirectUrl = `${window.location.origin}/publicar/exito`;
            const result = await initiatePaymentSession(propertyId, userEmail!, userId!, redirectUrl);

            if (result.success && result.data) {
                if (window.location.hostname === 'localhost') {
                    window.open(result.data.checkoutUrl, '_blank');
                    setIsInitiatingPayment(false);
                } else {
                    window.location.href = result.data.checkoutUrl;
                }
            }
        } catch (err: any) {
            setError(err.message);
            setIsInitiatingPayment(false);
        }
    };

    if (isLoading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin" /></div>;

    if (draftNotFound) return <div className="p-8 text-center">Borrador no encontrado</div>;

    const isFormComplete = getMissingFields().length === 0;

    return (
        <div className={`${inter.className} space-y-8`}>
            <div>
                <h1 className="text-2xl font-semibold text-slate-900 mb-1">Detalles y Multimedia</h1>
                <p className="text-slate-500">Sube fotos, describe tu inmueble y establece el precio.</p>
            </div>

            {error && <div className="p-4 bg-red-50 text-red-700 rounded-md">{error}</div>}

            <section className="bg-white border border-gray-200 rounded-md p-6">
                <StepFotos inmuebleId={propertyId} onNext={() => setPhotosCompleted(true)} />
            </section>

            <section className="bg-white border border-gray-200 rounded-md p-6">
                <h2 className="text-lg font-semibold text-slate-900 mb-5">Precio y Oferta</h2>
                <div className="grid md:grid-cols-2 gap-5">
                    <div>
                        <label className="block text-sm font-medium mb-2">Tipo de oferta</label>
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={() => handleOfferTypeChange('venta')} className={`h-11 rounded-md border ${offerType === 'venta' ? 'bg-slate-900 text-white' : 'bg-white'}`}>Venta</button>
                            <button onClick={() => handleOfferTypeChange('arriendo')} className={`h-11 rounded-md border ${offerType === 'arriendo' ? 'bg-slate-900 text-white' : 'bg-white'}`}>Arriendo</button>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-2">Valor</label>
                        <input type="text" value={price} onChange={e => setPrice(e.target.value.replace(/\D/g, ''))} onBlur={() => autoSaveField('precio', parseInt(price))} placeholder="0" className="w-full h-11 border rounded-md px-3" />
                    </div>
                </div>
            </section>

            <section className="bg-white border border-gray-200 rounded-md p-6">
                <div className="flex justify-between mb-5">
                    <h2 className="text-lg font-semibold text-slate-900">Descripción</h2>
                    <button onClick={handleGenerateDescription} disabled={isGenerating} className="text-blue-600 text-sm font-medium flex items-center gap-1">
                        {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Generar con IA
                    </button>
                </div>
                <div className="space-y-4">
                    <input type="text" value={title} onChange={e => setTitle(e.target.value)} onBlur={() => autoSaveField('titulo', title)} placeholder="Título del anuncio" className="w-full h-11 border rounded-md px-3" />
                    <textarea value={description} onChange={e => setDescription(e.target.value)} onBlur={() => autoSaveField('descripcion', description)} placeholder="Descripción detallada..." rows={5} className="w-full border rounded-md p-3 resize-none" />
                </div>
            </section>

            <section className="bg-white border border-gray-200 rounded-md p-6">
                <h2 className="text-lg font-semibold text-slate-900 mb-5">Contacto</h2>
                <div className="grid md:grid-cols-2 gap-5">
                    <input type="tel" value={telefono} onChange={e => setTelefono(e.target.value.replace(/\D/g, ''))} onBlur={() => saveContactField('telefono_llamadas', telefono)} placeholder="Teléfono" className="w-full h-11 border rounded-md px-3" />
                    <input type="tel" value={whatsapp} onChange={e => setWhatsapp(e.target.value.replace(/\D/g, ''))} onBlur={() => saveContactField('whatsapp', whatsapp)} placeholder="WhatsApp" className="w-full h-11 border rounded-md px-3" />
                </div>
            </section>

            {/* SECCIÓN DE VERIFICACIÓN CORREGIDA */}
            <section className="bg-white border border-gray-200 rounded-md p-6">
                <div className="flex items-center gap-2 mb-5">
                    <ShieldCheck className="w-5 h-5 text-slate-600" />
                    <h2 className="text-lg font-semibold text-slate-900">Verificación de Identidad</h2>
                </div>

                {/* CASO 1: USUARIO YA APROBADO */}
                {userVerificationApproval.isApproved && (
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-800 flex gap-3">
                        <Check className="w-5 h-5 mt-1" />
                        <div>
                            <p className="font-medium">Cuenta verificada</p>
                            <p className="text-sm">Ya puedes publicar sin restricciones.</p>
                        </div>
                    </div>
                )}

                {/* CASO 2: DOCUMENTOS PENDIENTES DE REVISIÓN (AQUÍ ESTABA EL ERROR) */}
                {!userVerificationApproval.isApproved && userPendingStatus === 'pendiente' && (
                    <div className="space-y-4">
                        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                            <h3 className="font-medium text-blue-900 mb-2">Documentos Cargados</h3>
                            <div className="flex items-center justify-between bg-white p-3 rounded border border-blue-100 shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                                        <FileText size={20} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-slate-900">Documento de Identidad</p>
                                        <p className="text-xs text-slate-500">Estado: Pendiente de revisión</p>
                                    </div>
                                </div>
                                <button
                                    onClick={handleDeleteDocument}
                                    disabled={isDeletingDoc}
                                    className="p-2 text-red-500 hover:bg-red-50 rounded-full transition-colors"
                                    title="Eliminar documento y volver a subir"
                                >
                                    {isDeletingDoc ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 size={18} />}
                                </button>
                            </div>
                            <p className="text-xs text-blue-700 mt-3">
                                * Tus documentos están guardados y listos para revisión. Si subiste el archivo incorrecto, usa el icono de basura para eliminarlo y subir uno nuevo.
                            </p>
                        </div>
                    </div>
                )}

                {/* CASO 3: USUARIO NUEVO O SIN DOCUMENTOS (MOSTRAR FORMULARIO) */}
                {!userVerificationApproval.isApproved && userPendingStatus !== 'pendiente' && userPendingStatus !== 'pendiente_revision' && (
                    <InmuebleVerificationForm inmuebleId={propertyId} onDocumentUploaded={handleDocumentUploaded} />
                )}
            </section>

            <div className="flex justify-between pt-4 border-t">
                <button onClick={() => router.back()} className="flex items-center gap-1 text-slate-600 font-medium">
                    <ChevronLeft size={18} /> Atrás
                </button>

                <button
                    onClick={handlePayment}
                    disabled={!isFormComplete || isInitiatingPayment}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-md font-medium text-white transition-colors ${isFormComplete ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-300 cursor-not-allowed'
                        }`}
                >
                    {isInitiatingPayment ? <Loader2 className="animate-spin" /> : <CreditCard size={18} />}
                    Pagar y Publicar ($10.000)
                </button>
            </div>
        </div>
    );
}