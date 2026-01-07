'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Fredoka } from 'next/font/google';
import {
    Camera, Upload, X, CheckCircle, AlertCircle, Loader2, ChevronDown, ChevronUp,
    Home, Utensils, Sofa, BedDouble, Bath, Trees, Sun, Car, Image as ImageIcon, Send
} from 'lucide-react';
import { uploadPropertyImage, getPropertyImages, deletePropertyImage, PropertyImageData } from '@/app/actions/uploadImages';

const fredoka = Fredoka({
    subsets: ['latin'],
    weight: ['300', '400', '500', '600', '700']
});

// Section configuration
interface PhotoSection {
    id: string;
    label: string;
    tag: string;
    required: number;
    icon: React.ReactNode;
    isOptional?: boolean;
    maxPhotos?: number;
}

// Icons for sections
const sectionIcons: Record<string, React.ReactNode> = {
    fachada: <Home size={20} />,
    sala: <Sofa size={20} />,
    comedor: <Utensils size={20} />,
    cocina: <Utensils size={20} />,
    habitacion: <BedDouble size={20} />,
    bano: <Bath size={20} />,
    patio: <Trees size={20} />,
    terraza: <Sun size={20} />,
    garaje: <Car size={20} />,
    otras: <ImageIcon size={20} />,
};

