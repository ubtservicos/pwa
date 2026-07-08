import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Polyline } from 'react-leaflet';
import L from 'leaflet';
import type { LatLngAddr, RideStatus } from '@/contexts/RideContext';
import { tomadorIcon, motoIcon, destinoIcon } from '@/lib/mapIcons';
import { getRouteInfo } from '@/lib/geoService';
import { FlyTo, MapRef, DARK_TILES, ATTRIBUTION, UBATUBA_CENTER } from '@/components/UBTMap';

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
    {/* faux road grid */}
    <div className="absolute inset-0 opacity-30" style={{
      backgroundImage:
        'linear-gradient(rgba(28,50,97,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(28,50,97,0.6) 1px, transparent 1px)',
      backgroundSize: '48px 48px',
    }} />
    {/* origin dot */}
    <div
      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full"
      style={{ background: '#0DB87E', boxShadow: '0 0 0 8px rgba(13,184,126,0.18)' }}
    />
    {(status === 'searching') && (
      <>
        {[120, 200, 300].map((r, i) => (
          <span
            key={r}
            className="absolute left-1/2 top-1/2 rounded-full pointer-events-none"
            style={{
              width: r * 2,
              height: r * 2,
              marginLeft: -r,
              marginTop: -r,
              background: 'rgba(13,184,126,0.04)',
              border: '1px solid rgba(13,184,126,0.25)',
              animation: `ubt-pulse 2.4s ease-out ${i * 0.5}s infinite`,
            }}
          />
        ))}
      </>
    )}
    <div className="absolute top-3 right-3 px-2 py-1 rounded font-sans text-[10px]" style={{ background: 'rgba(11,27,62,0.6)', color: 'rgba(255,255,255,0.4)' }}>
      {center.lat.toFixed(3)}, {center.lng.toFixed(3)}
    </div>
  </div>
);

const MototaxiMap = ({ origin, destination, prestadorLocation, status, center, onlineDrivers }: Props) => {
  const mapRef = useRef<L.Map | null>(null);
  const [polyline, setPolyline] = useState<[number, number][]>([]);

  useEffect(() => {
    if (!origin || !destination) { setPolyline([]); return; }
    getRouteInfo(origin, destination).then(info => {
      if (info) setPolyline(info.polyline);
    });
  }, [origin?.lat, origin?.lng, destination?.lat, destination?.lng]);

  if (!origin && !prestadorLocation) {
    return <MapFallback status={status} center={center} />;
  }

  const mapCenter: [number, number] = origin
    ? [origin.lat, origin.lng]
    : [center.lat, center.lng];

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
      {origin && <Marker position={[origin.lat, origin.lng]} icon={tomadorIcon} />}
      {destination && <Marker position={[destination.lat, destination.lng]} icon={destinoIcon} />}
      {prestadorLocation && (
        <Marker position={[prestadorLocation.lat, prestadorLocation.lng]} icon={motoIcon(true)} />
      )}
      {onlineDrivers && onlineDrivers.map((d) => (
        <Marker 
          key={d.id} 
          position={[Number(d.lat), Number(d.lng)]} 
          icon={motoIcon(true)} 
        />
      ))}
      {polyline.length > 0 && (
        <Polyline positions={polyline} color="#0DB87E" weight={4} opacity={0.9} />
      )}
      {origin && <FlyTo center={[origin.lat, origin.lng]} zoom={15} />}
    </MapContainer>
  );
};

export default MototaxiMap;
