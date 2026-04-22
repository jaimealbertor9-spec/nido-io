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

const MAP_STYLES = [
    { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
    { featureType: 'transit', elementType: 'labels', stylers: [{ visibility: 'simplified' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#c9e5f5' }] },
    { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#f5f5f5' }] },
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

function getMarkerIcon(price: number, isActive: boolean) {
    const text = formatPrice(price);
    const textLen = text.length;
    const pillWidth = Math.max(60, textLen * 10 + 20);
    const pillHeight = 30;
    
    const bgColor = isActive ? '#0F2C59' : 'white';
    const textColor = isActive ? 'white' : '#0F2C59';
    const stroke = isActive ? '' : 'stroke="#D1D5DB" stroke-width="1.5"';
    const shadow = isActive ? '' : 'filter="url(#shadow)"';
    const filterDef = isActive
        ? ''
        : `<defs><filter id="shadow" x="-10%" y="-10%" width="130%" height="150%"><feDropShadow dx="0" dy="1" stdDeviation="2" flood-color="#000000" flood-opacity="0.12"/></filter></defs>`;
        
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${pillWidth}" height="${pillHeight + 8}" viewBox="0 0 ${pillWidth} ${pillHeight + 8}">${filterDef}<rect x="0" y="0" width="${pillWidth}" height="${pillHeight}" rx="15" fill="${bgColor}" ${stroke} ${shadow}/><text x="${pillWidth / 2}" y="${pillHeight / 2 + 5}" font-family="Inter,system-ui,sans-serif" font-size="12" font-weight="700" fill="${textColor}" text-anchor="middle">${text}</text><polygon points="${pillWidth / 2 - 5},${pillHeight} ${pillWidth / 2 + 5},${pillHeight} ${pillWidth / 2},${pillHeight + 7}" fill="${bgColor}"/></svg>`;

    return {
        url: `data:image/svg+xml,${encodeURIComponent(svg)}`,
        scaledSize: new google.maps.Size(pillWidth, pillHeight + 8),
        anchor: new google.maps.Point(pillWidth / 2, pillHeight + 8),
    };
}

const getPixelPositionOffset = (width: number, height: number) => ({
    x: -(width / 2),
    y: -(height + 45),
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

        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, []);

    const { isLoaded: isLoaderLoaded, loadError } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
        libraries: MAPS_LIBRARIES,
    });

    const isLoaded = globalMapLoaded || isLoaderLoaded;

    useEffect(() => {
        if (isLoaded) return;
        const timer = setTimeout(() => {
            if (!isLoaded) setHasTimedOut(true);
        }, LOAD_TIMEOUT_MS);
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

    if (loadError || hasTimedOut || !hasApiKey) {
        return (
            <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-6 h-full">
                <div className="max-w-sm w-full text-center">
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                        <div className="flex items-center justify-center gap-2 mb-3">
                            <AlertTriangle className="w-4 h-4 text-amber-500" />
                            <h3 className="text-sm font-bold text-gray-800">Mapa temporalmente indisponible</h3>
                        </div>
                        <p className="text-xs text-gray-500 leading-relaxed mb-4">Revisa tu conexión o recarga la página.</p>
                    </div>
                </div>
            </div>
        );
    }

    if (!isLoaded) {
        return (
            <div className="flex-1 flex items-center justify-center bg-gray-50 h-full">
                <div className="w-10 h-10 border-[3px] border-gray-200 border-t-nido-500 rounded-full animate-spin mb-3" />
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
                {results.map((result) => {
                    const isActive = activeMarkerId === result.id;
                    return (
                        <MarkerF
                            key={result.id}
                            position={{ lat: result.latitud, lng: result.longitud }}
                            onClick={() => {
                                if (isActive) {
                                    setActiveMarkerId(null);
                                } else {
                                    setActiveMarkerId(result.id);
                                    onSelectProperty?.(result.id);
                                }
                            }}
                            icon={getMarkerIcon(result.precio, isActive)}
                            zIndex={isActive ? 999 : 1}
                        />
                    );
                })}

                {activeResult && (
                    <OverlayViewF
                        position={{ lat: activeResult.latitud, lng: activeResult.longitud }}
                        mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                        getPixelPositionOffset={getPixelPositionOffset}
                    >
                        <div
                            className="animate-in fade-in zoom-in-95 duration-75 w-[280px] bg-white rounded-xl shadow-2xl overflow-hidden cursor-default"
                            style={{ transform: 'translateZ(0)' }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="relative h-36 flex gap-[2px] rounded-t-xl overflow-hidden">
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
                                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center transition-colors z-10"
                                >
                                    <X className="w-3.5 h-3.5 text-white" />
                                </button>
                                <span className="absolute bottom-2 left-2 text-[10px] font-bold text-white uppercase tracking-wider bg-black/40 backdrop-blur-sm px-2.5 py-1 rounded-full">
                                    {activeResult.tipo_inmueble}
                                </span>
                            </div>

                            <div className="p-3">
                                <div className="flex items-baseline justify-between mb-1">
                                    <p className="text-lg font-black text-gray-900">${activeResult.precio.toLocaleString('es-CO')}</p>
                                    <span className="text-[10px] text-gray-400 capitalize font-medium">{activeResult.tipo_negocio}</span>
                                </div>
                                <h4 className="text-sm font-semibold text-gray-800 leading-tight truncate mb-2">{activeResult.titulo}</h4>
                                <div className="flex items-center gap-3 text-xs text-gray-500 border-t border-gray-100 pt-2">
                                    <span className="font-semibold">🛏️ {activeResult.habitaciones}</span>
                                    <span className="font-semibold">🚿 {activeResult.banos}</span>
                                    <span className="font-semibold">📐 {activeResult.area_m2}m²</span>
                                </div>
                                <p className="text-[11px] text-gray-400 mt-1.5 truncate">📍 {activeResult.barrio}, {activeResult.ciudad}</p>
                                {activeResult.closest_poi_name && (
                                    <p className="text-[11px] text-emerald-600 mt-1 font-medium truncate">✨ {activeResult.closest_poi_distance_m}m de {activeResult.closest_poi_name}</p>
                                )}
                            </div>
                            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white rotate-45 shadow-md" />
                        </div>
                    </OverlayViewF>
                )}

                {userLocation && (
                    <MarkerF
                        position={userLocation}
                        icon={{
                            url: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#4285F4" stroke="white" stroke-width="4"/></svg>`)}`,
                            scaledSize: new google.maps.Size(24, 24),
                            anchor: new google.maps.Point(12, 12),
                        }}
                        zIndex={1000}
                    />
                )}
            </GoogleMap>

            {results.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/5 backdrop-blur-[1px] pointer-events-none">
                    <div className="bg-white/90 backdrop-blur-sm rounded-2xl px-6 py-5 text-center shadow-lg max-w-xs pointer-events-auto">
                        <span className="text-4xl mb-3 block">🗺️</span>
                        <p className="text-sm text-gray-600 font-medium">Busca propiedades para verlas en el mapa</p>
                    </div>
                </div>
            )}
        </div>
    );
}
