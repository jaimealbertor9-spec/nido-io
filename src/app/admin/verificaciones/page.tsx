'use client';

import { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Inter } from 'next/font/google';
import {
    Shield, CheckCircle, XCircle, Eye, Loader2,
    Clock, User, FileText, ArrowLeft, ExternalLink,
    Building2, DollarSign, MapPin
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
    fetchPendingInmuebles,
    approvePublication,
    rejectPublication,
    getSignedDocumentUrl,
    checkIsAdmin,
    type PendingInmueble
} from './actions';

const inter = Inter({ subsets: ['latin'] });

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN VERIFICACIONES DASHBOARD
// Route: /admin/verificaciones
// Protected: Only accessible by users with rol='admin' or app_metadata.role='admin'
// ═══════════════════════════════════════════════════════════════════════════

export default function AdminVerificacionesPage() {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    // Auth state
    const [isLoading, setIsLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);

    // Data state
    const [inmuebles, setInmuebles] = useState<PendingInmueble[]>([]);

    // Selected item state
    const [selectedInmueble, setSelectedInmueble] = useState<PendingInmueble | null>(null);
    const [documentUrl, setDocumentUrl] = useState<string | null>(null);
    const [isLoadingDoc, setIsLoadingDoc] = useState(false);

    // Reject modal state
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [rejectReason, setRejectReason] = useState('');

    // Error state
    const [actionError, setActionError] = useState<string | null>(null);

    // ─────────────────────────────────────────────────────────────────────────
    // CHECK ADMIN AND LOAD DATA
    // ─────────────────────────────────────────────────────────────────────────

    useEffect(() => {
        async function loadData() {
            try {
                const { data: { user } } = await supabase.auth.getUser();

                if (!user) {
                    router.push('/publicar/auth');
                    return;
                }

                // Check admin role
                const isAdminUser = await checkIsAdmin(user.id);

                if (!isAdminUser) {
                    console.warn('User is not admin, redirecting...');
                    router.push('/');
                    return;
                }

                setIsAdmin(true);

                // Load pending inmuebles
                const pending = await fetchPendingInmuebles();
                setInmuebles(pending);

            } catch (err) {
                console.error('Error loading admin data:', err);
            } finally {
                setIsLoading(false);
            }
        }

        loadData();
    }, [router]);

    // ─────────────────────────────────────────────────────────────────────────
    // VIEW DOCUMENT
    // ─────────────────────────────────────────────────────────────────────────

    const handleViewDocument = async (inmueble: PendingInmueble, docPath: string) => {
        setIsLoadingDoc(true);
        setSelectedInmueble(inmueble);
        setDocumentUrl(null);
        setActionError(null);

        const result = await getSignedDocumentUrl(docPath);

        if (result.success && result.url) {
            setDocumentUrl(result.url);
        } else {
            setActionError(result.error || 'Error al cargar documento');
        }

        setIsLoadingDoc(false);
    };

    const handleOpenInNewTab = () => {
        if (documentUrl) {
            window.open(documentUrl, '_blank');
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // APPROVE PUBLICATION (RPC)
    // ─────────────────────────────────────────────────────────────────────────

    const handleApprove = (inmuebleId: string) => {
        setActionError(null);
        startTransition(async () => {
            const result = await approvePublication(inmuebleId);

            if (result.success) {
                setInmuebles(prev => prev.filter(i => i.id !== inmuebleId));
                setSelectedInmueble(null);
                setDocumentUrl(null);
            } else {
                setActionError(result.error || 'Error al aprobar');
            }
        });
    };

    // ─────────────────────────────────────────────────────────────────────────
    // REJECT PUBLICATION (RPC)
    // ─────────────────────────────────────────────────────────────────────────

    const openRejectModal = (inmueble: PendingInmueble) => {
        setSelectedInmueble(inmueble);
        setRejectReason('');
        setShowRejectModal(true);
    };

    const handleReject = () => {
        if (!selectedInmueble || !rejectReason.trim()) return;
        setActionError(null);

        startTransition(async () => {
            const result = await rejectPublication(selectedInmueble.id, rejectReason);

            if (result.success) {
                setInmuebles(prev => prev.filter(i => i.id !== selectedInmueble.id));
                setSelectedInmueble(null);
                setDocumentUrl(null);
                setShowRejectModal(false);
                setRejectReason('');
            } else {
                setActionError(result.error || 'Error al rechazar');
            }
        });
    };

    // ─────────────────────────────────────────────────────────────────────────
    // FORMAT PRICE
    // ─────────────────────────────────────────────────────────────────────────

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(price);
    };

    // ─────────────────────────────────────────────────────────────────────────
    // LOADING STATE
    // ─────────────────────────────────────────────────────────────────────────

    if (isLoading) {
        return (
            <div className={`${inter.className} min-h-screen bg-gray-100 flex items-center justify-center`}>
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // NOT ADMIN STATE
    // ─────────────────────────────────────────────────────────────────────────

    if (!isAdmin) {
        return (
            <div className={`${inter.className} min-h-screen bg-gray-100 flex items-center justify-center`}>
                <div className="text-center">
                    <Shield className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">Acceso Denegado</h2>
                    <p className="text-gray-500">No tienes permisos para acceder a esta página.</p>
                </div>
            </div>
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MAIN RENDER
    // ─────────────────────────────────────────────────────────────────────────

    return (
        <div className={`${inter.className} min-h-screen bg-gray-100`}>
            {/* Header */}
            <header className="bg-white border-b sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                <Shield className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-gray-900">Panel de Verificaciones</h1>
                                <p className="text-sm text-gray-500">
                                    {inmuebles.length} publicación{inmuebles.length !== 1 ? 'es' : ''} pendiente{inmuebles.length !== 1 ? 's' : ''}
                                </p>
                            </div>
                        </div>

                        <button
                            onClick={() => router.push('/')}
                            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Volver
                        </button>
                    </div>
                </div>
            </header>

            {/* Error Banner */}
            {actionError && (
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
                        <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                        <p className="text-red-700 flex-1">{actionError}</p>
                        <button onClick={() => setActionError(null)} className="text-red-500 hover:text-red-700">✕</button>
                    </div>
                </div>
            )}

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {inmuebles.length === 0 ? (
                    /* Empty State */
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <CheckCircle className="w-8 h-8 text-green-600" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Todo al día</h3>
                        <p className="text-gray-500">No hay publicaciones pendientes de verificación</p>
                    </div>
                ) : (
                    /* Inmuebles Grid */
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {inmuebles.map((inmueble) => (
                            <div
                                key={inmueble.id}
                                className={`bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden ${isPending ? 'opacity-50 pointer-events-none' : ''
                                    }`}
                            >
                                {/* Card Header */}
                                <div className="p-5 border-b border-gray-100">
                                    <div className="flex items-start justify-between gap-3 mb-3">
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-semibold text-gray-900 truncate">
                                                {inmueble.titulo || 'Sin título'}
                                            </h3>
                                            <div className="flex items-center gap-1.5 text-sm text-gray-500 mt-1">
                                                <MapPin className="w-3.5 h-3.5" />
                                                <span className="truncate">
                                                    {inmueble.barrio || inmueble.ciudad || 'Sin ubicación'}
                                                </span>
                                            </div>
                                        </div>
                                        <span className="flex-shrink-0 px-2.5 py-1 bg-yellow-100 text-yellow-700 text-xs font-medium rounded-full">
                                            Pendiente
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-4 text-sm">
                                        <div className="flex items-center gap-1 text-green-600 font-medium">
                                            <DollarSign className="w-4 h-4" />
                                            {formatPrice(inmueble.precio)}
                                        </div>
                                        <div className="flex items-center gap-1 text-gray-500">
                                            <Building2 className="w-4 h-4" />
                                            {inmueble.tipo_negocio === 'arriendo' ? 'Arriendo' : 'Venta'}
                                        </div>
                                    </div>
                                </div>

                                {/* Owner Info */}
                                <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
                                    <div className="flex items-center gap-2">
                                        <User className="w-4 h-4 text-gray-400" />
                                        <span className="text-sm text-gray-600">
                                            {inmueble.propietario?.nombre || 'Sin nombre'}
                                        </span>
                                        <span className="text-sm text-gray-400">|</span>
                                        <span className="text-sm text-gray-500 truncate">
                                            {inmueble.propietario?.email || 'Sin email'}
                                        </span>
                                    </div>
                                </div>

                                {/* Documents */}
                                <div className="p-5 space-y-2">
                                    <div className="flex items-center gap-2 mb-3">
                                        <FileText className="w-4 h-4 text-gray-400" />
                                        <span className="text-sm font-medium text-gray-700">Documentos</span>
                                    </div>

                                    {inmueble.verificaciones.length === 0 ? (
                                        <p className="text-sm text-gray-400">Sin documentos</p>
                                    ) : (
                                        inmueble.verificaciones.map((doc) => (
                                            <button
                                                key={doc.id}
                                                onClick={() => handleViewDocument(inmueble, doc.documento_url)}
                                                className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-left"
                                            >
                                                <span className="text-sm font-medium text-gray-700 capitalize">
                                                    {doc.tipo_documento === 'cedula' ? 'Cédula' : 'Poder'}
                                                </span>
                                                <Eye className="w-4 h-4 text-blue-600" />
                                            </button>
                                        ))
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="p-5 pt-0 flex gap-3">
                                    <button
                                        onClick={() => handleApprove(inmueble.id)}
                                        disabled={isPending}
                                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                                    >
                                        <CheckCircle className="w-4 h-4" />
                                        Aprobar
                                    </button>
                                    <button
                                        onClick={() => openRejectModal(inmueble)}
                                        disabled={isPending}
                                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                                    >
                                        <XCircle className="w-4 h-4" />
                                        Rechazar
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {/* Document Preview Modal */}
            {selectedInmueble && documentUrl && !showRejectModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
                        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                            <h3 className="font-semibold text-gray-900">
                                Documento - {selectedInmueble.titulo || 'Sin título'}
                            </h3>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleOpenInNewTab}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                >
                                    <ExternalLink className="w-4 h-4" />
                                    Abrir en nueva pestaña
                                </button>
                                <button
                                    onClick={() => {
                                        setSelectedInmueble(null);
                                        setDocumentUrl(null);
                                    }}
                                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>
                        <div className="p-4 overflow-auto max-h-[70vh]">
                            {isLoadingDoc ? (
                                <div className="flex items-center justify-center h-64">
                                    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                                </div>
                            ) : documentUrl.toLowerCase().endsWith('.pdf') ? (
                                <iframe
                                    src={documentUrl}
                                    className="w-full h-[60vh] rounded-lg border border-gray-200"
                                    title="Document Preview"
                                />
                            ) : (
                                <img
                                    src={documentUrl}
                                    alt="Documento de verificación"
                                    className="max-w-full h-auto rounded-lg mx-auto"
                                />
                            )}
                        </div>
                        <div className="p-4 border-t border-gray-200 flex justify-end gap-3">
                            <button
                                onClick={() => handleApprove(selectedInmueble.id)}
                                disabled={isPending}
                                className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                            >
                                <CheckCircle className="w-4 h-4" />
                                Aprobar
                            </button>
                            <button
                                onClick={() => openRejectModal(selectedInmueble)}
                                disabled={isPending}
                                className="flex items-center gap-2 px-6 py-2.5 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                            >
                                <XCircle className="w-4 h-4" />
                                Rechazar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Reject Modal */}
            {showRejectModal && selectedInmueble && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Rechazar Publicación</h3>
                        <p className="text-sm text-gray-500 mb-4">
                            <strong>{selectedInmueble.titulo || 'Sin título'}</strong>
                        </p>
                        <textarea
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="Escribe el motivo del rechazo..."
                            rows={4}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
                        />
                        <div className="flex justify-end gap-3 mt-4">
                            <button
                                onClick={() => {
                                    setShowRejectModal(false);
                                    setSelectedInmueble(null);
                                    setRejectReason('');
                                }}
                                disabled={isPending}
                                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleReject}
                                disabled={isPending || !rejectReason.trim()}
                                className="px-4 py-2 text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
                            >
                                {isPending ? 'Procesando...' : 'Rechazar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
