import { describe, it, expect } from "vitest";
import {
  isLocationInUbatuba,
  isCepInUbatuba,
  extractCep,
  validateGeofence
} from "../GeofenceService";

describe("GeofenceService - Coordenadas (Polígono)", () => {
  it("deve permitir coordenadas dentro do centro de Ubatuba", () => {
    // Coordenadas aproximadas do centro de Ubatuba
    const result = isLocationInUbatuba(-23.4339, -45.0711);
    expect(result).toBe(true);
  });

  it("deve permitir coordenadas na divisa sul (Maranduba)", () => {
    const result = isLocationInUbatuba(-23.54, -45.20);
    expect(result).toBe(true);
  });

  it("deve rejeitar coordenadas fora do município (ex: Caraguatatuba)", () => {
    const result = isLocationInUbatuba(-23.62, -45.42);
    expect(result).toBe(false);
  });

  it("deve rejeitar coordenadas distantes (ex: São Paulo - Capital)", () => {
    const result = isLocationInUbatuba(-23.5505, -46.6333);
    expect(result).toBe(false);
  });
});

describe("GeofenceService - Validação por CEP", () => {
  it("deve aceitar CEP geral de Ubatuba", () => {
    expect(isCepInUbatuba("11680-000")).toBe(true);
  });

  it("deve aceitar CEPs específicos de ruas de Ubatuba", () => {
    expect(isCepInUbatuba("11685-120")).toBe(true);
    expect(isCepInUbatuba("11690100")).toBe(true);
  });

  it("deve rejeitar CEP de Caraguatatuba", () => {
    expect(isCepInUbatuba("11660-000")).toBe(false);
  });

  it("deve rejeitar CEP de São Paulo", () => {
    expect(isCepInUbatuba("01310-100")).toBe(false);
  });
});

describe("GeofenceService - Extração de CEP", () => {
  it("deve extrair CEP de endereços formatados", () => {
    expect(extractCep("Rua Guarani, 120, Ubatuba - SP, 11680-000")).toBe("11680-000");
    expect(extractCep("CEP 11685000 - Centro")).toBe("11685000");
  });

  it("deve retornar null se não houver CEP", () => {
    expect(extractCep("Rua Guarani, 120, Ubatuba")).toBeNull();
  });
});

describe("GeofenceService - Validação Consolidada (validateGeofence)", () => {
  it("deve validar com sucesso por coordenadas se disponíveis e válidas", () => {
    const res = validateGeofence("Qualquer texto", { lat: -23.4339, lng: -45.0711 });
    expect(res.inside).toBe(true);
    expect(res.method).toBe("coordinates");
  });

  it("deve falhar por coordenadas se fora de Ubatuba", () => {
    const res = validateGeofence("Rua Guarani, Ubatuba", { lat: -23.62, lng: -45.42 });
    expect(res.inside).toBe(false);
    expect(res.method).toBe("coordinates");
  });

  it("deve recorrer ao CEP se coordenadas não forem informadas", () => {
    const res = validateGeofence("Rua Guarani, 120 - 11680-000");
    expect(res.inside).toBe(true);
    expect(res.method).toBe("cep");
  });

  it("deve recorrer à busca nominal se não houver CEP nem coordenadas", () => {
    const res = validateGeofence("Av. Iperoig, Centro, Ubatuba");
    expect(res.inside).toBe(true);
    expect(res.method).toBe("text");
  });

  it("deve falhar se o texto mencionar apenas cidades vizinhas", () => {
    const res = validateGeofence("Av. da Praia, Caraguatatuba");
    expect(res.inside).toBe(false);
    expect(res.method).toBe("text");
  });
});
