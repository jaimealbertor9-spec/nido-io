'use client';

import { useState, useRef } from 'react';
import { Loader2, Upload, X, FileImage, Check } from 'lucide-react';
import { submitVerificationDocument } from '@/app/actions/submitVerification';

interface InmuebleVerificationFormProps {
    inmuebleId: string;
    onDocumentUploaded: () => void;
    documentType?: 'cedula' | 'poder'; // New optional prop, defaults to 'cedula'
}

export default function InmuebleVerificationForm({
    inmuebleId,
    onDocumentUploaded,
    documentType = 'cedula' // Default value
}: InmuebleVerificationFormProps) {
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;

        // Validation: Max 5MB
        if (selectedFile.size > 5 * 1024 * 1024) {
            setError('El archivo pesa más de 5MB');
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
            // Convert to Base64
            const reader = new FileReader();
            const fileBase64 = await new Promise<string>((resolve, reject) => {
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });

            // Get current user ID from session context is handled in the server action, 
            // but we need the userId argument. 
            // NOTE: The server action expects userId. 
            // For simplicity in this component, we'll import supabase client to get the ID strictly for the call,
            // OR we rely on the server action to handle auth check if refactored.
            // However, based on the provided server action signature: (userId, base64, name, type, docType).

            // Let's get the user ID first
            const { createClient } = await import('@supabase/supabase-js');
            const supabase = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
            );
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                throw new Error('Usuario no autenticado');
            }

            const result = await submitVerificationDocument(
                user.id,
                fileBase64,
                file.name,
                file.type,
                documentType // Passing the specific type ('cedula' or 'poder')
            );

            if (!result.success) {
                throw new Error(result.error || 'Error al subir documento');
            }

            setSuccess(true);
            setTimeout(() => {
                clearFile();
                onDocumentUploaded(); // Trigger parent refresh
            }, 1500);

        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Error al subir');
        } finally {
            setIsUploading(false);
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
                id={`file-upload-${documentType}`} // Unique ID per type
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
                            JPG o PNG (Máx 5MB)
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