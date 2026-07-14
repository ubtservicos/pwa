import L from 'leaflet';

// Ícone base para criar SVGs coloridos
const svgIcon = (color: string, innerSvg: string, size = 36) =>
    L.divIcon({
        html: `
      <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size + 8}" viewBox="0 0 36 44">
        <circle cx="18" cy="18" r="16" fill="${color}" stroke="white" stroke-width="2"/>
        ${innerSvg}
        <polygon points="12,33 24,33 18,44" fill="${color}"/>
      </svg>
    `,
        className: '',
        iconSize: [size, size + 8],
        iconAnchor: [size / 2, size + 8],
        popupAnchor: [0, -(size + 8)],
    });

// Marcador do Tomador (círculo azul)
export const tomadorIcon = L.divIcon({
    html: `<div style="width:16px;height:16px;border-radius:50%;background:#2B6EE8;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.30)"></div>`,
    className: '',
    iconSize: [16, 16],
    iconAnchor: [8, 8],
});

// Marcador do Prestador / Mototaxi
export const motoIcon = (isOnline: boolean) => L.divIcon({
    html: `
    <div style="background:${isOnline ? '#0DB87E' : '#9399AD'};border-radius:50%;width:36px;height:36px;
      display:flex;align-items:center;justify-content:center;border:2px solid white;
      box-shadow:0 2px 8px rgba(0,0,0,0.25);font-size:18px;">
      🏍️
    </div>
  `,
    className: '',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
});

// Marcador de destino
export const destinoIcon = L.divIcon({
    html: `
    <div style="background:white;border-radius:50%;width:32px;height:32px;
      display:flex;align-items:center;justify-content:center;
      border:2px solid #0DB87E;box-shadow:0 2px 8px rgba(0,0,0,0.20);font-size:16px;">
      📍
    </div>
  `,
    className: '',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
});

// Marcador de coleta (Côco & Cia) por material
const MATERIAL_EMOJI: Record<string, string> = {
    plastico: '♻️', vidro: '🫙', organico: '🌱',
    metal: '🥫', papel: '📦', misto: '🗑️', eletronico: '📱',
};
const MATERIAL_COR: Record<string, string> = {
    plastico: '#2B6EE8', vidro: '#9B59B6', organico: '#0DB87E',
    metal: '#9399AD', papel: '#F5A623', misto: '#5B6178', eletronico: '#E84040',
};

export const coletaIcon = (material: string, coletado = false) => L.divIcon({
    html: `
    <div style="background:${coletado ? '#9399AD' : MATERIAL_COR[material] || '#5B6178'};
      border-radius:50%;width:36px;height:36px;
      display:flex;align-items:center;justify-content:center;
      border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.25);
      font-size:18px;opacity:${coletado ? 0.5 : 1};">
      ${MATERIAL_EMOJI[material] || '🗑️'}
    </div>
  `,
    className: '',
    iconSize: [36, 36],
    iconAnchor: [18, 36],
});

// Marcador de caminhão (Côco & Cia)
export const caminhaoIcon = (isOnline: boolean) => L.divIcon({
    html: `
    <div style="background:${isOnline ? '#0DB87E' : '#9399AD'};border-radius:8px;
      padding:4px 8px;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.25);
      font-size:18px;white-space:nowrap;">
      🚛
    </div>
  `,
    className: '',
    iconSize: [44, 36],
    iconAnchor: [22, 18],
});

// Marcador de ambulante por categoria
export const ambuIcon = (categoria: string) => L.divIcon({
    html: `
    <div style="background:${categoria === 'esporte' ? '#F5A623'
            : categoria === 'bebida' ? '#2B6EE8'
                : categoria === 'acessorio' ? '#9B59B6'
                    : '#0DB87E'
        };border-radius:50%;width:36px;height:36px;
      display:flex;align-items:center;justify-content:center;
      border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.25);font-size:18px;">
      ${categoria === 'esporte' ? '🏄' : categoria === 'bebida' ? '🥥' : categoria === 'acessorio' ? '🕶️' : '🍢'}
    </div>
  `,
    className: '',
    iconSize: [36, 36],
    iconAnchor: [18, 36],
});