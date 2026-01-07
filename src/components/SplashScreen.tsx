import Image from 'next/image';

export default function SplashScreen() {
    return (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white">
            {/* Official Logo */}
            <div className="animate-fade-in">
                <Image
                    src="/logo-nido-io.png"
                    alt="Nido io - Tu hogar ideal, a un clic"
                    width={280}
                    height={280}
                    priority
                    className="object-contain"
                />
            </div>

            {/* Loading indicator */}
            <div className="mt-8 animate-fade-in" style={{ animationDelay: '0.6s' }}>
                <div className="w-16 h-1.5 bg-nido-100 rounded-full overflow-hidden">
                    <div className="h-full bg-nido-700 rounded-full animate-pulse" style={{ width: '60%' }} />
                </div>
            </div>
        </div>
    );
}

