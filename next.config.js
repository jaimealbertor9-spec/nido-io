/** @type {import('next').NextConfig} */
const nextConfig = {
    // 1. Force build to ignore TypeScript errors
    typescript: {
        ignoreBuildErrors: true,
    },
    // 2. Force build to ignore ESLint errors
    eslint: {
        ignoreDuringBuilds: true,
    },

    // Keep your other configs here if you have them (like images)
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: '**',
            },
        ],
    },
};

export default nextConfig; // Use 'module.exports = nextConfig' if using .js extension