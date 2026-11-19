// Google Maps Configuration & Constants for UBT SuperApp

export const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

// A Geocoding API do Google Maps só é chamada se explicitamente habilitada via env
// para evitar erros "Geocoding Service: This API is not activated on your API project" no console.
export const GOOGLE_GEOCODING_ENABLED =
  String(import.meta.env.VITE_GOOGLE_GEOCODING_ENABLED || '').toLowerCase() === 'true';

export const UBATUBA_CENTER = { lat: -23.4336, lng: -45.0838 };

// Bounding box rigorosa do município de Ubatuba-SP
export const UBATUBA_BOUNDS = {
  north: -23.2750,
  south: -23.5900,
  west: -45.2800,
  east: -44.7500,
};

export const isValidLatLng = (lat: any, lng: any): boolean => {
  if (lat === null || lat === undefined || lng === null || lng === undefined) return false;
  const nLat = typeof lat === 'number' ? lat : Number(String(lat).trim());
  const nLng = typeof lng === 'number' ? lng : Number(String(lng).trim());
  return (
    typeof nLat === 'number' &&
    typeof nLng === 'number' &&
    !isNaN(nLat) &&
    !isNaN(nLng) &&
    isFinite(nLat) &&
    isFinite(nLng) &&
    nLat !== 0 &&
    nLng !== 0
  );
};

// Estilo Dark Theme oficial para mapas da UBT
export const GOOGLE_MAPS_DARK_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#0B1B3E" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0B1B3E" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8ec3b9" }] },
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ color: "#d59563" }],
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#9399AD" }],
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#132a4e" }],
  },
  {
    featureType: "poi.park",
    elementType: "labels.text.fill",
    stylers: [{ color: "#0DB87E" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#1c3261" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#0d1d40" }],
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [{ color: "#FFFFFF" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#2B6EE8" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [{ color: "#132348" }],
  },
  {
    featureType: "road.highway",
    elementType: "labels.text.fill",
    stylers: [{ color: "#FFFFFF" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#07122a" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#515c6d" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.stroke",
    stylers: [{ color: "#07122a" }],
  },
];
