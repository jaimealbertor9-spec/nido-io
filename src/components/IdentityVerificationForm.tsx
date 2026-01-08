'use client';

import { useState, useRef, useCallback } from 'react';
import { Upload, X, Check, Loader2, AlertCircle, FileText } from 'lucide-react';
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

    // Estados para archivos
    const [documentoFile, setDocumentoFile] = useState<File | null>(null);
    const [poderFile, setPoderFile] = useState<File | null>(null);

    // Estados UI
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    // Referencias para resetear inputs (FIX para re-upload)
    const documentoInputRef = useRef<HTMLInputElement>(null);
    const poderInputRef = useRef<HTMLInputElement>(null);

    // Manejar selección de archivo
    const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>, tipo: 'documento' | 'poder') => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validar tamaño (Max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            setError('El archivo no debe superar los 5MB');
            return;
        }

        // Validar tipo
        if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) {
            setError('Solo se permiten archivos PDF, JPG o PNG');
            return;
        }

        setError(null);
        if (tipo === 'documento') {
            setDocumentoFile(file);
        } else {
            setPoderFile(file);
        }
    }, []);

    // FIX: Resetear archivo y el input element para permitir re-selección
    const handleRemoveFile = useCallback((tipo: 'documento' | 'poder') => {
        if (tipo === 'documento') {
            setDocumentoFile(null);
            // Resetear el valor del input para permitir re-upload del mismo archivo
            if (documentoInputRef.current) {
                documentoInputRef.current.value = '';
            }
        } else {
            setPoderFile(null);
            // FIX CRÍTICO: Resetear explícitamente el input del poder
            if (poderInputRef.current) {
                poderInputRef.current.value = '';
            }
        }
    }, []);

    // Subir archivo a Supabase Storage
    const uploadToSupabase = async (file: File, path: string): Promise<string> => {
        const { data, error } = await supabase.storage
            .from('kyc-documents')
            .upload(path, file, { upsert: true });

        if (error) throw error;

        const { data: publicUrl } = supabase.storage
            .from('kyc-documents')
            .getPublicUrl(data.path);

        return publicUrl.publicUrl;
    };

    // Enviar formulario
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            if (!documentoFile) {
                throw new Error('Debes subir tu documento de identidad');
            }
            if (!esPropietario && !poderFile) {
                throw new Error('Debes subir el poder de representación');
            }

            // 1. Subir Documento a Storage
            const docExt = documentoFile.name.split('.').pop();
            const docPath = `${userId}/${tipoDocumento}_${Date.now()}.${docExt}`;
            const finalDocUrl = await uploadToSupabase(documentoFile, docPath);

            // 2. Subir Poder (si aplica)
            let finalPoderUrl: string | null = null;
            if (!esPropietario && poderFile) {
                const poderExt = poderFile.name.split('.').pop();
                const poderPath = `${userId}/poder_${Date.now()}.${poderExt}`;
                finalPoderUrl = await uploadToSupabase(poderFile, poderPath);
            }

            // 3. Guardar en BD via Server Action
            const result = await submitVerification({
                userId,
                email,
                tipoDocumento,
                documentoUrl: finalDocUrl,
                esPropietario,
                poderUrl: finalPoderUrl
            });

            if (!result.success) {
                throw new Error(result.error || 'Error al guardar verificación');
            }

            setSuccess(true);
            setTimeout(() => {
                onVerificationComplete();
            }, 2000);

        } catch (err: any) {
            console.error('Error verificación:', err);
            setError(err.message || 'Error al enviar la verificación');
        } finally {
            setLoading(false);
        }
    };

    // Estado de éxito
    if (success) {
        return (
            <div className="bg-green-50 p-6 rounded-lg text-center border border-green-200">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Check className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-xl font-bold text-green-800 mb-2">¡Documentos Enviados!</h3>
                <p className="text-green-700">Tu identidad está siendo verificada. Redirigiendo al pago...</p>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="bg-blue-50 p-4 rounded-lg flex items-start gap-3 border border-blue-100">
                <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-blue-800">
                    Por seguridad, necesitamos verificar tu identidad antes de procesar el pago.
                    Tus documentos están protegidos y solo se usan para validación legal.
                </p>
            </div>

            {/* Selector Tipo Documento */}
            <div className="grid grid-cols-2 gap-4">
                <button
                    type="button"
                    onClick={() => setTipoDocumento('cedula')}
                    className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${tipoDocumento === 'cedula'
                            ? 'border-[#183259] bg-blue-50 text-[#183259]'
                            : 'border-gray-200 text-gray-500 hover:border-gray-300'
                        }`}
                >
                    Cédula de Ciudadanía
                </button>
                <button
                    type="button"
                    onClick={() => setTipoDocumento('nit')}
                    className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${tipoDocumento === 'nit'
                            ? 'border-[#183259] bg-blue-50 text-[#183259]'
                            : 'border-gray-200 text-gray-500 hover:border-gray-300'
                        }`}
                >
                    NIT / RUT (Empresas)
                </button>
            </div>

            {/* Input Documento */}
            <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                    Foto del Documento ({tipoDocumento === 'cedula' ? 'Ambas caras' : 'RUT Actualizado'})
                </label>

                {!documentoFile ? (
                    <div className="relative border-2 border-dashed border-gray-300 rounded-lg p-6 hover:bg-gray-50 transition-colors text-center cursor-pointer">
                        <input
                            type="file"
                            ref={documentoInputRef}
                            onChange={(e) => handleFileUpload(e, 'documento')}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            accept=".pdf,.jpg,.jpeg,.png"
                        />
                        <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-500">Haz clic o arrastra tu archivo aquí</p>
                        <p className="text-xs text-gray-400 mt-1">PDF, JPG o PNG (Max 5MB)</p>
                    </div>
                ) : (
                    <div className="flex items-center justify-between bg-white border border-gray-200 p-3 rounded-lg shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                <FileText className="w-5 h-5 text-blue-600" />
                            </div>
                            <div className="overflow-hidden">
                                <p className="text-sm font-medium text-gray-900 truncate max-w-[200px]">{documentoFile.name}</p>
                                <p className="text-xs text-gray-500">{(documentoFile.size / 1024 / 1024).toFixed(2)} MB</p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => handleRemoveFile('documento')}
                            className="p-1 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-full transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                )}
            </div>

            {/* Checkbox Propietario */}
            <div className="space-y-3 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={!esPropietario}
                        onChange={(e) => setEsPropietario(!e.target.checked)}
                        className="w-4 h-4 text-[#183259] rounded border-gray-300 focus:ring-[#183259]"
                    />
                    <span className="text-sm text-gray-700">No soy el propietario legal (Actúo como apoderado/inmobiliaria)</span>
                </label>
            </div>

            {/* Input Poder (Condicional) */}
            {!esPropietario && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                    <label className="block text-sm font-medium text-gray-700">
                        Poder / Contrato de Mandato
                    </label>

                    {!poderFile ? (
                        <div className="relative border-2 border-dashed border-gray-300 rounded-lg p-6 hover:bg-gray-50 transition-colors text-center cursor-pointer bg-gray-50/50">
                            <input
                                type="file"
                                ref={poderInputRef}
                                onChange={(e) => handleFileUpload(e, 'poder')}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                accept=".pdf,.jpg,.jpeg,.png"
                            />
                            <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                            <p className="text-sm text-gray-500">Adjuntar Poder o Contrato</p>
                        </div>
                    ) : (
                        <div className="flex items-center justify-between bg-white border border-gray-200 p-3 rounded-lg shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                                    <FileText className="w-5 h-5 text-purple-600" />
                                </div>
                                <div className="overflow-hidden">
                                    <p className="text-sm font-medium text-gray-900 truncate max-w-[200px]">{poderFile.name}</p>
                                    <p className="text-xs text-gray-500">{(poderFile.size / 1024 / 1024).toFixed(2)} MB</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleRemoveFile('poder')}
                                className="p-1 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-full transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    )}
                </div>
            )}

            {error && (
                <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    {error}
                </div>
            )}

            <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#201658] hover:bg-[#150e3d] text-white font-bold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {loading ? (
                    <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Verificando...
                    </>
                ) : (
                    'Confirmar Identidad y Continuar'
                )}
            </button>
        </form>
    );
}