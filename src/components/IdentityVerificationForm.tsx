'use client';

import { useState, useRef } from 'react';
import { Upload, X, Check } from 'lucide-react';
// Asegúrate de que este import sea correcto para tu proyecto:
import { supabase } from '@/lib/supabase'; 
import { submitVerification } from '@/app/actions/submitVerification';

interface IdentityVerificationFormProps {
    userId: string;
    email: string;
    onVerificationComplete: () => void;
}

export default function IdentityVerificationForm({ userId, email, onVerificationComplete }: IdentityVerificationFormProps) {
    const [tipoDocumento, setTipoDocumento] = useState<'cedula' | 'nit'>('cedula');
    const [esPropietario, setEsPropietario] = useState<boolean>(true);
    const [documentoFile, setDocumentoFile] = useState<File | null>(null);
    const [poderFile, setPoderFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    // Refs para limpiar inputs
    const documentoInputRef = useRef<HTMLInputElement>(null);
    const poderInputRef = useRef<HTMLInputElement>(null);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, tipo: 'documento' | 'poder') => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) { 
            setError('El archivo supera los 5MB');
            e.target.value = ''; 
            return;
        }

        setError(null);
        if (tipo === 'documento') setDocumentoFile(file);
        else setPoderFile(file);
    };

    const handleRemoveFile = (tipo: 'documento' | 'poder') => {
        if (tipo === 'documento') {
            setDocumentoFile(null);
            if (documentoInputRef.current) documentoInputRef.current.value = '';
        } else {
            setPoderFile(null);
            if (poderInputRef.current) poderInputRef.current.value = '';
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            if (!documentoFile) throw new Error('Falta el documento de identidad');
            if (!esPropietario && !poderFile) throw new Error('Falta el poder de representación');

            // 1. Subir archivos
            const timestamp = Date.now();
            const docName = documentoFile.name.replace(/[^a-zA-Z0-9.]/g, '_');
            const docPath = `${userId}/doc_${timestamp}_${docName}`;
            
            const { error: errDoc } = await supabase.storage
                .from('kyc-documents')
                .upload(docPath, documentoFile, { upsert: true });
            if (errDoc) throw new Error('Error subiendo documento: ' + errDoc.message);

            const { data: publicUrlDoc } = supabase.storage.from('kyc-documents').getPublicUrl(docPath);

            let poderUrl = null;
            if (!esPropietario && poderFile) {
                const poderName = poderFile.name.replace(/[^a-zA-Z0-9.]/g, '_');
                const poderPath = `${userId}/poder_${timestamp}_${poderName}`;
                const { error: errPoder } = await supabase.storage
                    .from('kyc-documents')
                    .upload(poderPath, poderFile, { upsert: true });
                if (errPoder) throw new Error('Error subiendo poder: ' + errPoder.message);
                
                const { data: publicUrlPoder } = supabase.storage.from('kyc-documents').getPublicUrl(poderPath);
                poderUrl = publicUrlPoder.publicUrl;
            }

            // 2. Guardar en BD (Server Action)
            const result = await submitVerification({
                userId,
                email,
                tipoDocumento,
                documentoUrl: publicUrlDoc.publicUrl,
                esPropietario,
                poderUrl
            });

            if (!result.success) throw new Error(result.error);

            setSuccess(true);
            setTimeout(onVerificationComplete, 2000);

        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Error desconocido');
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="p-6 bg-green-50 border border-green-200 rounded-lg text-center">
                <Check className="w-12 h-12 text-green-600 mx-auto mb-2" />
                <h3 className="text-lg font-bold text-green-800">¡Documentos Recibidos!</h3>
                <p className="text-green-700">Procesando...</p>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {/* INPUT DOCUMENTO */}
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                {!documentoFile ? (
                    <div onClick={() => documentoInputRef.current?.click()} className="cursor-pointer py-4">
                        <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                        <span className="text-sm text-gray-500 font-medium">Subir Cédula o NIT</span>
                        <input 
                            type="file" 
                            ref={documentoInputRef} 
                            onChange={(e) => handleFileUpload(e, 'documento')} 
                            className="hidden" 
                            accept=".pdf,.jpg,.jpeg,.png" 
                        />
                    </div>
                ) : (
                    <div className="flex items-center justify-between bg-blue-50 p-3 rounded border border-blue-100">
                        <span className="text-sm truncate max-w-[200px]">{documentoFile.name}</span>
                        <button type="button" onClick={() => handleRemoveFile('documento')}>
                            <X className="w-5 h-5 text-red-500 hover:text-red-700" />
                        </button>
                    </div>
                )}
            </div>

            {/* CHECKBOX */}
            <label className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer">
                <input 
                    type="checkbox" 
                    checked={!esPropietario} 
                    onChange={(e) => setEsPropietario(!e.target.checked)}
                    className="w-5 h-5 text-[#183259] rounded border-gray-300"
                />
                <span className="text-sm text-gray-700 font-medium">No soy el propietario (Requiere Poder)</span>
            </label>

            {/* INPUT PODER */}
            {!esPropietario && (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center animate-in fade-in">
                    {!poderFile ? (
                        <div onClick={() => poderInputRef.current?.click()} className="cursor-pointer py-4">
                            <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                            <span className="text-sm text-gray-500 font-medium">Subir Poder Autenticado</span>
                            <input 
                                type="file" 
                                ref={poderInputRef} 
                                onChange={(e) => handleFileUpload(e, 'poder')} 
                                className="hidden" 
                                accept=".pdf,.jpg,.jpeg,.png" 
                            />
                        </div>
                    ) : (
                        <div className="flex items-center justify-between bg-blue-50 p-3 rounded border border-blue-100">
                            <span className="text-sm truncate max-w-[200px]">{poderFile.name}</span>
                            <button type="button" onClick={() => handleRemoveFile('poder')}>
                                <X className="w-5 h-5 text-red-500 hover:text-red-700" />
                            </button>
                        </div>
                    )}
                </div>
            )}

            {error && (
                <div className="bg-red-50 text-red-600 p-3 rounded text-sm text-center border border-red-100">
                    {error}
                </div>
            )}

            <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-[#183259] text-white py-4 rounded-lg font-bold hover:bg-[#201658] disabled:opacity-50 transition-colors"
            >
                {loading ? 'Subiendo Documentos...' : 'Confirmar y Continuar'}
            </button>
        </form>
    );
}