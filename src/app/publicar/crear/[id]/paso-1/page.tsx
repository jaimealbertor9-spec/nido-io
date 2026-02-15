'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Inter } from 'next/font/google';
import { Loader2, Minus, Plus, MapPin, Home, ChevronRight, Navigation, AlertTriangle, Trash2, Search } from 'lucide-react';
import { GoogleMap, MarkerF, useJsApiLoader } from '@react-google-maps/api';
import { updatePropertyLocation } from '@/app/actions/updateLocation';
import { savePropertyFeatures } from '@/app/actions/saveFeatures';
import { deletePropertyDraft } from '@/app/actions/publish';
import { enrichPOIs } from '@/app/actions/enrichPOIs';
import { supabase } from '@/lib/supabase';

const inter = Inter({
    subsets: ['latin'],
    weight: ['400', '500', '600', '700']
});

// ═══════════════════════════════════════════════════════════════
// CITY CONFIG — Centers, neighborhoods, and subdivision logic
// ═══════════════════════════════════════════════════════════════
const CITY_CENTERS: Record<string, { lat: number; lng: number }> = {
    'El Líbano': { lat: 4.9213, lng: -75.0665 },
    'Bogotá': { lat: 4.6510, lng: -74.0817 },
    'Medellín': { lat: 6.2476, lng: -75.5658 },
    'Cali': { lat: 3.4516, lng: -76.5320 },
    'Barranquilla': { lat: 10.9685, lng: -74.7813 },
    'Cartagena': { lat: 10.3910, lng: -75.5144 },
    'Bucaramanga': { lat: 7.1254, lng: -73.1198 },
    'Ibagué': { lat: 4.4389, lng: -75.2322 },
};

const ALL_CITIES = Object.keys(CITY_CENTERS);

const COMUNA_CITIES = ['Medellín', 'Cali', 'Bucaramanga', 'Ibagué'];

