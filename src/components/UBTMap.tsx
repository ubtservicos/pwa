import { useEffect, useRef } from 'react';
import {
    MapContainer, TileLayer, Marker, Popup,
    useMap, useMapEvents
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Tile escuro (dark theme para o Tomador)
export const DARK_TILES = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

// Tile claro (para o Prestador e o Admin)
export const LIGHT_TILES = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

// Tile padrão OpenStreetMap (fallback)
export const OSM_TILES = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

// Attribution obrigatório (OpenStreetMap exige)
export const ATTRIBUTION =
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>';

// Ubatuba como centro padrão
export const UBATUBA_CENTER: [number, number] = [-23.4336, -45.0838];

// Componente auxiliar para mover o mapa programaticamente
export function FlyTo({ center, zoom }: { center: [number, number]; zoom?: number }) {
    const map = useMap();
    useEffect(() => {
        map.flyTo(center, zoom ?? map.getZoom(), { duration: 1.2 });
    }, [center, zoom]);
    return null;
}

// Componente auxiliar para capturar clique no mapa
export function MapClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
    useMapEvents({
        click(e) {
            onClick(e.latlng.lat, e.latlng.lng);
        },
    });
    return null;
}

// Componente auxiliar para manter referência externa do mapa
export function MapRef({ mapRef }: { mapRef: React.MutableRefObject<L.Map | null> }) {
    const map = useMap();
    useEffect(() => { mapRef.current = map; }, [map]);
    return null;
}