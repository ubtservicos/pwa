import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { tomadorIcon, motoIcon, destinoIcon } from '../lib/mapIcons';
import { getRouteInfo } from '../lib/geoService';
import { FlyTo, MapRef, DARK_TILES, ATTRIBUTION, UBATUBA_CENTER } from './UBTMap';

interface Props {
    origin: { lat: number; lng: number } | null;
    destination: { lat: number; lng: number } | null;
    prestadorLocation?: { lat: number; lng: number } | null;
    isPrestadorOnline?: boolean;
    showRoute?: boolean;
    onRouteInfo?: (distKm: number, durMin: number) => void;
    height?: string;
}

export function MototaxiMap({
    origin, destination, prestadorLocation,
    isPrestadorOnline = false, showRoute = false,
    onRouteInfo, height = '100svh',
}: Props) {
    const mapRef = useRef<L.Map | null>(null);
    const [polyline, setPolyline] = useState<[number, number][]>([]);

    // Buscar rota quando origem e destino existirem
    useEffect(() => {
        if (!showRoute || !origin || !destination) { setPolyline([]); return; }
        getRouteInfo(origin, destination).then(info => {
            if (!info) return;
            setPolyline(info.polyline);
            onRouteInfo?.(info.distanceKm, info.durationMin);
        });
    }, [origin?.lat, origin?.lng, destination?.lat, destination?.lng, showRoute]);

    const center: [number, number] = origin
        ? [origin.lat, origin.lng]
        : UBATUBA_CENTER;

    return (
        <MapContainer
            center={center} zoom={15}
            style={{ width: '100%', height, zIndex: 0 }}
            zoomControl={false}
            attributionControl={false}>
            <TileLayer url={DARK_TILES} attribution={ATTRIBUTION} />
            <MapRef mapRef={mapRef} />
            {origin && <Marker position={[origin.lat, origin.lng]} icon={tomadorIcon} />}
            {destination && <Marker position={[destination.lat, destination.lng]} icon={destinoIcon} />}
            {prestadorLocation && (
                <Marker position={[prestadorLocation.lat, prestadorLocation.lng]} icon={motoIcon(isPrestadorOnline)} />
            )}
            {polyline.length > 0 && (
                <Polyline positions={polyline} color="#0DB87E" weight={4} opacity={0.9} />
            )}
            {origin && <FlyTo center={[origin.lat, origin.lng]} zoom={15} />}
        </MapContainer>
    );
}