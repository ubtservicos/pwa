import L from 'leaflet';
import { getMaterial } from '@/mocks/cocoMateriais';

export const getPinIconUrl = (materialId: string): string => {
  const m = getMaterial(materialId);
  return `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="36" height="44">
      <circle cx="18" cy="18" r="16" fill="${m.cor}" stroke="white" stroke-width="2"/>
      <text x="18" y="24" font-size="14" text-anchor="middle" font-family="serif">${m.emoji}</text>
      <polygon points="12,33 24,33 18,44" fill="${m.cor}"/>
    </svg>
  `)}`;
};

export const getTruckIconUrl = (isOnline: boolean): string => {
  const color = isOnline ? '#0DB87E' : '#9399AD';
  const dark = isOnline ? '#0C9562' : '#5B6178';
  return `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="28" viewBox="0 0 40 28">
      <rect x="2" y="6" width="28" height="17" rx="3" fill="${color}" stroke="white" stroke-width="1.5"/>
      <rect x="30" y="12" width="8" height="11" rx="2" fill="${dark}" stroke="white" stroke-width="1.5"/>
      <circle cx="10" cy="25" r="3" fill="white" stroke="${color}" stroke-width="1.5"/>
      <circle cx="28" cy="25" r="3" fill="white" stroke="${color}" stroke-width="1.5"/>
      <rect x="6" y="10" width="14" height="8" rx="1.5" fill="rgba(255,255,255,0.25)"/>
    </svg>
  `)}`;
};

// Leaflet DivIcon para pino de coleta
export const getPinIcon = (materialId: string): L.DivIcon =>
  L.divIcon({
    html: `<img src="${getPinIconUrl(materialId)}" width="36" height="44" />`,
    className: '',
    iconSize: [36, 44],
    iconAnchor: [18, 44],
    popupAnchor: [0, -44],
  });

// Leaflet DivIcon para caminhão
export const getTruckIcon = (isOnline: boolean, large = false): L.DivIcon => {
  const w = large ? 56 : 40;
  const h = large ? 40 : 28;
  return L.divIcon({
    html: `<img src="${getTruckIconUrl(isOnline)}" width="${w}" height="${h}" />`,
    className: '',
    iconSize: [w, h],
    iconAnchor: [w / 2, h / 2],
  });
};
