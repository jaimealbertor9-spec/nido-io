'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Inter } from 'next/font/google';
import { Loader2, Minus, Plus, MapPin, Home, ChevronRight, Navigation, AlertTriangle, Trash2, Search } from 'lucide-react';
import { GoogleMap, MarkerF, useJsApiLoader } from '@react-google-maps/api';
import { updatePropertyLocation } from '@/app/actions/updateLocation';
import { savePropertyFeatures } from '@/app/actions/saveFeatures';
import { deletePropertyDraft } from '@/app/actions/publish';
import { supabase } from '@/lib/supabase';

const inter = Inter({
    subsets: ['latin'],
    weight: ['400', '500', '600', '700']
});

// ═══════════════════════════════════════════════════════════════
// CITY & SUBDIVISION DATA
// ═══════════════════════════════════════════════════════════════

/** City center coordinates for map centering */
const CITY_CENTERS: Record<string, { lat: number; lng: number }> = {
    'Bogotá': { lat: 4.6110, lng: -74.0817 },
    'Medellín': { lat: 6.2442, lng: -75.5812 },
    'Cali': { lat: 3.4516, lng: -76.5320 },
    'Ibagué': { lat: 4.4389, lng: -75.2322 },
    'Cúcuta': { lat: 7.8891, lng: -72.4967 },
    'Manizales': { lat: 5.0689, lng: -75.5174 },
    'Pereira': { lat: 4.8133, lng: -75.6961 },
    'Armenia': { lat: 4.5339, lng: -75.6811 },
    'Bucaramanga': { lat: 7.1254, lng: -73.1198 },
    'Villavicencio': { lat: 4.1420, lng: -73.6266 },
    'El Líbano': { lat: 4.9213, lng: -75.0665 },
};

const ALL_CITIES = Object.keys(CITY_CENTERS);

/** Bogotá Localidades */
const BOGOTA_LOCALIDADES = [
    'Usaquén', 'Chapinero', 'Santa Fe', 'San Cristóbal', 'Usme',
    'Tunjuelito', 'Bosa', 'Kennedy', 'Fontibón', 'Engativá',
    'Suba', 'Barrios Unidos', 'Teusaquillo', 'Los Mártires', 'Antonio Nariño',
    'Puente Aranda', 'La Candelaria', 'Rafael Uribe Uribe', 'Ciudad Bolívar', 'Sumapaz',
];

/** Cities that use "Comuna" system */
const COMUNA_CITIES = ['Medellín', 'Cali', 'Ibagué', 'Cúcuta', 'Manizales', 'Pereira', 'Armenia', 'Bucaramanga', 'Villavicencio'];

/** Comunas by city (number-based) */
const COMUNAS: Record<string, string[]> = {
    'Medellín': Array.from({ length: 16 }, (_, i) => `Comuna ${i + 1}`),
    'Cali': Array.from({ length: 22 }, (_, i) => `Comuna ${i + 1}`),
    'Ibagué': Array.from({ length: 13 }, (_, i) => `Comuna ${i + 1}`),
    'Cúcuta': Array.from({ length: 10 }, (_, i) => `Comuna ${i + 1}`),
    'Manizales': Array.from({ length: 12 }, (_, i) => `Comuna ${i + 1}`),
    'Pereira': Array.from({ length: 19 }, (_, i) => `Comuna ${i + 1}`),
    'Armenia': Array.from({ length: 10 }, (_, i) => `Comuna ${i + 1}`),
    'Bucaramanga': Array.from({ length: 17 }, (_, i) => `Comuna ${i + 1}`),
    'Villavicencio': Array.from({ length: 8 }, (_, i) => `Comuna ${i + 1}`),
};

/** El Líbano barrios (preserved from original) */
const LIBANO_BARRIOS: Record<string, string[]> = {
    "Barrios Líbano": [
        "1 de Mayo", "20 de Julio", "Carlos Pizarro", "Cidral", "Coloyita",
        "El Carmen", "El Centro", "El Porvenir", "El Triunfo", "Estadio",
        "Isidro Parra", "Jaramillo", "La Libertad", "La Polea", "Las Acacias",
        "Las Ameritas", "Las Brisas", "Las Ferias", "Los Pinos", "Marsella",
        "Pablo VI", "San Antonio", "San José", "San Vicente", "Santa Rosa",
        "Villa Emma", "Villa Esperanza"
    ],
    "Corregimientos": [
        "Convenio", "San Fernando", "Santa Teresa", "Tierra Dentro"
    ]
};

