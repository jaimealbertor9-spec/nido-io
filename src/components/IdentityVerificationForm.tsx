'use client';

import { useState, useRef, useEffect } from 'react';
import { Loader2, Upload, X, FileImage, Check } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { saveVerificationDocumentUrl } from '@/app/actions/submitVerification';

// Create Supabase client for browser
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface InmuebleVerificationFormProps {
    inmuebleId: string;
    onDocumentUploaded: () => void;
    documentType?: 'cedula' | 'poder';
    isOptional?: boolean; // NEW: Mark as optional (for Power of Attorney)
}

export default function InmuebleVerificationForm({
    inmuebleId,
    onDocumentUploaded,
    documentType = 'cedula',
    isOptional = false
}: InmuebleVerificationFormProps) {
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // FIX: Track component mount status to prevent state updates on unmounted component
    const isMountedRef = useRef(true);

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;

        // Validation: Max 10MB (increased limit since we're uploading directly)
        if (selectedFile.size > 10 * 1024 * 1024) {
            setError('El archivo pesa más de 10MB');
            return;
        }

        // Validation: Images only
        if (!selectedFile.type.startsWith('image/')) {
            setError('Solo se permiten imágenes (JPG, PNG)');
            return;
        }

        setFile(selectedFile);
        setPreview(URL.createObjectURL(selectedFile));
        setError(null);
        setSuccess(false);
    };

    const clearFile = () => {
        setFile(null);
        if (preview) URL.revokeObjectURL(preview);
        setPreview(null);
        setError(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleUpload = async () => {
        if (!file) return;

        setIsUploading(true);
        setError(null);

        try {
            // 1. Get current user
            const { data: { user } } = await supabase.auth.getUser();

            // FIX: Check if component is still mounted before updating state
            if (!isMountedRef.current) return;

            if (!user) {
                throw new Error('Usuario no autenticado');
            }

            // 2. Upload file DIRECTLY to Supabase Storage (client-side)
            const fileExt = file.name.split('.').pop();
            const filePath = `${user.id}/${documentType}_${Date.now()}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
                .from('kyc-documents')
                .upload(filePath, file, {
                    contentType: file.type,
                    upsert: true
                });

            // FIX: Check if component is still mounted
            if (!isMountedRef.current) return;

            if (uploadError) {
                console.error('Storage Upload Error:', uploadError);
                throw new Error('Error subiendo imagen al servidor: ' + uploadError.message);
            }

            // 3. Get public URL
            const { data: { publicUrl } } = supabase.storage
                .from('kyc-documents')
                .getPublicUrl(filePath);

            // 4. Save only the URL to database via server action (lightweight call)
            const result = await saveVerificationDocumentUrl(
                user.id,
                publicUrl,
                documentType,
                inmuebleId  // Pass inmuebleId to satisfy DB constraint
            );

            // FIX: Check if component is still mounted
            if (!isMountedRef.current) return;

            if (!result.success) {
                throw new Error(result.error || 'Error al guardar documento');
            }

            setSuccess(true);
            setTimeout(() => {
                if (!isMountedRef.current) return;
                clearFile();
                onDocumentUploaded(); // Trigger parent refresh
            }, 1500);

        } catch (err: any) {
            // FIX: Swallow AbortError silently (happens when component unmounts mid-request)
            if (err?.name === 'AbortError' || err?.message?.includes('aborted')) {
                console.log('[IdentityVerificationForm] Request aborted (component unmounted)');
                return;
            }

            // FIX: Only update state if still mounted
            if (!isMountedRef.current) return;

            console.error('Upload process error:', err);
            setError(err.message || 'Error al subir');
        } finally {
            // FIX: Only update state if still mounted
            if (isMountedRef.current) {
                setIsUploading(false);
            }
        }
    };

    if (success) {
        return (
            <div className="flex flex-col items-center justify-center p-6 bg-green-50 border border-green-200 rounded-lg animate-in fade-in">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mb-2">
                    <Check className="w-6 h-6 text-green-600" />
                </div>
                <p className="text-sm font-medium text-green-800">¡Documento subido!</p>
            </div>
        );
    }

    return (
        <div className="border border-dashed border-gray-300 rounded-lg p-6 bg-gray-50 hover:bg-gray-100 transition-colors text-center">
            <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileChange}
                className="hidden"
                id={`file-upload-${documentType}`}
            />

            {!file ? (
                <label
                    htmlFor={`file-upload-${documentType}`}
                    className="cursor-pointer flex flex-col items-center justify-center gap-2"
                >
                    <div className="p-3 bg-white rounded-full shadow-sm">
                        <Upload className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-slate-700">
                            Clic para seleccionar imagen
                        </p>
                        <p className="text-xs text-slate-500">
                            JPG o PNG (Máx 10MB) {isOptional && <span className="text-blue-500">• Opcional</span>}
                        </p>
                    </div>
                </label>
            ) : (
                <div className="w-full">
                    <div className="relative w-full aspect-video bg-gray-200 rounded-md overflow-hidden mb-3 border border-gray-300">
                        {preview && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={preview}
                                alt="Preview"
                                className="w-full h-full object-contain"
                            />
                        )}
                        <button
                            onClick={clearFile}
                            className="absolute top-2 right-2 p-1 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    {error && (
                        <div className="mb-3 text-xs text-red-600 bg-red-50 p-2 rounded flex items-center gap-1 justify-center">
                            <FileImage size={12} /> {error}
                        </div>
                    )}

                    <button
                        onClick={handleUpload}
                        disabled={isUploading}
                        className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                    >
                        {isUploading ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" /> Subiendo...
                            </>
                        ) : (
                            'Confirmar y Subir'
                        )}
                    </button>
                </div>
            )}
        </div>
    );
}