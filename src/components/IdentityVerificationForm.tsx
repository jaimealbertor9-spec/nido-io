'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getSupabaseClient } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';
import { deleteDocument } from '@/app/actions/inmuebleVerification';


// ═══════════════════════════════════════════════════════════════════════════
// INMUEBLE VERIFICATION FORM
// Per-inmueble document upload for KYC compliance
// Uses Spanish enums: 'pendiente', 'aprobado', 'rechazado'
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type TipoDocumento = 'cedula' | 'poder';
export type EstadoVerificacion = 'pendiente' | 'aprobado' | 'rechazado';

export interface InmuebleVerification {
    id: string;
    user_id: string;
    inmueble_id: string;
    tipo_documento: TipoDocumento;
    documento_url: string;
    estado: EstadoVerificacion;
    observaciones_admin: string | null;
    created_at: string;
}

interface UploadState {
    isLoading: boolean;
    isUploading: boolean;
    error: string | null;
    uploadProgress: number;
}

interface Props {
    inmuebleId: string;
    onDocumentUploaded?: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
];
const STORAGE_BUCKET = 'kyc-documents';

// ─────────────────────────────────────────────────────────────────────────────
// UTILITY FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

function validateFile(file: File): { valid: boolean; error?: string } {
    if (file.size > MAX_FILE_SIZE) {
        return { valid: false, error: 'El archivo es muy grande. Máximo 10MB.' };
    }
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        return { valid: false, error: 'Tipo de archivo no permitido. Usa JPG, PNG o PDF.' };
    }
    return { valid: true };
}

