'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { uploadPropertyImage, deletePropertyImage, getPropertyImages } from '@/app/actions/uploadImages'
import Image from 'next/image'
import { Trash2, Loader2, Camera, ImagePlus, Star, Plus, X } from 'lucide-react'

// ═══════════════════════════════════════════════════════════════
// ANCHOR SLOTS — always visible, fixed positions
// ═══════════════════════════════════════════════════════════════
const ANCHOR_SLOTS = [
    { id: 'fachada', label: 'Fachada (Frente)', weight: 20 },
    { id: 'cocina', label: 'Cocina', weight: 20 },
    { id: 'sala', label: 'Sala de Estar', weight: 10 },
    { id: 'comedor', label: 'Comedor', weight: 10 },
]
// Anchor total = 60%

// ═══════════════════════════════════════════════════════════════
// LEGACY TAG MAPPING
// ═══════════════════════════════════════════════════════════════
const LEGACY_TAG_MAP: Record<string, string> = {
    'bano': 'bano_1',
    'habitacion': 'habitacion_1',
}

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════
interface Slot {
    id: string
    label: string
    weight: number
}

interface UploadedImage {
    url: string
    imageId?: string
}

interface StepFotosProps {
    inmuebleId: string
    habitaciones?: number
    banos?: number
    onNext: () => void
    onCategoriesChange?: (categories: string[]) => void
}

