'use server';

import { createServerSupabaseClient } from '@/lib/supabase-server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

/**
 * Server Action for signing out.
 * 
 * 1. Clears Supabase session cookies
 * 2. Revalidates the dashboard layout cache
 * 3. Redirects to welcome page (hard navigation)
 */
export async function signOutAction() {
    const supabase = createServerSupabaseClient();
    await supabase.auth.signOut();

    // Clear the cached dashboard data to prevent back-button access
    revalidatePath('/mis-inmuebles', 'layout');

    redirect('/bienvenidos');
}

/**
 * Updates the user's nombre and telefono in the usuarios table.
 * Sanitizes inputs: trims whitespace and enforces max length.
 */
export async function updateProfileData(formData: FormData) {
    const supabase = createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const nombre = (formData.get('nombre') as string || '').trim().slice(0, 100);
    const telefono = (formData.get('telefono') as string || '').trim().slice(0, 20);

    if (!nombre) throw new Error('El nombre no puede estar vacío');

    const { error } = await supabase
        .from('usuarios')
        .update({ nombre, telefono })
        .eq('id', user.id);

    if (error) throw new Error(`Profile update failed: ${error.message}`);

    revalidatePath('/mis-inmuebles/perfil');
    revalidatePath('/mis-inmuebles', 'layout');
}

/**
 * Updates the user's avatar_url in the usuarios table.
 * Validates that the URL originates from our Supabase Storage domain.
 */
export async function updateAvatarUrl(url: string) {
    const supabase = createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Security: Fail-closed — reject if env var is missing or URL doesn't match
    const allowedOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!allowedOrigin) throw new Error('Server misconfiguration: Missing Supabase URL');
    if (!url.startsWith(allowedOrigin)) {
        throw new Error('Invalid avatar URL: must originate from application storage.');
    }

    const { error } = await supabase
        .from('usuarios')
        .update({ avatar_url: url })
        .eq('id', user.id);

    if (error) throw new Error(`Avatar update failed: ${error.message}`);

    revalidatePath('/mis-inmuebles/perfil');
    revalidatePath('/mis-inmuebles', 'layout');
}

/**
 * Sends a password reset email via Supabase Auth.
 * Security: Derives email from the authenticated session — never from client input.
 */
export async function sendPasswordResetEmail() {
    const supabase = createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !user.email) throw new Error('Not authenticated');

    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback`,
    });

    if (error) throw new Error(`Password reset failed: ${error.message}`);
}
