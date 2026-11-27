export * from './mapIcons.tsx';

// Helper to create an SVG data URL with an emoji badge
const createEmojiIconSvg = (emoji: string, bgColor: string, size = 38): string => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 2}" fill="${bgColor}" stroke="#FFFFFF" stroke-width="2.5" />
    <text x="50%" y="54%" font-size="${size * 0.48}" text-anchor="middle" dominant-baseline="middle">${emoji}</text>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

// Tomador (Passageiro) Icon
const tomadorSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
  <circle cx="12" cy="12" r="8" fill="#2B6EE8" stroke="#FFFFFF" stroke-width="3"/>
</svg>`;
export const tomadorIcon = {
  url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(tomadorSvg)}`,
  scaledSize: { width: 24, height: 24 } as any,
};

// Destino Icon
const destinoSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 34 34">
  <circle cx="17" cy="17" r="15" fill="#FFFFFF" stroke="#0DB87E" stroke-width="3" />
  <text x="50%" y="55%" font-size="16" text-anchor="middle" dominant-baseline="middle">📍</text>
</svg>`;
export const destinoIcon = {
  url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(destinoSvg)}`,
  scaledSize: { width: 34, height: 34 } as any,
};

// Mototáxi Icon (Online/Offline)
export const motoIcon = (isOnline = true) => ({
  url: createEmojiIconSvg('🏍️', isOnline ? '#0DB87E' : '#9399AD'),
  scaledSize: { width: 38, height: 38 } as any,
});

// Carros Icon (Online/Offline)
export const carIcon = (isOnline = true) => ({
  url: createEmojiIconSvg('🚗', isOnline ? '#00E676' : '#71717A'),
  scaledSize: { width: 38, height: 38 } as any,
});

// Ambulante Icon
export const ambuIcon = (categoria = 'comida') => {
  const bg = categoria === 'esporte' ? '#F5A623' : categoria === 'bebida' ? '#2B6EE8' : categoria === 'acessorio' ? '#9B59B6' : '#0DB87E';
  const emoji = categoria === 'esporte' ? '🏄' : categoria === 'bebida' ? '🥥' : categoria === 'acessorio' ? '🕶️' : '🍢';
  return {
    url: createEmojiIconSvg(emoji, bg),
    scaledSize: { width: 38, height: 38 } as any,
  };
};

// Coleta Icon (Materiais Recicláveis)
const MATERIAL_EMOJI: Record<string, string> = {
  plastico: '♻️', vidro: '🫙', organico: '🌱', metal: '🥫', papel: '📦', misto: '🗑️', eletronico: '📱',
};
const MATERIAL_COR: Record<string, string> = {
  plastico: '#2B6EE8', vidro: '#9B59B6', organico: '#0DB87E', metal: '#9399AD', papel: '#F5A623', misto: '#5B6178', eletronico: '#E84040',
};

export const coletaIcon = (material = 'misto', coletado = false) => {
  const bg = coletado ? '#9399AD' : MATERIAL_COR[material] || '#5B6178';
  const emoji = MATERIAL_EMOJI[material] || '🗑️';
  return {
    url: createEmojiIconSvg(emoji, bg),
    scaledSize: { width: 38, height: 38 } as any,
  };
};

// Caminhão Coleta Icon
export const caminhaoIcon = (isOnline = true) => ({
  url: createEmojiIconSvg('🚛', isOnline ? '#0DB87E' : '#9399AD'),
  scaledSize: { width: 38, height: 38 } as any,
});