// ═══════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function StepFotos({ inmuebleId, habitaciones = 0, banos = 0, onNext, onCategoriesChange }: StepFotosProps) {
    const [uploadedPhotos, setUploadedPhotos] = useState<Record<string, UploadedImage>>({})
    const [uploadingSlot, setUploadingSlot] = useState<string | null>(null)
    const [deletingSlot, setDeletingSlot] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [uploadError, setUploadError] = useState<string | null>(null)

    // Extras state
    const [extraPhotos, setExtraPhotos] = useState<{ tag: string; url: string; imageId?: string }[]>([])
    const [nextExtraIndex, setNextExtraIndex] = useState(1)
    const [isUploadingExtra, setIsUploadingExtra] = useState(false)
    const extrasScrollRef = useRef<HTMLDivElement>(null)

    // ── Dynamic slot generation ──
    const numHabitaciones = Math.max(habitaciones, 1)
    const numBanos = Math.max(banos, 1)

    const allScoredSlots: Slot[] = useMemo(() => {
        const dynamicCount = numHabitaciones + numBanos
        const anchorTotalWeight = 60 // fixed
        const remainingWeight = 100 - anchorTotalWeight // 40
        const perDynamicWeight = dynamicCount > 0 ? remainingWeight / dynamicCount : 0

        const bedroomSlots: Slot[] = Array.from({ length: numHabitaciones }, (_, i) => ({
            id: `habitacion_${i + 1}`,
            label: numHabitaciones === 1 ? 'Habitación Principal' : `Habitación ${i + 1}`,
            weight: perDynamicWeight,
        }))

        const bathroomSlots: Slot[] = Array.from({ length: numBanos }, (_, i) => ({
            id: `bano_${i + 1}`,
            label: numBanos === 1 ? 'Baño Principal' : `Baño ${i + 1}`,
            weight: perDynamicWeight,
        }))

        return [
            ...ANCHOR_SLOTS.map(s => ({ ...s })),
            ...bedroomSlots,
            ...bathroomSlots,
        ]
    }, [numHabitaciones, numBanos])

    // All known slot IDs (for hydration matching)
    const allSlotIds = useMemo(() => {
        return allScoredSlots.map(s => s.id)
    }, [allScoredSlots])

    // ═══════════════════════════════════════════════════════════════
    // QUALITY SCORE (0-100%)
    // ═══════════════════════════════════════════════════════════════
    const qualityScore = useMemo(() => {
        let score = 0
        for (const slot of allScoredSlots) {
            if (uploadedPhotos[slot.id]) {
                score += slot.weight
            }
        }
        return Math.round(Math.min(score, 100))
    }, [allScoredSlots, uploadedPhotos])

    const qualityColor = qualityScore >= 80
        ? 'bg-green-500' : qualityScore >= 50
            ? 'bg-amber-500' : 'bg-red-400'

    const qualityTextColor = qualityScore >= 80
        ? 'text-green-700' : qualityScore >= 50
            ? 'text-amber-700' : 'text-red-600'

    const qualityLabel = qualityScore >= 80
        ? '¡Excelente!' : qualityScore >= 50
            ? 'Buen avance' : 'Incompleto'

    // ═══════════════════════════════════════════════════════════════
    // HYDRATION: Load existing images on mount
    // ═══════════════════════════════════════════════════════════════
    useEffect(() => {
        const loadExistingImages = async () => {
            if (!inmuebleId) {
                setIsLoading(false)
                return
            }

            try {
                const existingImages = await getPropertyImages(inmuebleId)

                const hydrated: Record<string, UploadedImage> = {}
                const hydratedExtras: { tag: string; url: string; imageId?: string }[] = []
                let maxExtraIndex = 0

                for (const img of existingImages) {
                    let dbCategory = (img.category || '').toLowerCase().trim()

                    // Apply legacy tag mapping
                    if (LEGACY_TAG_MAP[dbCategory]) {
                        dbCategory = LEGACY_TAG_MAP[dbCategory]
                    }

                    // Check if it's an extra
                    const extraMatch = dbCategory.match(/^extra_(\d+)$/)
                    if (extraMatch) {
                        const idx = parseInt(extraMatch[1], 10)
                        if (idx > maxExtraIndex) maxExtraIndex = idx
                        hydratedExtras.push({
                            tag: dbCategory,
                            url: img.url,
                            imageId: img.id,
                        })
                        continue
                    }

                    // Match against scored slots
                    if (allSlotIds.includes(dbCategory) && img.url) {
                        hydrated[dbCategory] = {
                            url: img.url,
                            imageId: img.id,
                        }
                    }
                }

                setUploadedPhotos(hydrated)
                setExtraPhotos(hydratedExtras)
                setNextExtraIndex(maxExtraIndex + 1)
            } catch (err) {
                console.error('[StepFotos] Error loading existing images:', err)
            } finally {
                setIsLoading(false)
            }
        }

        loadExistingImages()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [inmuebleId])

    // Notify parent when quality hits 100%
    useEffect(() => {
        if (!isLoading && qualityScore >= 100) {
            onNext()
        }
    }, [isLoading, qualityScore, onNext])

    // Report uploaded categories to parent for payment gatekeeper
    useEffect(() => {
        onCategoriesChange?.(Object.keys(uploadedPhotos))
    }, [uploadedPhotos, onCategoriesChange])

    // Auto-dismiss upload error after 5s
    useEffect(() => {
        if (uploadError) {
            const timer = setTimeout(() => setUploadError(null), 5000)
            return () => clearTimeout(timer)
        }
    }, [uploadError])

    // ═══════════════════════════════════════════════════════════════
    // UPLOAD HANDLER (Scored Slots)
    // ═══════════════════════════════════════════════════════════════
    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, category: string) => {
        if (!e.target.files?.[0]) return
        setUploadingSlot(category)
        setUploadError(null)

        try {
            const formData = new FormData()
            formData.append('file', e.target.files[0])
            formData.append('inmuebleId', inmuebleId)
            formData.append('category', category)

            const result = await uploadPropertyImage(formData)

            if (result.success) {
                setUploadedPhotos(prev => ({
                    ...prev,
                    [category]: { url: result.url!, imageId: result.imageId },
                }))
            } else {
                console.error('[StepFotos] Upload failed:', result.error)
                setUploadError(`Error al subir foto: ${result.error}`)
            }
        } catch (err: any) {
            console.error('[StepFotos] Upload exception:', err)
            setUploadError(`Error inesperado al subir foto: ${err.message || 'Intenta de nuevo'}`)
        } finally {
            setUploadingSlot(null)
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // DELETE HANDLER (Scored Slots)
    // ═══════════════════════════════════════════════════════════════
    const handleRemoveImage = async (slotId: string, e: React.MouseEvent) => {
        e.stopPropagation()
        e.preventDefault()

        const image = uploadedPhotos[slotId]
        if (!image) return

        setDeletingSlot(slotId)

        try {
            if (image.imageId) {
                await deletePropertyImage(image.imageId)
            }
            setUploadedPhotos(prev => {
                const updated = { ...prev }
                delete updated[slotId]
                return updated
            })
        } catch (err) {
            console.error('Error removing image:', err)
            setUploadError('Error al eliminar la imagen')
        } finally {
            setDeletingSlot(null)
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // EXTRAS: Upload & Delete
    // ═══════════════════════════════════════════════════════════════
    const handleUploadExtra = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.[0]) return
        setIsUploadingExtra(true)
        setUploadError(null)

        const tag = `extra_${nextExtraIndex}`

        try {
            const formData = new FormData()
            formData.append('file', e.target.files[0])
            formData.append('inmuebleId', inmuebleId)
            formData.append('category', tag)

            const result = await uploadPropertyImage(formData)

            if (result.success) {
                setExtraPhotos(prev => [...prev, { tag, url: result.url!, imageId: result.imageId }])
                setNextExtraIndex(prev => prev + 1)

                // Scroll to end after adding
                setTimeout(() => {
                    extrasScrollRef.current?.scrollTo({
                        left: extrasScrollRef.current.scrollWidth,
                        behavior: 'smooth',
                    })
                }, 100)
            } else {
                console.error('[StepFotos] Extra upload failed:', result.error)
                setUploadError(`Error al subir foto extra: ${result.error}`)
            }
        } catch (err: any) {
            console.error('[StepFotos] Extra upload exception:', err)
            setUploadError(`Error inesperado: ${err.message || 'Intenta de nuevo'}`)
        } finally {
            setIsUploadingExtra(false)
        }
    }

    const handleRemoveExtra = async (tag: string, imageId?: string, e?: React.MouseEvent) => {
        e?.stopPropagation()
        e?.preventDefault()
        setDeletingSlot(tag)

        try {
            if (imageId) {
                await deletePropertyImage(imageId)
            }
            setExtraPhotos(prev => prev.filter(p => p.tag !== tag))
        } catch (err) {
            console.error('Error removing extra:', err)
            setUploadError('Error al eliminar la foto extra')
        } finally {
            setDeletingSlot(null)
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // RENDER: Slot Card
    // ═══════════════════════════════════════════════════════════════
    const renderSlotCard = (slot: { id: string; label: string }) => {
        const image = uploadedPhotos[slot.id]
        const isUploading = uploadingSlot === slot.id
        const isDeleting = deletingSlot === slot.id

        return (
            <div key={slot.id} className="group relative aspect-[4/3] rounded-xl overflow-hidden border-2 border-gray-200 bg-white shadow-sm transition-all hover:shadow-md">
                {image ? (
                    <>
                        <Image src={image.url} alt={slot.label} fill className="object-cover" />

                        {/* Gradient + label */}
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 pt-8">
                            <p className="text-white text-xs font-medium text-center truncate">{slot.label}</p>
                        </div>

                        {/* Green check */}
                        <div className="absolute top-2 left-2 bg-green-500 text-white rounded-full p-1 w-6 h-6 flex items-center justify-center text-xs shadow">
                            ✓
                        </div>

                        {/* Delete button */}
                        <button
                            type="button"
                            onClick={(e) => handleRemoveImage(slot.id, e)}
                            disabled={isDeleting}
                            className="absolute top-2 right-2 z-10 bg-red-500 hover:bg-red-600 text-white rounded-full p-1.5 w-8 h-8 flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Eliminar imagen"
                        >
                            {isDeleting ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Trash2 className="w-4 h-4" />
                            )}
                        </button>
                    </>
                ) : (
                    <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer border-2 border-dashed border-gray-300 rounded-xl hover:border-blue-400 hover:bg-blue-50/50 transition-colors">
                        {isUploading ? (
                            <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-2" />
                        ) : (
                            <Camera className="w-8 h-8 text-gray-400 mb-2" />
                        )}
                        <span className="text-sm font-medium text-gray-600 text-center px-2">{slot.label}</span>
                        <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            disabled={isUploading}
                            onChange={(e) => handleUpload(e, slot.id)}
                        />
                    </label>
                )}
            </div>
        )
    }

    // ═══════════════════════════════════════════════════════════════
    // LOADING STATE
    // ═══════════════════════════════════════════════════════════════
    if (isLoading) {
        return (
            <div className="space-y-8">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Fotografías del Inmueble</h2>
                    <p className="text-gray-500">Cargando imágenes existentes...</p>
                </div>
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                </div>
            </div>
        )
    }

    // ═══════════════════════════════════════════════════════════════
    // MAIN RENDER
    // ═══════════════════════════════════════════════════════════════
    return (
        <div className="space-y-8">
            {/* ── Header ── */}
            <div>
                <h2 className="text-2xl font-bold text-gray-900">Fotografías del Inmueble</h2>
                <p className="text-gray-500">
                    Sube fotos de cada espacio para mejorar tu anuncio. Todas son opcionales.
                </p>
            </div>

            {/* ── Error Alert ── */}
            {uploadError && (
                <div className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    <span>{uploadError}</span>
                    <button
                        type="button"
                        onClick={() => setUploadError(null)}
                        className="ml-3 text-red-500 hover:text-red-700"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* ── Quality Score Bar ── */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <Star className="w-5 h-5 text-amber-500" />
                        <span className="text-sm font-bold text-gray-800">Puntaje de Calidad del Anuncio</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full text-white ${qualityColor}`}>
                            {qualityScore}%
                        </span>
                        <span className={`text-xs font-medium ${qualityTextColor}`}>{qualityLabel}</span>
                    </div>
                </div>

                <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                    <div
                        className={`${qualityColor} h-full transition-all duration-700 ease-out rounded-full`}
                        style={{ width: `${qualityScore}%` }}
                    />
                </div>

                <p className="text-xs text-gray-500 mt-3 flex items-center gap-1.5">
                    <ImagePlus className="w-3.5 h-3.5" />
                    Inmuebles con fotos completas reciben <strong className="text-gray-700">3x más visitas</strong>
                </p>
            </div>

            {/* ── Scored Slots Grid ── */}
            <div>
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">
                    Espacios del Inmueble
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {allScoredSlots.map(slot => renderSlotCard(slot))}
                </div>
            </div>

            {/* ── Unlimited Extras Carousel ── */}
            <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-1">
                    Otras áreas y amenidades
                </h3>
                <p className="text-xs text-gray-400 mb-4">
                    Garaje, patio, piscina, balcón, zonas comunes… agrega todas las que quieras.
                </p>

                <div
                    ref={extrasScrollRef}
                    className="flex gap-3 overflow-x-auto pb-3 scrollbar-thin scrollbar-thumb-gray-300"
                    style={{ scrollbarWidth: 'thin' }}
                >
                    {/* Existing extras */}
                    {extraPhotos.map((extra) => {
                        const isDeleting = deletingSlot === extra.tag
                        return (
                            <div
                                key={extra.tag}
                                className="group relative flex-shrink-0 w-32 h-32 rounded-xl overflow-hidden border-2 border-gray-200 shadow-sm"
                            >
                                <Image src={extra.url} alt={extra.tag} fill className="object-cover" />

                                {/* Label */}
                                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2 pt-6">
                                    <p className="text-white text-[10px] font-medium text-center">
                                        Extra {extra.tag.replace('extra_', '')}
                                    </p>
                                </div>

                                {/* Delete */}
                                <button
                                    type="button"
                                    onClick={(e) => handleRemoveExtra(extra.tag, extra.imageId, e)}
                                    disabled={isDeleting}
                                    className="absolute top-1.5 right-1.5 z-10 bg-red-500 hover:bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 disabled:opacity-50"
                                >
                                    {isDeleting ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                        <Trash2 className="w-3 h-3" />
                                    )}
                                </button>
                            </div>
                        )
                    })}

                    {/* Add Extra Button */}
                    <label className="flex-shrink-0 w-32 h-32 flex flex-col items-center justify-center cursor-pointer border-2 border-dashed border-gray-300 rounded-xl hover:border-blue-400 hover:bg-blue-50/50 transition-colors">
                        {isUploadingExtra ? (
                            <Loader2 className="w-6 h-6 text-blue-500 animate-spin mb-1" />
                        ) : (
                            <Plus className="w-6 h-6 text-gray-400 mb-1" />
                        )}
                        <span className="text-xs font-medium text-gray-500">
                            {isUploadingExtra ? 'Subiendo...' : 'Agregar Foto'}
                        </span>
                        <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            disabled={isUploadingExtra}
                            onChange={handleUploadExtra}
                        />
                    </label>
                </div>

                {extraPhotos.length > 0 && (
                    <p className="text-xs text-gray-400 mt-2">
                        ✨ {extraPhotos.length} foto{extraPhotos.length !== 1 ? 's' : ''} extra{extraPhotos.length !== 1 ? 's' : ''} — valor adicional para tu anuncio
                    </p>
                )}
            </div>
        </div>
    )
}