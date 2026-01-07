'use client'

import { useState, useEffect } from 'react'
import { uploadPropertyImage, deletePropertyImage, getPropertyImages } from '@/app/actions/uploadImages'
import Image from 'next/image'
import { Trash2, Loader2 } from 'lucide-react'

// LISTA DE FOTOS OBLIGATORIAS (EN ORDEN)
const REQUIRED_PHOTOS = [
    { id: 'fachada', label: 'Fachada (Frente)' },
    { id: 'sala', label: 'Sala de Estar' },
    { id: 'comedor', label: 'Comedor' },
    { id: 'cocina', label: 'Cocina' },
    { id: 'bano', label: 'Baño Principal' },
    { id: 'habitacion', label: 'Habitación Principal' }
]

// LISTA DE FOTOS OPCIONALES
const OPTIONAL_PHOTOS = [
    { id: 'garaje', label: 'Garaje' },
    { id: 'patio', label: 'Patio / Balcón' },
    { id: 'otros', label: 'Zonas Comunes (Piscina, etc)' }
]

interface UploadedImage {
    url: string;
    imageId?: string;
}

export default function StepFotos({ inmuebleId, onNext }: { inmuebleId: string, onNext: () => void }) {
    const [uploadedPhotos, setUploadedPhotos] = useState<Record<string, UploadedImage>>({})
    const [uploading, setUploading] = useState(false)
    const [deletingSlot, setDeletingSlot] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    // ═══════════════════════════════════════════════════════════════
    // FETCH EXISTING IMAGES ON MOUNT (Hydration)
    // ═══════════════════════════════════════════════════════════════
    useEffect(() => {
        const loadExistingImages = async () => {
            if (!inmuebleId) {
                setIsLoading(false)
                return
            }

            try {
                const existingImages = await getPropertyImages(inmuebleId)

                // Convert array to Record<category, UploadedImage>
                // Use case-insensitive matching for category comparison
                const hydrated: Record<string, UploadedImage> = {}
                for (const img of existingImages) {
                    // Get category from DB (may be stored with different casing)
                    const dbCategory = (img.category || '').toLowerCase().trim()

                    // Find matching UI category using case-insensitive comparison
                    const allCategories = [...REQUIRED_PHOTOS, ...OPTIONAL_PHOTOS]
                    const matchedCategory = allCategories.find(p => p.id.toLowerCase() === dbCategory)

                    if (matchedCategory && img.url) {
                        hydrated[matchedCategory.id] = {
                            url: img.url,
                            imageId: img.id
                        }
                    }
                }

                setUploadedPhotos(hydrated)
            } catch (err) {
                console.error('[StepFotos] Error loading existing images:', err)
            } finally {
                setIsLoading(false)
            }
        }

        loadExistingImages()
    }, [inmuebleId])

    // Helper function for case-insensitive category lookup
    const hasUploadedPhoto = (categoryId: string): boolean => {
        return !!uploadedPhotos[categoryId]
    }

    // Calculate which required photos are still needed
    const uploadedRequiredIds = REQUIRED_PHOTOS.filter(p => hasUploadedPhoto(p.id)).map(p => p.id)
    const nextRequiredPhoto = REQUIRED_PHOTOS.find(p => !hasUploadedPhoto(p.id))
    const isFinishedRequired = uploadedRequiredIds.length >= REQUIRED_PHOTOS.length

    // Notify parent when all required photos are done (but only after initial load)
    useEffect(() => {
        if (!isLoading && isFinishedRequired) {
            onNext()
        }
    }, [isLoading, isFinishedRequired, onNext])

    // Progress based on how many required photos are uploaded
    const progress = (uploadedRequiredIds.length / REQUIRED_PHOTOS.length) * 100

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, category: string) => {
        if (!e.target.files?.[0]) return
        setUploading(true)

        const formData = new FormData()
        formData.append('file', e.target.files[0])
        formData.append('inmuebleId', inmuebleId)
        formData.append('category', category)

        const result = await uploadPropertyImage(formData)

        if (result.success) {
            setUploadedPhotos(prev => ({
                ...prev,
                [category]: { url: result.url!, imageId: result.imageId }
            }))
        } else {
            alert('Error: ' + result.error)
        }
        setUploading(false)
    }

    const handleRemoveImage = async (slotId: string, e: React.MouseEvent) => {
        // Prevent triggering any parent click handlers
        e.stopPropagation()
        e.preventDefault()

        const image = uploadedPhotos[slotId]
        if (!image) return

        setDeletingSlot(slotId)

        try {
            // If we have an imageId, delete from database/storage
            if (image.imageId) {
                await deletePropertyImage(image.imageId)
            }

            // Clear from local state - this will re-render the upload input
            setUploadedPhotos(prev => {
                const updated = { ...prev }
                delete updated[slotId]
                return updated
            })
        } catch (err) {
            console.error('Error removing image:', err)
            alert('Error al eliminar la imagen')
        } finally {
            setDeletingSlot(null)
        }
    }

    // Show loading state while fetching existing images
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

    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-2xl font-bold text-gray-900">Fotografías del Inmueble</h2>
                <p className="text-gray-500">Sube las fotos en orden para completar tu anuncio.</p>
            </div>

            {/* Barra de Progreso */}
            <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                <div
                    className="bg-green-500 h-full transition-all duration-500 ease-out"
                    style={{ width: `${Math.min(progress, 100)}%` }}
                ></div>
            </div>

            {/* ZONA DE CARGA ACTIVA */}
            <div className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors ${isFinishedRequired ? 'border-green-300 bg-green-50' : 'border-blue-300 bg-blue-50'}`}>
                {!isFinishedRequired && nextRequiredPhoto ? (
                    <div>
                        <p className="text-sm font-semibold text-blue-600 uppercase tracking-wide mb-2">Siguiente Foto Requerida</p>
                        <h3 className="text-3xl font-extrabold text-gray-800 mb-6">{nextRequiredPhoto.label}</h3>

                        <label className={`inline-flex items-center gap-2 px-8 py-4 rounded-full text-white font-bold text-lg cursor-pointer transition shadow-lg ${uploading ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700 hover:scale-105'}`}>
                            {uploading ? 'Subiendo...' : '📸 Tomar / Subir Foto'}
                            <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={(e) => handleUpload(e, nextRequiredPhoto.id)} />
                        </label>
                    </div>
                ) : (
                    <div>
                        <h3 className="text-2xl font-bold text-green-700 mb-2">✅ ¡Fotos Obligatorias Listas!</h3>
                        <p className="text-gray-600 mb-6">Puedes agregar fotos extra si quieres, o continuar al siguiente paso.</p>

                        <div className="flex flex-wrap justify-center gap-3">
                            {OPTIONAL_PHOTOS.filter(opt => !uploadedPhotos[opt.id]).map(opt => (
                                <label key={opt.id} className="cursor-pointer bg-white border border-gray-200 shadow-sm px-4 py-2 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700 flex items-center gap-2">
                                    <span>+</span> {opt.label}
                                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleUpload(e, opt.id)} />
                                </label>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* GALERÍA DE MINIATURAS CON BOTÓN ELIMINAR */}
            {Object.keys(uploadedPhotos).length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
                    {Object.entries(uploadedPhotos).map(([catId, imageData]) => {
                        const label = [...REQUIRED_PHOTOS, ...OPTIONAL_PHOTOS].find(p => p.id === catId)?.label || catId
                        const isDeleting = deletingSlot === catId

                        return (
                            <div key={catId} className="group relative aspect-square rounded-xl overflow-hidden border border-gray-200 shadow-sm">
                                {imageData.url ? (
                                    <Image src={imageData.url} alt={label} fill className="object-cover" />
                                ) : (
                                    <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                                        <span className="text-gray-400">Sin imagen</span>
                                    </div>
                                )}

                                {/* Gradient overlay with label */}
                                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 pt-8">
                                    <p className="text-white text-xs font-medium text-center truncate">{label}</p>
                                </div>

                                {/* Delete button - appears on hover or always on mobile */}
                                <button
                                    type="button"
                                    onClick={(e) => handleRemoveImage(catId, e)}
                                    disabled={isDeleting}
                                    className="absolute top-2 right-2 z-10 bg-red-500 hover:bg-red-600 text-white rounded-full p-1.5 w-8 h-8 flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="Eliminar imagen"
                                >
                                    {isDeleting ? (
                                        <span className="animate-spin text-xs">⏳</span>
                                    ) : (
                                        <Trash2 className="w-4 h-4" />
                                    )}
                                </button>

                                {/* Check mark - bottom left to not overlap with delete */}
                                <div className="absolute top-2 left-2 bg-green-500 text-white rounded-full p-1 w-6 h-6 flex items-center justify-center text-xs shadow">
                                    ✓
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* NOTE: Removed the "Continuar al Siguiente Paso" button. 
                User now scrolls naturally to the Price/Offer section below. */}
        </div>
    )
}