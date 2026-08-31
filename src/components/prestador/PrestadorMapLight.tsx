import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Polyline } from 'react-leaflet';
import L from 'leaflet';
import { motoIcon, tomadorIcon, destinoIcon, ambuIcon, coletaIcon } from '@/lib/mapIcons';
import { getRouteInfo } from '@/lib/geoService';
import { MapRef, DARK_TILES, ATTRIBUTION, UBATUBA_CENTER, isValidLatLng } from '@/components/UBTMap';

interface Props {
  myLocation: { lat: number; lng: number } | null;
  origin?: { lat: number; lng: number } | null;
  destination?: { lat: number; lng: number } | null;
  routeFrom?: { lat: number; lng: number } | null;
  routeTo?: { lat: number; lng: number } | null;
  providerType?: "mototaxi" | "ambulante" | "coco";
}

const Fallback = ({ myLocation }: { myLocation: { lat: number; lng: number } | null }) => (
  <div className="absolute inset-0" style={{ background: '#09090B' }}>
    <div
      className="absolute inset-0 opacity-40"
      style={{
        backgroundImage:
          'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)',
        backgroundSize: '48px 48px',
      }}
    />
    <div
      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full"
      style={{ background: '#0DB87E', boxShadow: '0 0 0 8px rgba(13,184,126,0.18)' }}
    />
    {myLocation && (
      <div
        className="absolute top-3 right-3 px-2 py-1 rounded font-sans text-[10px]"
        style={{ background: '#18181B', border: '1px solid #27272A', color: '#A1A1AA' }}
      >
        {myLocation.lat.toFixed(3)}, {myLocation.lng.toFixed(3)}
      </div>
    )}
  </div>
);

const PrestadorMapLight = ({ myLocation, origin, destination, routeFrom, routeTo, providerType = "mototaxi" }: Props) => {
  const mapRef = useRef<L.Map | null>(null);
  const [polyline, setPolyline] = useState<[number, number][]>([]);

  useEffect(() => {
    if (!routeFrom || !routeTo) { setPolyline([]); return; }
    getRouteInfo(routeFrom, routeTo).then(info => {
      if (info) setPolyline(info.polyline);
    });
  }, [routeFrom?.lat, routeFrom?.lng, routeTo?.lat, routeTo?.lng]);

  if (!myLocation || !isValidLatLng(myLocation.lat, myLocation.lng)) {
    return <Fallback myLocation={myLocation} />;
  }

  const center: [number, number] = [Number(myLocation.lat), Number(myLocation.lng)];

  return (
    <MapContainer
      center={center}
      zoom={15}
      style={{ width: '100%', height: '400px' }}
      zoomControl={false}
      attributionControl={false}
    >
      <TileLayer url={DARK_TILES} attribution={ATTRIBUTION} />
      <MapRef mapRef={mapRef} />
      {myLocation && isValidLatLng(myLocation.lat, myLocation.lng) && (
        <Marker 
          position={[Number(myLocation.lat), Number(myLocation.lng)]} 
          icon={providerType === "ambulante" ? ambuIcon("comida") : providerType === "coco" ? coletaIcon("misto") : motoIcon(true)} 
        />
      )}
      {origin && isValidLatLng(origin.lat, origin.lng) && (
        <Marker position={[Number(origin.lat), Number(origin.lng)]} icon={tomadorIcon} />
      )}
      {destination && isValidLatLng(destination.lat, destination.lng) && (
        <Marker position={[Number(destination.lat), Number(destination.lng)]} icon={destinoIcon} />
      )}
      {polyline.length > 0 && (
        <Polyline positions={polyline} color="#0DB87E" weight={4} opacity={0.9} />
      )}
    </MapContainer>
  );
};

export default PrestadorMapLight;
