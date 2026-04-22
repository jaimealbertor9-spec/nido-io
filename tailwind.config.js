/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
        './src/components/**/*.{js,ts,jsx,tsx,mdx}',
        './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    theme: {
        extend: {
            colors: {
                // Paleta Nido IO - Deep Navy Blue Theme
                nido: {
                    50: '#E6EAF0',
                    100: '#C9D3E0',
                    200: '#A3B4CC',
                    300: '#7D95B8',
                    400: '#5776A4',
                    500: '#315790',
                    600: '#1E4175',
                    700: '#0F2C59',  // PRIMARY
                    800: '#0A1F40',
                    900: '#051228',
                },
                accent: {
                    50: '#FFF8E6',
                    100: '#FFEFC2',
                    200: '#FFE299',
                    300: '#FFD166',
                    400: '#FFC233',
                    500: '#FFB300',
                    600: '#CC8F00',
                    700: '#996B00',
                },
                // ── Serenity Design System ──────────────────────
                'serenity': {
                    50: '#F8F9FA',
                    100: '#F1F3F5',
                    200: '#E9ECEF',
                    300: '#DEE2E6',
                    400: '#CED4DA',
                    500: '#ADB5BD',
                    600: '#868E96',
                    700: '#495057',
                    800: '#343A40',
                    900: '#212529',
                },
                'primary-container': '#E8DEF8',
                'on-primary-container': '#1D192B',
                'surface-tint': '#6750A4',
                'surface-container': '#F3EDF7',
                'on-surface': '#1D1B20',
                'on-surface-variant': '#49454F',
                'outline': '#79747E',
                'outline-variant': '#CAC4D0',
                'iris': '#B287FE',
                'rose-mist': '#FE97B9',
            },
            fontFamily: {
                sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
                display: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
                fredoka: ['Fredoka', 'system-ui', 'sans-serif'],
            },
            boxShadow: {
                'ambient': '0 20px 60px -5px rgba(45, 51, 53, 0.06)',
                'ambient-lg': '0 30px 80px -10px rgba(45, 51, 53, 0.1)',
                'glass': '0 8px 32px rgba(0, 0, 0, 0.04)',
                'pill': '0 2px 12px rgba(0, 0, 0, 0.08)',
            },
            borderRadius: {
                '4xl': '2rem',
            },
            animation: {
                'float': 'float 6s ease-in-out infinite',
                'shimmer': 'shimmer 2s linear infinite',
            },
            keyframes: {
                float: {
                    '0%, 100%': { transform: 'translateY(0)' },
                    '50%': { transform: 'translateY(-6px)' },
                },
                shimmer: {
                    '0%': { backgroundPosition: '-200% 0' },
                    '100%': { backgroundPosition: '200% 0' },
                },
            },
        },
    },
    plugins: [],
};
