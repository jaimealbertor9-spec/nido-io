import { createServerSupabaseClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import DashboardClient from './_components/DashboardClient';

/**
 * Server Component Page for Dashboard.
 * Fetches user data and properties on the server.
 * Passes everything as props to Client Component.
 */
export default async function DashboardPage() {
    const supabase = createServerSupabaseClient();

    // Get authenticated user (layout already validated, but double-check)
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        redirect('/publicar/auth?type=login');
    }

    // Fetch user profile
    const { data: profile } = await supabase
        .from('usuarios')
        .select('*')
        .eq('id', user.id)
        .single();

    // Fetch user's properties
    const { data: properties, error: propsError } = await supabase
        .from('inmuebles')
        .select('*, inmueble_imagenes(*)')
        .eq('propietario_id', user.id)
        .order('created_at', { ascending: false });

    if (propsError) {
        console.error('Error fetching properties:', propsError.message);
    }

    // Pass all data to Client Component
    return (
        <DashboardClient
            user={user}
            profile={profile}
            properties={properties || []}
        />
    );
}