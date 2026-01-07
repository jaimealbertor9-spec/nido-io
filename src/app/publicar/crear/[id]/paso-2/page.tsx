'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Inter } from 'next/font/google';
// Script import removed - using redirect method instead of widget
import {
    Loader2, ChevronLeft, ChevronRight, Sparkles,
    Phone, MessageCircle, Home, Key, DollarSign, Check, AlertCircle, CalendarDays,
    ShieldCheck, Upload, FileImage, X, CreditCard
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { updateListingDetails, getListingDetails, getPropertyFeatures } from '@/app/actions/updateListingDetails';
import { generatePropertyDescription } from '@/app/actions/generateDescription';
import { checkUserVerificationStatus, submitVerificationDocument, VerificationStatus } from '@/app/actions/submitVerification';
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

// Supabase client imported from lib/supabase.ts singleton


export default function Paso2Page() {
    const router = useRouter();
    const params = useParams();
    const propertyId = params.id as string;

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [draftNotFound, setDraftNotFound] = useState(false);

    // Auto-save state for Price & Offer section
    const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
    const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const priceDebounceRef = useRef<NodeJS.Timeout | null>(null);
    const titleDebounceRef = useRef<NodeJS.Timeout | null>(null);
    const descriptionDebounceRef = useRef<NodeJS.Timeout | null>(null);

    // Contact field auto-save state (with error support)
    const [contactSaveStatus, setContactSaveStatus] = useState<{
        telefono: 'idle' | 'saving' | 'saved' | 'error';
        whatsapp: 'idle' | 'saving' | 'saved' | 'error'
    }>({
        telefono: 'idle',
        whatsapp: 'idle'
    });
    const contactSaveTimeoutRef = useRef<{ telefono: NodeJS.Timeout | null; whatsapp: NodeJS.Timeout | null }>({
        telefono: null,
        whatsapp: null
    });

    // Photos completed state (from StepFotos callback)
    const [photosCompleted, setPhotosCompleted] = useState(false);

    // Listing details state
    const [offerType, setOfferType] = useState<'venta' | 'arriendo'>('venta');
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [price, setPrice] = useState('');

    // Contact state
    const [telefono, setTelefono] = useState('');
    const [whatsapp, setWhatsapp] = useState('');

    // Trust & Verification state
    const [verificationStatus, setVerificationStatus] = useState<VerificationStatus | 'loading'>('loading');
    const [verificationFile, setVerificationFile] = useState<File | null>(null);
    const [verificationPreview, setVerificationPreview] = useState<string | null>(null);
    const [isUploadingVerification, setIsUploadingVerification] = useState(false);
    const [contactErrors, setContactErrors] = useState<{ telefono?: string; whatsapp?: string }>({});
    const [hasDocumentUploaded, setHasDocumentUploaded] = useState(false);

    // User verification approval state (for blocking pending users)
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

    // Inmueble status tracking (for detecting 'en_revision' or 'publicado' after payment)
    const [inmuebleEstado, setInmuebleEstado] = useState<string>('borrador');
    const [showPaymentSuccessMessage, setShowPaymentSuccessMessage] = useState(false);

    // Step 1 validation data (loaded from DB for cross-step validation)
    const [step1Data, setStep1Data] = useState<{
        tipo_inmueble: string | null;
        area_m2: number | null;
        barrio: string | null;
        direccion: string | null;
    }>({
        tipo_inmueble: null,
        area_m2: null,
        barrio: null,
        direccion: null,
    });

    // Track if initial load is complete (to prevent auto-save on hydration)
    const hasLoadedRef = useRef(false);

    // ═══════════════════════════════════════════════════════════════
    // AUTO-SAVE FUNCTION
    // ═══════════════════════════════════════════════════════════════
    const autoSaveField = useCallback(async (field: 'tipo_negocio' | 'precio' | 'titulo' | 'descripcion', value: string | number) => {
        if (!propertyId || !hasLoadedRef.current) return;

        setAutoSaveStatus('saving');

        try {
            const updateData: Record<string, any> = {
                updated_at: new Date().toISOString()
            };
            updateData[field] = value;

            const { error: updateError } = await supabase
                .from('inmuebles')
                .update(updateData)
                .eq('id', propertyId);

            if (updateError) throw updateError;

            setAutoSaveStatus('saved');

            // Clear "saved" status after 2 seconds
            if (autoSaveTimeoutRef.current) {
                clearTimeout(autoSaveTimeoutRef.current);
            }
            autoSaveTimeoutRef.current = setTimeout(() => {
                setAutoSaveStatus('idle');
            }, 2000);

        } catch (err) {
            console.error('[AutoSave] Error:', err);
            setAutoSaveStatus('idle');
        }
    }, [propertyId]);

    // ═══════════════════════════════════════════════════════════════
    // CONTACT FIELD AUTO-SAVE (onBlur Strategy with robust error handling)
    // ═══════════════════════════════════════════════════════════════
    const saveContactField = useCallback(async (field: 'telefono_llamadas' | 'whatsapp', value: string) => {
        // Guard: Don't save if not loaded or no property ID
        if (!propertyId) {
            console.warn('[ContactAutoSave] No propertyId, skipping save');
            return;
        }
        if (!hasLoadedRef.current) {
            console.warn('[ContactAutoSave] Data not loaded yet, skipping save');
            return;
        }

        const stateKey = field === 'telefono_llamadas' ? 'telefono' : 'whatsapp';

        // Clear any existing timeout for this field
        if (contactSaveTimeoutRef.current[stateKey]) {
            clearTimeout(contactSaveTimeoutRef.current[stateKey]!);
            contactSaveTimeoutRef.current[stateKey] = null;
        }

        // Set saving state immediately
        setContactSaveStatus(prev => ({ ...prev, [stateKey]: 'saving' }));
        console.log(`[ContactAutoSave] Saving ${field}:`, value);

        try {
            const updateData: Record<string, any> = {
                updated_at: new Date().toISOString()
            };
            updateData[field] = value.trim() || null;

            const { error: updateError } = await supabase
                .from('inmuebles')
                .update(updateData)
                .eq('id', propertyId);

            if (updateError) {
                console.error('[ContactAutoSave] Supabase error:', updateError);
                throw updateError;
            }

            console.log(`[ContactAutoSave] ✅ ${field} saved successfully`);
            setContactSaveStatus(prev => ({ ...prev, [stateKey]: 'saved' }));

            // Clear "saved" status after 2 seconds
            contactSaveTimeoutRef.current[stateKey] = setTimeout(() => {
                setContactSaveStatus(prev => ({ ...prev, [stateKey]: 'idle' }));
            }, 2000);

        } catch (err: any) {
            console.error('[ContactAutoSave] Error saving contact field:', err?.message || err);
            setContactSaveStatus(prev => ({ ...prev, [stateKey]: 'error' }));

            // Clear error state after 3 seconds
            contactSaveTimeoutRef.current[stateKey] = setTimeout(() => {
                setContactSaveStatus(prev => ({ ...prev, [stateKey]: 'idle' }));
            }, 3000);
        }
    }, [propertyId]);

    // ═══════════════════════════════════════════════════════════════
    // LOAD DATA ON MOUNT
    // ═══════════════════════════════════════════════════════════════
    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            try {
                // Load listing details
                const details = await getListingDetails(propertyId);

                // ═══════════════════════════════════════════════════════════════
                // NULL GUARD: Handle case where draft doesn't exist in database
                // ═══════════════════════════════════════════════════════════════
                if (!details) {
                    console.warn('[Paso2] Draft not found for ID:', propertyId);
                    setDraftNotFound(true);
                    setIsLoading(false);
                    return;
                }

                setTitle(details.title || '');
                setDescription(details.description || '');
                setPrice(details.price > 0 ? details.price.toString() : '');
                // Only accept valid offer types (venta or arriendo)
                const validOfferType = details.offerType === 'arriendo' ? 'arriendo' : 'venta';
                setOfferType(validOfferType);

                // Load contact info AND Step 1 validation data
                const { data: propertyData } = await supabase
                    .from('inmuebles')
                    .select('telefono_llamadas, whatsapp, tipo_inmueble, area_m2, barrio, direccion')
                    .eq('id', propertyId)
                    .single();

                if (propertyData) {
                    setTelefono(propertyData.telefono_llamadas || '');
                    setWhatsapp(propertyData.whatsapp || '');

                    // Store Step 1 data for validation
                    setStep1Data({
                        tipo_inmueble: propertyData.tipo_inmueble || null,
                        area_m2: propertyData.area_m2 || null,
                        barrio: propertyData.barrio || null,
                        direccion: propertyData.direccion || null,
                    });
                }

                // Mark as loaded to allow auto-save
                hasLoadedRef.current = true;

            } catch (err) {
                console.error('Error loading data:', err);
                setError('Error al cargar los datos. Por favor, recarga la página.');
            } finally {
                setIsLoading(false);
            }
        };

        if (propertyId) {
            loadData();
        }

        // Cleanup on unmount
        return () => {
            if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
            if (priceDebounceRef.current) clearTimeout(priceDebounceRef.current);
            if (titleDebounceRef.current) clearTimeout(titleDebounceRef.current);
            if (descriptionDebounceRef.current) clearTimeout(descriptionDebounceRef.current);
            // Cleanup contact save timeouts
            if (contactSaveTimeoutRef.current.telefono) clearTimeout(contactSaveTimeoutRef.current.telefono);
            if (contactSaveTimeoutRef.current.whatsapp) clearTimeout(contactSaveTimeoutRef.current.whatsapp);
        };
    }, [propertyId]);

    // ═══════════════════════════════════════════════════════════════
    // CHECK VERIFICATION STATUS ON MOUNT + LOAD USER DATA
    // ═══════════════════════════════════════════════════════════════
    useEffect(() => {
        const checkVerificationAndUser = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    // Set user data for payment
                    setUserId(user.id);
                    setUserEmail(user.email || null);

                    const status = await checkUserVerificationStatus(user.id);
                    setVerificationStatus(status);

                    // Check user's overall verification approval status
                    const approvalStatus = await getUserVerificationApprovalStatus(user.id);
                    setUserVerificationApproval(approvalStatus);

                    // Check if user has documents pending approval (pendiente or pendiente_revision)
                    const pendingDocsResult = await checkUserDocumentsPendingApproval(user.id);
                    setIsUserDocsPending(pendingDocsResult.isPending);
                    setUserPendingStatus(pendingDocsResult.status);

                    console.log('📋 User verification status:', {
                        status,
                        approvalStatus,
                        hasPendingDocs: pendingDocsResult.isPending,
                        pendingStatus: pendingDocsResult.status
                    });
                } else {
                    setVerificationStatus('NOT_FOUND');
                }
            } catch (err) {
                console.error('Error checking verification:', err);
                setVerificationStatus('NOT_FOUND');
            }
        };

        checkVerificationAndUser();
    }, []);

    // ═══════════════════════════════════════════════════════════════
    // CHECK IF DOCUMENT ALREADY UPLOADED FOR THIS INMUEBLE
    // ═══════════════════════════════════════════════════════════════
    useEffect(() => {
        const checkDocumentUploaded = async () => {
            if (propertyId) {
                const hasDoc = await hasRequiredDocument(propertyId);
                setHasDocumentUploaded(hasDoc);
            }
        };
        checkDocumentUploaded();
    }, [propertyId]);

    // ═══════════════════════════════════════════════════════════════
    // POLL INMUEBLE STATUS: Detect 'en_revision' or 'publicado' after payment
    // ═══════════════════════════════════════════════════════════════
    useEffect(() => {
        if (!propertyId) return;

        let pollInterval: NodeJS.Timeout | null = null;
        let isCancelled = false;

        const checkInmuebleStatus = async () => {
            try {
                const { data, error } = await supabase
                    .from('inmuebles')
                    .select('estado')
                    .eq('id', propertyId)
                    .single();

                if (error || !data || isCancelled) return;

                const estado = data.estado;
                setInmuebleEstado(estado);

                // If status changed to 'en_revision' or 'publicado', show success message and redirect
                if (estado === 'en_revision' || estado === 'publicado') {
                    console.log(`🎉 [Status] Inmueble changed to: ${estado}`);
                    setShowPaymentSuccessMessage(true);
                    setIsInitiatingPayment(false);

                    // Clear the polling interval
                    if (pollInterval) {
                        clearInterval(pollInterval);
                        pollInterval = null;
                    }

                    // Redirect after 3 seconds
                    setTimeout(() => {
                        if (!isCancelled) {
                            router.push('/mis-inmuebles');
                        }
                    }, 3000);
                }
            } catch (err) {
                console.error('[Status Poll] Error:', err);
            }
        };

        // Initial check
        checkInmuebleStatus();

        // Poll every 3 seconds (only if not already in a final state)
        pollInterval = setInterval(() => {
            if (!isCancelled) {
                checkInmuebleStatus();
            }
        }, 3000);

        return () => {
            isCancelled = true;
            if (pollInterval) {
                clearInterval(pollInterval);
            }
        };
    }, [propertyId, router]);

    // ═══════════════════════════════════════════════════════════════
    // HANDLE DOCUMENT CHANGE (Upload OR Delete) -> Refresh Status
    // ═══════════════════════════════════════════════════════════════
    const handleDocumentUploaded = async () => {
        console.log('📄 [Doc Change] Refreshing document status...');

        try {
            // CRITICAL: Re-check document status from server
            // This is called for BOTH uploads AND deletions
            const hasDoc = await hasRequiredDocument(propertyId);
            console.log('📄 [Doc Change] hasRequiredDocument:', hasDoc);
            setHasDocumentUploaded(hasDoc);

            // Also refresh the pending status
            const pendingResult = await checkUserDocumentsPendingApproval(userId || '');
            console.log('📄 [Doc Change] Pending result:', pendingResult);

            if (pendingResult.isPending) {
                setUserPendingStatus(pendingResult.status);
                setIsUserDocsPending(true);
            } else {
                setUserPendingStatus(null);
                setIsUserDocsPending(false);
            }

            // If document was just uploaded (hasDoc = true), activate payment
            if (hasDoc) {
                console.log('✅ Document uploaded, activating payment...');
                const result = await activatePaymentForInmueble(propertyId);

                if (result.success) {
                    console.log('✅ Payment activated');
                } else {
                    console.warn('Payment activation warning:', result.error);
                }
            } else {
                console.log('⚠️ No document - payment button should be disabled');
            }
        } catch (err: any) {
            console.error('Document status refresh error:', err);
        }
    };

    // ═══════════════════════════════════════════════════════════════
    // HANDLE VERIFICATION FILE SELECTION
    // ═══════════════════════════════════════════════════════════════
    const handleVerificationFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            // Validate file size (max 5MB)
            if (file.size > 5 * 1024 * 1024) {
                setError('El archivo es muy grande. Máximo 5MB.');
                return;
            }
            // Validate file type
            if (!file.type.startsWith('image/')) {
                setError('Solo se permiten imágenes (JPG, PNG).');
                return;
            }
            setVerificationFile(file);
            setVerificationPreview(URL.createObjectURL(file));
            setError(null);
        }
    };

    const clearVerificationFile = () => {
        setVerificationFile(null);
        if (verificationPreview) {
            URL.revokeObjectURL(verificationPreview);
            setVerificationPreview(null);
        }
    };

    // ═══════════════════════════════════════════════════════════════
    // AI DESCRIPTION GENERATOR
    // ═══════════════════════════════════════════════════════════════
    const handleGenerateDescription = async () => {
        console.log('🚀 [AI Button] Clicked! Starting generation...');
        console.log('🔑 Property ID:', propertyId);

        setIsGenerating(true);
        setError(null);

        try {
            console.log('📥 [AI Button] Fetching property features...');
            const features = await getPropertyFeatures(propertyId);
            console.log('📦 [AI Button] Features received:', features);

            if (!features) {
                console.error('❌ [AI Button] No features returned!');
                setError('No se encontraron características. Completa el paso anterior.');
                return;
            }

            console.log('🤖 [AI Button] Calling generatePropertyDescription...');
            const result = await generatePropertyDescription(features);
            console.log('✅ [AI Button] AI Result:', result);

            if (result.titulo && result.descripcion) {
                console.log('📝 [AI Button] Updating UI state...');
                // Update UI state
                setTitle(result.titulo);
                setDescription(result.descripcion);

                // Auto-save to database immediately
                console.log('💾 [AI Button] Auto-saving to database...');
                await Promise.all([
                    autoSaveField('titulo', result.titulo),
                    autoSaveField('descripcion', result.descripcion)
                ]);
                console.log('✅ [AI Button] Saved to database!');
            } else {
                console.error('❌ [AI Button] Invalid result - missing titulo or descripcion');
                setError('La IA no pudo generar el contenido. Intenta de nuevo.');
            }
        } catch (err: any) {
            console.error('❌ [AI Button] Error:', err);
            console.error('   Stack:', err.stack);
            setError('No pudimos generar la descripción en este momento. Intenta de nuevo.');
        } finally {
            console.log('🏁 [AI Button] Generation complete.');
            setIsGenerating(false);
        }
    };

    // ═══════════════════════════════════════════════════════════════
    // OFFER TYPE HANDLER (Immediate Auto-Save)
    // ═══════════════════════════════════════════════════════════════
    const handleOfferTypeChange = (newType: 'venta' | 'arriendo') => {
        setOfferType(newType);
        autoSaveField('tipo_negocio', newType);
    };

    // ═══════════════════════════════════════════════════════════════
    // PRICE FORMATTING & HANDLER (Debounced Auto-Save)
    // ═══════════════════════════════════════════════════════════════
    const formatPrice = (value: string) => {
        const num = value.replace(/\D/g, '');
        if (!num) return '';
        return new Intl.NumberFormat('es-CO').format(parseInt(num));
    };

    const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value.replace(/\D/g, '');
        setPrice(raw);

        // Debounce auto-save for 1 second
        if (priceDebounceRef.current) {
            clearTimeout(priceDebounceRef.current);
        }
        priceDebounceRef.current = setTimeout(() => {
            const numericPrice = parseInt(raw) || 0;
            if (numericPrice > 0) {
                autoSaveField('precio', numericPrice);
            }
        }, 1000);
    };

    // Also save on blur for immediate feedback
    const handlePriceBlur = () => {
        if (priceDebounceRef.current) {
            clearTimeout(priceDebounceRef.current);
        }
        const numericPrice = parseInt(price) || 0;
        if (numericPrice > 0) {
            autoSaveField('precio', numericPrice);
        }
    };

    const getNumericPrice = () => parseInt(price) || 0;

    // ═══════════════════════════════════════════════════════════════
    // TITLE HANDLER (Debounced Auto-Save)
    // ═══════════════════════════════════════════════════════════════
    const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newTitle = e.target.value;
        setTitle(newTitle);

        // Debounce auto-save for 1 second
        if (titleDebounceRef.current) {
            clearTimeout(titleDebounceRef.current);
        }
        titleDebounceRef.current = setTimeout(() => {
            if (newTitle.trim()) {
                autoSaveField('titulo', newTitle.trim());
            }
        }, 1000);
    };

    const handleTitleBlur = () => {
        if (titleDebounceRef.current) {
            clearTimeout(titleDebounceRef.current);
        }
        if (title.trim()) {
            autoSaveField('titulo', title.trim());
        }
    };

    // ═══════════════════════════════════════════════════════════════
    // DESCRIPTION HANDLER (Debounced Auto-Save)
    // ═══════════════════════════════════════════════════════════════
    const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newDescription = e.target.value;
        setDescription(newDescription);

        // Debounce auto-save for 1 second
        if (descriptionDebounceRef.current) {
            clearTimeout(descriptionDebounceRef.current);
        }
        descriptionDebounceRef.current = setTimeout(() => {
            if (newDescription.trim()) {
                autoSaveField('descripcion', newDescription.trim());
            }
        }, 1000);
    };

    const handleDescriptionBlur = () => {
        if (descriptionDebounceRef.current) {
            clearTimeout(descriptionDebounceRef.current);
        }
        if (description.trim()) {
            autoSaveField('descripcion', description.trim());
        }
    };

    // ═══════════════════════════════════════════════════════════════
    // BACK NAVIGATION (Race-Condition Safe)
    // ═══════════════════════════════════════════════════════════════
    const [isNavigatingBack, setIsNavigatingBack] = useState(false);

    const handleBack = () => {
        // Cancel all pending debounced saves to prevent race conditions
        if (priceDebounceRef.current) clearTimeout(priceDebounceRef.current);
        if (titleDebounceRef.current) clearTimeout(titleDebounceRef.current);
        if (descriptionDebounceRef.current) clearTimeout(descriptionDebounceRef.current);
        if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);

        // Show loading state
        setIsNavigatingBack(true);

        // Safety timeout: If navigation doesn't complete in 5 seconds, unlock UI
        const safetyTimeout = setTimeout(() => {
            setIsNavigatingBack(false);
        }, 5000);

        // Navigate (fire and forget - don't await)
        router.push(`/publicar/crear/${propertyId}/paso-1`);

        // Clear safety timeout on successful navigation (component unmount will handle this)
        return () => clearTimeout(safetyTimeout);
    };

    // ═══════════════════════════════════════════════════════════════
    // SMART VALIDATION: Get all missing fields for Smart Submit Button
    // 3-STATE CONDITIONAL LOGIC based on user verification status
    // ═══════════════════════════════════════════════════════════════
    const getMissingFields = useCallback((): string[] => {
        const missing: string[] = [];
        const colombianPhoneRegex = /^\d{10}$/;

        // ═══════════════════════════════════════════════════════════════
        // SCENARIO B: UNDER REVIEW (pendiente_revision)
        // User has paid and is waiting for admin approval
        // PERMANENTLY BLOCK - No new payments allowed
        // ═══════════════════════════════════════════════════════════════
        if (userPendingStatus === 'pendiente_revision') {
            missing.push('BLOQUEADO: Cuenta en revisión (aprox. 20 min)');
            return missing; // Hard block - don't check anything else
        }

        // ═══════════════════════════════════════════════════════════════
        // COMMON VALIDATIONS (Step 1 + Step 2 fields)
        // Required for ALL scenarios (A, A-pending, C)
        // ═══════════════════════════════════════════════════════════════

        // Step 1 Fields (from database)
        if (!step1Data.tipo_inmueble) {
            missing.push('Tipo de inmueble (Paso 1)');
        }
        if (!step1Data.area_m2 || step1Data.area_m2 <= 0) {
            missing.push('Área en m² (Paso 1)');
        }
        if (!step1Data.barrio && !step1Data.direccion) {
            missing.push('Ubicación/Barrio (Paso 1)');
        }

        // Step 2 Fields (current form)
        if (!photosCompleted) {
            missing.push('Fotos obligatorias');
        }
        if (!title.trim()) {
            missing.push('Título del anuncio');
        }
        if (title.length > 70) {
            missing.push('Título excede 70 caracteres');
        }
        if (!description.trim()) {
            missing.push('Descripción');
        }
        if (getNumericPrice() <= 0) {
            missing.push('Precio');
        }
        if (!colombianPhoneRegex.test(telefono.replace(/\D/g, ''))) {
            missing.push('Teléfono (10 dígitos)');
        }
        if (!colombianPhoneRegex.test(whatsapp.replace(/\D/g, ''))) {
            missing.push('WhatsApp (10 dígitos)');
        }

        // ═══════════════════════════════════════════════════════════════
        // SCENARIO C: APPROVED USER
        // ID Document: NOT REQUIRED (hidden)
        // Power of Attorney: OPTIONAL (can proceed without it)
        // Button: ENABLED after Step 1 + Step 2 validation only
        // ═══════════════════════════════════════════════════════════════
        if (userVerificationApproval.isApproved) {
            // No document requirements for approved users
            return missing;
        }

        // ═══════════════════════════════════════════════════════════════
        // SCENARIO A-PENDING: User has uploaded docs, status is 'pendiente'
        // CRITICAL FIX: If userPendingStatus === 'pendiente', it means
        // the user HAS ALREADY uploaded documents (that's how they got
        // the 'pendiente' status in the first place).
        // DO NOT require re-upload - treat document requirement as SATISFIED
        // ENABLE the button so they can PAY and transition to pendiente_revision
        // ═══════════════════════════════════════════════════════════════
        if (userPendingStatus === 'pendiente') {
            // Documents already uploaded - requirement satisfied
            // Allow payment to proceed
            console.log('✅ [Validation] User has pendiente status = docs already uploaded');
            return missing;
        }

        // ═══════════════════════════════════════════════════════════════
        // SCENARIO A-NEW: Truly new user (null/NOT_FOUND status)
        // ID Document: MANDATORY
        // Button: ENABLED only when all docs uploaded + fields valid
        // ═══════════════════════════════════════════════════════════════
        if (!hasDocumentUploaded) {
            missing.push('Documento de identidad (Cédula)');
        }

        return missing;
    }, [step1Data, photosCompleted, title, description, price, telefono, whatsapp, userPendingStatus, userVerificationApproval, hasDocumentUploaded]);

    // Check if form is complete (for button styling)
    const isFormComplete = getMissingFields().length === 0;

    // Check if user is permanently blocked (pendiente_revision)
    const isUserBlocked = userPendingStatus === 'pendiente_revision';

    // Check if user has already uploaded docs (pendiente status)
    const hasExistingDocs = userPendingStatus === 'pendiente';

    // ═══════════════════════════════════════════════════════════════
    // SAVE AND CONTINUE
    // ═══════════════════════════════════════════════════════════════
    const handleContinue = async () => {
        // Smart Validation: Check all fields first
        const missingFields = getMissingFields();

        if (missingFields.length > 0) {
            // Show alert with missing fields list
            setError(`Por favor completa: ${missingFields.join(', ')}`);

            // Also set contact errors for visual feedback if applicable
            const colombianPhoneRegex = /^\d{10}$/;
            const newContactErrors: { telefono?: string; whatsapp?: string } = {};

            if (!colombianPhoneRegex.test(telefono.replace(/\D/g, ''))) {
                newContactErrors.telefono = 'El número debe tener 10 dígitos exactos';
            }
            if (!colombianPhoneRegex.test(whatsapp.replace(/\D/g, ''))) {
                newContactErrors.whatsapp = 'El número debe tener 10 dígitos exactos';
            }

            if (Object.keys(newContactErrors).length > 0) {
                setContactErrors(newContactErrors);
            }

            return;
        }

        // All validations passed - proceed with save
        setContactErrors({});
        setError(null);
        setIsSaving(true);

        try {
            // Save listing details
            const result = await updateListingDetails(
                propertyId,
                title.trim(),
                description.trim(),
                getNumericPrice(),
                offerType,
                []
            );

            if (!result.success) {
                throw new Error(result.error || 'Error al guardar');
            }

            // Save contact info
            await supabase
                .from('inmuebles')
                .update({
                    telefono_llamadas: telefono.trim() || null,
                    whatsapp: whatsapp.trim() || null,
                    updated_at: new Date().toISOString()
                })
                .eq('id', propertyId);

            // Upload verification document if needed
            if ((verificationStatus === 'NOT_FOUND' || verificationStatus === 'rechazado') && verificationFile) {
                setIsUploadingVerification(true);

                try {
                    // Get current user
                    const { data: { user } } = await supabase.auth.getUser();
                    if (user) {
                        // Convert file to base64
                        const reader = new FileReader();
                        const fileBase64 = await new Promise<string>((resolve, reject) => {
                            reader.onload = () => resolve(reader.result as string);
                            reader.onerror = reject;
                            reader.readAsDataURL(verificationFile);
                        });

                        // Submit verification
                        const verificationResult = await submitVerificationDocument(
                            user.id,
                            fileBase64,
                            verificationFile.name,
                            verificationFile.type
                        );

                        if (!verificationResult.success) {
                            console.warn('Verification upload warning:', verificationResult.error);
                            // Don't block navigation - verification can be done later
                        } else {
                            console.log('✅ Verification document submitted successfully');
                        }
                    }
                } catch (verifyErr) {
                    console.warn('Verification upload error (non-blocking):', verifyErr);
                    // Don't block navigation - verification is optional for proceeding
                } finally {
                    setIsUploadingVerification(false);
                }
            }

            // Navigate to payment
            router.push(`/publicar/pago/${propertyId}`);

        } catch (err: any) {
            console.error('Save error:', err);
            setError(err.message || 'Error al guardar');
        } finally {
            setIsSaving(false);
        }
    };

    // ═══════════════════════════════════════════════════════════════
    // WOMPI PAYMENT HANDLER (Redirect Method)
    // ═══════════════════════════════════════════════════════════════
    const handlePayment = async () => {
        // ═══════════════════════════════════════════════════════════════
        // SECURITY CHECK: Block users in pendiente_revision state
        // ═══════════════════════════════════════════════════════════════
        if (isUserBlocked) {
            setError('🚫 Tu cuenta está en revisión. No puedes iniciar nuevos pagos hasta ser aprobado.');
            console.error('[Security] Blocked payment attempt for user in pendiente_revision state');
            return;
        }

        // Pre-condition: Form must be valid
        const missingFields = getMissingFields();
        if (missingFields.length > 0) {
            setError(`Por favor completa: ${missingFields.join(', ')}`);
            return;
        }

        // Ensure we have user data
        if (!userId || !userEmail) {
            setError('Error de autenticación. Por favor, recarga la página.');
            return;
        }

        setIsInitiatingPayment(true);
        setError(null);

        try {
            console.log('💳 [Payment] Initiating payment session (Redirect Method)...');

            // Save any pending data first
            await supabase
                .from('inmuebles')
                .update({
                    titulo: title.trim(),
                    descripcion: description.trim(),
                    precio: parseInt(price) || 0,
                    tipo_negocio: offerType,
                    telefono_llamadas: telefono.trim() || null,
                    whatsapp: whatsapp.trim() || null,
                    updated_at: new Date().toISOString()
                })
                .eq('id', propertyId);

            // Build redirect URL for Wompi callback
            const redirectUrl = `${window.location.origin}/publicar/exito`;

            // Call server action to get checkout URL
            const result = await initiatePaymentSession(propertyId, userEmail, userId, redirectUrl);

            if (!result.success || !result.data) {
                throw new Error(result.error || 'No se pudo iniciar el pago');
            }

            console.log('✅ [Payment] Checkout URL ready');
            console.log('   Reference:', result.data.reference);
            console.log('   Amount:', result.data.amountInCents / 100, 'COP');
            console.log('   URL:', result.data.checkoutUrl);

            // Check if we're in development/localhost
            const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

            if (isDev) {
                // In development: Open in new tab to avoid losing context
                window.open(result.data.checkoutUrl, '_blank');
                setIsInitiatingPayment(false);

                // Show feedback to user
                alert(
                    '✅ Link de pago generado correctamente.\n\n' +
                    '📱 Se abrió una nueva pestaña para completar el pago.\n\n' +
                    `📋 Referencia: ${result.data.reference}\n\n` +
                    'Después de pagar, puedes cerrar la pestaña y continuar aquí.'
                );
            } else {
                // In production: Use redirect (Wompi will redirect back)
                window.location.href = result.data.checkoutUrl;
            }

        } catch (err: any) {
            console.error('❌ [Payment] Error:', err.message);
            setError(err.message || 'Error al iniciar el pago. Inténtalo de nuevo.');
            setIsInitiatingPayment(false);
        }
    };

    // ═══════════════════════════════════════════════════════════════
    // LOADING STATE
    // ═══════════════════════════════════════════════════════════════
    if (isLoading) {
        return (
            <div className={`${inter.className} flex items-center justify-center min-h-[400px]`}>
                <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
            </div>
        );
    }

    // ═══════════════════════════════════════════════════════════════
    // DRAFT NOT FOUND STATE
    // ═══════════════════════════════════════════════════════════════
    if (draftNotFound) {
        return (
            <div className={`${inter.className} flex flex-col items-center justify-center min-h-[400px] text-center p-8`}>
                <AlertCircle className="w-16 h-16 text-amber-500 mb-4" />
                <h2 className="text-xl font-semibold text-slate-900 mb-2">
                    Borrador no encontrado
                </h2>
                <p className="text-slate-500 mb-6 max-w-md">
                    El inmueble que buscas no existe o fue eliminado.
                    Por favor, crea un nuevo anuncio.
                </p>
                <button
                    onClick={() => router.push('/publicar/tipo')}
                    className="px-6 py-2.5 bg-[#0c263b] text-white font-medium rounded-md hover:bg-[#0c263b]/90 transition-colors"
                >
                    Crear nuevo anuncio
                </button>
            </div>
        );
    }


    // ═══════════════════════════════════════════════════════════════
    // MAIN RENDER
    // ═══════════════════════════════════════════════════════════════
    return (
        <div className={`${inter.className} space-y-8`}>
            {/* Header */}
            <div>
                <h1 className="text-2xl font-semibold text-slate-900 mb-1">
                    Detalles y Multimedia
                </h1>
                <p className="text-slate-500">
                    Sube fotos, describe tu inmueble y establece el precio.
                </p>
            </div>

            {/* Error Message */}
            {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
                    {error}
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════════ */}
            {/* SECTION A: FOTOGRAFÍAS (STRUCTURED FLOW) */}
            {/* ═══════════════════════════════════════════════════════════ */}
            <section className="bg-white border border-gray-200 rounded-md p-6">
                <StepFotos
                    inmuebleId={propertyId}
                    onNext={() => setPhotosCompleted(true)}
                />
            </section>

            {/* ═══════════════════════════════════════════════════════════ */}
            {/* SECTION B: TIPO DE OFERTA Y PRECIO (Auto-Save) */}
            {/* ═══════════════════════════════════════════════════════════ */}
            <section className="bg-white border border-gray-200 rounded-md p-6">
                <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2">
                        <DollarSign className="w-5 h-5 text-slate-600" />
                        <h2 className="text-lg font-semibold text-slate-900">Precio y Oferta</h2>
                    </div>

                    {/* Auto-Save Status Indicator */}
                    {autoSaveStatus !== 'idle' && (
                        <div className={`flex items-center gap-1.5 text-xs font-medium transition-opacity ${autoSaveStatus === 'saving' ? 'text-blue-500' : 'text-green-600'}`}>
                            {autoSaveStatus === 'saving' ? (
                                <>
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    Guardando...
                                </>
                            ) : (
                                <>
                                    <Check className="w-3 h-3" />
                                    Guardado
                                </>
                            )}
                        </div>
                    )}
                </div>

                <div className="grid md:grid-cols-2 gap-5">
                    {/* Offer Type - 2 options */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Tipo de oferta
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => handleOfferTypeChange('venta')}
                                className={`flex items-center justify-center gap-2 h-11 rounded-md font-medium text-sm border transition-all ${offerType === 'venta'
                                    ? 'bg-slate-900 text-white border-slate-900'
                                    : 'bg-white text-slate-700 border-gray-300 hover:border-slate-400'
                                    }`}
                            >
                                <Home size={16} />
                                Venta
                            </button>
                            <button
                                type="button"
                                onClick={() => handleOfferTypeChange('arriendo')}
                                className={`flex items-center justify-center gap-2 h-11 rounded-md font-medium text-sm border transition-all ${offerType === 'arriendo'
                                    ? 'bg-slate-900 text-white border-slate-900'
                                    : 'bg-white text-slate-700 border-gray-300 hover:border-slate-400'
                                    }`}
                            >
                                <Key size={16} />
                                Arriendo
                            </button>
                        </div>
                    </div>

                    {/* Price */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            {offerType === 'arriendo' ? 'Canon mensual' : 'Valor'} <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-medium">$</span>
                            <input
                                type="text"
                                value={formatPrice(price)}
                                onChange={handlePriceChange}
                                onBlur={handlePriceBlur}
                                placeholder="0"
                                className="w-full h-11 pl-8 pr-16 bg-white border border-gray-300 rounded-md text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                                COP{offerType === 'arriendo' ? '/mes' : ''}
                            </span>
                        </div>
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════════════════════════ */}
            {/* SECTION C: DESCRIPCIÓN */}
            {/* ═══════════════════════════════════════════════════════════ */}
            <section className="bg-white border border-gray-200 rounded-md p-6">
                <div className="flex items-center justify-between mb-5">
                    <h2 className="text-lg font-semibold text-slate-900">Descripción</h2>
                    <button
                        type="button"
                        onClick={handleGenerateDescription}
                        disabled={isGenerating}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-md transition-colors disabled:opacity-50"
                    >
                        {isGenerating ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Sparkles className="w-4 h-4" />
                        )}
                        {isGenerating ? 'Generando...' : 'Generar con IA'}
                    </button>
                </div>

                <div className="space-y-5">
                    {/* Title with 70 char constraint */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                            Título del anuncio <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={handleTitleChange}
                            onBlur={handleTitleBlur}
                            placeholder="Ej: Hermoso apartamento en el centro"
                            className={`w-full h-11 px-3 bg-white border rounded-md text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:border-transparent ${title.length > 70
                                ? 'border-red-500 focus:ring-red-500'
                                : 'border-gray-300 focus:ring-blue-500'
                                }`}
                        />
                        <div className="flex items-center justify-between mt-1">
                            <p className={`text-xs font-medium ${title.length > 70 ? 'text-red-600' : 'text-slate-400'}`}>
                                {title.length}/70 caracteres
                            </p>
                            {title.length > 70 && (
                                <p className="text-xs text-red-600 font-medium">
                                    El título no puede exceder 70 caracteres.
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                            Descripción detallada <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            value={description}
                            onChange={handleDescriptionChange}
                            onBlur={handleDescriptionBlur}
                            placeholder="Describe tu inmueble con detalle: características, ubicación, beneficios..."
                            rows={5}
                            className="w-full p-3 bg-white border border-gray-300 rounded-md text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                        />
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════════════════════════ */}
            {/* SECTION D: CONTACTO */}
            {/* ═══════════════════════════════════════════════════════════ */}
            <section className="bg-white border border-gray-200 rounded-md p-6">
                <div className="flex items-center gap-2 mb-5">
                    <Phone className="w-5 h-5 text-slate-600" />
                    <h2 className="text-lg font-semibold text-slate-900">Información de Contacto</h2>
                    <span className="text-red-500 text-sm font-medium">(Obligatorio)</span>
                </div>

                <div className="grid md:grid-cols-2 gap-5">
                    {/* Phone with auto-save on blur */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="block text-sm font-medium text-slate-700">
                                Teléfono <span className="text-red-500">*</span>
                            </label>
                            {contactSaveStatus.telefono !== 'idle' && (
                                <span className={`flex items-center gap-1 text-xs font-medium ${contactSaveStatus.telefono === 'saving' ? 'text-blue-500' :
                                    contactSaveStatus.telefono === 'error' ? 'text-red-500' : 'text-green-600'
                                    }`}>
                                    {contactSaveStatus.telefono === 'saving' ? (
                                        <><Loader2 className="w-3 h-3 animate-spin" /> Guardando...</>
                                    ) : contactSaveStatus.telefono === 'error' ? (
                                        <><AlertCircle className="w-3 h-3" /> Error al guardar</>
                                    ) : (
                                        <><Check className="w-3 h-3" /> Guardado</>
                                    )}
                                </span>
                            )}
                        </div>
                        <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="tel"
                                inputMode="numeric"
                                maxLength={10}
                                value={telefono}
                                onChange={(e) => {
                                    // Sanitize: only allow digits
                                    const sanitized = e.target.value.replace(/\D/g, '');
                                    setTelefono(sanitized);
                                    if (contactErrors.telefono) {
                                        setContactErrors(prev => ({ ...prev, telefono: undefined }));
                                    }
                                }}
                                onBlur={() => saveContactField('telefono_llamadas', telefono)}
                                placeholder="3001234567"
                                required
                                className={`w-full h-11 pl-10 pr-3 bg-white border rounded-md text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${contactErrors.telefono ? 'border-red-500' : 'border-gray-300'
                                    }`}
                            />
                        </div>
                        <p className="mt-1 text-xs text-slate-400">{telefono.length}/10 dígitos</p>
                        {contactErrors.telefono && (
                            <p className="mt-0.5 text-xs text-red-500">{contactErrors.telefono}</p>
                        )}
                    </div>

                    {/* WhatsApp with auto-save on blur */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="block text-sm font-medium text-slate-700">
                                WhatsApp <span className="text-red-500">*</span>
                            </label>
                            {contactSaveStatus.whatsapp !== 'idle' && (
                                <span className={`flex items-center gap-1 text-xs font-medium ${contactSaveStatus.whatsapp === 'saving' ? 'text-blue-500' :
                                    contactSaveStatus.whatsapp === 'error' ? 'text-red-500' : 'text-green-600'
                                    }`}>
                                    {contactSaveStatus.whatsapp === 'saving' ? (
                                        <><Loader2 className="w-3 h-3 animate-spin" /> Guardando...</>
                                    ) : contactSaveStatus.whatsapp === 'error' ? (
                                        <><AlertCircle className="w-3 h-3" /> Error al guardar</>
                                    ) : (
                                        <><Check className="w-3 h-3" /> Guardado</>
                                    )}
                                </span>
                            )}
                        </div>
                        <div className="relative">
                            <MessageCircle className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="tel"
                                inputMode="numeric"
                                maxLength={10}
                                value={whatsapp}
                                onChange={(e) => {
                                    // Sanitize: only allow digits
                                    const sanitized = e.target.value.replace(/\D/g, '');
                                    setWhatsapp(sanitized);
                                    if (contactErrors.whatsapp) {
                                        setContactErrors(prev => ({ ...prev, whatsapp: undefined }));
                                    }
                                }}
                                onBlur={() => saveContactField('whatsapp', whatsapp)}
                                placeholder="3001234567"
                                required
                                className={`w-full h-11 pl-10 pr-3 bg-white border rounded-md text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${contactErrors.whatsapp ? 'border-red-500' : 'border-gray-300'
                                    }`}
                            />
                        </div>
                        <p className="mt-1 text-xs text-slate-400">{whatsapp.length}/10 dígitos</p>
                        {contactErrors.whatsapp && (
                            <p className="mt-0.5 text-xs text-red-500">{contactErrors.whatsapp}</p>
                        )}
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════════════════════════ */}
            {/* SECTION E: TRUST & VERIFICATION (3-STATE CONDITIONAL) */}
            {/* ═══════════════════════════════════════════════════════════ */}
            <section className="bg-white border border-gray-200 rounded-md p-6">
                <div className="flex items-center gap-2 mb-5">
                    <ShieldCheck className="w-5 h-5 text-slate-600" />
                    <h2 className="text-lg font-semibold text-slate-900">Verificación de Identidad</h2>
                    {userVerificationApproval.isApproved && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                            ✓ Cuenta verificada
                        </span>
                    )}
                    {userPendingStatus === 'pendiente_revision' && (
                        <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
                            🚫 En cola de revisión
                        </span>
                    )}
                    {userPendingStatus === 'pendiente' && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                            ✓ Docs cargados
                        </span>
                    )}
                </div>

                {/* ═══════════════════════════════════════════════════════════ */}
                {/* SCENARIO B: UNDER REVIEW (pendiente_revision) - HARD BLOCK */}
                {/* ═══════════════════════════════════════════════════════════ */}
                {userPendingStatus === 'pendiente_revision' && (
                    <div className="p-4 bg-red-50 border-2 border-red-300 rounded-lg">
                        <div className="flex items-start gap-3">
                            <AlertCircle className="w-6 h-6 text-red-600 mt-0.5 flex-shrink-0" />
                            <div>
                                <p className="font-bold text-red-800 text-lg">
                                    🚫 Publicación Bloqueada
                                </p>
                                <p className="text-sm text-red-700 mt-2">
                                    Ya realizaste un pago y tu cuenta está en la <strong>cola de revisión administrativa</strong>.
                                </p>
                                <p className="text-sm text-red-700 mt-1">
                                    Este proceso toma aproximadamente <strong>20 minutos</strong>.
                                    Una vez aprobada tu cuenta, podrás publicar inmuebles adicionales.
                                </p>
                                <div className="mt-3 p-2 bg-red-100 rounded text-xs text-red-800">
                                    💡 <strong>Tip:</strong> Recibirás una notificación cuando tu cuenta sea verificada.
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ═══════════════════════════════════════════════════════════ */}
                {/* SCENARIO C: APPROVED USER - No docs required (Poder optional) */}
                {/* ═══════════════════════════════════════════════════════════ */}
                {userVerificationApproval.isApproved && (
                    <div className="space-y-4">
                        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                            <div className="flex items-start gap-3">
                                <ShieldCheck className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                                <div>
                                    <p className="font-medium text-green-800">
                                        ✅ Tu cuenta está verificada
                                    </p>
                                    <p className="text-sm text-green-700 mt-1">
                                        No necesitas subir documentos de identidad nuevamente.
                                        Puedes proceder directamente con el pago.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Optional Power of Attorney section for approved users */}
                        <details className="border border-gray-200 rounded-lg">
                            <summary className="p-3 cursor-pointer text-sm font-medium text-slate-600 hover:bg-gray-50">
                                📑 ¿Representas a otra persona? (Opcional)
                            </summary>
                            <div className="p-4 border-t border-gray-200 bg-gray-50">
                                <p className="text-xs text-slate-500 mb-3">
                                    Si no eres el propietario directo, puedes subir un poder notarial opcionalmente.
                                    Esto <strong>no bloquea</strong> el proceso de pago.
                                </p>
                                <InmuebleVerificationForm
                                    inmuebleId={propertyId}
                                    onDocumentUploaded={handleDocumentUploaded}
                                />
                            </div>
                        </details>
                    </div>
                )}

                {/* ═══════════════════════════════════════════════════════════ */}
                {/* SCENARIO A: NEW USER (pendiente or null/NOT_FOUND) */}
                {/* ═══════════════════════════════════════════════════════════ */}
                {!userVerificationApproval.isApproved && userPendingStatus !== 'pendiente_revision' && (
                    <div>
                        {/* A-PENDING: User has uploaded docs, just needs to pay */}
                        {userPendingStatus === 'pendiente' ? (
                            <div className="space-y-4">
                                {/* Success banner */}
                                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                                    <div className="flex items-start gap-3">
                                        <ShieldCheck className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                                        <div>
                                            <p className="font-medium text-green-800">
                                                ✅ Documentación Recibida
                                            </p>
                                            <p className="text-sm text-green-700 mt-1">
                                                Tu cédula ha sido cargada correctamente.
                                                <strong> Por favor realiza el pago</strong> para iniciar la revisión administrativa.
                                            </p>
                                            <div className="mt-3 p-2 bg-green-100 rounded text-xs text-green-800">
                                                💡 <strong>Siguiente paso:</strong> Haz clic en "Pagar y Publicar" para completar tu registro.
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                {/* Document list with delete option */}
                                <InmuebleVerificationForm
                                    inmuebleId={propertyId}
                                    onDocumentUploaded={handleDocumentUploaded}
                                />
                            </div>
                        ) : (
                            /* A-NEW: Truly new user, needs to upload docs */
                            <InmuebleVerificationForm
                                inmuebleId={propertyId}
                                onDocumentUploaded={handleDocumentUploaded}
                            />
                        )}
                    </div>
                )}
            </section>

            {/* ═══════════════════════════════════════════════════════════ */}
            {/* PAYMENT SUCCESS MESSAGE (shown after webhook confirms payment) */}
            {/* ═══════════════════════════════════════════════════════════ */}
            {showPaymentSuccessMessage && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-2xl animate-in fade-in zoom-in duration-300">
                        <div className="text-6xl mb-4">🎉</div>
                        <h2 className="text-2xl font-bold text-slate-900 mb-2">
                            ¡Pago Recibido!
                        </h2>
                        <p className="text-slate-600 mb-4">
                            {inmuebleEstado === 'publicado'
                                ? 'Tu inmueble ha sido publicado exitosamente.'
                                : 'Tu inmueble está en revisión por nuestro equipo. Te notificaremos cuando sea aprobado (aprox. 20 minutos).'}
                        </p>
                        <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Redirigiendo a tus inmuebles...
                        </div>
                    </div>
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════════ */}
            {/* FOOTER ACTIONS */}
            {/* ═══════════════════════════════════════════════════════════ */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                <button
                    type="button"
                    onClick={handleBack}
                    disabled={isNavigatingBack || isInitiatingPayment || showPaymentSuccessMessage}
                    className="flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors disabled:opacity-50"
                >
                    {isNavigatingBack ? (
                        <Loader2 size={18} className="animate-spin" />
                    ) : (
                        <ChevronLeft size={18} />
                    )}
                    Atrás
                </button>

                {/* Hide payment button if inmueble is already in review or published */}
                {(inmuebleEstado === 'en_revision' || inmuebleEstado === 'publicado') ? (
                    <div className="flex items-center gap-2 px-6 py-2.5 bg-blue-100 text-blue-700 font-medium rounded-md">
                        <Check className="w-4 h-4" />
                        {inmuebleEstado === 'publicado' ? 'Publicado' : 'En Revisión'}
                    </div>
                ) : (
                    <button
                        type="button"
                        onClick={handlePayment}
                        disabled={isSaving || isUploadingVerification || isInitiatingPayment || isUserBlocked || !isFormComplete}
                        className={`flex items-center gap-2 px-6 py-2.5 font-medium rounded-md transition-colors disabled:cursor-not-allowed ${isUserBlocked
                            ? 'bg-red-200 text-red-600 cursor-not-allowed'
                            : isFormComplete
                                ? 'bg-green-600 text-white hover:bg-green-700'
                                : 'bg-gray-300 text-gray-600'
                            } ${(isSaving || isUploadingVerification || isInitiatingPayment) ? 'opacity-50' : ''}`}
                    >
                        {isInitiatingPayment ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Iniciando transacción segura...
                            </>
                        ) : isSaving || isUploadingVerification ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                {isUploadingVerification ? 'Verificando...' : 'Guardando...'}
                            </>
                        ) : isUserBlocked ? (
                            <>
                                <AlertCircle className="w-4 h-4" />
                                🚫 Publicación Bloqueada
                            </>
                        ) : (
                            <>
                                {!isFormComplete && <AlertCircle className="w-4 h-4" />}
                                {isFormComplete && <CreditCard className="w-4 h-4" />}
                                Pagar y Publicar ($10.000)
                                {isFormComplete && <ChevronRight className="w-4 h-4" />}
                            </>
                        )}
                    </button>
                )}
            </div>

            {/* Widget script removed - using redirect method */}
        </div>
    );
}
