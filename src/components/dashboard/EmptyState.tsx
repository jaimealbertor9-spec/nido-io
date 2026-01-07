import Link from 'next/link';

export default function EmptyState() {
    return (
        <div className="flex flex-col items-center justify-center py-16 px-4 animate-fade-in">
            {/* Illustration */}
            <div className="relative mb-8">
                <div className="w-32 h-32 bg-gradient-to-br from-nido-100 to-nido-200 rounded-full flex items-center justify-center">
                    <span className="text-6xl">🏠</span>
                </div>
                <div className="absolute -bottom-2 -right-2 w-12 h-12 bg-accent-100 rounded-full flex items-center justify-center border-4 border-white">
                    <span className="text-2xl">✨</span>
                </div>
            </div>

            {/* Message */}
            <h2 className="text-2xl font-bold text-gray-800 mb-2 text-center">
                ¡Aún no tienes propiedades!
            </h2>
            <p className="text-gray-500 text-center max-w-md mb-8">
                Publica tu primer inmueble y comienza a recibir interesados en minutos.
            </p>

            {/* CTA Button */}
            <Link
                href="/publicar"
                className="btn-primary text-lg px-8 py-4 inline-flex items-center gap-2 shadow-lg shadow-nido-200 hover:shadow-xl transition-shadow"
            >
                <span>📤</span>
                Publicar mi primer inmueble
            </Link>
        </div>
    );
}
