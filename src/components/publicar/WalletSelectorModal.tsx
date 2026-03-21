'use client';

import { useState, useEffect } from 'react';
import { X, Check, Clock, Phone, MessageCircle, BarChart3, Crown, Infinity, Zap } from 'lucide-react';
import type { WalletSummary } from '@/app/actions/action-types';

// =============================================================================
// TYPES
// =============================================================================
interface WalletSelectorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (walletId: string) => void;
    wallets: WalletSummary[];
    isPublishing?: boolean;
}

// =============================================================================
// HELPER: Format expiry date
// =============================================================================
function formatExpiry(expiresAt: string | null): string {
    if (!expiresAt) return '';
    const date = new Date(expiresAt);
    const now = new Date();
    const daysUntilExpiry = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntilExpiry <= 0) return 'Expirado';
    if (daysUntilExpiry === 1) return 'Expira mañana';
    if (daysUntilExpiry <= 7) return `Expira en ${daysUntilExpiry} días`;
    return `Expira ${date.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}`;
}

// =============================================================================
// HELPER: Get plan styling
// =============================================================================
function getPlanStyle(slug: string) {
    switch (slug) {
        case 'unlimited':
            return {
                gradient: 'bg-gradient-to-br from-[#0c263b] to-[#1a4a6e]',
                border: 'border-[#1a4a6e]',
                text: 'text-white',
                accent: 'text-amber-400',
                check: 'bg-amber-400',
                badge: 'bg-gradient-to-r from-amber-400 to-yellow-300 text-amber-950'
            };
        case 'gold':
        case 'oro':
            return {
                gradient: 'bg-gradient-to-br from-amber-50 to-yellow-100',
                border: 'border-amber-200',
                text: 'text-amber-900',
                accent: 'text-amber-600',
                check: 'bg-amber-500',
                badge: 'bg-amber-100 text-amber-800'
            };
        case 'silver':
        case 'plata':
            return {
                gradient: 'bg-gradient-to-br from-slate-50 to-gray-100',
                border: 'border-slate-200',
                text: 'text-slate-800',
                accent: 'text-slate-600',
                check: 'bg-slate-500',
                badge: 'bg-slate-100 text-slate-700'
            };
        default:
            return {
                gradient: 'bg-gradient-to-br from-blue-50 to-indigo-50',
                border: 'border-blue-200',
                text: 'text-blue-900',
                accent: 'text-blue-600',
                check: 'bg-blue-500',
                badge: 'bg-blue-100 text-blue-800'
            };
    }
}

