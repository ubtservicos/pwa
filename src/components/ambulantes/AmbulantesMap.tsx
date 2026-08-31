import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import { getCategoriaIcon, type AmbulanteSession } from '@/mocks/ambulantesSessions';
import { tomadorIcon } from '@/lib/mapIcons';
import { DARK_TILES, ATTRIBUTION, isValidLatLng, UBATUBA_CENTER } from '@/components/UBTMap';

interface Props {
  center: { lat: number; lng: number };
  sessions: AmbulanteSession[];
  onMarkerClick?: (s: AmbulanteSession) => void;
  selectedId?: string | null;
}

// Cria um ícone de ambulante usando emoji + cor
const makeAmbuIcon = (emoji: string, color: string): L.DivIcon =>
  L.divIcon({
    html: `<div style="background:${color};border-radius:50%;width:36px;height:36px;
      display:flex;align-items:center;justify-content:center;
      border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.25);font-size:18px;">${emoji}</div>`,
    className: '',
    iconSize: [36, 36],
    iconAnchor: [18, 36],
  });

const Fallback = ({ sessions, onMarkerClick }: Pick<Props, 'sessions' | 'onMarkerClick'>) => (
  <div
    className="absolute inset-0"
    style={{
      background:
        'radial-gradient(circle at 50% 40%, #1C3261 0%, #132348 40%, #0B1B3E 100%)',
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
      style={{ background: '#2B6EE8', boxShadow: '0 0 0 4px rgba(255,255,255,0.7)' }}
    />
    {sessions.map((s, i) => {
      const cat = getCategoriaIcon(s.produtos);
      const angle = (i / Math.max(sessions.length, 1)) * Math.PI * 2;
      const r = 110 + (i % 2) * 40;
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      return (
        <button
          key={s.sessionId}
          type="button"
          onClick={() => onMarkerClick?.(s)}
          className="absolute left-1/2 top-1/2 rounded-full flex items-center justify-center"
          style={{
            transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
            width: 44,
            height: 44,
            background: cat.color,
            border: '2px solid white',
            cursor: 'pointer',
            fontSize: 18,
          }}
        >
          {cat.emoji}
        </button>
      );
    })}
  </div>
);

const AmbulantesMap = ({ center, sessions, onMarkerClick }: Props) => {
  const mapCenter: [number, number] = (center && isValidLatLng(center.lat, center.lng))
    ? [Number(center.lat), Number(center.lng)]
    : UBATUBA_CENTER;

  return (
    <MapContainer
      center={mapCenter}
      zoom={15}
      style={{ width: '100%', height: '400px' }}
      zoomControl={false}
      attributionControl={false}
    >
      <TileLayer url={DARK_TILES} attribution={ATTRIBUTION} />
      <Marker position={mapCenter} icon={tomadorIcon} />
      {sessions.map((s) => {
        if (!s?.location || !isValidLatLng(s.location.lat, s.location.lng)) return null;
        const cat = getCategoriaIcon(s.produtos);
        return (
          <Marker
            key={s.sessionId}
            position={[Number(s.location.lat), Number(s.location.lng)]}
            icon={makeAmbuIcon(cat.emoji, cat.color)}
            eventHandlers={{ click: () => onMarkerClick?.(s) }}
          />
        );
      })}
    </MapContainer>
  );
};

export default AmbulantesMap;
