/** @type {import('next').NextConfig} */
const nextConfig = {
    // 1. Ignorar errores de TypeScript en el build
    typescript: {
        ignoreBuildErrors: true,
    },
    // 2. Ignorar errores de ESLint en el build
    eslint: {
        ignoreDuringBuilds: true,
    },
    // 3. Configuración de imágenes (necesaria para Supabase)
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: '**',
            },
        ],
    },
};

module.exports = nextConfig;