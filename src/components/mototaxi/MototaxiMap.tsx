import React, { useEffect, useState } from 'react';
import { AdvancedMarker } from '@vis.gl/react-google-maps';
import type { LatLngAddr, RideStatus } from '@/contexts/RideContext';
import { TomadorMarker, MotoMarker, CarMarker, DestinoMarker } from '@/lib/mapIcons';
import { getRouteInfo } from '@/lib/geoService';
import { UBTMap, GooglePolyline, MapFlyTo, isValidLatLng, UBATUBA_CENTER } from '@/components/UBTMap';

interface Props {
  origin: LatLngAddr | null;
  destination: LatLngAddr | null;
  prestadorLocation: { lat: number; lng: number } | null;
  status: RideStatus;
  center: { lat: number; lng: number };
  onlineDrivers?: any[];
  vehicleType?: 'mototaxi' | 'carro';
  height?: string;
}

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
  vehicleType = 'mototaxi',
  height = '100%',
}: Props) => {
  const [polyline, setPolyline] = useState<[number, number][]>([]);

  useEffect(() => {
    let isMounted = true;
    if (!origin || !destination || status === 'completed' || status === 'rating') {
      return;
    }
    getRouteInfo(origin, destination).then((info) => {
      if (info && isMounted) setPolyline(info.polyline);
    });
    return () => {
      isMounted = false;
    };
  }, [origin?.lat, origin?.lng, destination?.lat, destination?.lng, status]);

  if (!origin && !prestadorLocation) {
    return <MapFallback status={status} center={center} />;
  }

  const mapCenter = origin && isValidLatLng(origin.lat, origin.lng)
    ? { lat: Number(origin.lat), lng: Number(origin.lng) }
    : (isValidLatLng(center?.lat, center?.lng) ? { lat: Number(center.lat), lng: Number(center.lng) } : UBATUBA_CENTER);

  return (
    <UBTMap center={mapCenter} zoom={15} style={{ width: '100%', height }}>
      {origin && isValidLatLng(origin.lat, origin.lng) && (
        <AdvancedMarker position={{ lat: Number(origin.lat), lng: Number(origin.lng) }}>
          <TomadorMarker />
        </AdvancedMarker>
      )}
      {destination && isValidLatLng(destination.lat, destination.lng) && (
        <AdvancedMarker position={{ lat: Number(destination.lat), lng: Number(destination.lng) }}>
          <DestinoMarker />
        </AdvancedMarker>
      )}
      {prestadorLocation && isValidLatLng(prestadorLocation.lat, prestadorLocation.lng) && (
        <AdvancedMarker position={{ lat: Number(prestadorLocation.lat), lng: Number(prestadorLocation.lng) }}>
          {vehicleType === 'carro' ? <CarMarker isOnline={true} /> : <MotoMarker isOnline={true} />}
        </AdvancedMarker>
      )}
      {onlineDrivers && onlineDrivers.map((d) => {
        if (!d || !isValidLatLng(d.lat, d.lng)) return null;
        return (
          <AdvancedMarker 
            key={d.id} 
            position={{ lat: Number(d.lat), lng: Number(d.lng) }} 
          >
            {vehicleType === 'carro' ? <CarMarker isOnline={true} /> : <MotoMarker isOnline={true} />}
          </AdvancedMarker>
        );
      })}
      {polyline.length > 0 && <GooglePolyline path={polyline} color="#0DB87E" weight={4} />}
      {origin && isValidLatLng(origin.lat, origin.lng) && (
        <MapFlyTo center={{ lat: Number(origin.lat), lng: Number(origin.lng) }} zoom={15} />
      )}
    </UBTMap>
  );
};

export default MototaxiMap;
