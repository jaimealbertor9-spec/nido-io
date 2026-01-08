/** @type {import('next').NextConfig} */
const nextConfig = {
    // Ignorar errores de TypeScript durante el build
    typescript: {
        ignoreBuildErrors: true,
    },
    // Ignorar errores de ESLint durante el build
    eslint: {
        ignoreDuringBuilds: true,
    },
    // Configuración de imágenes
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: '**',
            },
        ],
    },
};

// IMPORTANTE: Usar module.exports en lugar de export default
module.exports = nextConfig;