import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

// Esta página actúa como DASHBOARD y como ENRUTADOR INTELIGENTE
export default async function MisInmueblesPage() {
    const cookieStore = cookies();
    const supabase = createServerComponentClient({ cookies: () => cookieStore });

    // 1. Verificar Sesión
    const {
        data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
        redirect('/bienvenidos');
    }

    // 2. Obtener el Inmueble del usuario (Traemos el más reciente si hay varios, o el único)
    const { data: inmuebles, error } = await supabase
        .from('inmuebles')
        .select('*')
        .eq('user_id', session.user.id)
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
        // Revisamos columnas críticas del PASO 1
        const paso1Completo =
            inmueble.barrio && inmueble.area_construida && inmueble.direccion;

        if (!paso1Completo) {
            // Sub-caso B1: Le falta data básica -> Ir a Paso 1
            redirect('/publicar/paso-1');
        } else {
            // Sub-caso B2: Tiene data básica pero sigue en borrador (Falta precio/fotos) -> Ir a Paso 2
            redirect('/publicar/paso-2');
        }
    }

    // CASO C: En Revisión o Publicado -> SE QUEDA AQUÍ (Renderizamos Dashboard)

    // =====================================================================
    // 🎨 DISEÑO UI (Estilo Coursue / Dashboard Moderno)
    // =====================================================================

    return (
        <div className="min-h-screen bg-gray-50 p-6 md:p-12 font-sans">
            <div className="max-w-5xl mx-auto space-y-8">

                {/* Header de Bienvenida */}
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">
                            Hola, Usuario 👋
                        </h1>
                        <p className="text-gray-500 mt-1">
                            Aquí tienes el resumen de tu actividad inmobiliaria.
                        </p>
                    </div>
                    {/* Botón Salir (Temporal si no está en el Navbar) */}
                    {/* <form action="/auth/signout" method="post">
            <button className="text-sm font-medium text-red-500 hover:text-red-700">
              Cerrar Sesión
            </button>
          </form> */}
                </header>

                {/* Banner Principal (Hero Card) */}
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 p-8 shadow-lg text-white">
                    <div className="relative z-10 max-w-lg">
                        <h2 className="text-2xl font-bold mb-2">
                            Gestiona tu propiedad profesionalmente
                        </h2>
                        <p className="text-indigo-100 mb-6">
                            Revisa el estado de tu publicación y mantén tus datos actualizados para vender más rápido.
                        </p>
                        {/* Si permites crear más de uno, aquí iría el botón. Por ahora oculto si es 1 a 1 */}
                        {/* <button className="bg-white text-indigo-600 px-5 py-2 rounded-full font-semibold text-sm hover:bg-gray-100 transition">
              + Publicar Nuevo
            </button> */}
                    </div>
                    {/* Decoración de fondo */}
                    <div className="absolute top-0 right-0 -mt-10 -mr-10 h-64 w-64 rounded-full bg-white opacity-10 blur-3xl"></div>
                </div>

                {/* Sección: Mis Inmuebles */}
                <section>
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xl font-bold text-gray-800">Mis Inmuebles</h3>
                        <span className="text-sm text-gray-400">Total: 1</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {/* Tarjeta del Inmueble */}
                        <div className="group bg-white rounded-2xl p-5 shadow-sm hover:shadow-md transition-all border border-gray-100">

                            {/* Encabezado de la tarjeta: Estado */}
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-2">
                                    <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                                        {/* Icono Casa Simple */}
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                                        </svg>
                                    </div>
                                </div>

                                {/* BADGES DE ESTADO */}
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

                            {/* Información Principal */}
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

                            {/* Footer de Acciones */}
                            <div className="pt-4 border-t border-gray-100 flex gap-3">
                                <button className="flex-1 bg-gray-50 text-gray-700 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-100 transition">
                                    Ver Detalle
                                </button>
                                {/* Botón extra si quisieras editar algo específico, por ahora oculto para en_revision */}
                            </div>

                        </div>
                    </div>
                </section>

            </div>
        </div>
    );
}