const SERVICIOS_LIST = ['Agua', 'Luz', 'Gas Natural', 'Internet', 'Telefonía', 'TV Cable'];

const AMENIDADES_LIST = [
    'Piscina', 'Gimnasio', 'Parqueadero', 'Garaje', 'Balcón', 'Terraza',
    'Patio', 'Vigilancia', 'Ascensor', 'Zona BBQ', 'Salón Comunal', 'Depósito', 'Cocina Integral',
];

// Google Maps Libraries
const MAPS_LIBRARIES: ("places")[] = ['places'];

const mapContainerStyle = {
    width: '100%',
    height: '350px',
    borderRadius: '12px',
};

export default function Paso1Page() {
    const router = useRouter();
    const params = useParams();
    const propertyId = params.id as string;

    // Loading states
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isSavingAndExit, setIsSavingAndExit] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // Fatal error state
    const [fatalError, setFatalError] = useState<{ message: string; canDelete: boolean } | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Location state
    const [address, setAddress] = useState('');
    const [neighborhood, setNeighborhood] = useState('');
    const [subdivision, setSubdivision] = useState('');
    const [latitud, setLatitud] = useState<number | null>(null);
    const [longitud, setLongitud] = useState<number | null>(null);
    const [ciudad, setCiudad] = useState<string>('El Líbano');
    const [isGeocodingLoading, setIsGeocodingLoading] = useState(false);
    const [pinPlaced, setPinPlaced] = useState(false);

    // Map state
    const [markerPosition, setMarkerPosition] = useState(CITY_CENTERS['El Líbano']);
    const [mapCenter, setMapCenter] = useState(CITY_CENTERS['El Líbano']);

    // Autocomplete ref
    const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
    const searchInputRef = useRef<HTMLInputElement | null>(null);

    // Debounce timer ref for dragend
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Characteristics state
    const [habitaciones, setHabitaciones] = useState(0);
    const [banos, setBanos] = useState(0);
    const [area, setArea] = useState(0);
    const [estrato, setEstrato] = useState(3);

    // Features state
    const [servicios, setServicios] = useState<string[]>([]);
    const [amenidades, setAmenidades] = useState<string[]>([]);

    // ═══════════════════════════════════════════════════════════════
    // GOOGLE MAPS LOADER (with Places library)
    // ═══════════════════════════════════════════════════════════════
    const { isLoaded: isMapLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
        libraries: MAPS_LIBRARIES,
    });

    // ═══════════════════════════════════════════════════════════════
    // FORM VALIDATION — Pin is MANDATORY
    // ═══════════════════════════════════════════════════════════════
    const isFormValid =
        address.trim().length > 0 &&
        neighborhood !== '' &&
        latitud !== null &&
        longitud !== null &&
        pinPlaced &&
        habitaciones > 0 &&
        banos > 0 &&
        area > 0 &&
        estrato > 0 &&
        servicios.length > 0;

    // ═══════════════════════════════════════════════════════════════
    // DYNAMIC UI LOGIC — Determine subdivision type
    // ═══════════════════════════════════════════════════════════════
    const getSubdivisionType = useCallback((): 'localidad' | 'comuna' | 'barrio_list' | 'free_text' => {
        if (ciudad === 'Bogotá') return 'localidad';
        if (COMUNA_CITIES.includes(ciudad)) return 'comuna';
        if (ciudad === 'El Líbano') return 'barrio_list';
        return 'free_text';
    }, [ciudad]);

    const subdivisionType = getSubdivisionType();

    // ═══════════════════════════════════════════════════════════════
    // LOAD EXISTING DATA (State Re-hydration) with Recovery Pattern
    // ═══════════════════════════════════════════════════════════════
    useEffect(() => {
        const loadData = async () => {
            if (!propertyId) {
                console.log('[Paso1] No propertyId, skipping data load');
                setIsLoading(false);
                return;
            }

            console.log('[Paso1] Loading data for property:', propertyId);
            setIsLoading(true);
            setError(null);
            setFatalError(null);

            try {
                const { data, error: fetchError } = await supabase
                    .from('inmuebles')
                    .select('direccion, barrio, subdivision, latitud, longitud, ciudad, habitaciones, banos, area_m2, estrato, servicios, amenities, propietario_id')
                    .eq('id', propertyId)
                    .single();

                if (fetchError) {
                    console.error('[Paso1] Supabase fetch error:', fetchError);

                    if (fetchError.code === 'PGRST116') {
                        setFatalError({
                            message: 'Este borrador no existe o fue eliminado.',
                            canDelete: false
                        });
                    } else {
                        setFatalError({
                            message: 'Encontramos un problema al cargar tu borrador. Los datos pueden estar corruptos.',
                            canDelete: true
                        });
                    }
                    return;
                }

                if (!data) {
                    console.log('[Paso1] No data found for property:', propertyId);
                    setFatalError({
                        message: 'No se encontró información del borrador.',
                        canDelete: false
                    });
                    return;
                }

                console.log('[Paso1] Data loaded successfully:', data);

                // Populate form state with fetched data (null-safe)
                setAddress(data.direccion ?? '');
                setNeighborhood(data.barrio ?? '');
                setSubdivision(data.subdivision ?? '');
                setCiudad(data.ciudad ?? 'El Líbano');
                setLatitud(data.latitud ?? null);
                setLongitud(data.longitud ?? null);
                setHabitaciones(data.habitaciones ?? 0);
                setBanos(data.banos ?? 0);
                setArea(data.area_m2 ?? 0);
                setEstrato(data.estrato ?? 3);

                // Set marker position if coordinates exist
                if (data.latitud && data.longitud) {
                    setMarkerPosition({ lat: data.latitud, lng: data.longitud });
                    setMapCenter({ lat: data.latitud, lng: data.longitud });
                    setPinPlaced(true);
                } else if (data.ciudad && CITY_CENTERS[data.ciudad]) {
                    setMapCenter(CITY_CENTERS[data.ciudad]);
                    setMarkerPosition(CITY_CENTERS[data.ciudad]);
                }

                // Handle arrays
                setServicios(Array.isArray(data.servicios) ? data.servicios : []);
                setAmenidades(Array.isArray(data.amenities) ? data.amenities : []);

            } catch (err: any) {
                console.error('[Paso1] Unexpected error loading data:', err);
                setFatalError({
                    message: `Error inesperado: ${err.message || 'No se pudo cargar el borrador'}`,
                    canDelete: true
                });
            } finally {
                console.log('[Paso1] Data load complete, stopping spinner');
                setIsLoading(false);
            }
        };

        loadData();
    }, [propertyId]);

    // ═══════════════════════════════════════════════════════════════
    // Update map center when city changes
    // ═══════════════════════════════════════════════════════════════
    useEffect(() => {
        if (CITY_CENTERS[ciudad]) {
            setMapCenter(CITY_CENTERS[ciudad]);
            // Reset subdivision when city changes
            setSubdivision('');
        }
    }, [ciudad]);

    // ═══════════════════════════════════════════════════════════════
    // GOOGLE PLACES AUTOCOMPLETE SETUP
    // ═══════════════════════════════════════════════════════════════
    useEffect(() => {
        if (!isMapLoaded || !searchInputRef.current || autocompleteRef.current) return;

        const autocomplete = new google.maps.places.Autocomplete(searchInputRef.current, {
            componentRestrictions: { country: 'co' },
            fields: ['geometry', 'formatted_address', 'name', 'address_components'],
            types: ['address'],
        });

        autocomplete.addListener('place_changed', () => {
            const place = autocomplete.getPlace();
            if (place.geometry?.location) {
                const newLat = place.geometry.location.lat();
                const newLng = place.geometry.location.lng();

                setMarkerPosition({ lat: newLat, lng: newLng });
                setMapCenter({ lat: newLat, lng: newLng });
                setLatitud(newLat);
                setLongitud(newLng);
                setPinPlaced(true);

                // Extract city from address components
                if (place.address_components) {
                    for (const component of place.address_components) {
                        if (component.types.includes('locality')) {
                            const detectedCity = component.long_name;
                            // Match to our known cities or default
                            const matchedCity = ALL_CITIES.find(c =>
                                detectedCity.toLowerCase().includes(c.toLowerCase()) ||
                                c.toLowerCase().includes(detectedCity.toLowerCase())
                            );
                            if (matchedCity) {
                                setCiudad(matchedCity);
                            } else {
                                setCiudad(detectedCity);
                            }
                            break;
                        }
                    }
                }

                console.log('[Autocomplete] Place selected:', place.formatted_address, { lat: newLat, lng: newLng });
            }
        });

        autocompleteRef.current = autocomplete;
    }, [isMapLoaded]);

    // ═══════════════════════════════════════════════════════════════
    // REVERSE GEOCODING (for when user drags marker)
    // ═══════════════════════════════════════════════════════════════
    const reverseGeocode = useCallback(async (lat: number, lng: number) => {
        if (!window.google) return;

        setIsGeocodingLoading(true);
        try {
            const geocoder = new window.google.maps.Geocoder();
            const response = await geocoder.geocode({ location: { lat, lng } });

            if (response.results && response.results.length > 0) {
                const result = response.results[0];
                console.log('[Geocoder] Full result:', result);

                let detectedCity = 'El Líbano';
                for (const component of result.address_components) {
                    if (component.types.includes('locality')) {
                        detectedCity = component.long_name;
                        break;
                    }
                    if (component.types.includes('administrative_area_level_2')) {
                        detectedCity = component.long_name;
                    }
                }

                // Match to known city or use raw
                const matchedCity = ALL_CITIES.find(c =>
                    detectedCity.toLowerCase().includes(c.toLowerCase()) ||
                    c.toLowerCase().includes(detectedCity.toLowerCase())
                );
                setCiudad(matchedCity || detectedCity);
                console.log('[Geocoder] Detected city:', matchedCity || detectedCity);
            }
        } catch (err) {
            console.error('[Geocoder] Error:', err);
        } finally {
            setIsGeocodingLoading(false);
        }
    }, []);

    // ═══════════════════════════════════════════════════════════════
    // MAP HANDLERS — 3s debounce on dragend
    // ═══════════════════════════════════════════════════════════════
    const handleMarkerDragEnd = useCallback((e: google.maps.MapMouseEvent) => {
        if (e.latLng) {
            const newLat = e.latLng.lat();
            const newLng = e.latLng.lng();
            setMarkerPosition({ lat: newLat, lng: newLng });
            setLatitud(newLat);
            setLongitud(newLng);
            setPinPlaced(true);
            console.log('[Map] Marker dragged to:', { lat: newLat, lng: newLng });

            // 3s debounce before reverse geocoding
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
            debounceTimerRef.current = setTimeout(() => {
                reverseGeocode(newLat, newLng);
            }, 3000);
        }
    }, [reverseGeocode]);

    const handleMapClick = useCallback((e: google.maps.MapMouseEvent) => {
        if (e.latLng) {
            const newLat = e.latLng.lat();
            const newLng = e.latLng.lng();
            setMarkerPosition({ lat: newLat, lng: newLng });
            setLatitud(newLat);
            setLongitud(newLng);
            setPinPlaced(true);
            console.log('[Map] Clicked at:', { lat: newLat, lng: newLng });

            // 3s debounce before reverse geocoding
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
            debounceTimerRef.current = setTimeout(() => {
                reverseGeocode(newLat, newLng);
            }, 3000);
        }
    }, [reverseGeocode]);

    // Cleanup debounce timer
    useEffect(() => {
        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, []);

    // ═══════════════════════════════════════════════════════════════
    // TOGGLE FUNCTIONS
    // ═══════════════════════════════════════════════════════════════
    const toggleServicio = (item: string) => {
        setServicios(prev =>
            prev.includes(item) ? prev.filter(s => s !== item) : [...prev, item]
        );
    };

    const toggleAmenidad = (item: string) => {
        setAmenidades(prev =>
            prev.includes(item) ? prev.filter(a => a !== item) : [...prev, item]
        );
    };

    // ═══════════════════════════════════════════════════════════════
    // SAVE AND CONTINUE
    // ═══════════════════════════════════════════════════════════════
    const handleContinue = async () => {
        if (!isFormValid) return;

        setError(null);
        setIsSaving(true);

        try {
            // Save location with new subdivision field
            const locationResult = await updatePropertyLocation(
                propertyId,
                address.trim(),
                neighborhood,
                subdivision || null,
                latitud,
                longitud,
                ciudad
            );

            if (!locationResult.success) {
                throw new Error(locationResult.error || 'Error al guardar ubicación');
            }

            // Save features
            const featuresResult = await savePropertyFeatures(
                propertyId,
                habitaciones,
                banos,
                area,
                estrato,
                amenidades,
                servicios,
                undefined
            );

            if (!featuresResult.success) {
                throw new Error(featuresResult.error || 'Error al guardar características');
            }

            router.push(`/publicar/crear/${propertyId}/paso-2`);

        } catch (err: any) {
            console.error('Save error:', err);
            setError(err.message || 'Error al guardar. Intenta de nuevo.');
        } finally {
            setIsSaving(false);
        }
    };

    // ═══════════════════════════════════════════════════════════════
    // SAVE AND EXIT (Guardar y Volver)
    // ═══════════════════════════════════════════════════════════════
    const handleSaveAndExit = async () => {
        setError(null);
        setIsSavingAndExit(true);

        try {
            if (address.trim() && neighborhood) {
                const locationResult = await updatePropertyLocation(
                    propertyId,
                    address.trim(),
                    neighborhood,
                    subdivision || null,
                    latitud,
                    longitud,
                    ciudad
                );

                if (!locationResult.success) {
                    console.warn('Location save warning:', locationResult.error);
                }
            }

            if (habitaciones > 0 || banos > 0 || area > 0 || servicios.length > 0) {
                const featuresResult = await savePropertyFeatures(
                    propertyId,
                    habitaciones,
                    banos,
                    area,
                    estrato,
                    amenidades,
                    servicios,
                    undefined
                );

                if (!featuresResult.success) {
                    console.warn('Features save warning:', featuresResult.error);
                }
            }

            router.push('/mis-inmuebles');

        } catch (err: any) {
            console.error('Save and exit error:', err);
            setError(err.message || 'Error al guardar. Intenta de nuevo.');
        } finally {
            setIsSavingAndExit(false);
        }
    };

    // ═══════════════════════════════════════════════════════════════
    // DELETE DRAFT HANDLER
    // ═══════════════════════════════════════════════════════════════
    const handleDeleteDraft = async () => {
        if (!propertyId) {
            setError('No se puede eliminar: ID no disponible');
            return;
        }

        setIsDeleting(true);
        setError(null);

        try {
            const result = await deletePropertyDraft(propertyId);

            if (result.success) {
                console.log('✅ Draft deleted successfully, redirecting to tipo...');
                router.push('/publicar/tipo');
            } else {
                setError(result.error || 'Error al eliminar el borrador');
            }
        } catch (err: any) {
            console.error('Delete error:', err);
            setError(err.message || 'Error inesperado al eliminar');
        } finally {
            setIsDeleting(false);
        }
    };

    if (isLoading) {
        return (
            <div className={`${inter.className} flex items-center justify-center min-h-[400px]`}>
                <Loader2 className="w-8 h-8 text-[#0c263b]/40 animate-spin" />
            </div>
        );
    }

    // ═══════════════════════════════════════════════════════════════
    // RECOVERY UI
    // ═══════════════════════════════════════════════════════════════
    if (fatalError) {
        return (
            <div className={`${inter.className} flex flex-col items-center justify-center min-h-[400px] p-8`}>
                <div className="max-w-md w-full bg-white border border-red-200 rounded-lg shadow-lg p-8 text-center">
                    <div className="w-16 h-16 mx-auto mb-6 bg-red-100 rounded-full flex items-center justify-center">
                        <AlertTriangle className="w-8 h-8 text-red-600" />
                    </div>

                    <h2 className="text-xl font-semibold text-slate-800 mb-2">
                        Problema al cargar el borrador
                    </h2>
                    <p className="text-slate-600 mb-6">
                        {fatalError.message}
                    </p>

                    <div className="space-y-3">
                        {fatalError.canDelete && (
                            <button
                                onClick={handleDeleteDraft}
                                disabled={isDeleting}
                                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isDeleting ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Eliminando...
                                    </>
                                ) : (
                                    <>
                                        <Trash2 className="w-5 h-5" />
                                        Eliminar Borrador y Empezar de Nuevo
                                    </>
                                )}
                            </button>
                        )}

                        <button
                            onClick={() => router.push('/publicar/tipo')}
                            className="w-full px-6 py-3 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 transition-colors"
                        >
                            Volver a Selección de Tipo
                        </button>
                    </div>

                    {error && (
                        <p className="mt-4 text-sm text-red-600">{error}</p>
                    )}
                </div>
            </div>
        );
    }

    // ═══════════════════════════════════════════════════════════════
    // SUBDIVISION RENDERER — Dynamic based on city
    // ═══════════════════════════════════════════════════════════════
    const renderSubdivisionField = () => {
        if (subdivisionType === 'localidad') {
            return (
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Localidad <span className="text-red-500 ml-1">*</span>
                    </label>
                    <select
                        value={subdivision}
                        onChange={(e) => setSubdivision(e.target.value)}
                        className="w-full h-11 px-3 bg-white border border-gray-300 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0c263b] focus:border-transparent"
                    >
                        <option value="">Seleccionar localidad</option>
                        {BOGOTA_LOCALIDADES.map(loc => (
                            <option key={loc} value={loc}>{loc}</option>
                        ))}
                    </select>
                </div>
            );
        }

        if (subdivisionType === 'comuna') {
            const comunaList = COMUNAS[ciudad] || [];
            return (
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Comuna <span className="text-red-500 ml-1">*</span>
                    </label>
                    <select
                        value={subdivision}
                        onChange={(e) => setSubdivision(e.target.value)}
                        className="w-full h-11 px-3 bg-white border border-gray-300 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0c263b] focus:border-transparent"
                    >
                        <option value="">Seleccionar comuna</option>
                        {comunaList.map(c => (
                            <option key={c} value={c}>{c}</option>
                        ))}
                    </select>
                </div>
            );
        }

        // barrio_list and free_text don't need subdivision — barrio field handles it
        return null;
    };

    // ═══════════════════════════════════════════════════════════════
    // BARRIO RENDERER — Dynamic based on city
    // ═══════════════════════════════════════════════════════════════
    const renderBarrioField = () => {
        if (subdivisionType === 'barrio_list') {
            // El Líbano — dropdown with predefined barrios
            return (
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Barrio <span className="text-red-500 ml-1">*</span>
                    </label>
                    <select
                        value={neighborhood}
                        onChange={(e) => setNeighborhood(e.target.value)}
                        className="w-full h-11 px-3 bg-white border border-gray-300 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0c263b] focus:border-transparent"
                    >
                        <option value="">Seleccionar barrio</option>
                        {Object.entries(LIBANO_BARRIOS).map(([category, barrios]) => (
                            <optgroup key={category} label={category}>
                                {barrios.map(barrio => (
                                    <option key={barrio} value={barrio}>{barrio}</option>
                                ))}
                            </optgroup>
                        ))}
                    </select>
                </div>
            );
        }

        // All other cities — free text barrio
        return (
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Barrio <span className="text-red-500 ml-1">*</span>
                </label>
                <input
                    type="text"
                    value={neighborhood}
                    onChange={(e) => setNeighborhood(e.target.value)}
                    placeholder="Ej: El Chicó, La Soledad, Pinares..."
                    className="w-full h-11 px-3 bg-white border border-gray-300 rounded-md text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0c263b] focus:border-transparent"
                />
            </div>
        );
    };

    return (
        <div className={`${inter.className} space-y-8`} style={{ fontFamily: 'Lufga, sans-serif' }}>
            {/* Header */}
            <div>
                <h1 className="text-2xl font-semibold text-[#0c263b] mb-1">
                    Información Básica
                </h1>
                <p className="text-slate-500">
                    Completa los datos de ubicación y características de tu inmueble.
                </p>
            </div>

            {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
                    {error}
                </div>
            )}

            {/* SECTION A: UBICACIÓN */}
            <section className="bg-white border border-gray-200 rounded-md p-6">
                <div className="flex items-center gap-2 mb-5">
                    <MapPin className="w-5 h-5 text-[#0c263b]" />
                    <h2 className="text-lg font-semibold text-[#0c263b]">Ubicación</h2>
                </div>

                {/* Google Places Search Bar */}
                <div className="mb-5">
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        <Search className="inline w-4 h-4 mr-1" />
                        Buscar dirección en Google
                    </label>
                    <input
                        ref={searchInputRef}
                        type="text"
                        placeholder="Busca una dirección en Colombia..."
                        className="w-full h-11 px-3 bg-slate-50 border border-gray-300 rounded-md text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <p className="mt-1 text-xs text-slate-400">
                        Escribe una dirección y selecciona de las sugerencias para ubicar el pin automáticamente.
                    </p>
                </div>

                {/* MANDATORY MAP */}
                <div className="mb-5">
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                        <Navigation className="inline w-4 h-4 mr-1" />
                        Ubicación en el Mapa <span className="text-red-500 ml-1">*</span>
                    </label>
                    <p className="text-xs text-slate-400 mb-3">
                        Haz clic o arrastra el marcador para indicar la ubicación exacta del inmueble. <strong>Es obligatorio.</strong>
                    </p>

                    {isMapLoaded ? (
                        <div className="border-2 border-gray-200 rounded-xl overflow-hidden shadow-sm">
                            <GoogleMap
                                mapContainerStyle={mapContainerStyle}
                                center={mapCenter}
                                zoom={15}
                                onClick={handleMapClick}
                                options={{
                                    streetViewControl: false,
                                    mapTypeControl: false,
                                    fullscreenControl: true,
                                }}
                            >
                                <MarkerF
                                    position={markerPosition}
                                    draggable={true}
                                    onDragEnd={handleMarkerDragEnd}
                                />
                            </GoogleMap>
                        </div>
                    ) : (
                        <div className="h-[350px] bg-slate-100 rounded-xl flex items-center justify-center">
                            <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
                        </div>
                    )}

                    {/* Location Feedback Display */}
                    <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                        {isGeocodingLoading ? (
                            <div className="flex items-center gap-2 text-sm text-slate-500">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Detectando ubicación...
                            </div>
                        ) : (
                            <div className="space-y-1">
                                {pinPlaced && latitud && longitud ? (
                                    <div className="flex items-center gap-2 text-sm text-green-700">
                                        <MapPin className="w-4 h-4" />
                                        <span>
                                            Ubicación marcada en: <strong>{ciudad}</strong>
                                        </span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 text-sm text-amber-600">
                                        <AlertTriangle className="w-4 h-4" />
                                        <span className="font-medium">Debes colocar el pin en el mapa para continuar</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* City + Subdivision + Barrio + Address Grid */}
                <div className="grid md:grid-cols-2 gap-5">
                    {/* City */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                            Ciudad <span className="text-red-500 ml-1">*</span>
                        </label>
                        <select
                            value={ALL_CITIES.includes(ciudad) ? ciudad : '__other__'}
                            onChange={(e) => {
                                const val = e.target.value;
                                if (val === '__other__') {
                                    setCiudad('');
                                } else {
                                    setCiudad(val);
                                }
                                setSubdivision('');
                                setNeighborhood('');
                            }}
                            className="w-full h-11 px-3 bg-white border border-gray-300 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0c263b] focus:border-transparent"
                        >
                            {ALL_CITIES.map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                            <option value="__other__">Otra ciudad</option>
                        </select>
                    </div>

                    {/* Custom city name (if "Otra") */}
                    {!ALL_CITIES.includes(ciudad) && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                Nombre de la Ciudad <span className="text-red-500 ml-1">*</span>
                            </label>
                            <input
                                type="text"
                                value={ciudad}
                                onChange={(e) => setCiudad(e.target.value)}
                                placeholder="Ej: Tunja, Neiva, Popayán..."
                                className="w-full h-11 px-3 bg-white border border-gray-300 rounded-md text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0c263b] focus:border-transparent"
                            />
                        </div>
                    )}

                    {/* Dynamic Subdivision (Localidad / Comuna) */}
                    {renderSubdivisionField()}

                    {/* Barrio */}
                    {renderBarrioField()}

                    {/* Manual Address — Free Text */}
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                            Dirección Manual <span className="text-red-500 ml-1">*</span>
                        </label>
                        <input
                            type="text"
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            placeholder="Ej: Manzana A Casa 5, Calle 10 #5-42, Etapa 3 Torre 2 Apto 501..."
                            className="w-full h-11 px-3 bg-white border border-gray-300 rounded-md text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0c263b] focus:border-transparent"
                        />
                        <p className="mt-1 text-xs text-slate-400">
                            Escribe la dirección tal como la conoces. No te preocupes por el formato exacto.
                        </p>
                    </div>
                </div>
            </section>

            {/* SECTION B: DETALLES DEL INMUEBLE */}
            <section className="bg-white border border-gray-200 rounded-md p-6">
                <div className="flex items-center gap-2 mb-5">
                    <Home className="w-5 h-5 text-[#0c263b]" />
                    <h2 className="text-lg font-semibold text-[#0c263b]">Detalles del Inmueble</h2>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                    {/* Habitaciones */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Habitaciones <span className="text-red-500">*</span>
                        </label>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setHabitaciones(Math.max(0, habitaciones - 1))}
                                className="w-9 h-9 flex items-center justify-center border border-gray-300 rounded-md text-slate-700 hover:bg-slate-50"
                            >
                                <Minus size={16} />
                            </button>
                            <span className="w-10 text-center text-lg font-semibold text-[#0c263b]">
                                {habitaciones}
                            </span>
                            <button
                                type="button"
                                onClick={() => setHabitaciones(habitaciones + 1)}
                                className="w-9 h-9 flex items-center justify-center bg-[#0c263b] text-white rounded-md hover:bg-[#0c263b]/90"
                            >
                                <Plus size={16} />
                            </button>
                        </div>
                    </div>

                    {/* Baños */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Baños <span className="text-red-500">*</span>
                        </label>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setBanos(Math.max(0, banos - 1))}
                                className="w-9 h-9 flex items-center justify-center border border-gray-300 rounded-md text-slate-700 hover:bg-slate-50"
                            >
                                <Minus size={16} />
                            </button>
                            <span className="w-10 text-center text-lg font-semibold text-[#0c263b]">
                                {banos}
                            </span>
                            <button
                                type="button"
                                onClick={() => setBanos(banos + 1)}
                                className="w-9 h-9 flex items-center justify-center bg-[#0c263b] text-white rounded-md hover:bg-[#0c263b]/90"
                            >
                                <Plus size={16} />
                            </button>
                        </div>
                    </div>

                    {/* Área */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Área (m²) <span className="text-red-500 ml-1">*</span>
                        </label>
                        <input
                            type="number"
                            value={area || ''}
                            onChange={(e) => setArea(Number(e.target.value))}
                            placeholder="85"
                            min="0"
                            className="w-full h-11 px-3 bg-white border border-gray-300 rounded-md text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0c263b] focus:border-transparent"
                        />
                    </div>

                    {/* Estrato */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Estrato <span className="text-red-500 ml-1">*</span>
                        </label>
                        <select
                            value={estrato}
                            onChange={(e) => setEstrato(Number(e.target.value))}
                            className="w-full h-11 px-3 bg-white border border-gray-300 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0c263b] focus:border-transparent"
                        >
                            {[1, 2, 3, 4, 5, 6].map(num => (
                                <option key={num} value={num}>Estrato {num}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </section>

            {/* SECTION C: CARACTERÍSTICAS */}
            <section className="bg-white border border-gray-200 rounded-md p-6 space-y-6">
                <div>
                    <h3 className="text-sm font-semibold text-slate-700 mb-3">
                        Servicios Públicos <span className="text-red-500">*</span>
                    </h3>
                    <p className="text-xs text-slate-400 mb-3">Selecciona al menos un servicio</p>
                    <div className="flex flex-wrap gap-2">
                        {SERVICIOS_LIST.map((item) => {
                            const isSelected = servicios.includes(item);
                            return (
                                <button
                                    key={item}
                                    type="button"
                                    onClick={() => toggleServicio(item)}
                                    className={`
                                        px-4 py-2 rounded-md text-sm font-medium transition-all
                                        ${isSelected
                                            ? 'bg-[#0c263b] text-white'
                                            : 'bg-white border border-gray-300 text-slate-700 hover:border-[#0c263b]'
                                        }
                                    `}
                                >
                                    {item}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div>
                    <h3 className="text-sm font-semibold text-slate-700 mb-3">
                        Amenidades
                    </h3>
                    <div className="flex flex-wrap gap-2">
                        {AMENIDADES_LIST.map((item) => {
                            const isSelected = amenidades.includes(item);
                            return (
                                <button
                                    key={item}
                                    type="button"
                                    onClick={() => toggleAmenidad(item)}
                                    className={`
                                        px-4 py-2 rounded-md text-sm font-medium transition-all
                                        ${isSelected
                                            ? 'bg-[#0c263b] text-white'
                                            : 'bg-white border border-gray-300 text-slate-700 hover:border-[#0c263b]'
                                        }
                                    `}
                                >
                                    {item}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* FOOTER ACTIONS */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                <button
                    type="button"
                    onClick={handleSaveAndExit}
                    disabled={isSavingAndExit}
                    className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors disabled:opacity-50"
                >
                    {isSavingAndExit ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Guardando...
                        </>
                    ) : (
                        'Guardar y Volver'
                    )}
                </button>

                {/* CONTINUE BUTTON WITH CONDITIONAL STATE */}
                <button
                    type="button"
                    onClick={handleContinue}
                    disabled={isSaving || !isFormValid}
                    className={`flex items-center gap-2 px-6 py-2.5 font-medium rounded-md transition-all
                        ${(isSaving || !isFormValid)
                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            : 'bg-[#0c263b] text-white hover:bg-[#0c263b]/90 hover:scale-[1.02]'
                        }
                    `}
                >
                    {isSaving ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Guardando...
                        </>
                    ) : (
                        <>
                            Continuar
                            <ChevronRight className="w-4 h-4" />
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}
