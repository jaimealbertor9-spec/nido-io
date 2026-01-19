import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function MisInmueblesPage() {
    const cookieStore = await cookies();

    // CONEXIÓN MODERNA USANDO @supabase/ssr con manejo completo de cookies
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return cookieStore.get(name)?.value;
                },
                set(name: string, value: string, options: CookieOptions) {
                    try {
                        cookieStore.set({ name, value, ...options });
                    } catch (error) {
                        // Handle cookie setting in Server Component
                    }
                },
                remove(name: string, options: CookieOptions) {
                    try {
                        cookieStore.set({ name, value: '', ...options });
                    } catch (error) {
                        // Handle cookie removal in Server Component
                    }
                },
            },
        }
    );

    // 1. Verificar Sesión usando getUser() (NO getSession) - Crítico para SSR
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    console.log('🔍 [MisInmuebles] Auth check:', user?.email || 'No user', authError?.message || '');

    if (!user) {
        redirect('/bienvenidos');
    }

    // 2. Obtener el Inmueble del usuario
    const { data: inmuebles } = await supabase
        .from('inmuebles')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);

    const inmueble = inmuebles && inmuebles.length > 0 ? inmuebles[0] : null;

    // =====================================================================
    // 🧠 LÓGICA DE CEREBRO (SMART ROUTER)
    // =====================================================================

    // CASO A: Usuario Nuevo (Sin inmuebles) -> A elegir tipo
    if (!inmueble) {
        redirect('/publicar/tipo');
    }

    // CASO B: Está en Borrador -> Verificar qué le falta
    if (inmueble.estado === 'borrador') {
        // Validamos campos del Paso 1 para saber dónde enviarlo
        const paso1Completo =
            inmueble.barrio && inmueble.area_construida && inmueble.direccion;

        if (!paso1Completo) {
            redirect('/publicar/paso-1');
        } else {
            redirect('/publicar/paso-2');
        }
    }

    // CASO C: En Revisión o Publicado -> SE QUEDA AQUÍ (Renderizamos Dashboard)

    // =====================================================================
    // 🎨 DISEÑO UI
    // =====================================================================

    return (
        <div className="min-h-screen bg-gray-50 p-6 md:p-12 font-sans">
            <div className="max-w-5xl mx-auto space-y-8">

                {/* Header */}
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">
                            Hola, Usuario 👋
                        </h1>
                        <p className="text-gray-500 mt-1">
                            Aquí tienes el resumen de tu actividad inmobiliaria.
                        </p>
                    </div>
                </header>

                {/* Banner Principal */}
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 p-8 shadow-lg text-white">
                    <div className="relative z-10 max-w-lg">
                        <h2 className="text-2xl font-bold mb-2">
                            Estado de tu Propiedad
                        </h2>
                        <p className="text-indigo-100">
                            Gestiona el estado de tu publicación y mantente al día con las notificaciones.
                        </p>
                    </div>
                    {/* Decoración */}
                    <div className="absolute top-0 right-0 -mt-10 -mr-10 h-64 w-64 rounded-full bg-white opacity-10 blur-3xl"></div>
                </div>

                {/* Sección: Mis Inmuebles */}
                <section>
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xl font-bold text-gray-800">Mis Inmuebles</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {/* Tarjeta del Inmueble */}
                        <div className="group bg-white rounded-2xl p-5 shadow-sm hover:shadow-md transition-all border border-gray-100">

                            {/* Encabezado: Icono y Badge */}
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                                    </svg>
                                </div>

                                {inmueble.estado === 'en_revision' && (
                                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700 border border-yellow-200">
                                        En Revisión
                                    </span>
                                )}
                                {inmueble.estado === 'publicado' && (
                                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-200">
                                        Publicado
                                    </span>
                                )}
                            </div>

                            {/* Info */}
                            <h4 className="text-lg font-bold text-gray-900 mb-1">
                                {inmueble.tipo_inmueble || 'Propiedad'} en {inmueble.barrio || '...'}
                            </h4>
                            <p className="text-sm text-gray-500 mb-4 line-clamp-2">
                                {inmueble.descripcion || 'Sin descripción disponible.'}
                            </p>

                            {/* Precio */}
                            <div className="mb-6">
                                <p className="text-xs text-gray-400 uppercase font-semibold">Precio de Venta</p>
                                <p className="text-xl font-bold text-gray-900">
                                    {inmueble.precio
                                        ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(inmueble.precio)
                                        : '$ ---'}
                                </p>
                            </div>

                            {/* Footer */}
                            <div className="pt-4 border-t border-gray-100">
                                <button className="w-full bg-gray-50 text-gray-700 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-100 transition">
                                    Ver Detalle
                                </button>
                            </div>

                        </div>
                    </div>
                </section>

            </div>
        </div>
    );
}