// =============================================================================
// FEATURE ICONS
// =============================================================================
function FeatureCheck({ included, label }: { included: boolean; label: string }) {
    return (
        <div className={`flex items-center gap-1.5 text-xs ${included ? 'text-current opacity-80' : 'text-current opacity-40'}`}>
            {included ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
            <span>{label}</span>
        </div>
    );
}

// =============================================================================
// WALLET SELECTOR MODAL COMPONENT
// =============================================================================
export default function WalletSelectorModal({
    isOpen,
    onClose,
    onSelect,
    wallets,
    isPublishing = false
}: WalletSelectorModalProps) {

    // Auto-select first wallet on mount
    const [selectedId, setSelectedId] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && wallets.length > 0 && !selectedId) {
            // Select the first wallet (already sorted by priority)
            setSelectedId(wallets[0].walletId);
        }
    }, [isOpen, wallets, selectedId]);

    // Handle escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !isPublishing) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [onClose, isPublishing]);

    if (!isOpen) return null;

    const selectedWallet = wallets.find(w => w.walletId === selectedId);

    const handleConfirm = () => {
        if (selectedId && !isPublishing) {
            onSelect(selectedId);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={isPublishing ? undefined : onClose}
            />

            {/* Modal */}
            <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="bg-gradient-to-r from-[#0c263b] to-[#1a4a6e] px-6 py-5 text-white">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-bold">¿Con qué crédito publicar?</h2>
                            <p className="text-blue-200 text-sm mt-1">Selecciona el plan que deseas usar</p>
                        </div>
                        {!isPublishing && (
                            <button
                                onClick={onClose}
                                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Wallet Options */}
                <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
                    {wallets.map((wallet) => {
                        const style = getPlanStyle(wallet.packageSlug);
                        const isSelected = selectedId === wallet.walletId;
                        const expiryText = formatExpiry(wallet.expiresAt);

                        return (
                            <button
                                key={wallet.walletId}
                                onClick={() => !isPublishing && setSelectedId(wallet.walletId)}
                                disabled={isPublishing}
                                className={`w-full text-left rounded-xl border-2 transition-all duration-200 ${
                                    isSelected
                                        ? `${style.border} ring-2 ring-offset-1 ring-blue-400`
                                        : 'border-gray-100 hover:border-gray-200'
                                } ${isPublishing ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                            >
                                <div className={`p-4 rounded-lg ${style.gradient}`}>
                                    {/* Plan Header */}
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            {wallet.isUnlimited && <Crown className={`w-5 h-5 ${style.accent}`} />}
                                            <span className={`font-bold text-lg ${style.text}`}>
                                                {wallet.packageName}
                                            </span>
                                        </div>
                                        {isSelected && (
                                            <div className={`w-6 h-6 rounded-full ${style.check} flex items-center justify-center`}>
                                                <Check className="w-4 h-4 text-white" />
                                            </div>
                                        )}
                                    </div>

                                    {/* Credits Display */}
                                    <div className="flex items-baseline gap-2 mb-3">
                                        {wallet.isUnlimited ? (
                                            <>
                                                <span className={`text-2xl font-bold ${style.text} flex items-center`}>
                                                    <Infinity className="w-7 h-7 mr-1" />
                                                </span>
                                                <span className={style.accent}>Publicaciones ilimitadas</span>
                                            </>
                                        ) : (
                                            <>
                                                <span className={`text-2xl font-bold ${style.text}`}>
                                                    {wallet.creditsRemaining}
                                                </span>
                                                <span className={style.accent}>
                                                    {wallet.creditsRemaining === 1 ? 'crédito disponible' : 'créditos disponibles'}
                                                </span>
                                            </>
                                        )}
                                    </div>

                                    {/* Duration Badge */}
                                    <div className="flex flex-wrap items-center gap-2 mb-3">
                                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${style.badge}`}>
                                            <Clock className="w-3 h-3 inline mr-1" />
                                            {wallet.duracionDias} días por publicación
                                        </span>
                                        {expiryText && !wallet.isUnlimited && (
                                            <span className={`text-xs ${style.accent}`}>
                                                {expiryText}
                                            </span>
                                        )}
                                    </div>

                                    {/* Features */}
                                    <div className={`grid grid-cols-2 gap-1.5 ${style.text} opacity-80`}>
                                        <FeatureCheck
                                            included={wallet.features?.showPhone ?? false}
                                            label="Teléfono visible"
                                        />
                                        <FeatureCheck
                                            included={wallet.features?.showWhatsApp ?? false}
                                            label="WhatsApp visible"
                                        />
                                        <FeatureCheck
                                            included={wallet.features?.highlighted ?? false}
                                            label="Destacado"
                                        />
                                        <FeatureCheck
                                            included={wallet.features?.statistics ?? true}
                                            label="Estadísticas"
                                        />
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* Footer */}
                <div className="px-4 pb-4 pt-2 border-t border-gray-100">
                    {/* Expiry Warning if applicable */}
                    {selectedWallet && !selectedWallet.isUnlimited && selectedWallet.expiresAt && (
                        <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                            <div className="flex items-start gap-2">
                                <Clock className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                                <div className="text-xs text-amber-800">
                                    <span className="font-semibold">Importante:</span> Este crédito expira el{' '}
                                    {new Date(selectedWallet.expiresAt).toLocaleDateString('es-CO', {
                                        day: 'numeric',
                                        month: 'long'
                                    })}. Úsalo antes de que venza.
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            disabled={isPublishing}
                            className={`flex-1 py-3 px-4 rounded-xl font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors ${
                                isPublishing ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={!selectedId || isPublishing}
                            className={`flex-1 py-3 px-4 rounded-xl font-bold text-white transition-all flex items-center justify-center gap-2 ${
                                !selectedId || isPublishing
                                    ? 'bg-gray-300 cursor-not-allowed'
                                    : 'bg-gradient-to-r from-[#1A56DB] to-blue-600 hover:from-blue-700 hover:to-blue-700 shadow-lg shadow-blue-500/25'
                            }`}
                        >
                            {isPublishing ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Publicando...
                                </>
                            ) : (
                                <>
                                    <Zap className="w-4 h-4" />
                                    Publicar
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}