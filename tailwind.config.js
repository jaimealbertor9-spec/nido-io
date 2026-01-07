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
                    50: '#E6EAF0',   // Light Blueish Gray (backgrounds)
                    100: '#C9D3E0',
                    200: '#A3B4CC',
                    300: '#7D95B8',
                    400: '#5776A4',
                    500: '#315790',
                    600: '#1E4175',
                    700: '#0F2C59',  // PRIMARY - Deep Navy Blue
                    800: '#0A1F40',
                    900: '#051228',
                },
                accent: {
                    50: '#FFF8E6',
                    100: '#FFEFC2',
                    200: '#FFE299',
                    300: '#FFD166',
                    400: '#FFC233',
                    500: '#FFB300',  // Golden accent
                    600: '#CC8F00',
                    700: '#996B00',
                }
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
                fredoka: ['Fredoka', 'system-ui', 'sans-serif'],
            },
        },
    },
    plugins: [],
};