const UBICACIONES = {
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

// Bogotá localidades
const BOGOTA_LOCALIDADES = [
    'Usaquén', 'Chapinero', 'Santa Fe', 'San Cristóbal', 'Usme', 'Tunjuelito',
    'Bosa', 'Kennedy', 'Fontibón', 'Engativá', 'Suba', 'Barrios Unidos',
    'Teusaquillo', 'Los Mártires', 'Antonio Nariño', 'Puente Aranda',
    'La Candelaria', 'Rafael Uribe Uribe', 'Ciudad Bolívar', 'Sumapaz'
];

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

// ═══════════════════════════════════════════════════════════════
// FORMAT ADDRESS UTILITY
// Constructs: "[Address], [Subdivision], [City], [Country]"
// ═══════════════════════════════════════════════════════════════
function formatAddress(components: google.maps.GeocoderAddressComponent[], placeName?: string): {
    formatted: string;
    route: string;
    streetNumber: string;
    neighborhood: string;
    sublocality: string;
    city: string;
    country: string;
} {
    let route = '';
    let streetNumber = '';
    let neighborhood = '';
    let sublocality = '';
    let city = '';
    let country = '';

    for (const component of components) {
        const types = component.types;
        if (types.includes('route')) route = component.long_name;
        if (types.includes('street_number')) streetNumber = component.long_name;
        if (types.includes('neighborhood')) neighborhood = component.long_name;
        if (types.includes('sublocality_level_1') || types.includes('sublocality')) {
            sublocality = component.long_name;
        }
        if (types.includes('locality')) city = component.long_name;
        if (types.includes('country')) country = component.long_name;
    }

    // BUILD: "[Address], [Subdivision], [City], [Country]"
    const parts: string[] = [];

    // 1. PLACE / ADDRESS
    if (route && streetNumber) {
        parts.push(`${route} #${streetNumber}`);
    } else if (route) {
        parts.push(route);
    } else if (placeName) {
        parts.push(placeName);
    }

    // 2. SUBDIVISION (neighborhood or sublocality)
    const subdivision = neighborhood || sublocality;
    if (subdivision) {
        parts.push(subdivision);
    }

    // 3. CITY
    if (city) {
        parts.push(city);
    }

    // 4. COUNTRY
    if (country) {
        parts.push(country);
    }

    return {
        formatted: parts.join(', '),
        route,
        streetNumber,
        neighborhood,
        sublocality,
        city,
        country,
    };
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
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
    const [direccionFormateada, setDireccionFormateada] = useState<string>('');

    // Map state
    const [markerPosition, setMarkerPosition] = useState(CITY_CENTERS['El Líbano']);
    const [mapCenter, setMapCenter] = useState(CITY_CENTERS['El Líbano']);

    // Refs
    const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
    const searchInputRef = useRef<HTMLInputElement | null>(null);
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
    const mapInstanceRef = useRef<google.maps.Map | null>(null);

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
    // DYNAMIC UI — Determine subdivision type per city
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
                    .select('direccion, barrio, subdivision, latitud, longitud, ciudad, direccion_formateada, habitaciones, banos, area_m2, estrato, servicios, amenities, propietario_id' as any)
                    .eq('id', propertyId)
                    .single();

                if (fetchError) {
                    console.error('[Paso1] Supabase fetch error:', fetchError);
                    if (fetchError.code === 'PGRST116') {
                        setFatalError({ message: 'Este borrador no existe o fue eliminado.', canDelete: false });
                    } else {
                        setFatalError({ message: 'Encontramos un problema al cargar tu borrador.', canDelete: true });
                    }
                    return;
                }

                if (!data) {
                    setFatalError({ message: 'No se encontró información del borrador.', canDelete: false });
                    return;
                }

                console.log('[Paso1] Data loaded successfully');

                // Populate form state (null-safe)
                setAddress((data as any).direccion ?? '');
                setNeighborhood((data as any).barrio ?? '');
                setSubdivision((data as any).subdivision ?? '');
                setLatitud((data as any).latitud ?? null);
                setLongitud((data as any).longitud ?? null);
                setCiudad((data as any).ciudad ?? 'El Líbano');
                setDireccionFormateada((data as any).direccion_formateada ?? '');
                setHabitaciones((data as any).habitaciones ?? 0);
                setBanos((data as any).banos ?? 0);
                setArea((data as any).area_m2 ?? 0);
                setEstrato((data as any).estrato ?? 3);

                // Set marker + map center if coordinates exist
                if ((data as any).latitud && (data as any).longitud) {
                    const pos = { lat: (data as any).latitud, lng: (data as any).longitud };
                    setMarkerPosition(pos);
                    setMapCenter(pos);
                    setPinPlaced(true);
                }

                // Handle arrays
                setServicios(Array.isArray((data as any).servicios) ? (data as any).servicios : []);
                setAmenidades(Array.isArray((data as any).amenities) ? (data as any).amenities : []);

            } catch (err: any) {
                console.error('[Paso1] Unexpected error loading data:', err);
                setFatalError({ message: `Error inesperado: ${err.message}`, canDelete: true });
            } finally {
                setIsLoading(false);
            }
        };

        loadData();
    }, [propertyId]);

    // ═══════════════════════════════════════════════════════════════
    // AUTOCOMPLETE SETUP — Flow A: Input → Map
    // ═══════════════════════════════════════════════════════════════
    useEffect(() => {
        if (!isMapLoaded || !searchInputRef.current) return;
        if (autocompleteRef.current) return;

        // Polling — wait for Google Places to be fully available
        const pollInterval = setInterval(() => {
            if (!window.google?.maps?.places) {
                console.log('[Autocomplete] Waiting for Places library...');
                return;
            }
            clearInterval(pollInterval);

            if (!searchInputRef.current || autocompleteRef.current) return;

            try {
                const autocomplete = new window.google.maps.places.Autocomplete(searchInputRef.current, {
                    componentRestrictions: { country: 'co' },
                    fields: ['geometry', 'formatted_address', 'name', 'address_components'],
                    types: ['geocode', 'establishment'],
                });

                autocomplete.addListener('place_changed', () => {
                    const place = autocomplete.getPlace();
                    if (place.geometry?.location) {
                        const newLat = place.geometry.location.lat();
                        const newLng = place.geometry.location.lng();
                        const newPos = { lat: newLat, lng: newLng };

                        setMarkerPosition(newPos);
                        setMapCenter(newPos);
                        setLatitud(newLat);
                        setLongitud(newLng);
                        setPinPlaced(true);

                        if (mapInstanceRef.current) {
                            mapInstanceRef.current.panTo(newPos);
                            mapInstanceRef.current.setZoom(17);
                        }

                        if (place.address_components) {
                            const parsed = formatAddress(place.address_components, place.name);

                            setDireccionFormateada(parsed.formatted);
                            if (searchInputRef.current) {
                                searchInputRef.current.value = parsed.formatted;
                            }

                            if (parsed.route && parsed.streetNumber) {
                                setAddress(`${parsed.route} #${parsed.streetNumber}`);
                            } else if (parsed.route) {
                                setAddress(parsed.route);
                            }

                            const barrio = parsed.neighborhood || parsed.sublocality;
                            if (barrio) {
                                setNeighborhood(prev => prev.trim() ? prev : barrio);
                                if (parsed.sublocality) {
                                    setSubdivision(parsed.sublocality);
                                }
                            }

                            if (parsed.city) {
                                const matchedCity = ALL_CITIES.find(c =>
                                    parsed.city.toLowerCase().includes(c.toLowerCase()) ||
                                    c.toLowerCase().includes(parsed.city.toLowerCase())
                                );
                                setCiudad(matchedCity || parsed.city);
                            }

                            console.log('[Autocomplete] formatAddress →', parsed.formatted);
                        }

                        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
                        debounceTimerRef.current = setTimeout(() => {
                            reverseGeocode(newLat, newLng);
                        }, 3000);
                    }
                });

                autocompleteRef.current = autocomplete;
                console.log('[Autocomplete] ATTACHED');
            } catch (err) {
                console.error('[Autocomplete] Failed to initialize:', err);
            }
        }, 500);

        // Cleanup: stop polling on unmount
        return () => clearInterval(pollInterval);
    }, [isMapLoaded]);

    // ═══════════════════════════════════════════════════════════════
    // Reactive panTo effect — moves map when mapCenter changes
    // ═══════════════════════════════════════════════════════════════
    useEffect(() => {
        if (mapInstanceRef.current && mapCenter) {
            mapInstanceRef.current.panTo(mapCenter);
        }
    }, [mapCenter]);

    // ═══════════════════════════════════════════════════════════════
    // Pre-fill search bar with saved address on load
    // ═══════════════════════════════════════════════════════════════
    useEffect(() => {
        if (direccionFormateada && searchInputRef.current) {
            searchInputRef.current.value = direccionFormateada;
        }
    }, [direccionFormateada]);

    // ═══════════════════════════════════════════════════════════════
    // REVERSE GEOCODING — Flow B: Map drag → Update ALL form fields
    // Uses formatAddress for consistent string construction
    // ═══════════════════════════════════════════════════════════════
    const reverseGeocode = useCallback(async (lat: number, lng: number) => {
        if (!window.google) return;

        setIsGeocodingLoading(true);
        try {
            const geocoder = new window.google.maps.Geocoder();
            const response = await geocoder.geocode({ location: { lat, lng } });

            if (response.results && response.results.length > 0) {
                const result = response.results[0];

                // Use formatAddress for consistent output
                const parsed = formatAddress(result.address_components);

                // ── Update formatted address → search bar text ──
                if (parsed.formatted) {
                    setDireccionFormateada(parsed.formatted);
                    if (searchInputRef.current) {
                        searchInputRef.current.value = parsed.formatted;
                    }
                }

                // ── Set city ──
                if (parsed.city) {
                    const matchedCity = ALL_CITIES.find(c =>
                        parsed.city.toLowerCase().includes(c.toLowerCase()) ||
                        c.toLowerCase().includes(parsed.city.toLowerCase())
                    );
                    setCiudad(matchedCity || parsed.city);
                }

                // ── Set neighborhood / barrio ──
                const barrio = parsed.neighborhood || parsed.sublocality;
                if (barrio) {
                    setNeighborhood(barrio);
                    if (parsed.sublocality) {
                        setSubdivision(parsed.sublocality);
                    }
                }

                // ── Set address from route + street number ──
                if (parsed.route && parsed.streetNumber) {
                    setAddress(`${parsed.route} #${parsed.streetNumber}`);
                } else if (parsed.route) {
                    setAddress(parsed.route);
                }

                console.log('[Geocoder] formatAddress →', parsed);
            }
        } catch (err) {
            console.error('[Geocoder] Error:', err);
        } finally {
            setIsGeocodingLoading(false);
        }
    }, []);

    // ═══════════════════════════════════════════════════════════════
    // MAP HANDLERS — Debounced (3s) reverse geocode
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

            if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
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

            if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
            debounceTimerRef.current = setTimeout(() => {
                reverseGeocode(newLat, newLng);
            }, 3000);
        }
    }, [reverseGeocode]);

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
            // Save location (subdivision explicitly passed)
            const locationResult = await updatePropertyLocation(
                propertyId,
                address.trim(),
                neighborhood,
                subdivision || null,
                latitud,
                longitud,
                ciudad,
                direccionFormateada || null
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

            // Fire-and-forget POI enrichment
            if (latitud && longitud) {
                enrichPOIs(propertyId, latitud, longitud).catch(err =>
                    console.warn('[handleContinue] POI enrichment failed:', err)
                );
            }

            // FORCED NAVIGATION — bypass React router entirely
            console.log('[handleContinue] ✅ Saves complete. Navigating to paso-2...');
            window.location.assign(`/publicar/crear/${propertyId}/paso-2`);

        } catch (err: any) {
            console.error('Save error:', err);
            setError(err.message || 'Error al guardar. Intenta de nuevo.');
            setIsSaving(false);
        }
    };

    // ═══════════════════════════════════════════════════════════════
    // SAVE AND EXIT — ALWAYS persists location if ANY data exists
    // ═══════════════════════════════════════════════════════════════
    const handleSaveAndExit = async () => {
        setError(null);
        setIsSavingAndExit(true);

        // Safety: force-kill spinner after 2s no matter what
        const spinnerTimeout = setTimeout(() => {
            setIsSavingAndExit(false);
            console.warn('[SaveAndExit] Spinner timeout — forcing redirect');
            window.location.assign('/mis-inmuebles');
        }, 2000);

        try {
            const hasLocationData = latitud !== null || longitud !== null || address.trim() || ciudad;
            if (hasLocationData) {
                console.log('[SaveAndExit] Saving location:', { latitud, longitud, ciudad, subdivision, address: address.trim() });
                const locationResult = await updatePropertyLocation(
                    propertyId,
                    address.trim() || direccionFormateada || 'Sin dirección',
                    neighborhood || 'Sin barrio',
                    subdivision || null,
                    latitud,
                    longitud,
                    ciudad,
                    direccionFormateada || null
                );

                if (!locationResult.success) {
                    console.warn('[SaveAndExit] Location save warning:', locationResult.error);
                } else {
                    console.log('[SaveAndExit] ✅ Location persisted successfully');
                }
            }

            if (habitaciones > 0 || banos > 0 || area > 0 || servicios.length > 0 || amenidades.length > 0) {
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
                    console.warn('[SaveAndExit] Features save warning:', featuresResult.error);
                }
            }

            // Fire-and-forget POI enrichment
            if (latitud && longitud) {
                enrichPOIs(propertyId, latitud, longitud).catch(err =>
                    console.warn('[SaveAndExit] POI enrichment failed:', err)
                );
            }

            clearTimeout(spinnerTimeout);
            setIsSavingAndExit(false);

            // FORCED NAVIGATION
            console.log('[SaveAndExit] ✅ Saves complete. Redirecting...');
            window.location.assign('/mis-inmuebles');

        } catch (err: any) {
            clearTimeout(spinnerTimeout);
            console.error('[SaveAndExit] Error:', err);
            setError(err.message || 'Error al guardar. Intenta de nuevo.');
            setIsSavingAndExit(false);
        }
    };

    // ═══════════════════════════════════════════════════════════════
    // DELETE DRAFT HANDLER (for recovery from corrupted drafts)
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
    // RECOVERY UI: Show when draft fails to load
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
                            onClick={() => router.push('/mis-inmuebles')}
                            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 transition-colors"
                        >
                            Volver al Dashboard
                        </button>
                    </div>
                </div>
            </div>
        );
    }

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
                        Buscar Dirección
                    </label>
                    <input
                        ref={searchInputRef}
                        type="text"
                        placeholder="Busca una dirección, lugar o punto de referencia..."
                        className="w-full h-12 px-4 bg-white border-2 border-[#0c263b]/20 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0c263b] focus:border-transparent text-base"
                    />
                    <p className="mt-1 text-xs text-slate-400">
                        Busca y selecciona una dirección. El mapa se moverá automáticamente.
                    </p>
                </div>

                <div className="grid md:grid-cols-2 gap-5">
                    {/* Address */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                            Dirección <span className="text-red-500 ml-1">*</span>
                        </label>
                        <input
                            type="text"
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            placeholder="Ej: Carrera 7 #32-16"
                            className="w-full h-11 px-3 bg-white border border-gray-300 rounded-md text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0c263b] focus:border-transparent"
                        />
                    </div>

                    {/* Neighborhood — Dynamic per city */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                            Barrio <span className="text-red-500 ml-1">*</span>
                        </label>
                        {subdivisionType === 'barrio_list' ? (
                            <select
                                value={neighborhood}
                                onChange={(e) => setNeighborhood(e.target.value)}
                                className="w-full h-11 px-3 bg-white border border-gray-300 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0c263b] focus:border-transparent"
                            >
                                <option value="">Seleccionar barrio</option>
                                {Object.entries(UBICACIONES).map(([category, barrios]) => (
                                    <optgroup key={category} label={category}>
                                        {barrios.map(barrio => (
                                            <option key={barrio} value={barrio}>{barrio}</option>
                                        ))}
                                    </optgroup>
                                ))}
                            </select>
                        ) : (
                            <input
                                type="text"
                                value={neighborhood}
                                onChange={(e) => setNeighborhood(e.target.value)}
                                placeholder="Ej: La Candelaria"
                                className="w-full h-11 px-3 bg-white border border-gray-300 rounded-md text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0c263b] focus:border-transparent"
                            />
                        )}
                    </div>
                </div>

                {/* Subdivision — Dynamic per city */}
                {subdivisionType !== 'barrio_list' && (
                    <div className="mt-5">
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                            {subdivisionType === 'localidad' ? 'Localidad' : subdivisionType === 'comuna' ? 'Comuna' : 'Zona / Localidad'}
                            <span className="text-slate-400 text-xs ml-2">(Opcional)</span>
                        </label>
                        {subdivisionType === 'localidad' ? (
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
                        ) : (
                            <input
                                type="text"
                                value={subdivision}
                                onChange={(e) => setSubdivision(e.target.value)}
                                placeholder={subdivisionType === 'comuna' ? 'Ej: Comuna 14 - El Poblado' : 'Ej: Zona Norte'}
                                className="w-full h-11 px-3 bg-white border border-gray-300 rounded-md text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0c263b] focus:border-transparent"
                            />
                        )}
                    </div>
                )}

                {/* Google Maps */}
                <div className="mt-5">
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                        <Navigation className="inline w-4 h-4 mr-1" />
                        Ubicación en el Mapa
                    </label>
                    <p className="text-xs text-slate-400 mb-3">
                        Haz clic o arrastra el marcador para indicar la ubicación exacta del inmueble.
                    </p>

                    {isMapLoaded ? (
                        <div className="border border-gray-200 rounded-lg overflow-hidden">
                            <GoogleMap
                                mapContainerStyle={mapContainerStyle}
                                center={mapCenter}
                                zoom={15}
                                onClick={handleMapClick}
                                onLoad={(map) => { mapInstanceRef.current = map; }}
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
                        <div className="h-[350px] bg-slate-100 rounded-lg flex items-center justify-center">
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
                                {(latitud && longitud) ? (
                                    <div className="flex items-center gap-2 text-sm text-green-700">
                                        <MapPin className="w-4 h-4" />
                                        <span>
                                            Ubicación marcada en: <strong>{ciudad}</strong>
                                        </span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 text-sm text-slate-500">
                                        <MapPin className="w-4 h-4" />
                                        <span>Haz clic en el mapa para marcar la ubicación</span>
                                    </div>
                                )}
                                {direccionFormateada && (
                                    <div className="flex items-center gap-2 text-sm text-slate-600">
                                        <Home className="w-4 h-4" />
                                        <span>{direccionFormateada}</span>
                                    </div>
                                )}
                            </div>
                        )}
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