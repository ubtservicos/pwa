import React from 'react';

export const TomadorMarker = () => (
  <div style={{
    width: '18px',
    height: '18px',
    borderRadius: '50%',
    background: '#2B6EE8',
    border: '3px solid #FFFFFF',
    boxShadow: '0 2px 8px rgba(0,0,0,0.40)',
  }} />
);

export const MotoMarker = ({ isOnline = true }: { isOnline?: boolean }) => (
  <div style={{
    background: isOnline ? '#0DB87E' : '#9399AD',
    borderRadius: '50%',
    width: '36px',
    height: '36px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '2px solid white',
    boxShadow: '0 2px 8px rgba(0,0,0,0.30)',
    fontSize: '18px',
    cursor: 'pointer',
  }}>
    🏍️
  </div>
);

export const CarMarker = ({ isOnline = true }: { isOnline?: boolean }) => (
  <div
    aria-label="Motorista de carro"
    style={{
      background: isOnline ? '#09090B' : '#27272A',
      borderRadius: '50%',
      width: '38px',
      height: '38px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      border: `2.5px solid ${isOnline ? '#00E676' : '#71717A'}`,
      boxShadow: isOnline
        ? '0 0 12px rgba(0,230,118,0.45), 0 2px 8px rgba(0,0,0,0.55)'
        : '0 2px 8px rgba(0,0,0,0.35)',
      cursor: 'pointer',
    }}
  >
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke={isOnline ? '#00E676' : '#A1A1AA'}
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
      <circle cx="7" cy="17" r="2" />
      <path d="M9 17h6" />
      <circle cx="17" cy="17" r="2" />
    </svg>
  </div>
);

export const DestinoMarker = () => (
  <div style={{
    background: '#FFFFFF',
    borderRadius: '50%',
    width: '34px',
    height: '34px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '2px solid #0DB87E',
    boxShadow: '0 2px 8px rgba(0,0,0,0.30)',
    fontSize: '16px',
  }}>
    📍
  </div>
);

export const AmbulanteMarker = ({ categoria = 'comida' }: { categoria?: string }) => {
  const bg = categoria === 'esporte' ? '#F5A623' : categoria === 'bebida' ? '#2B6EE8' : categoria === 'acessorio' ? '#9B59B6' : '#0DB87E';
  const emoji = categoria === 'esporte' ? '🏄' : categoria === 'bebida' ? '🥥' : categoria === 'acessorio' ? '🕶️' : '🍢';
  return (
    <div style={{
      background: bg,
      borderRadius: '50%',
      width: '36px',
      height: '36px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      border: '2px solid white',
      boxShadow: '0 2px 8px rgba(0,0,0,0.30)',
      fontSize: '18px',
      cursor: 'pointer',
    }}>
      {emoji}
    </div>
  );
};

export const ColetaMarker = ({ material = 'misto', coletado = false }: { material?: string; coletado?: boolean }) => {
  const MATERIAL_EMOJI: Record<string, string> = {
    plastico: '♻️', vidro: '🫙', organico: '🌱', metal: '🥫', papel: '📦', misto: '🗑️', eletronico: '📱',
  };
  const MATERIAL_COR: Record<string, string> = {
    plastico: '#2B6EE8', vidro: '#9B59B6', organico: '#0DB87E', metal: '#9399AD', papel: '#F5A623', misto: '#5B6178', eletronico: '#E84040',
  };
  return (
    <div style={{
      background: coletado ? '#9399AD' : MATERIAL_COR[material] || '#5B6178',
      borderRadius: '50%',
      width: '36px',
      height: '36px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      border: '2px solid white',
      boxShadow: '0 2px 8px rgba(0,0,0,0.30)',
      fontSize: '18px',
      opacity: coletado ? 0.5 : 1,
      cursor: 'pointer',
    }}>
      {MATERIAL_EMOJI[material] || '🗑️'}
    </div>
  );
};

export const CaminhaoMarker = ({ isOnline = true }: { isOnline?: boolean }) => (
  <div style={{
    background: isOnline ? '#0DB87E' : '#9399AD',
    borderRadius: '8px',
    padding: '4px 8px',
    border: '2px solid white',
    boxShadow: '0 2px 8px rgba(0,0,0,0.30)',
    fontSize: '18px',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
  }}>
    🚛
  </div>
);
