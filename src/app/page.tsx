'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function SplashPage() {
    const router = useRouter();

    useEffect(() => {
        const timer = setTimeout(() => {
            router.push('/bienvenidos');
        }, 3000);

        return () => clearTimeout(timer);
    }, [router]);

    return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white">
            {/* Nido Logo */}
            <Image
                src="/logo-nido-io.png"
                alt="Nido io"
                width={280}
                height={280}
                priority
                className="object-contain"
            />

            {/* Slogan */}
            <p className="mt-6 text-xl text-gray-600 font-medium font-fredoka">
                Tu hogar ideal, a un clic
            </p>

            {/* Loading indicator */}
            <div className="mt-8 w-12 h-12 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
        </div>
    );
}
