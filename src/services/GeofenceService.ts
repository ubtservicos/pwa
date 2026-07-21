// GeofenceService.ts
// Servico de validacao geografica (Geofencing) da UBT SuperApp

export interface Coordinate {
  lat: number;
  lng: number;
}

// Poligono simplificado abrangendo os limites geograficos do municipio de Ubatuba-SP
export const UBATUBA_POLYGON: Coordinate[] = [
  { lat: -23.3644, lng: -45.1951 }, // Divisa Oeste / Serra do Mar
  { lat: -23.2750, lng: -44.8950 }, // Divisa Norte (RJ / Picinguaba)
  { lat: -23.3500, lng: -44.7500 }, // Costa Norte
  { lat: -23.4750, lng: -44.9750 }, // Ubatuba Centro / Ponta Grossa
  { lat: -23.5900, lng: -45.2100 }, // Divisa Sul (Maranduba / Caraguatatuba)
  { lat: -23.5100, lng: -45.2750 }, // Divisa Sudoeste inland
  { lat: -23.3644, lng: -45.1951 }  // Fechamento do poligono
];

/**
 * Valida se um par de coordenadas geograficas esta dentro do poligono do municipio de Ubatuba.
 * Utiliza o algoritmo de Ray-Casting (Ponto em Poligono).
 */
export function isLocationInUbatuba(lat: number, lng: number): boolean {
  let inside = false;
  const len = UBATUBA_POLYGON.length;
  
  for (let i = 0, j = len - 1; i < len; j = i++) {
    const xi = UBATUBA_POLYGON[i].lng, yi = UBATUBA_POLYGON[i].lat;
    const xj = UBATUBA_POLYGON[j].lng, yj = UBATUBA_POLYGON[j].lat;
    
    const intersect = ((yi > lat) !== (yj > lat))
        && (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  
  return inside;
}

/**
 * Valida se um CEP pertence a faixa municipal de Ubatuba (11680-000 ate 11699-999).
 */
export function isCepInUbatuba(cep: string): boolean {
  const cleanCep = cep.replace(/\D/g, "");
  if (cleanCep.length !== 8) return false;
  
  const numCep = parseInt(cleanCep, 10);
  return numCep >= 11680000 && numCep <= 11699999;
}

/**
 * Extrai o CEP de uma string de endereco.
 */
export function extractCep(address: string): string | null {
  const match = address.match(/\b\d{5}-?\d{3}\b/);
  return match ? match[0] : null;
}

/**
 * Realiza a validacao consolidada de geofence de Ubatuba,
 * priorizando coordenadas e usando CEP/busca nominal como fallback.
 */
export function validateGeofence(
  address?: string,
  coords?: Coordinate
): { inside: boolean; method: "coordinates" | "cep" | "text" | "none"; reason?: string } {
  
  // 1. Validacao por coordenadas (precisao absoluta)
  if (coords && coords.lat && coords.lng) {
    const isInside = isLocationInUbatuba(coords.lat, coords.lng);
    return {
      inside: isInside,
      method: "coordinates",
      reason: isInside ? undefined : "As coordenadas geograficas estao fora dos limites do municipio de Ubatuba."
    };
  }

  // 2. Validacao por CEP (fallback secundario)
  if (address) {
    const cep = extractCep(address);
    if (cep) {
      const isInside = isCepInUbatuba(cep);
      return {
        inside: isInside,
        method: "cep",
        reason: isInside ? undefined : `O CEP ${cep} nao pertence a faixa de atendimento de Ubatuba-SP.`
      };
    }
  }

  // 3. Validacao por busca nominal textual (fallback terciario)
  if (address) {
    const addressLower = address.toLowerCase();
    const hasUbatuba = addressLower.includes("ubatuba") || addressLower.includes("uba");
    const hasNeighbour = addressLower.includes("caraguatatuba") || addressLower.includes("caragua") || addressLower.includes("paraty");
    
    // Se cita Ubatuba e nao cita cidades vizinhas diretamente como destino
    const isInside = hasUbatuba && !hasNeighbour;
    return {
      inside: isInside,
      method: "text",
      reason: isInside ? undefined : "Nao foi possivel confirmar Ubatuba como localidade de atendimento no endereco informado."
    };
  }

  return {
    inside: false,
    method: "none",
    reason: "Sem dados geograficos (coordenadas ou endereco) disponiveis para validacao."
  };
}
