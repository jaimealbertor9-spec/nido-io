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
