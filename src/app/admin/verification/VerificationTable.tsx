'use client';

import { useState, useTransition } from 'react';
import {
    PendingVerification,
    getSignedDocumentUrl,
    approveVerification,
    rejectVerification,
} from './actions';

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN VERIFICATION TABLE
// Per-inmueble verification display with Spanish enums
// ═══════════════════════════════════════════════════════════════════════════

interface Props {
    initialData: PendingVerification[];
}

export default function VerificationTable({ initialData }: Props) {
    const [verifications, setVerifications] = useState<PendingVerification[]>(initialData);
    const [isPending, startTransition] = useTransition();

    // Rejection modal state
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [rejectingId, setRejectingId] = useState<string | null>(null);
    const [rejectReason, setRejectReason] = useState('');
    const [actionError, setActionError] = useState<string | null>(null);

    // ─────────────────────────────────────────────────────────────────────────
    // VIEW DOCUMENT (SIGNED URL)
    // ─────────────────────────────────────────────────────────────────────────

    const handleViewDocument = async (documentPath: string) => {
        setActionError(null);
        const result = await getSignedDocumentUrl(documentPath);
        if (result.success && result.url) {
            window.open(result.url, '_blank');
        } else {
            setActionError(result.error || 'Error al abrir documento');
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // APPROVE
    // ─────────────────────────────────────────────────────────────────────────

    const handleApprove = (id: string) => {
        setActionError(null);
        startTransition(async () => {
            const result = await approveVerification(id);
            if (result.success) {
                setVerifications((prev) => prev.filter((v) => v.id !== id));
            } else {
                setActionError(result.error || 'Error al aprobar');
            }
        });
    };

    // ─────────────────────────────────────────────────────────────────────────
    // REJECT
    // ─────────────────────────────────────────────────────────────────────────

    const openRejectModal = (id: string) => {
        setRejectingId(id);
        setRejectReason('');
        setShowRejectModal(true);
    };

    const handleReject = () => {
        if (!rejectingId || !rejectReason.trim()) return;
        setActionError(null);

        startTransition(async () => {
            const result = await rejectVerification(rejectingId, rejectReason);
            if (result.success) {
                setVerifications((prev) => prev.filter((v) => v.id !== rejectingId));
                setShowRejectModal(false);
                setRejectingId(null);
                setRejectReason('');
            } else {
                setActionError(result.error || 'Error al rechazar');
            }
        });
    };

    // ─────────────────────────────────────────────────────────────────────────
    // EMPTY STATE
    // ─────────────────────────────────────────────────────────────────────────

    if (verifications.length === 0) {
        return (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Todo al día</h3>
                <p className="text-gray-500">No hay verificaciones pendientes</p>
            </div>
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────────────────

    return (
        <>
            {/* Error Banner */}
            {actionError && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
                    <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-red-700 flex-1">{actionError}</p>
                    <button onClick={() => setActionError(null)} className="text-red-500 hover:text-red-700">
                        ✕
                    </button>
                </div>
            )}

            {/* Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Usuario
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Inmueble
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Documento
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Fecha
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Acciones
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {verifications.map((v) => (
                            <tr key={v.id} className={isPending ? 'opacity-50' : ''}>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div>
                                        <p className="text-sm font-medium text-gray-900">
                                            {v.usuario?.nombre || 'Sin nombre'}
                                        </p>
                                        <p className="text-sm text-gray-500">{v.usuario?.email}</p>
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div>
                                        <p className="text-sm font-medium text-gray-900">
                                            {v.inmueble?.titulo || 'Sin título'}
                                        </p>
                                        <p className="text-sm text-gray-500">{v.inmueble?.ciudad || '-'}</p>
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`
                    inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                    ${v.tipo_documento === 'cedula' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}
                  `}>
                                        {v.tipo_documento === 'cedula' ? 'Cédula' : 'Poder'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {new Date(v.created_at).toLocaleDateString('es-CO', {
                                        day: '2-digit',
                                        month: 'short',
                                        year: 'numeric',
                                    })}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right space-x-2">
                                    {/* View */}
                                    <button
                                        onClick={() => handleViewDocument(v.documento_url)}
                                        disabled={isPending}
                                        className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition disabled:opacity-50"
                                    >
                                        Ver
                                    </button>
                                    {/* Approve */}
                                    <button
                                        onClick={() => handleApprove(v.id)}
                                        disabled={isPending}
                                        className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition disabled:opacity-50"
                                    >
                                        Aprobar
                                    </button>
                                    {/* Reject */}
                                    <button
                                        onClick={() => openRejectModal(v.id)}
                                        disabled={isPending}
                                        className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition disabled:opacity-50"
                                    >
                                        Rechazar
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Rejection Modal */}
            {showRejectModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Rechazar Verificación</h3>
                        <textarea
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="Escribe el motivo del rechazo..."
                            rows={4}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
                        />
                        <div className="flex justify-end gap-3 mt-4">
                            <button
                                onClick={() => setShowRejectModal(false)}
                                disabled={isPending}
                                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleReject}
                                disabled={isPending || !rejectReason.trim()}
                                className="px-4 py-2 text-white bg-red-600 hover:bg-red-700 rounded-lg transition disabled:opacity-50"
                            >
                                {isPending ? 'Procesando...' : 'Rechazar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