export default function MultimediaPage() {
    const router = useRouter();
    const params = useParams();
    const propertyId = params.id as string;

    // Property data (would be fetched from DB in production)
    const [propertyData, setPropertyData] = useState({
        habitaciones: 2,
        banos: 1,
        amenities: ['patio', 'parqueadero'] as string[],
    });

    // State
    const [sections, setSections] = useState<PhotoSection[]>([]);
    const [images, setImages] = useState<Record<string, PropertyImageData[]>>({});
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['fachada', 'sala']));
    const [uploadingSection, setUploadingSection] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const currentUploadSection = useRef<string>('');

    // Generate dynamic sections based on property data
    useEffect(() => {
        const generatedSections: PhotoSection[] = [];

        // Always required sections
        generatedSections.push({
            id: 'fachada',
            label: 'Fachada',
            tag: 'fachada',
            required: 2,
            icon: sectionIcons.fachada,
        });

        generatedSections.push({
            id: 'sala',
            label: 'Sala',
            tag: 'sala',
            required: 2,
            icon: sectionIcons.sala,
        });

        generatedSections.push({
            id: 'comedor',
            label: 'Comedor',
            tag: 'comedor',
            required: 2,
            icon: sectionIcons.comedor,
        });

        generatedSections.push({
            id: 'cocina',
            label: 'Cocina',
            tag: 'cocina',
            required: 2,
            icon: sectionIcons.cocina,
        });

        // Dynamic habitaciones
        for (let i = 1; i <= propertyData.habitaciones; i++) {
            generatedSections.push({
                id: `habitacion_${i}`,
                label: `Habitación ${i}`,
                tag: `habitacion_${i}`,
                required: 2,
                icon: sectionIcons.habitacion,
            });
        }

        // Dynamic baños
        for (let i = 1; i <= propertyData.banos; i++) {
            generatedSections.push({
                id: `bano_${i}`,
                label: `Baño ${i}`,
                tag: `bano_${i}`,
                required: 2,
                icon: sectionIcons.bano,
            });
        }

        // Conditional based on amenities
        if (propertyData.amenities.includes('patio')) {
            generatedSections.push({
                id: 'patio',
                label: 'Patio',
                tag: 'patio',
                required: 2,
                icon: sectionIcons.patio,
            });
        }

        if (propertyData.amenities.includes('terraza')) {
            generatedSections.push({
                id: 'terraza',
                label: 'Terraza',
                tag: 'terraza',
                required: 2,
                icon: sectionIcons.terraza,
            });
        }

        if (propertyData.amenities.includes('parqueadero') || propertyData.amenities.includes('garaje')) {
            generatedSections.push({
                id: 'garaje',
                label: 'Garaje / Parqueadero',
                tag: 'garaje',
                required: 2,
                icon: sectionIcons.garaje,
            });
        }

        // Optional section
        generatedSections.push({
            id: 'otras',
            label: 'Otras (Opcional)',
            tag: 'otras',
            required: 0,
            isOptional: true,
            maxPhotos: 5,
            icon: sectionIcons.otras,
        });

        setSections(generatedSections);

        // Open first incomplete sections
        const firstTwo = generatedSections.slice(0, 2).map(s => s.id);
        setExpandedSections(new Set(firstTwo));

    }, [propertyData]);

    // Load existing images
    useEffect(() => {
        const loadImages = async () => {
            setIsLoading(true);
            try {
                const allImages = await getPropertyImages(propertyId);

                // Group by tag
                const grouped: Record<string, PropertyImageData[]> = {};
                allImages.forEach(img => {
                    const tag = img.category || 'unknown';
                    if (tag && tag !== 'unknown') {
                        if (!grouped[tag]) {
                            grouped[tag] = [];
                        }
                        grouped[tag].push(img);
                    }
                });

                setImages(grouped);
            } catch (error) {
                console.error('Error loading images:', error);
            } finally {
                setIsLoading(false);
            }
        };

        loadImages();
    }, [propertyId]);

    // Toggle section expansion
    const toggleSection = (sectionId: string) => {
        setExpandedSections(prev => {
            const next = new Set(prev);
            if (next.has(sectionId)) {
                next.delete(sectionId);
            } else {
                next.add(sectionId);
            }
            return next;
        });
    };

    // Get photos for a section
    const getSectionPhotos = (tag: string) => images[tag] || [];

    // Check if section is complete
    const isSectionComplete = (section: PhotoSection) => {
        const photos = getSectionPhotos(section.tag);
        return photos.length >= section.required;
    };

    // Get missing count
    const getMissingCount = (section: PhotoSection) => {
        const photos = getSectionPhotos(section.tag);
        return Math.max(0, section.required - photos.length);
    };

    // Check if all mandatory sections are complete
    const allMandatoryComplete = () => {
        return sections
            .filter(s => !s.isOptional)
            .every(s => isSectionComplete(s));
    };

    // Handle file selection
    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const sectionTag = currentUploadSection.current;
        if (!sectionTag) return;

        const section = sections.find(s => s.tag === sectionTag);
        if (!section) return;

        // Check max photos for optional section
        if (section.isOptional && section.maxPhotos) {
            const currentCount = getSectionPhotos(sectionTag).length;
            if (currentCount >= section.maxPhotos) {
                alert(`Máximo ${section.maxPhotos} fotos para esta sección`);
                return;
            }
        }

        setUploadingSection(sectionTag);

        try {
            for (const file of Array.from(files)) {
                // Check max again for each file
                if (section.isOptional && section.maxPhotos) {
                    const currentCount = getSectionPhotos(sectionTag).length;
                    if (currentCount >= section.maxPhotos) break;
                }

                // Convert to base64 is no longer needed - use File directly
                const formData = new FormData();
                formData.append('file', file);
                formData.append('inmuebleId', propertyId);
                formData.append('category', sectionTag);

                // Upload to storage and save to database in one call
                const uploadResult = await uploadPropertyImage(formData);

                if (uploadResult.success && uploadResult.imageId && uploadResult.url) {
                    // Update local state
                    setImages(prev => ({
                        ...prev,
                        [sectionTag]: [
                            ...(prev[sectionTag] || []),
                            {
                                id: uploadResult.imageId!,
                                url: uploadResult.url!,
                                category: sectionTag,
                                orden: (prev[sectionTag]?.length || 0) + 1,
                            }
                        ]
                    }));
                } else {
                    console.error('Upload failed:', uploadResult.error);
                }
            }
        } catch (error) {
            console.error('Upload error:', error);
            alert('Error al subir la imagen. Intenta de nuevo.');
        } finally {
            setUploadingSection(null);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    // Convert file to base64
    const fileToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const base64 = (reader.result as string).split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    };

    // Trigger file input for specific section
    const triggerUpload = (sectionTag: string) => {
        currentUploadSection.current = sectionTag;
        fileInputRef.current?.click();
    };

    // Delete image
    const handleDeleteImage = async (imageId: string, sectionTag: string) => {
        const result = await deletePropertyImage(imageId);
        if (result.success) {
            setImages(prev => ({
                ...prev,
                [sectionTag]: (prev[sectionTag] || []).filter(img => img.id !== imageId)
            }));
        }
    };

    // Save and continue
    const handleSave = async () => {
        if (!allMandatoryComplete()) {
            alert('Completa todas las secciones obligatorias antes de continuar.');
            return;
        }

        setIsSaving(true);
        try {
            // In production, you might want to update the property status here
            await new Promise(resolve => setTimeout(resolve, 500));
            router.push(`/publicar/crear/${propertyId}/descripcion`);
        } catch (error) {
            console.error('Error saving:', error);
            alert('Error al guardar. Intenta de nuevo.');
        } finally {
            setIsSaving(false);
        }
    };

    // Calculate progress
    const completedMandatory = sections.filter(s => !s.isOptional && isSectionComplete(s)).length;
    const totalMandatory = sections.filter(s => !s.isOptional).length;
    const progressPercent = totalMandatory > 0 ? (completedMandatory / totalMandatory) * 100 : 0;

    if (isLoading) {
        return (
            <div className={`${fredoka.className} flex items-center justify-center min-h-[400px]`}>
                <Loader2 className="w-8 h-8 text-[#0c263b] animate-spin" />
            </div>
        );
    }

    return (
        <div className={`${fredoka.className} space-y-6`}>

            {/* Hidden file input */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileSelect}
                className="hidden"
            />

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* HEADER */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            <div className="space-y-3">
                <h1 className="text-3xl sm:text-4xl font-bold text-[#0c263b]">
                    3. Evidencias Fotográficas
                </h1>
                <p className="text-gray-500 text-lg">
                    Sube las fotos obligatorias por cada sector del inmueble.
                </p>

                {/* Progress bar */}
                <div className="bg-gray-100 rounded-full h-3 overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-[#0c263b] to-[#1a4a6e] transition-all duration-500"
                        style={{ width: `${progressPercent}%` }}
                    />
                </div>
                <p className="text-sm text-gray-500">
                    {completedMandatory} de {totalMandatory} secciones completas
                </p>
            </div>

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* SECTIONS LIST */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            <div className="space-y-3">
                {sections.map((section) => {
                    const photos = getSectionPhotos(section.tag);
                    const isComplete = isSectionComplete(section);
                    const missing = getMissingCount(section);
                    const isExpanded = expandedSections.has(section.id);
                    const isUploading = uploadingSection === section.tag;
                    const atMaxLimit = section.isOptional && section.maxPhotos && photos.length >= section.maxPhotos;

                    return (
                        <div
                            key={section.id}
                            className={`
                                bg-white rounded-[22px] border-2 overflow-hidden
                                transition-all duration-300
                                ${isComplete
                                    ? 'border-green-200 bg-green-50/30'
                                    : section.isOptional
                                        ? 'border-gray-200'
                                        : 'border-amber-200 bg-amber-50/20'
                                }
                            `}
                        >
                            {/* Section Header */}
                            <button
                                onClick={() => toggleSection(section.id)}
                                className="w-full flex items-center justify-between p-4 sm:p-5 hover:bg-gray-50/50 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    {/* Status icon */}
                                    <div className={`
                                        w-10 h-10 rounded-full flex items-center justify-center
                                        ${isComplete
                                            ? 'bg-green-100 text-green-600'
                                            : section.isOptional
                                                ? 'bg-gray-100 text-gray-500'
                                                : 'bg-amber-100 text-amber-600'
                                        }
                                    `}>
                                        {isComplete ? (
                                            <CheckCircle size={20} />
                                        ) : (
                                            section.icon
                                        )}
                                    </div>

                                    {/* Label */}
                                    <div className="text-left">
                                        <p className="font-semibold text-[#0c263b]">
                                            {section.label}
                                        </p>
                                        <p className="text-sm text-gray-500">
                                            {photos.length} / {section.required || section.maxPhotos} fotos
                                            {!isComplete && !section.isOptional && (
                                                <span className="text-amber-600 ml-2">
                                                    • Faltan {missing}
                                                </span>
                                            )}
                                            {section.isOptional && (
                                                <span className="text-gray-400 ml-2">• Opcional</span>
                                            )}
                                        </p>
                                    </div>
                                </div>

                                {/* Chevron */}
                                <div className="text-gray-400">
                                    {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                </div>
                            </button>

                            {/* Expanded Content */}
                            {isExpanded && (
                                <div className="px-4 sm:px-5 pb-5 space-y-4 border-t border-gray-100 pt-4">

                                    {/* Photo Grid */}
                                    {photos.length > 0 && (
                                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                            {photos.map((photo) => (
                                                <div key={photo.id} className="relative aspect-square group">
                                                    <img
                                                        src={photo.url}
                                                        alt={section.label}
                                                        className="w-full h-full object-cover rounded-xl"
                                                    />
                                                    {/* Delete button */}
                                                    <button
                                                        onClick={() => handleDeleteImage(photo.id, section.tag)}
                                                        className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Upload Button */}
                                    {!atMaxLimit && (
                                        <button
                                            onClick={() => triggerUpload(section.tag)}
                                            disabled={isUploading}
                                            className={`
                                                w-full flex items-center justify-center gap-2 py-4
                                                border-2 border-dashed rounded-[18px]
                                                font-semibold transition-all
                                                ${isUploading
                                                    ? 'border-gray-300 bg-gray-50 text-gray-400 cursor-not-allowed'
                                                    : 'border-[#0c263b]/30 text-[#0c263b] hover:border-[#0c263b] hover:bg-[#0c263b]/5'
                                                }
                                            `}
                                        >
                                            {isUploading ? (
                                                <>
                                                    <Loader2 className="w-5 h-5 animate-spin" />
                                                    Subiendo...
                                                </>
                                            ) : (
                                                <>
                                                    <Camera className="w-5 h-5" />
                                                    Subir fotos de {section.label}
                                                </>
                                            )}
                                        </button>
                                    )}

                                    {/* Max limit message */}
                                    {atMaxLimit && (
                                        <p className="text-center text-sm text-gray-500 py-2">
                                            ✓ Has alcanzado el límite de {section.maxPhotos} fotos
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* FOOTER */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            <div className="pt-4">
                {!allMandatoryComplete() && (
                    <div className="flex items-center gap-2 text-amber-600 mb-4 p-3 bg-amber-50 rounded-[16px]">
                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                        <p className="text-sm font-medium">
                            Completa todas las secciones obligatorias para continuar
                        </p>
                    </div>
                )}

                <div className="flex justify-end">
                    <button
                        onClick={handleSave}
                        disabled={isSaving || !allMandatoryComplete()}
                        className={`
                            flex items-center gap-3 px-10 py-4 rounded-full
                            font-bold text-lg transition-all duration-300
                            ${!isSaving && allMandatoryComplete()
                                ? 'bg-gradient-to-r from-[#0c263b] to-[#1a4a6e] text-white shadow-xl hover:shadow-2xl hover:scale-[1.02]'
                                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            }
                        `}
                    >
                        {isSaving ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Guardando...
                            </>
                        ) : (
                            <>
                                Guardar y Continuar
                                <Send className="w-5 h-5" />
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
