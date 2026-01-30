'use client';

import { useParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Inter } from 'next/font/google';
import { FileText, ImageIcon, Check } from 'lucide-react';

const inter = Inter({
    subsets: ['latin'],
    weight: ['400', '500', '600', '700']
});

// New 2-Step Structure
const WIZARD_STEPS = [
    { id: 'paso-1', label: 'Información Básica', icon: FileText, path: 'paso-1' },
    { id: 'paso-2', label: 'Detalles y Multimedia', icon: ImageIcon, path: 'paso-2' },
];

export default function WizardLayout({ children }: { children: React.ReactNode }) {
    const params = useParams();
    const pathname = usePathname();
    const propertyId = params.id as string;

    // Determine current step based on pathname
    const getCurrentStepIndex = () => {
        if (pathname?.includes('/paso-2')) return 1;
        if (pathname?.includes('/paso-1')) return 0;
        // Legacy routes mapping (for backwards compatibility during transition)
        if (pathname?.includes('/ubicacion') || pathname?.includes('/caracteristicas')) return 0;
        if (pathname?.includes('/multimedia') || pathname?.includes('/descripcion')) return 1;
        return 0;
    };

    const currentStepIndex = getCurrentStepIndex();

    return (
        <div className={`${inter.className} min-h-screen bg-slate-50`}>
            <div className="flex">

                {/* ═══════════════════════════════════════════════════════════════ */}
                {/* SIDEBAR (Desktop) */}
                {/* ═══════════════════════════════════════════════════════════════ */}
                <aside className="hidden lg:flex w-64 min-h-screen flex-col bg-white border-r border-slate-200">
                    {/* Logo */}
                    <div className="p-5 border-b border-slate-200">
                        <Link href="/" className="flex items-center gap-2">
                            <Image
                                src="/Logo solo Nido.png"
                                alt="Nido"
                                width={36}
                                height={36}
                                className="rounded-lg"
                            />
                            <span className="text-lg font-semibold text-slate-900">Nido</span>
                        </Link>
                    </div>

                    {/* Steps Navigation */}
                    <nav className="flex-1 p-4">
                        <p className="text-xs font-medium text-slate-400 uppercase tracking-wide px-3 mb-4">
                            Nueva publicación
                        </p>

                        <div className="space-y-1">
                            {WIZARD_STEPS.map((step, index) => {
                                const Icon = step.icon;
                                const isActive = currentStepIndex === index;
                                const isCompleted = currentStepIndex > index;
                                const stepUrl = `/publicar/crear/${propertyId}/${step.path}`;

                                return (
                                    <Link
                                        key={step.id}
                                        href={stepUrl}
                                        className={`
                                            flex items-center gap-3 px-3 py-3 rounded-md
                                            transition-all duration-150
                                            ${isActive
                                                ? 'bg-blue-600 text-white'
                                                : isCompleted
                                                    ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                                    : 'text-slate-500 hover:bg-slate-50'
                                            }
                                        `}
                                    >
                                        <div className={`
                                            w-7 h-7 rounded-md flex items-center justify-center text-sm font-medium
                                            ${isActive
                                                ? 'bg-white/20'
                                                : isCompleted
                                                    ? 'bg-green-100 text-green-700'
                                                    : 'bg-slate-200 text-slate-500'
                                            }
                                        `}>
                                            {isCompleted ? (
                                                <Check size={14} strokeWidth={2.5} />
                                            ) : (
                                                <span>{index + 1}</span>
                                            )}
                                        </div>
                                        <span className="font-medium text-sm">
                                            {step.label}
                                        </span>
                                    </Link>
                                );
                            })}
                        </div>

                        {/* Progress indicator */}
                        <div className="mt-8 px-3">
                            <div className="flex items-center gap-2 text-xs text-slate-400">
                                <div className="flex-1 h-1 bg-slate-200 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-blue-600 transition-all duration-300"
                                        style={{ width: `${((currentStepIndex + 1) / WIZARD_STEPS.length) * 100}%` }}
                                    />
                                </div>
                                <span>{currentStepIndex + 1}/{WIZARD_STEPS.length}</span>
                            </div>
                        </div>
                    </nav>

                    {/* Footer - Removed "Cancelar y salir" to prevent session errors */}
                    {/* Users should use the "Guardar y Volver" button on each step instead */}
                </aside>

                {/* ═══════════════════════════════════════════════════════════════ */}
                {/* MAIN CONTENT */}
                {/* ═══════════════════════════════════════════════════════════════ */}
                <main className="flex-1 min-h-screen">
                    {/* Mobile Header */}
                    <header className="lg:hidden sticky top-0 z-50 bg-white border-b border-slate-200 px-4 py-3">
                        <div className="flex items-center justify-between mb-3">
                            <Link href="/" className="flex items-center gap-2">
                                <Image
                                    src="/Logo solo Nido.png"
                                    alt="Nido"
                                    width={28}
                                    height={28}
                                    className="rounded-md"
                                />
                                <span className="font-semibold text-slate-900">Nido</span>
                            </Link>
                            <span className="text-sm text-slate-500">
                                Paso {currentStepIndex + 1} de {WIZARD_STEPS.length}
                            </span>
                        </div>

                        {/* Progress Bar (2 segments) */}
                        <div className="flex gap-2">
                            {WIZARD_STEPS.map((step, index) => (
                                <div
                                    key={step.id}
                                    className={`
                                        flex-1 h-1 rounded-full transition-colors
                                        ${index <= currentStepIndex
                                            ? 'bg-blue-600'
                                            : 'bg-slate-200'
                                        }
                                    `}
                                />
                            ))}
                        </div>

                        {/* Step Labels (Mobile) */}
                        <div className="flex justify-between mt-2">
                            {WIZARD_STEPS.map((step, index) => (
                                <span
                                    key={step.id}
                                    className={`text-xs ${index === currentStepIndex
                                        ? 'text-blue-600 font-medium'
                                        : 'text-slate-400'
                                        }`}
                                >
                                    {step.label}
                                </span>
                            ))}
                        </div>
                    </header>

                    {/* Page Content */}
                    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
