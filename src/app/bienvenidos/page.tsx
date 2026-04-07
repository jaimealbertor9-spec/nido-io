'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Fredoka } from 'next/font/google';

// Import Fredoka font for consistent typography
const fredoka = Fredoka({
    subsets: ['latin'],
    weight: ['300', '400', '500', '600', '700'],
});

export default function BienvenidosPage() {
    const router = useRouter();

    const handleBuscar = () => {
        router.push('/buscar');
    };

    const handlePublicar = () => {
        // Route directly to Auth page (Dashboard-Centric architecture)
        router.push('/publicar/auth?intent=propietario');
    };

    return (
        <div className={`${fredoka.className} relative min-h-screen flex flex-col items-center overflow-x-hidden`}>

            {/* --- 1. IMAGEN DE FONDO --- */}
            <div className="fixed inset-0 z-0">
                <img
                    src="/Bienvenido a Nido (8).png"
                    alt="Fondo Nido"
                    className="w-full h-full object-cover blur-[2px] scale-[1.02]"
                />
                {/* Capa oscura suave para que el texto blanco resalte */}
                <div className="absolute inset-0 bg-black/20" />
            </div>

            {/* --- LOGO TOP-RIGHT --- */}
            <img
                src="/Logo solo Nido.png"
                alt="Nido Logo"
                className="fixed top-4 right-4 md:top-6 md:right-6 z-20 w-10 h-10 md:w-16 md:h-16 object-contain drop-shadow-lg"
            />

            {/* --- 2. CONTENIDO PRINCIPAL --- */}
            <div className="relative z-10 flex-grow flex flex-col items-center justify-center text-center text-white w-full px-6 md:px-8 pt-16 md:pt-20 pb-40 md:pb-[180px]">

                {/* Título responsivo */}
                <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-[78px] font-bold leading-tight drop-shadow-md max-w-4xl">
                    Bienvenido a Nido
                </h1>

                {/* Subtítulo responsivo */}
                <p className="text-lg sm:text-xl md:text-2xl lg:text-[29px] font-medium mt-3 md:mt-4 drop-shadow-sm">
                    Tu Nido, tu hogar a un clic.
                </p>

                {/* --- 3. BOTONES --- */}
                <div className="mt-12 md:mt-[90px] flex flex-col md:flex-row items-center justify-center gap-4 md:gap-[60px] w-full max-w-3xl px-4">

                    {/* Botón 1: Buscar */}
                    <button
                        onClick={handleBuscar}
                        className="w-full md:w-auto bg-white/20 hover:bg-white/30 backdrop-blur-md text-white py-3.5 md:py-4 px-8 md:px-12 rounded-2xl text-lg md:text-2xl font-semibold transition-all text-center min-w-0 md:min-w-[200px] border border-white/30 shadow-lg hover:scale-105 active:scale-95"
                    >
                        Buscar
                    </button>

                    {/* Botón 2: Publicar */}
                    <button
                        onClick={handlePublicar}
                        className="w-full md:w-auto bg-white/20 hover:bg-white/30 backdrop-blur-md text-white py-3.5 md:py-4 px-8 md:px-12 rounded-2xl text-lg md:text-2xl font-semibold transition-all text-center min-w-0 md:min-w-[200px] border border-white/30 shadow-lg hover:scale-105 active:scale-95"
                    >
                        Publicar
                    </button>
                </div>

            </div>

            {/* --- 4. BARRA INFERIOR FLOTANTE CON ICONOS --- */}
            <div className="fixed bottom-4 md:bottom-8 left-1/2 -translate-x-1/2 z-20 w-[92%] md:w-[60%] py-4 md:py-6 bg-white/[0.17] backdrop-blur-md rounded-2xl md:rounded-[22px] border border-white/20 shadow-lg">

                {/* Contenedor de iconos alineados y distribuidos */}
                <div className="flex flex-wrap items-center justify-center gap-5 md:gap-16 px-4">

                    <div className="flex flex-col items-center gap-2 group cursor-pointer">
                        <img src="/casa-moderna.png" alt="Casa" className="w-10 h-10 object-contain opacity-90 group-hover:opacity-100 group-hover:scale-110 transition-all" />
                    </div>

                    <div className="flex flex-col items-center gap-2 group cursor-pointer">
                        <img src="/sala-de-estar.png" alt="Sala" className="w-10 h-10 object-contain opacity-90 group-hover:opacity-100 group-hover:scale-110 transition-all" />
                    </div>

                    <div className="flex flex-col items-center gap-2 group cursor-pointer">
                        <img src="/cocina.png" alt="Cocina" className="w-10 h-10 object-contain opacity-90 group-hover:opacity-100 group-hover:scale-110 transition-all" />
                    </div>

                    <div className="flex flex-col items-center gap-2 group cursor-pointer">
                        <img src="/cama-matrimonial.png" alt="Habitación" className="w-10 h-10 object-contain opacity-90 group-hover:opacity-100 group-hover:scale-110 transition-all" />
                    </div>

                    <div className="flex flex-col items-center gap-2 group cursor-pointer">
                        <img src="/ducha.png" alt="Baño" className="w-10 h-10 object-contain opacity-90 group-hover:opacity-100 group-hover:scale-110 transition-all" />
                    </div>

                    <div className="flex flex-col items-center gap-2 group cursor-pointer">
                        <img src="/carro.png" alt="Parqueadero" className="w-10 h-10 object-contain opacity-90 group-hover:opacity-100 group-hover:scale-110 transition-all" />
                    </div>

                </div>
            </div>

        </div>
    );
}