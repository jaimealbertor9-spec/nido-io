'use client';

import { useRef, useState, useTransition } from 'react';
import Image from 'next/image';
import { Camera } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { updateProfileData, updateAvatarUrl, sendPasswordResetEmail } from '../actions';
import type { User } from '@supabase/supabase-js';

interface ProfileClientProps {
    profile: {
        id: string;
        nombre: string | null;
        telefono: string | null;
        avatar_url: string | null;
        tipo_usuario: string | null;
        [key: string]: unknown;
    } | null;
    user: User;
}

export default function ProfileClient({ profile, user }: ProfileClientProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [saveMessage, setSaveMessage] = useState<string | null>(null);
    const [resetMessage, setResetMessage] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    const displayName = profile?.nombre || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuario';
    const displayEmail = user.email || '';
    const currentAvatar = avatarPreview || profile?.avatar_url || user.user_metadata?.avatar_url || user.user_metadata?.picture || null;

    // ── Avatar Upload ──────────────────────────────────────────────────
    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate size (5MB max)
        if (file.size > 5 * 1024 * 1024) {
            alert('El archivo es demasiado grande. Máximo 5MB.');
            return;
        }

        setIsUploading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const filePath = `${user.id}/avatar-${Date.now()}.${fileExt}`;

            // Cleanup old avatar (Best-Effort — must not block new upload)
            try {
                const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
                const bucketSegment = '/storage/v1/object/public/avatars/';
                if (currentAvatar && currentAvatar.startsWith(supabaseUrl) && currentAvatar.includes(bucketSegment)) {
                    const oldPath = currentAvatar.split(bucketSegment)[1]?.split('?')[0];
                    if (oldPath) {
                        await supabase.storage.from('avatars').remove([decodeURIComponent(oldPath)]);
                    }
                }
            } catch (cleanupError) {
                console.warn('Silent catch: Failed to delete old avatar, proceeding with new upload.', cleanupError);
            }

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, file, { upsert: true });

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);

            setAvatarPreview(publicUrl);

            // Persist to DB via server action
            await updateAvatarUrl(publicUrl);
        } catch (err) {
            console.error('Avatar upload failed:', err);
            alert('Error al subir la imagen. Intenta de nuevo.');
        } finally {
            setIsUploading(false);
        }
    };

    // ── Profile Form Submit ────────────────────────────────────────────
    const handleProfileSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);

        startTransition(async () => {
            try {
                await updateProfileData(formData);
                setSaveMessage('✅ Cambios guardados exitosamente.');
                setTimeout(() => setSaveMessage(null), 3000);
            } catch {
                setSaveMessage('❌ Error al guardar. Intenta de nuevo.');
                setTimeout(() => setSaveMessage(null), 3000);
            }
        });
    };

    // ── Password Reset ─────────────────────────────────────────────────
    const handlePasswordReset = () => {
        startTransition(async () => {
            try {
                await sendPasswordResetEmail();
                setResetMessage('📧 Correo de restablecimiento enviado.');
                setTimeout(() => setResetMessage(null), 5000);
            } catch {
                setResetMessage('❌ Error al enviar correo. Intenta de nuevo.');
                setTimeout(() => setResetMessage(null), 5000);
            }
        });
    };

    return (
        <main className="min-h-screen p-4 md:p-12">
            <header className="mb-12">
                <h1 className="text-4xl font-black tracking-tight text-slate-900">Mi Perfil</h1>
                <p className="text-slate-500 mt-2 max-w-lg">Gestiona tu identidad digital y configuración de seguridad.</p>
            </header>

            <div className="grid grid-cols-12 gap-8 items-start">
                {/* ── LEFT COLUMN: Avatar Card ─────────────────────────── */}
                <section className="col-span-12 lg:col-span-4 flex flex-col gap-8">
                    <div className="bg-white/70 backdrop-blur-md p-8 rounded-2xl shadow-lg border border-white text-center">
                        <div className="relative inline-block group mb-6">
                            <div className="w-40 h-40 rounded-full overflow-hidden border-4 border-white shadow-xl">
                                {currentAvatar ? (
                                    <Image
                                        src={currentAvatar}
                                        alt="Profile Display"
                                        width={160}
                                        height={160}
                                        className="w-full h-full object-cover"
                                        referrerPolicy="no-referrer"
                                    />
                                ) : (
                                    <div className="w-full h-full bg-gradient-to-tr from-orange-300 to-amber-200 flex items-center justify-center text-white text-5xl font-bold">
                                        {displayName[0]?.toUpperCase() || 'U'}
                                    </div>
                                )}
                            </div>
                        </div>
                        <h2 className="text-xl font-bold mb-1">{displayName}</h2>
                        <p className="text-slate-500 text-sm mb-2">{displayEmail}</p>
                        <div className="flex justify-center mb-6">
                            <span className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-bold uppercase tracking-wider rounded-full border border-blue-200">
                                {profile?.tipo_usuario || 'Usuario'}
                            </span>
                        </div>
                        <div className="space-y-4">
                            {/* Hidden file input */}
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/png, image/jpeg"
                                className="hidden"
                                onChange={handleFileSelect}
                            />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isUploading}
                                className="w-full py-3 rounded-full border border-slate-200 hover:bg-slate-50 transition-colors text-sm font-semibold text-slate-700 flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                <Camera className="w-4 h-4" />
                                {isUploading ? 'Subiendo...' : 'Editar Foto'}
                            </button>
                            <p className="text-[10px] text-slate-400 leading-relaxed px-4">JPG, PNG. Máx 5MB.</p>
                        </div>
                    </div>
                </section>

                {/* ── RIGHT COLUMN: Personal Info + Security ───────────── */}
                <div className="col-span-12 lg:col-span-8 flex flex-col gap-8">
                    {/* Personal Information */}
                    <section className="bg-white/70 backdrop-blur-md p-10 rounded-2xl shadow-lg border border-white">
                        <h3 className="text-xl font-bold mb-8">Información Personal</h3>
                        <form className="space-y-8" onSubmit={handleProfileSubmit}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nombre Completo</label>
                                    <input
                                        name="nombre"
                                        defaultValue={profile?.nombre || ''}
                                        className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500/20 text-slate-900 font-medium"
                                        type="text"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Teléfono</label>
                                    <input
                                        name="telefono"
                                        defaultValue={profile?.telefono || ''}
                                        className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500/20 text-slate-900 font-medium"
                                        type="tel"
                                    />
                                </div>
                            </div>
                            <div className="pt-4 flex items-center justify-end gap-4">
                                {saveMessage && (
                                    <p className="text-sm font-medium text-slate-600 animate-in fade-in duration-300">{saveMessage}</p>
                                )}
                                <button
                                    className="bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-3 rounded-full font-bold shadow-lg shadow-emerald-500/20 transition-all active:scale-95 disabled:opacity-50"
                                    type="submit"
                                    disabled={isPending}
                                >
                                    {isPending ? 'Guardando...' : 'Guardar Cambios'}
                                </button>
                            </div>
                        </form>
                    </section>

                    {/* Security */}
                    <section className="bg-white/70 backdrop-blur-md p-10 rounded-2xl shadow-lg border border-white">
                        <h3 className="text-xl font-bold mb-6">Seguridad</h3>
                        <div className="flex flex-col md:flex-row items-center justify-between p-6 rounded-2xl bg-slate-50 border border-white">
                            <div className="mb-4 md:mb-0">
                                <h4 className="font-bold text-slate-900">Contraseña</h4>
                                <p className="text-xs text-slate-500 mt-1">Se enviará un correo seguro de restablecimiento vía Supabase.</p>
                                {resetMessage && (
                                    <p className="text-xs font-medium text-blue-600 mt-2 animate-in fade-in duration-300">{resetMessage}</p>
                                )}
                            </div>
                            <button
                                onClick={handlePasswordReset}
                                disabled={isPending}
                                className="w-full md:w-auto bg-white border border-slate-200 hover:border-blue-700 text-blue-700 font-bold px-6 py-2.5 rounded-full transition-all text-sm disabled:opacity-50"
                            >
                                {isPending ? 'Enviando...' : 'Cambiar Contraseña'}
                            </button>
                        </div>
                    </section>
                </div>
            </div>
        </main>
    );
}