function getFileExtension(filename: string): string {
    const parts = filename.split('.');
    return parts.length > 1 ? parts.pop()!.toLowerCase() : '';
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function InmuebleVerificationForm({ inmuebleId, onDocumentUploaded }: Props) {
    const supabase = getSupabaseClient();

    // User state
    const [userId, setUserId] = useState<string | null>(null);

    // Existing documents for this inmueble
    const [documents, setDocuments] = useState<InmuebleVerification[]>([]);

    // Upload state
    const [uploadState, setUploadState] = useState<UploadState>({
        isLoading: true,
        isUploading: false,
        error: null,
        uploadProgress: 0,
    });

    // Delete state
    const [isDeleting, setIsDeleting] = useState<string | null>(null); // holds documentId being deleted

    // File state
    const [cedulaFile, setCedulaFile] = useState<File | null>(null);
    const [cedulaPreview, setCedulaPreview] = useState<string | null>(null);
    const [poderFile, setPoderFile] = useState<File | null>(null);
    const [poderPreview, setPoderPreview] = useState<string | null>(null);

    // Owner vs Representative toggle
    const [isOwner, setIsOwner] = useState<boolean>(true);

    // Refs
    const cedulaInputRef = useRef<HTMLInputElement>(null);
    const poderInputRef = useRef<HTMLInputElement>(null);

    // ─────────────────────────────────────────────────────────────────────────
    // LOAD USER AND EXISTING DOCUMENTS
    // ─────────────────────────────────────────────────────────────────────────

    useEffect(() => {
        async function loadData() {
            try {
                const { data: { user }, error: authError } = await supabase.auth.getUser();

                if (authError || !user) {
                    setUploadState(prev => ({
                        ...prev,
                        isLoading: false,
                        error: 'No se pudo obtener el usuario.',
                    }));
                    return;
                }

                setUserId(user.id);

                // Fetch existing documents for this inmueble
                const { data: docs, error: docsError } = await supabase
                    .from('user_verifications')
                    .select('*')
                    .eq('inmueble_id', inmuebleId)
                    .order('created_at', { ascending: false });

                if (docsError) {
                    console.error('Error fetching documents:', docsError);
                } else {
                    setDocuments(docs || []);
                }

                setUploadState(prev => ({ ...prev, isLoading: false }));
            } catch (err) {
                console.error('Error loading data:', err);
                setUploadState(prev => ({
                    ...prev,
                    isLoading: false,
                    error: 'Error al cargar datos.',
                }));
            }
        }

        if (inmuebleId) {
            loadData();
        }
    }, [supabase, inmuebleId]);

    // ─────────────────────────────────────────────────────────────────────────
    // FILE SELECTION HANDLERS
    // ─────────────────────────────────────────────────────────────────────────

    const handleCedulaSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const validation = validateFile(file);
        if (!validation.valid) {
            setUploadState(prev => ({ ...prev, error: validation.error! }));
            return;
        }

        setUploadState(prev => ({ ...prev, error: null }));
        setCedulaFile(file);

        if (file.type.startsWith('image/')) {
            setCedulaPreview(URL.createObjectURL(file));
        } else {
            setCedulaPreview(null);
        }
    }, []);

    const handlePoderSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const validation = validateFile(file);
        if (!validation.valid) {
            setUploadState(prev => ({ ...prev, error: validation.error! }));
            return;
        }

        setUploadState(prev => ({ ...prev, error: null }));
        setPoderFile(file);

        if (file.type.startsWith('image/')) {
            setPoderPreview(URL.createObjectURL(file));
        } else {
            setPoderPreview(null);
        }
    }, []);

    const clearCedulaFile = useCallback(() => {
        setCedulaFile(null);
        if (cedulaPreview) URL.revokeObjectURL(cedulaPreview);
        setCedulaPreview(null);
        if (cedulaInputRef.current) cedulaInputRef.current.value = '';
    }, [cedulaPreview]);

    const clearPoderFile = useCallback(() => {
        setPoderFile(null);
        if (poderPreview) URL.revokeObjectURL(poderPreview);
        setPoderPreview(null);
        if (poderInputRef.current) poderInputRef.current.value = '';
    }, [poderPreview]);

    // ─────────────────────────────────────────────────────────────────────────
    // UPLOAD DOCUMENT (one row per document type)
    // ─────────────────────────────────────────────────────────────────────────

    const uploadDocument = async (
        file: File,
        tipoDocumento: TipoDocumento
    ): Promise<boolean> => {
        console.log(`[UploadDocument] Starting upload for ${tipoDocumento}`);
        console.log(`[UploadDocument] UserId: ${userId}, InmuebleId: ${inmuebleId}`);
        console.log(`[UploadDocument] File: ${file.name}, Size: ${file.size}, Type: ${file.type}`);

        if (!userId) {
            console.error('[UploadDocument] No userId available');
            throw new Error('No se pudo identificar al usuario. Por favor, recarga la página.');
        }

        const ext = getFileExtension(file.name);
        const storagePath = `${userId}/${inmuebleId}/${tipoDocumento}_${uuidv4()}.${ext}`;
        console.log(`[UploadDocument] Storage path: ${storagePath}`);
        console.log(`[UploadDocument] Bucket: ${STORAGE_BUCKET}`);

        try {
            // Upload to storage with timeout
            console.log('[UploadDocument] Starting storage upload...');
            const uploadStartTime = Date.now();

            const { data: uploadData, error: uploadError } = await supabase.storage
                .from(STORAGE_BUCKET)
                .upload(storagePath, file, {
                    cacheControl: '3600',
                    upsert: false,
                });

            const uploadDuration = Date.now() - uploadStartTime;
            console.log(`[UploadDocument] Storage upload completed in ${uploadDuration}ms`);

            if (uploadError) {
                console.error('[UploadDocument] Storage upload error:', uploadError);
                console.error('[UploadDocument] Error code:', uploadError.message);

                // Provide helpful error messages based on common issues
                if (uploadError.message.includes('Bucket not found')) {
                    throw new Error(`El bucket de almacenamiento "${STORAGE_BUCKET}" no existe. Contacta al administrador.`);
                } else if (uploadError.message.includes('Permission denied') || uploadError.message.includes('not authorized')) {
                    throw new Error('No tienes permisos para subir archivos. Verifica tu sesión e intenta de nuevo.');
                } else if (uploadError.message.includes('Payload too large')) {
                    throw new Error('El archivo es demasiado grande. Máximo 10MB.');
                } else {
                    throw new Error(`Error al subir ${tipoDocumento}: ${uploadError.message}`);
                }
            }

            if (!uploadData?.path) {
                console.error('[UploadDocument] Upload succeeded but no path returned');
                throw new Error('El archivo se subió pero no se recibió confirmación. Intenta de nuevo.');
            }

            console.log('[UploadDocument] ✅ File uploaded successfully:', uploadData.path);

            // Insert verification record
            console.log('[UploadDocument] Inserting verification record...');
            const insertData = {
                user_id: userId,
                inmueble_id: inmuebleId,
                tipo_documento: tipoDocumento,
                documento_url: uploadData.path,
                estado: 'pendiente',
            };
            console.log('[UploadDocument] Insert data:', insertData);

            const { error: insertError } = await supabase
                .from('user_verifications')
                .insert(insertData);

            if (insertError) {
                console.error('[UploadDocument] Insert error:', insertError);
                console.error('[UploadDocument] Insert error code:', insertError.code);
                console.error('[UploadDocument] Insert error details:', insertError.details);

                // Try to clean up the uploaded file
                console.log('[UploadDocument] Attempting to clean up uploaded file...');
                await supabase.storage.from(STORAGE_BUCKET).remove([uploadData.path]);

                if (insertError.code === '23505') {
                    throw new Error('Ya existe un documento de este tipo para este inmueble.');
                } else if (insertError.code === '42501' || insertError.message?.includes('permission')) {
                    throw new Error('No tienes permisos para registrar documentos. Contacta al administrador.');
                } else {
                    throw new Error(`Error al guardar ${tipoDocumento}: ${insertError.message}`);
                }
            }

            console.log('[UploadDocument] ✅ Verification record inserted successfully');
            return true;
        } catch (err: any) {
            console.error(`[UploadDocument] Fatal error (${tipoDocumento}):`, err);
            // Re-throw with formatted message
            throw err;
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // HANDLE SUBMIT
    // ─────────────────────────────────────────────────────────────────────────

    const handleSubmit = async () => {
        // Validation: Cedula is always required
        if (!userId || !cedulaFile) {
            setUploadState(prev => ({
                ...prev,
                error: 'Debes subir tu documento de identidad (Cédula).',
            }));
            return;
        }

        // Validation: Poder is required only for representatives
        if (!isOwner && !poderFile) {
            setUploadState(prev => ({
                ...prev,
                error: 'Como representante, debes subir el Poder o Autorización.',
            }));
            return;
        }

        setUploadState(prev => ({ ...prev, isUploading: true, error: null, uploadProgress: 10 }));

        try {
            // Upload cedula (required)
            setUploadState(prev => ({ ...prev, uploadProgress: 30 }));
            await uploadDocument(cedulaFile, 'cedula');

            // Upload poder (optional)
            if (poderFile) {
                setUploadState(prev => ({ ...prev, uploadProgress: 60 }));
                await uploadDocument(poderFile, 'poder');
            }

            setUploadState(prev => ({ ...prev, uploadProgress: 90 }));

            // Refresh documents list
            const { data: updatedDocs } = await supabase
                .from('user_verifications')
                .select('*')
                .eq('inmueble_id', inmuebleId)
                .order('created_at', { ascending: false });

            setDocuments(updatedDocs || []);

            // Clear files
            clearCedulaFile();
            clearPoderFile();

            setUploadState(prev => ({ ...prev, isUploading: false, uploadProgress: 100 }));

            // Callback for parent component
            if (onDocumentUploaded) {
                onDocumentUploaded();
            }

            // Reset progress after delay
            setTimeout(() => {
                setUploadState(prev => ({ ...prev, uploadProgress: 0 }));
            }, 1500);
        } catch (err: any) {
            console.error('Submit error:', err);
            setUploadState(prev => ({
                ...prev,
                isUploading: false,
                error: err.message || 'Error al subir documentos.',
                uploadProgress: 0,
            }));
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // HANDLE DELETE DOCUMENT
    // ─────────────────────────────────────────────────────────────────────────

    const handleDeleteDocument = async (documentId: string) => {
        if (!userId) {
            setUploadState(prev => ({ ...prev, error: 'Usuario no identificado.' }));
            return;
        }

        // Confirm deletion
        const confirmed = window.confirm('¿Estás seguro de eliminar este documento? Tendrás que volver a subirlo.');
        if (!confirmed) return;

        setIsDeleting(documentId);
        setUploadState(prev => ({ ...prev, error: null }));

        try {
            const result = await deleteDocument(documentId, userId);

            if (!result.success) {
                setUploadState(prev => ({ ...prev, error: result.error || 'Error al eliminar.' }));
                return;
            }

            console.log('[DeleteDocument] ✅ Document deleted:', result.deletedType);
            console.log('[DeleteDocument] New status:', {
                hasRemainingCedula: result.hasRemainingCedula,
                newVerificationStatus: result.newVerificationStatus
            });

            // Refresh documents list by removing the deleted one
            setDocuments(prev => prev.filter(d => d.id !== documentId));

            // Trigger parent callback to update validation state
            // This is the CRITICAL step that re-disables the Pay button
            // The parent component will re-run getMissingFields which checks verification status
            if (onDocumentUploaded) {
                onDocumentUploaded();
            }

        } catch (err: any) {
            console.error('[DeleteDocument] Error:', err);
            setUploadState(prev => ({ ...prev, error: err.message || 'Error inesperado.' }));
        } finally {
            setIsDeleting(null);
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // HELPER: Check if cedula already uploaded
    // ─────────────────────────────────────────────────────────────────────────

    const hasCedula = documents.some(d => d.tipo_documento === 'cedula');
    const cedulaDoc = documents.find(d => d.tipo_documento === 'cedula');
    const poderDoc = documents.find(d => d.tipo_documento === 'poder');

    // Status badge component
    const StatusBadge = ({ estado }: { estado: EstadoVerificacion }) => {
        const colors = {
            pendiente: 'bg-yellow-100 text-yellow-800',
            aprobado: 'bg-green-100 text-green-800',
            rechazado: 'bg-red-100 text-red-800',
        };
        const labels = {
            pendiente: 'Pendiente',
            aprobado: 'Aprobado',
            rechazado: 'Rechazado',
        };
        return (
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[estado]}`}>
                {labels[estado]}
            </span>
        );
    };

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER: LOADING STATE
    // ─────────────────────────────────────────────────────────────────────────

    if (uploadState.isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[200px]">
                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER: DOCUMENTS ALREADY UPLOADED + STATUS
    // ─────────────────────────────────────────────────────────────────────────

    if (hasCedula) {
        return (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                        <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="font-semibold text-gray-900">Documento Subido</h3>
                        <p className="text-sm text-gray-500">Tu documento está en revisión</p>
                    </div>
                </div>

                {/* Document List */}
                <div className="space-y-3">
                    {cedulaDoc && (
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center gap-3">
                                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <span className="text-sm font-medium text-gray-700">Cédula de Ciudadanía</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <StatusBadge estado={cedulaDoc.estado} />
                                {/* Delete button - only for pendiente status */}
                                {cedulaDoc.estado === 'pendiente' && (
                                    <button
                                        onClick={() => handleDeleteDocument(cedulaDoc.id)}
                                        disabled={isDeleting === cedulaDoc.id}
                                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
                                        title="Eliminar documento"
                                    >
                                        {isDeleting === cedulaDoc.id ? (
                                            <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                                                <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" className="opacity-75" />
                                            </svg>
                                        ) : (
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        )}
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {poderDoc && (
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center gap-3">
                                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <span className="text-sm font-medium text-gray-700">Poder / Autorización</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <StatusBadge estado={poderDoc.estado} />
                                {/* Delete button - only for pendiente status */}
                                {poderDoc.estado === 'pendiente' && (
                                    <button
                                        onClick={() => handleDeleteDocument(poderDoc.id)}
                                        disabled={isDeleting === poderDoc.id}
                                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
                                        title="Eliminar documento"
                                    >
                                        {isDeleting === poderDoc.id ? (
                                            <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                                                <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" className="opacity-75" />
                                            </svg>
                                        ) : (
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        )}
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Admin rejection feedback */}
                {cedulaDoc?.estado === 'rechazado' && cedulaDoc.observaciones_admin && (
                    <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm font-medium text-red-800 mb-1">Motivo del rechazo:</p>
                        <p className="text-sm text-red-700">{cedulaDoc.observaciones_admin}</p>
                    </div>
                )}
            </div>
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER: UPLOAD FORM
    // ─────────────────────────────────────────────────────────────────────────

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                </div>
                <div>
                    <h3 className="font-semibold text-gray-900">Verificación de Identidad</h3>
                    <p className="text-sm text-gray-500">Requerido para publicar</p>
                </div>
            </div>

            {/* Error */}
            {uploadState.error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-700">{uploadState.error}</p>
                </div>
            )}

            {/* Owner Toggle */}
            <div className="mb-5 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="flex items-start gap-3">
                    <input
                        type="checkbox"
                        id="isOwnerToggle"
                        checked={isOwner}
                        onChange={(e) => {
                            setIsOwner(e.target.checked);
                            // Clear poder file when switching to owner mode
                            if (e.target.checked) {
                                clearPoderFile();
                            }
                        }}
                        className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                    />
                    <label htmlFor="isOwnerToggle" className="cursor-pointer">
                        <span className="block text-sm font-medium text-gray-900">
                            Soy el propietario del inmueble
                        </span>
                        <span className="block text-xs text-gray-500 mt-0.5">
                            {isOwner
                                ? 'No requieres poder o autorización de terceros'
                                : 'Desmarca si actúas en nombre de otra persona'}
                        </span>
                    </label>
                </div>
            </div>

            {/* Cedula Upload */}
            <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cédula de Ciudadanía <span className="text-red-500">*</span>
                </label>
                <div
                    onClick={() => !uploadState.isUploading && cedulaInputRef.current?.click()}
                    className={`
            border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all
            ${cedulaFile ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-blue-400'}
            ${uploadState.isUploading ? 'opacity-50 cursor-not-allowed' : ''}
          `}
                >
                    <input
                        ref={cedulaInputRef}
                        type="file"
                        accept="image/jpeg,image/png,application/pdf"
                        onChange={handleCedulaSelect}
                        disabled={uploadState.isUploading}
                        className="hidden"
                    />

                    {cedulaFile ? (
                        <div className="flex flex-col items-center gap-2">
                            {cedulaPreview && (
                                <img src={cedulaPreview} alt="Preview" className="max-h-24 rounded-lg" />
                            )}
                            <p className="text-sm font-medium text-gray-900">{cedulaFile.name}</p>
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); clearCedulaFile(); }}
                                className="text-xs text-red-600 hover:text-red-700"
                            >
                                Eliminar
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-2">
                            <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                            </svg>
                            <p className="text-sm text-gray-600">Arrastra o selecciona tu cédula</p>
                            <p className="text-xs text-gray-400">JPG, PNG o PDF • Máximo 10MB</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Poder Upload - Conditional based on isOwner */}
            {!isOwner && (
                <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Poder / Autorización <span className="text-red-500">*</span>
                        <span className="text-xs text-gray-500 ml-1">(Requerido para representantes)</span>
                    </label>
                    <div
                        onClick={() => !uploadState.isUploading && poderInputRef.current?.click()}
                        className={`
                border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all
                ${poderFile ? 'border-blue-400 bg-blue-50' : 'border-orange-300 hover:border-orange-400 bg-orange-50/50'}
                ${uploadState.isUploading ? 'opacity-50 cursor-not-allowed' : ''}
              `}
                    >
                        <input
                            ref={poderInputRef}
                            type="file"
                            accept="image/jpeg,image/png,application/pdf"
                            onChange={handlePoderSelect}
                            disabled={uploadState.isUploading}
                            className="hidden"
                        />

                        {poderFile ? (
                            <div className="flex flex-col items-center gap-2">
                                {poderPreview && (
                                    <img src={poderPreview} alt="Preview" className="max-h-24 rounded-lg" />
                                )}
                                <p className="text-sm font-medium text-gray-900">{poderFile.name}</p>
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); clearPoderFile(); }}
                                    className="text-xs text-red-600 hover:text-red-700"
                                >
                                    Eliminar
                                </button>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-2">
                                <svg className="w-10 h-10 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <p className="text-sm text-gray-600">Sube el poder o autorización notarial</p>
                                <p className="text-xs text-gray-400">JPG, PNG o PDF • Máximo 10MB</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Progress Bar */}
            {uploadState.isUploading && (
                <div className="mb-4">
                    <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600">Subiendo...</span>
                        <span className="text-gray-500">{uploadState.uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                            className="bg-blue-600 h-2 rounded-full transition-all"
                            style={{ width: `${uploadState.uploadProgress}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Submit Button */}
            <button
                onClick={handleSubmit}
                disabled={!cedulaFile || (!isOwner && !poderFile) || uploadState.isUploading}
                className={`
          w-full py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2
          ${(cedulaFile && (isOwner || poderFile)) && !uploadState.isUploading
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    }
        `}
            >
                {uploadState.isUploading ? (
                    <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Subiendo...
                    </>
                ) : (
                    <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        Subir Documento
                    </>
                )}
            </button>
        </div>
    );
}
