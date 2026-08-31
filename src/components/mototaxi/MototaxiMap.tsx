import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Polyline } from 'react-leaflet';
import L from 'leaflet';
import type { LatLngAddr, RideStatus } from '@/contexts/RideContext';
import { tomadorIcon, motoIcon, destinoIcon } from '@/lib/mapIcons';
import { getRouteInfo } from '@/lib/geoService';
import { isValidLatLng, FlyTo, MapRef, DARK_TILES, ATTRIBUTION, UBATUBA_CENTER } from '@/components/UBTMap';

interface Props {
  origin: LatLngAddr | null;
  destination: LatLngAddr | null;
  prestadorLocation: { lat: number; lng: number } | null;
  status: RideStatus;
  center: { lat: number; lng: number };
  onlineDrivers?: any[];
}

// Renders a dark fallback "map surface" when there is no valid location.
const MapFallback = ({ status, center }: { status: RideStatus; center: { lat: number; lng: number } }) => (
  <div
    className="absolute inset-0"
    style={{
      background: 'radial-gradient(circle at 50% 40%, #1C3261 0%, #132348 40%, #0B1B3E 100%)',
    }}
  >
    <div
      className="absolute inset-0 opacity-30"
      style={{
        backgroundImage:
          'linear-gradient(rgba(28,50,97,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(28,50,97,0.6) 1px, transparent 1px)',
        backgroundSize: '48px 48px',
      }}
    />
    <div
      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full"
      style={{ background: '#0DB87E', boxShadow: '0 0 0 8px rgba(13,184,126,0.18)' }}
    />
    <div
      className="absolute top-4 left-4 px-3 py-1.5 rounded-full font-mono text-[11px]"
      style={{ background: 'rgba(11,27,62,0.85)', border: '1px solid rgba(255,255,255,0.10)', color: '#9399AD' }}
    >
      📍 {center.lat.toFixed(3)}, {center.lng.toFixed(3)} • {status}
    </div>
  </div>
);

const MototaxiMap = ({
  origin,
  destination,
  prestadorLocation,
  status,
  center,
  onlineDrivers,
}: Props) => {
  const mapRef = useRef<L.Map | null>(null);
  const [polyline, setPolyline] = useState<[number, number][]>([]);

  // Buscar rota quando origem e destino existirem
  useEffect(() => {
    if (!origin || !destination) {
      setPolyline([]);
      return;
    }
    getRouteInfo(origin, destination).then((info) => {
      if (info) setPolyline(info.polyline);
    });
  }, [origin?.lat, origin?.lng, destination?.lat, destination?.lng]);

  if (!origin && !prestadorLocation) {
    return <MapFallback status={status} center={center} />;
  }

  const mapCenter: [number, number] = (origin && isValidLatLng(origin.lat, origin.lng))
    ? [Number(origin.lat), Number(origin.lng)]
    : (isValidLatLng(center?.lat, center?.lng) ? [Number(center.lat), Number(center.lng)] : UBATUBA_CENTER);

  return (
    <MapContainer
      center={mapCenter}
      zoom={15}
      style={{ width: '100%', height: '400px' }}
      zoomControl={false}
      attributionControl={false}
    >
      <TileLayer url={DARK_TILES} attribution={ATTRIBUTION} />
      <MapRef mapRef={mapRef} />
      {origin && isValidLatLng(origin.lat, origin.lng) && (
        <Marker position={[Number(origin.lat), Number(origin.lng)]} icon={tomadorIcon} />
      )}
      {destination && isValidLatLng(destination.lat, destination.lng) && (
        <Marker position={[Number(destination.lat), Number(destination.lng)]} icon={destinoIcon} />
      )}
      {prestadorLocation && isValidLatLng(prestadorLocation.lat, prestadorLocation.lng) && (
        <Marker position={[Number(prestadorLocation.lat), Number(prestadorLocation.lng)]} icon={motoIcon(true)} />
      )}
      {onlineDrivers && onlineDrivers.map((d) => {
        if (!d || !isValidLatLng(d.lat, d.lng)) return null;
        return (
          <Marker 
            key={d.id} 
            position={[Number(d.lat), Number(d.lng)]} 
            icon={motoIcon(true)} 
          />
        );
      })}
      {polyline.length > 0 && (
        <Polyline positions={polyline} color="#0DB87E" weight={4} opacity={0.9} />
      )}
      {origin && isValidLatLng(origin.lat, origin.lng) && (
        <FlyTo center={[Number(origin.lat), Number(origin.lng)]} zoom={15} />
      )}
    </MapContainer>
  );
};

export default MototaxiMap;
