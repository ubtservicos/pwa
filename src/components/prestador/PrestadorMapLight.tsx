import React, { useEffect, useState } from 'react';
import { AdvancedMarker } from '@vis.gl/react-google-maps';
import { MotoMarker, CarMarker, TomadorMarker, DestinoMarker, AmbulanteMarker, ColetaMarker } from '@/lib/mapIcons';
import { getRouteInfo } from '@/lib/geoService';
import { UBTMap, GooglePolyline, isValidLatLng, UBATUBA_CENTER } from '@/components/UBTMap';

interface Props {
  myLocation: { lat: number; lng: number } | null;
  origin?: { lat: number; lng: number } | null;
  destination?: { lat: number; lng: number } | null;
  routeFrom?: { lat: number; lng: number } | null;
  routeTo?: { lat: number; lng: number } | null;
  providerType?: 'mototaxi' | 'carro' | 'ambulante' | 'coco';
  height?: string;
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

const PrestadorMapLight = ({
  myLocation,
  origin,
  destination,
  routeFrom,
  routeTo,
  providerType = 'mototaxi',
  height = '100%',
}: Props) => {
  const [polyline, setPolyline] = useState<[number, number][]>([]);

  useEffect(() => {
    let isMounted = true;
    if (!routeFrom || !routeTo) {
      setPolyline([]);
      return;
    }
    getRouteInfo(routeFrom, routeTo).then((info) => {
      if (info && isMounted) setPolyline(info.polyline);
    });
    return () => {
      isMounted = false;
    };
  }, [routeFrom?.lat, routeFrom?.lng, routeTo?.lat, routeTo?.lng]);

  if (!myLocation || !isValidLatLng(myLocation.lat, myLocation.lng)) {
    return <Fallback myLocation={myLocation} />;
  }

  const center = { lat: Number(myLocation.lat), lng: Number(myLocation.lng) };

  return (
    <UBTMap center={center} zoom={15} style={{ width: '100%', height }}>
      {myLocation && isValidLatLng(myLocation.lat, myLocation.lng) && (
        <AdvancedMarker
          position={{ lat: Number(myLocation.lat), lng: Number(myLocation.lng) }}
        >
          {providerType === 'ambulante' ? (
            <AmbulanteMarker categoria="comida" />
          ) : providerType === 'coco' ? (
            <ColetaMarker material="misto" />
          ) : providerType === 'carro' ? (
            <CarMarker isOnline={true} />
          ) : (
            <MotoMarker isOnline={true} />
          )}
        </AdvancedMarker>
      )}
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
      {polyline.length > 0 && <GooglePolyline path={polyline} color="#0DB87E" weight={4} />}
    </UBTMap>
  );
};

export default PrestadorMapLight;
