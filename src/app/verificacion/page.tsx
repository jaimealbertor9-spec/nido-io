'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Inter } from 'next/font/google';
import {
    Upload, Clock, AlertTriangle, CheckCircle, FileText,
    Loader2, ArrowRight, Shield, Camera, FilePlus, X, LogOut
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
    getUserVerification,
    uploadVerificationDocument,
    getDeadlineStatus,
    type UserVerification
} from '@/app/actions/verification';

const inter = Inter({ subsets: ['latin'] });

// Tunnel Mode Header - No navigation, only logout
function TunnelHeader({ onLogout, isLoggingOut }: { onLogout: () => void; isLoggingOut: boolean }) {
    return (
        <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200">
            <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
                {/* Logo - Static, non-clickable */}
                <div className="flex items-center gap-2 select-none">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                        <span className="text-white font-bold text-sm">N</span>
                    </div>
                    <span className="text-xl font-bold text-gray-900">Nido</span>
                </div>

                {/* Logout Button - Only exit action */}
                <button
                    onClick={onLogout}
                    disabled={isLoggingOut}
                    className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isLoggingOut ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <LogOut className="w-4 h-4" />
                    )}
                    <span>Cerrar Sesión</span>
                </button>
            </div>
        </header>
    );
}

export default function VerificacionPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const [userId, setUserId] = useState<string | null>(null);
    const [verification, setVerification] = useState<UserVerification | null>(null);
    const [deadline, setDeadline] = useState<{
        hoursRemaining: number;
        isExpired: boolean;
        isUrgent: boolean;
        deadline: string | null;
    } | null>(null);

    // Primary document (Cédula)
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    // Optional document (Poder/Autorización)
    const [optionalFile, setOptionalFile] = useState<File | null>(null);
    const [optionalPreviewUrl, setOptionalPreviewUrl] = useState<string | null>(null);

    // Handle logout - HARD REDIRECT to marketing page
    const handleLogout = async () => {
        setIsLoggingOut(true);
        try {
            await supabase.auth.signOut();
        } catch (err) {
            console.error('Logout error:', err);
        } finally {
            // FORCE HARD REDIRECT - bypasses Next.js routing
            window.location.href = '/bienvenidos';
        }
    };

    // Load user and verification status
    useEffect(() => {
        async function loadData() {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) {
                    router.push('/publicar/auth');
                    return;
                }

                setUserId(user.id);

                const verificationData = await getUserVerification(user.id);
                setVerification(verificationData);

                if (verificationData) {
                    const deadlineData = await getDeadlineStatus(user.id);
                    setDeadline(deadlineData);

                    // Redirect if already verified
                    if (verificationData.estado === 'verificado') {
                        router.push('/mis-inmuebles');
                        return;
                    }
                }
            } catch (err) {
                console.error('Error loading verification:', err);
                setError('Error al cargar datos de verificación');
            } finally {
                setIsLoading(false);
            }
        }

        loadData();
    }, [router]);

    // Handle primary file selection
    const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
        if (!allowedTypes.includes(file.type)) {
            setError('Tipo de archivo no permitido. Usa JPG, PNG o PDF.');
            return;
        }

        if (file.size > 10 * 1024 * 1024) {
            setError('El archivo es muy grande. Máximo 10MB.');
            return;
        }

        setError(null);
        setSelectedFile(file);

        if (file.type.startsWith('image/')) {
            const url = URL.createObjectURL(file);
            setPreviewUrl(url);
        } else {
            setPreviewUrl(null);
        }
    }, []);

    // Handle optional file selection
    const handleOptionalFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
        if (!allowedTypes.includes(file.type)) {
            setError('Tipo de archivo no permitido. Usa JPG, PNG o PDF.');
            return;
        }

        if (file.size > 10 * 1024 * 1024) {
            setError('El archivo es muy grande. Máximo 10MB.');
            return;
        }

        setError(null);
        setOptionalFile(file);

        if (file.type.startsWith('image/')) {
            const url = URL.createObjectURL(file);
            setOptionalPreviewUrl(url);
        } else {
            setOptionalPreviewUrl(null);
        }
    }, []);

    // Remove optional file
    const removeOptionalFile = () => {
        setOptionalFile(null);
        if (optionalPreviewUrl) {
            URL.revokeObjectURL(optionalPreviewUrl);
            setOptionalPreviewUrl(null);
        }
    };

    // Handle upload
    const handleUpload = async () => {
        if (!userId || !selectedFile) return;

        setIsUploading(true);
        setError(null);

        try {
            // Upload primary document
            const result = await uploadVerificationDocument(
                userId,
                selectedFile,
                'cedula_frontal'
            );

            if (!result.success) {
                throw new Error(result.error);
            }

            // Upload optional document if provided
            if (optionalFile) {
                await uploadVerificationDocument(
                    userId,
                    optionalFile,
                    'poder_autorizacion' as any
                );
            }

            setSuccess(true);
            const updatedVerification = await getUserVerification(userId);
            setVerification(updatedVerification);

        } catch (err: any) {
            setError(err.message || 'Error al subir documento');
        } finally {
            setIsUploading(false);
        }
    };

    // Format deadline
    const formatDeadline = (dateString: string) => {
        return new Date(dateString).toLocaleString('es-CO', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // Loading state
    if (isLoading) {
        return (
            <div className={`${inter.className} min-h-screen bg-gray-50`}>
                <TunnelHeader onLogout={handleLogout} isLoggingOut={isLoggingOut} />
                <div className="pt-16 min-h-screen flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                </div>
            </div>
        );
    }

    // Verified state - show badge
    if (verification?.estado === 'verificado') {
        return (
            <div className={`${inter.className} min-h-screen bg-gray-50`}>
                <TunnelHeader onLogout={handleLogout} isLoggingOut={isLoggingOut} />
                <div className="pt-16 min-h-screen flex items-center justify-center p-4">
                    <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
                        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <CheckCircle className="w-10 h-10 text-green-600" />
                        </div>
                        <div className="inline-flex items-center gap-2 bg-green-100 text-green-800 px-4 py-2 rounded-full text-sm font-medium mb-4">
                            <Shield className="w-4 h-4" />
                            Identidad Verificada
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900 mb-2">
                            ¡Ya estás verificado!
                        </h1>
                        <p className="text-gray-600 mb-6">
                            Tu identidad ha sido verificada exitosamente. Ahora puedes publicar inmuebles sin restricciones.
                        </p>
                        <button
                            onClick={() => router.push('/mis-inmuebles')}
                            className="w-full py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                        >
                            Ir a Mis Inmuebles
                            <ArrowRight className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Rejected state
    if (verification?.estado === 'rechazado') {
        return (
            <div className={`${inter.className} min-h-screen bg-gray-50`}>
                <TunnelHeader onLogout={handleLogout} isLoggingOut={isLoggingOut} />
                <div className="pt-16 min-h-screen flex items-center justify-center p-4">
                    <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
                        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <AlertTriangle className="w-8 h-8 text-red-600" />
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900 mb-2">
                            Verificación Rechazada
                        </h1>
                        <p className="text-gray-600 mb-4">
                            {verification.rejected_reason || 'Tu verificación ha sido rechazada.'}
                        </p>
                        <p className="text-sm text-gray-500 mb-6">
                            Para más información, contacta a soporte a través de PQR.
                        </p>
                        <button
                            onClick={() => router.push('/soporte')}
                            className="w-full py-3 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
                        >
                            Contactar Soporte
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Under review state - inputs disabled
    if (verification?.estado === 'pendiente') {
        return (
            <div className={`${inter.className} min-h-screen bg-gray-50`}>
                <TunnelHeader onLogout={handleLogout} isLoggingOut={isLoggingOut} />
                <div className="pt-16 min-h-screen flex items-center justify-center p-4">
                    <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
                        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <FileText className="w-8 h-8 text-blue-600" />
                        </div>
                        <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-800 px-4 py-2 rounded-full text-sm font-medium mb-4">
                            <Clock className="w-4 h-4" />
                            En Revisión
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900 mb-2">
                            Documento en Revisión
                        </h1>
                        <p className="text-gray-600 mb-6">
                            Hemos recibido tu documento. Nuestro equipo lo revisará pronto.
                            Te notificaremos cuando tu verificación sea aprobada.
                        </p>
                        <div className="bg-blue-50 rounded-lg p-4 mb-6">
                            <p className="text-sm text-blue-800">
                                Tiempo estimado de revisión: <strong>24-48 horas</strong>
                            </p>
                        </div>
                        <button
                            onClick={() => router.push('/mis-inmuebles')}
                            className="w-full py-3 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
                        >
                            Ir a Mis Inmuebles
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Main upload interface - PENDING_UPLOAD state
    return (
        <div className={`${inter.className} min-h-screen bg-gray-50`}>
            <TunnelHeader onLogout={handleLogout} isLoggingOut={isLoggingOut} />
            <div className="pt-20 max-w-2xl mx-auto px-4 py-8">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Shield className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">
                        Verificación de Identidad
                    </h1>
                    <span className="inline-block bg-red-100 text-red-800 text-sm font-medium px-3 py-1 rounded-full mb-3">
                        Requerido
                    </span>
                    <p className="text-gray-600 max-w-md mx-auto">
                        Sube tu Cédula de Ciudadanía para activar tus inmuebles.
                        {deadline?.deadline && !deadline.isExpired && (
                            <span className="block mt-2 font-medium text-amber-700">
                                Tienes hasta el {formatDeadline(deadline.deadline)} antes de que se cancele tu publicación.
                            </span>
                        )}
                    </p>
                </div>

                {/* Deadline Warning */}
                {deadline && !deadline.isExpired && (
                    <div className={`p-4 rounded-lg mb-6 ${deadline.isUrgent
                        ? 'bg-red-50 border border-red-200'
                        : 'bg-yellow-50 border border-yellow-200'
                        }`}>
                        <div className="flex items-center gap-3">
                            <Clock className={`w-5 h-5 flex-shrink-0 ${deadline.isUrgent ? 'text-red-600' : 'text-yellow-600'}`} />
                            <div>
                                <p className={`font-medium ${deadline.isUrgent ? 'text-red-800' : 'text-yellow-800'}`}>
                                    {deadline.isUrgent ? '¡Tiempo casi agotado!' : 'Tiempo limitado'}
                                </p>
                                <p className={`text-sm ${deadline.isUrgent ? 'text-red-700' : 'text-yellow-700'}`}>
                                    Quedan <strong>{deadline.hoursRemaining} horas</strong> para subir tu documento.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Expired Warning */}
                {deadline?.isExpired && (
                    <div className="p-4 rounded-lg mb-6 bg-red-50 border border-red-200">
                        <div className="flex items-center gap-3">
                            <AlertTriangle className="w-5 h-5 text-red-600" />
                            <p className="font-medium text-red-800">
                                El plazo ha vencido. Tu publicación no puede ser activada.
                            </p>
                        </div>
                    </div>
                )}

                {/* Success Message */}
                {success && (
                    <div className="p-4 rounded-lg mb-6 bg-green-50 border border-green-200">
                        <div className="flex items-center gap-3">
                            <CheckCircle className="w-5 h-5 text-green-600" />
                            <p className="font-medium text-green-800">
                                ¡Documento subido exitosamente! Está en revisión.
                            </p>
                        </div>
                    </div>
                )}

                {/* Error Message */}
                {error && (
                    <div className="p-4 rounded-lg mb-6 bg-red-50 border border-red-200">
                        <p className="text-red-700">{error}</p>
                    </div>
                )}

                {/* Primary Upload Card - Cédula */}
                <div className="bg-white rounded-xl shadow-lg p-6 mb-4">
                    <div className="flex items-center gap-2 mb-4">
                        <h2 className="text-lg font-semibold text-gray-900">
                            Cédula de Ciudadanía
                        </h2>
                        <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded">Obligatorio</span>
                    </div>

                    <p className="text-gray-600 text-sm mb-6">
                        Sube una foto o escaneo claro de la parte frontal de tu cédula.
                    </p>

                    {/* File Input */}
                    <label className={`
                        block border-2 border-dashed rounded-xl p-8 text-center cursor-pointer
                        transition-colors
                        ${selectedFile
                            ? 'border-blue-300 bg-blue-50'
                            : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                        }
                        ${deadline?.isExpired ? 'opacity-50 cursor-not-allowed' : ''}
                    `}>
                        <input
                            type="file"
                            accept="image/jpeg,image/png,application/pdf"
                            onChange={handleFileChange}
                            className="hidden"
                            disabled={isUploading || deadline?.isExpired}
                        />

                        {previewUrl ? (
                            <div className="space-y-4">
                                <img
                                    src={previewUrl}
                                    alt="Preview"
                                    className="max-h-48 mx-auto rounded-lg shadow"
                                />
                                <p className="text-sm text-gray-600">
                                    {selectedFile?.name}
                                </p>
                            </div>
                        ) : selectedFile ? (
                            <div className="space-y-2">
                                <FileText className="w-12 h-12 text-blue-600 mx-auto" />
                                <p className="text-gray-900 font-medium">{selectedFile.name}</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
                                    <Camera className="w-8 h-8 text-gray-400" />
                                </div>
                                <p className="text-gray-600">
                                    Arrastra tu archivo aquí o <span className="text-blue-600">selecciónalo</span>
                                </p>
                                <p className="text-xs text-gray-400">
                                    JPG, PNG o PDF • Máximo 10MB
                                </p>
                            </div>
                        )}
                    </label>
                </div>

                {/* Optional Upload Card - Poder/Autorización */}
                <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
                    <div className="flex items-center gap-2 mb-4">
                        <h2 className="text-lg font-semibold text-gray-900">
                            Poder / Autorización
                        </h2>
                        <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded">Opcional</span>
                    </div>

                    <p className="text-gray-600 text-sm mb-4">
                        Si publicas en nombre de otra persona, sube el poder o autorización firmada.
                    </p>

                    {optionalFile ? (
                        <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg">
                            <FileText className="w-8 h-8 text-blue-600" />
                            <div className="flex-1">
                                <p className="font-medium text-gray-900 text-sm">{optionalFile.name}</p>
                                <p className="text-xs text-gray-500">
                                    {(optionalFile.size / 1024 / 1024).toFixed(2)} MB
                                </p>
                            </div>
                            <button
                                onClick={removeOptionalFile}
                                className="p-1 hover:bg-gray-200 rounded"
                            >
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>
                    ) : (
                        <label className={`
                            block border border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer
                            hover:border-gray-400 hover:bg-gray-50 transition-colors
                            ${deadline?.isExpired ? 'opacity-50 cursor-not-allowed' : ''}
                        `}>
                            <input
                                type="file"
                                accept="image/jpeg,image/png,application/pdf"
                                onChange={handleOptionalFileChange}
                                className="hidden"
                                disabled={isUploading || deadline?.isExpired}
                            />
                            <div className="flex items-center justify-center gap-2 text-gray-500">
                                <FilePlus className="w-5 h-5" />
                                <span className="text-sm">Agregar documento (PDF/JPG/PNG)</span>
                            </div>
                        </label>
                    )}
                </div>

                {/* Upload Button */}
                <button
                    onClick={handleUpload}
                    disabled={!selectedFile || isUploading || deadline?.isExpired}
                    className={`
                        w-full py-4 rounded-xl font-semibold text-lg flex items-center justify-center gap-2
                        transition-all shadow-lg
                        ${selectedFile && !deadline?.isExpired
                            ? 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-xl'
                            : 'bg-gray-200 text-gray-500 cursor-not-allowed shadow-none'
                        }
                    `}
                >
                    {isUploading ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Subiendo documentos...
                        </>
                    ) : (
                        <>
                            <Upload className="w-5 h-5" />
                            Enviar para Verificación
                        </>
                    )}
                </button>

                {/* Info Section */}
                <div className="mt-6 p-4 bg-gray-100 rounded-lg">
                    <h3 className="font-medium text-gray-900 mb-2">¿Por qué necesitamos esto?</h3>
                    <ul className="text-sm text-gray-600 space-y-1">
                        <li>• Protegemos a compradores e inquilinos de fraudes</li>
                        <li>• Cumplimos con regulaciones locales</li>
                        <li>• Tu documento se almacena de forma segura y privada</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}

