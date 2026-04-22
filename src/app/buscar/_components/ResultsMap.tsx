'use client';

import { useMemo, useCallback, useRef, useEffect, useState } from 'react';
import { GoogleMap, MarkerF, OverlayViewF, OverlayView, useJsApiLoader } from '@react-google-maps/api';
import { SearchResult } from './types';
import { AlertTriangle, X } from 'lucide-react';

interface ResultsMapProps {
    results?: SearchResult[];
    selectedPropertyId?: string | null;
    onSelectProperty?: (id: string) => void;
    userLocation?: { lat: number; lng: number } | null;
}

const MAPS_LIBRARIES: ('places')[] = ['places'];

// ── Serenity Ethereal Map Theme ─────────────────────────────────
const MAP_STYLES = [
    { featureType: 'all', elementType: 'labels.text.fill', stylers: [{ color: '#868E96' }] },
    { featureType: 'all', elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }, { weight: 3 }] },
    { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
    { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#E8F5E9' }] },
    { featureType: 'transit', elementType: 'labels', stylers: [{ visibility: 'off' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#E3F2FD' }] },
    { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#F8F9FA' }] },
    { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: '#FFFFFF' }] },
    { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#E9ECEF' }] },
    { featureType: 'road.highway', elementType: 'geometry.fill', stylers: [{ color: '#F1F3F5' }] },
    { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#DEE2E6' }] },
    { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#DEE2E6' }] },
];

const mapContainerStyle = { width: '100%', height: '100%', borderRadius: '0px' };
const DEFAULT_CENTER = { lat: 4.6510, lng: -74.0817 }; // Bogotá
const LOAD_TIMEOUT_MS = 6000;

const PLACEHOLDER_IMAGES = [
    'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=400&h=300&fit=crop&q=80',
    'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=200&h=150&fit=crop&q=80',
    'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=200&h=150&fit=crop&q=80',
];

function formatPrice(price: number): string {
    if (price >= 1000000) return `$${(price / 1000000).toFixed(1)}M`;
    return `$${Math.floor(price / 1000)}k`;
}

function getMarkerIcon(isActive: boolean, price: number) {
    const bgColor = isActive ? '#7146b9' : 'white';
    const textColor = isActive ? 'white' : '#7146b9';
    const formattedPrice = formatPrice(price);
    const width = Math.max(50, formattedPrice.length * 8 + 24);

    const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="32" viewBox="0 0 ${width} 32">
        <rect x="0" y="0" width="${width}" height="24" rx="12" fill="${bgColor}" stroke="#7146b9" stroke-width="2" />
        <path d="M${width/2 - 6} 24 L${width/2 + 6} 24 L${width/2} 30 Z" fill="${bgColor}" stroke="#7146b9" stroke-width="2" stroke-linejoin="round" />
        <path d="M${width/2 - 5} 23 L${width/2 + 5} 23 L${width/2} 29 Z" fill="${bgColor}" stroke="none" />
        <text x="${width/2}" y="16" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="12" font-weight="bold" fill="${textColor}" text-anchor="middle" dominant-baseline="central">${formattedPrice}</text>
    </svg>
    `;
    
    return {
        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
        scaledSize: new google.maps.Size(width, 32),
        anchor: new google.maps.Point(width / 2, 32),
    };
}

// ── OverlayView pixel offsets ───────────────────────────────────
const getCardOffset = (width: number, height: number) => ({
    x: -(width / 2),
    y: -(height + 35),
});

export default function ResultsMap({ results = [], selectedPropertyId, onSelectProperty, userLocation }: ResultsMapProps) {
    const mapRef = useRef<google.maps.Map | null>(null);
    const [hasTimedOut, setHasTimedOut] = useState(false);
    const [globalMapLoaded, setGlobalMapLoaded] = useState(false);
    const [activeMarkerId, setActiveMarkerId] = useState<string | null>(null);
    const hasApiKey = Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY);

    const activeResult = useMemo(() => (results || []).find(r => r.id === activeMarkerId) ?? null, [results, activeMarkerId]);

    useEffect(() => {
        if (selectedPropertyId) setActiveMarkerId(selectedPropertyId);
    }, [selectedPropertyId]);

    // Polling for google.maps.Map constructor
    useEffect(() => {
        let isMounted = true;
        const checkGoogleMaps = () => {
            const w = window as any;
            if (typeof window !== 'undefined' && w.google && w.google.maps && typeof w.google.maps.Map === 'function') {
                if (isMounted) setGlobalMapLoaded(true);
                return true;
            }
            return false;
        };
        if (checkGoogleMaps()) return;
        const interval = setInterval(() => {
            if (checkGoogleMaps()) clearInterval(interval);
        }, 100);
        return () => { isMounted = false; clearInterval(interval); };
    }, []);

    const { isLoaded: isLoaderLoaded, loadError } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
        libraries: MAPS_LIBRARIES,
    });

    const isLoaded = globalMapLoaded || isLoaderLoaded;

    useEffect(() => {
        if (isLoaded) return;
        const timer = setTimeout(() => { if (!isLoaded) setHasTimedOut(true); }, LOAD_TIMEOUT_MS);
        return () => clearTimeout(timer);
    }, [isLoaded]);

    const mapConfig = useMemo(() => {
        if (results.length === 0) return { center: userLocation || DEFAULT_CENTER, zoom: 12 };
        if (results.length === 1) return { center: { lat: results[0].latitud, lng: results[0].longitud }, zoom: 15 };
        const lats = results.map(r => r.latitud);
        const lngs = results.map(r => r.longitud);
        return {
            center: { lat: (Math.min(...lats) + Math.max(...lats)) / 2, lng: (Math.min(...lngs) + Math.max(...lngs)) / 2 },
            zoom: 12
        };
    }, [results, userLocation]);

    const fitBounds = useCallback(() => {
        if (!mapRef.current || results.length < 2) return;
        const bounds = new google.maps.LatLngBounds();
        results.forEach(r => bounds.extend({ lat: r.latitud, lng: r.longitud }));
        if (userLocation) bounds.extend(userLocation);
        mapRef.current.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });
    }, [results, userLocation]);

    useEffect(() => {
        if (mapRef.current && results.length >= 2) fitBounds();
    }, [results, fitBounds]);

    const onMapLoad = useCallback((map: google.maps.Map) => {
        mapRef.current = map;
        if (results.length >= 2) fitBounds();
    }, [results, fitBounds]);

    // ── Error / Loading States ──────────────────────────────────
    if (loadError || hasTimedOut || !hasApiKey) {
        return (
            <div className="flex-1 flex items-center justify-center bg-iridescent p-6 h-full">
                <div className="max-w-sm w-full text-center">
                    <div className="glass-panel rounded-3xl p-8 ambient-shadow">
                        <div className="flex items-center justify-center gap-2 mb-3">
                            <AlertTriangle className="w-5 h-5 text-amber-500" />
                            <h3 className="text-sm font-bold text-on-surface">Mapa temporalmente indisponible</h3>
                        </div>
                        <p className="text-xs text-on-surface-variant leading-relaxed">Revisa tu conexión o recarga la página.</p>
                    </div>
                </div>
            </div>
        );
    }

    if (!isLoaded) {
        return (
            <div className="flex-1 flex items-center justify-center bg-iridescent h-full">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 border-[3px] border-serenity-200 border-t-surface-tint rounded-full animate-spin" />
                    <p className="text-xs text-on-surface-variant font-medium">Cargando mapa...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 relative h-full w-full">
            <GoogleMap
                mapContainerStyle={mapContainerStyle}
                center={mapConfig.center}
                zoom={mapConfig.zoom}
                onLoad={onMapLoad}
                options={{ disableDefaultUI: true, zoomControl: true, gestureHandling: 'greedy', styles: MAP_STYLES }}
                onClick={() => setActiveMarkerId(null)}
            >
                {/* ── Serenity Price Pill Markers ── */}
                {results.map((result) => {
                    const isActive = activeMarkerId === result.id;
                    return (
                        <MarkerF
                            key={`pill-${result.id}`}
                            position={{ lat: result.latitud, lng: result.longitud }}
                            icon={getMarkerIcon(isActive, result.precio)}
                            onClick={() => {
                                if (isActive) {
                                    setActiveMarkerId(null);
                                } else {
                                    setActiveMarkerId(result.id);
                                    onSelectProperty?.(result.id);
                                }
                            }}
                            zIndex={isActive ? 100 : 1}
                        />
                    );
                })}

                {/* ── Active Property Card Overlay ── */}
                {activeResult && (
                    <OverlayViewF
                        position={{ lat: activeResult.latitud, lng: activeResult.longitud }}
                        mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                        getPixelPositionOffset={getCardOffset}
                    >
                        <div
                            className="animate-in fade-in zoom-in-95 duration-100 w-[280px] glass-panel rounded-2xl ambient-shadow-lg overflow-hidden cursor-default"
                            style={{ transform: 'translateZ(0)' }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* ── 3-Image Mosaic ── */}
                            <div className="relative h-36 flex gap-[2px] rounded-t-2xl overflow-hidden">
                                <div className="w-2/3 h-full">
                                    <img src={activeResult.image_url || PLACEHOLDER_IMAGES[0]} alt={activeResult.titulo} className="w-full h-full object-cover" />
                                </div>
                                <div className="w-1/3 h-full flex flex-col gap-[2px]">
                                    <div className="flex-1 overflow-hidden">
                                        <img src={PLACEHOLDER_IMAGES[1]} alt="Interior" className="w-full h-full object-cover" />
                                    </div>
                                    <div className="flex-1 overflow-hidden">
                                        <img src={PLACEHOLDER_IMAGES[2]} alt="Detalle" className="w-full h-full object-cover" />
                                    </div>
                                </div>
                                <button
                                    onClick={(e) => { e.stopPropagation(); setActiveMarkerId(null); }}
                                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/40 backdrop-blur-sm hover:bg-black/60 flex items-center justify-center transition-colors z-10"
                                >
                                    <X className="w-3.5 h-3.5 text-white" />
                                </button>
                                <span className="absolute bottom-2 left-2 text-[10px] font-bold text-white uppercase tracking-wider bg-surface-tint/70 backdrop-blur-sm px-2.5 py-1 rounded-full">
                                    {activeResult.tipo_inmueble}
                                </span>
                            </div>

                            {/* ── Card Info ── */}
                            <div className="p-3">
                                <div className="flex items-baseline justify-between mb-1">
                                    <p className="text-lg font-black text-on-surface">${activeResult.precio.toLocaleString('es-CO')}</p>
                                    <span className="text-[10px] text-on-surface-variant capitalize font-medium">{activeResult.tipo_negocio}</span>
                                </div>
                                <h4 className="text-sm font-semibold text-on-surface leading-tight truncate mb-2">{activeResult.titulo}</h4>
                                <div className="flex items-center gap-3 text-xs text-on-surface-variant border-t border-outline-variant/30 pt-2">
                                    <span className="font-semibold">🛏️ {activeResult.habitaciones}</span>
                                    <span className="font-semibold">🚿 {activeResult.banos}</span>
                                    <span className="font-semibold">📐 {activeResult.area_m2}m²</span>
                                </div>
                                <p className="text-[11px] text-on-surface-variant/60 mt-1.5 truncate">📍 {activeResult.barrio}, {activeResult.ciudad}</p>
                                {activeResult.closest_poi_name && (
                                    <p className="text-[11px] text-emerald-600 mt-1 font-medium truncate">✨ {activeResult.closest_poi_distance_m}m de {activeResult.closest_poi_name}</p>
                                )}
                            </div>
                            {/* Bottom arrow */}
                            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white/60 backdrop-blur-sm rotate-45 shadow-md" />
                        </div>
                    </OverlayViewF>
                )}

                {/* ── User Location ── */}
                {userLocation && (
                    <MarkerF
                        position={userLocation}
                        icon={{
                            url: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#6750A4" stroke="white" stroke-width="4"/></svg>`)}`,
                            scaledSize: new google.maps.Size(24, 24),
                            anchor: new google.maps.Point(12, 12),
                        }}
                        zIndex={1000}
                    />
                )}
            </GoogleMap>

            {/* ── Empty state ── */}
            {results.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="glass-panel rounded-3xl px-8 py-6 text-center ambient-shadow pointer-events-auto">
                        <span className="text-4xl mb-3 block">🗺️</span>
                        <p className="text-sm text-on-surface-variant font-medium">Busca propiedades para verlas en el mapa</p>
                    </div>
                </div>
            )}
        </div>
    );
}
