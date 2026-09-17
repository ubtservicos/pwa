import React, { useEffect, useRef, Component, ErrorInfo } from 'react';
import {
  APIProvider,
  Map as GoogleMap,
  AdvancedMarker,
  useMap,
} from '@vis.gl/react-google-maps';
import {
  GOOGLE_MAPS_API_KEY,
  UBATUBA_CENTER,
  UBATUBA_BOUNDS,
  isValidLatLng,
  GOOGLE_MAPS_DARK_STYLE,
} from '@/lib/googleMapsConfig';
import { Compass } from 'lucide-react';

export {
  GOOGLE_MAPS_API_KEY,
  UBATUBA_CENTER,
  UBATUBA_BOUNDS,
  isValidLatLng,
  GOOGLE_MAPS_DARK_STYLE,
};

interface MapErrorBoundaryProps {
  children: React.ReactNode;
  fallback: React.ReactNode;
}

interface MapErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class MapErrorBoundary extends Component<MapErrorBoundaryProps, MapErrorBoundaryState> {
  constructor(props: MapErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): MapErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn('[UBTMap] Google Maps Error caught by Boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

function TacticalMapFallback({ style }: { style?: React.CSSProperties }) {
  return (
    <div
      style={style}
      className="relative w-full h-[400px] bg-[#07122a] border border-[#1c3261] rounded-2xl overflow-hidden flex flex-col items-center justify-center p-6 text-center select-none"
    >
      {/* Radar Grid Background */}
      <div className="absolute inset-0 bg-[radial-gradient(#1c3261_1px,transparent_1px)] [background-size:20px_20px] opacity-40 pointer-events-none" />

      {/* Pulse Rings */}
      <div className="absolute w-48 h-48 rounded-full border border-[#00FF66]/20 animate-ping opacity-25 pointer-events-none" />
      <div className="absolute w-32 h-32 rounded-full border border-[#00FF66]/40 pointer-events-none" />

      {/* Center Icon */}
      <div className="relative z-10 w-12 h-12 rounded-full bg-[#0B1B3E] border border-[#00FF66]/60 flex items-center justify-center shadow-lg shadow-[#00FF66]/10 mb-3">
        <Compass className="w-6 h-6 text-[#00FF66]" />
      </div>

      {/* Info */}
      <div className="relative z-10 space-y-1">
        <h4 className="text-white font-semibold text-sm tracking-wide">UBT Radar GPS (Modo Tático)</h4>
        <p className="text-xs text-white/50 max-w-xs">
          Posicionamento Ubatuba-SP.
        </p>
      </div>
    </div>
  );
}

// Componente para desenhar Polyline no Google Map
export function GooglePolyline({
  path,
  color = '#0DB87E',
  weight = 4,
  opacity = 0.9,
}: {
  path: [number, number][];
  color?: string;
  weight?: number;
  opacity?: number;
}) {
  const map = useMap();
  const polylineRef = useRef<google.maps.Polyline | null>(null);

  useEffect(() => {
    if (!map || typeof google === 'undefined' || !google.maps) return;

    if (!polylineRef.current) {
      polylineRef.current = new google.maps.Polyline({
        map,
        strokeColor: color,
        strokeWeight: weight,
        strokeOpacity: opacity,
      });
    } else {
      polylineRef.current.setMap(map);
      polylineRef.current.setOptions({ strokeColor: color, strokeWeight: weight, strokeOpacity: opacity });
    }

    const latLngPath = path
      .filter(([lat, lng]) => isValidLatLng(lat, lng))
      .map(([lat, lng]) => ({ lat: Number(lat), lng: Number(lng) }));

    polylineRef.current.setPath(latLngPath);

    return () => {
      if (polylineRef.current) {
        polylineRef.current.setMap(null);
      }
    };
  }, [map, path, color, weight, opacity]);

  return null;
}

// Componente para mover a câmera suavemente (FlyTo)
export function MapFlyTo({ center, zoom = 15 }: { center: { lat: number; lng: number } | [number, number]; zoom?: number }) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    const lat = Array.isArray(center) ? center[0] : center.lat;
    const lng = Array.isArray(center) ? center[1] : center.lng;
    if (isValidLatLng(lat, lng)) {
      map.panTo({ lat: Number(lat), lng: Number(lng) });
      if (zoom) map.setZoom(zoom);
    }
  }, [map, center, zoom]);

  return null;
}

// Componente para capturar clique no mapa
export function MapClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  const map = useMap();

  useEffect(() => {
    if (!map || typeof google === 'undefined' || !google.maps) return;
    const listener = map.addListener('click', (e: google.maps.MapMouseEvent) => {
      if (e.latLng) {
        onClick(e.latLng.lat(), e.latLng.lng());
      }
    });

    return () => {
      google.maps.event.removeListener(listener);
    };
  }, [map, onClick]);

  return null;
}

interface UBTMapProps {
  center?: { lat: number; lng: number } | [number, number];
  zoom?: number;
  style?: React.CSSProperties;
  children?: React.ReactNode;
  dark?: boolean;
  mapId?: string;
  onClick?: (lat: number, lng: number) => void;
  gestureHandling?: 'cooperative' | 'greedy' | 'none' | 'auto';
}

export function UBTMap({
  center = UBATUBA_CENTER,
  zoom = 14,
  style = { width: '100%', height: '400px' },
  children,
  dark = true,
  mapId = 'ubt_dark_map',
  onClick,
  gestureHandling = 'greedy',
}: UBTMapProps) {
  const defaultCenter = Array.isArray(center)
    ? { lat: Number(center[0]), lng: Number(center[1]) }
    : { lat: Number(center.lat), lng: Number(center.lng) };

  if (!GOOGLE_MAPS_API_KEY) {
    return <TacticalMapFallback style={style} />;
  }

  return (
    <MapErrorBoundary fallback={<TacticalMapFallback style={style} />}>
      <APIProvider apiKey={GOOGLE_MAPS_API_KEY} libraries={['places', 'routes', 'geometry', 'marker']}>
        <GoogleMap
          mapId={mapId}
          defaultCenter={defaultCenter}
          defaultZoom={zoom}
          style={style}
          disableDefaultUI={true}
          gestureHandling={gestureHandling}
          restriction={{
            latLngBounds: UBATUBA_BOUNDS,
            strictBounds: false,
          }}
        >
          {onClick && <MapClickHandler onClick={onClick} />}
          {children}
        </GoogleMap>
      </APIProvider>
    </MapErrorBoundary>
  );
}

export { AdvancedMarker };
export default UBTMap;
