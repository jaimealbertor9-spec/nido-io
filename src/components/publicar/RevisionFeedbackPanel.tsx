'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, Loader2, Image as ImageIcon } from 'lucide-react';
import { getPendingRevision, markRevisionAsCorrected } from '@/app/actions/revisionActions';

interface Revision {
    id: string;
    comentarios: string;
    imageUrls: string[];
}

export default function RevisionFeedbackPanel({ inmuebleId }: { inmuebleId: string }) {
    const [revision, setRevision] = useState<Revision | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (!inmuebleId) return;
        let isMounted = true;
        
        const fetchRevision = async () => {
            try {
                const data = await getPendingRevision(inmuebleId);
                if (isMounted) {
                    setRevision(data);
                }
            } catch (error) {
                console.error('Failed to load pending revision:', error);
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        fetchRevision();

        return () => { isMounted = false; };
    }, [inmuebleId]);

    const handleResubmit = async () => {
        setIsSubmitting(true);
        try {
            const res = await markRevisionAsCorrected(inmuebleId);
            if (!res.success) {
                alert(res.error || 'Hubo un error al re-enviar.');
                setIsSubmitting(false);
            } else {
                setRevision(null); // Hide panel on success
            }
        } catch (e) {
            alert('Error inesperado.');
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return null; // Or skeleton
    }

    if (!revision) {
        return null; // No pending revision
    }

    return (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-6 rounded-r-lg shadow-sm mb-6 flex flex-col items-start gap-4">
            <div className="w-full">
                <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="text-amber-600 w-6 h-6" />
                    <h3 className="text-lg font-bold text-amber-900">
                        Acción Requerida: Se solicitaron correcciones
                    </h3>
                </div>
                
                <div className="bg-white/60 p-4 rounded-md text-amber-900 whitespace-pre-wrap text-sm border border-amber-200/50 mb-4">
                    {revision.comentarios}
                </div>

                {revision.imageUrls && revision.imageUrls.length > 0 && (
                    <div className="mb-4">
                        <p className="text-xs font-semibold text-amber-800 mb-2 flex items-center gap-1">
                            <ImageIcon size={14} /> Imágenes adjuntas:
                        </p>
                        <div className="flex gap-3 flex-wrap">
                            {revision.imageUrls.map((url, idx) => (
                                <a 
                                    key={idx} 
                                    href={url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="block group relative overflow-hidden rounded-md border border-amber-200"
                                >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img 
                                        src={url} 
                                        alt={`Adjunto ${idx + 1}`} 
                                        className="w-24 h-24 object-cover group-hover:opacity-80 transition-opacity"
                                    />
                                </a>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className="w-full flex flex-col items-start md:items-end">
                <button
                    onClick={handleResubmit}
                    disabled={isSubmitting}
                    className="w-full md:w-auto px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-all shadow-sm shadow-amber-600/20 disabled:opacity-50"
                >
                    {isSubmitting ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Procesando...
                        </>
                    ) : (
                        <>
                            <CheckCircle className="w-5 h-5" />
                            He realizado los cambios, reenviar a revisión
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}
