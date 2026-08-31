import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { tomadorIcon, motoIcon, destinoIcon } from '../lib/mapIcons';
import { getRouteInfo } from '../lib/geoService';
import { isValidLatLng, FlyTo, MapRef, DARK_TILES, ATTRIBUTION, UBATUBA_CENTER } from './UBTMap';

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

    const center: [number, number] = (origin && isValidLatLng(origin.lat, origin.lng))
        ? [Number(origin.lat), Number(origin.lng)]
        : UBATUBA_CENTER;

    return (
        <MapContainer
            center={center} zoom={15}
            style={{ width: '100%', height, zIndex: 0 }}
            zoomControl={false}
            attributionControl={false}>
            <TileLayer url={DARK_TILES} attribution={ATTRIBUTION} />
            <MapRef mapRef={mapRef} />
            {origin && isValidLatLng(origin.lat, origin.lng) && (
                <Marker position={[Number(origin.lat), Number(origin.lng)]} icon={tomadorIcon} />
            )}
            {destination && isValidLatLng(destination.lat, destination.lng) && (
                <Marker position={[Number(destination.lat), Number(destination.lng)]} icon={destinoIcon} />
            )}
            {prestadorLocation && isValidLatLng(prestadorLocation.lat, prestadorLocation.lng) && (
                <Marker position={[Number(prestadorLocation.lat), Number(prestadorLocation.lng)]} icon={motoIcon(isPrestadorOnline)} />
            )}
            {polyline.length > 0 && (
                <Polyline positions={polyline} color="#0DB87E" weight={4} opacity={0.9} />
            )}
            {origin && isValidLatLng(origin.lat, origin.lng) && (
                <FlyTo center={[Number(origin.lat), Number(origin.lng)]} zoom={15} />
            )}
        </MapContainer>
    );
}