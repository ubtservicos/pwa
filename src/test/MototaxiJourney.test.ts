import { describe, it, expect, vi } from "vitest";
import { calcPrice, calculateMototaxiQuote, calcSplit, formatBRL } from "../utils/ride";
import { RideStatus, RideState } from "../types/database.types";

// Class to simulate the state transitions of the Mototáxi journey
class RideStateMachine {
  private state: RideState;

  constructor() {
    this.state = {
      status: "idle",
      rideId: null,
      type: null,
      origin: null,
      destination: null,
      estimatedPrice: 0,
      finalPrice: 0,
      distanceKm: 0,
      durationMin: 0,
      prestadorInfo: null,
      prestadorLocation: null,
      acceptedAt: null,
      paymentMethod: null,
      messages: [],
    };
  }

  public getState(): RideState {
    return { ...this.state };
  }

  public requestRide(type: "carona" | "entrega", origin: string, dest: string, distance: number) {
    if (this.state.status !== "idle") {
      throw new Error(`Cannot request ride from state: ${this.state.status}`);
    }

    const price = calcPrice(distance);
    const duration = Math.max(3, Math.round(distance * 3));

    this.state.status = "searching";
    this.state.rideId = "ride_12345";
    this.state.type = type;
    this.state.origin = { lat: -23.4336, lng: -45.0838, address: origin };
    this.state.destination = { lat: -23.4450, lng: -45.0920, address: dest };
    this.state.distanceKm = distance;
    this.state.estimatedPrice = price;
    this.state.durationMin = duration;
  }

  public acceptRide(driverId: string, name: string, plate: string) {
    if (this.state.status !== "searching") {
      throw new Error(`Cannot accept ride from state: ${this.state.status}`);
    }

    this.state.status = "accepted";
    this.state.acceptedAt = Date.now();
    this.state.prestadorInfo = {
      name,
      photo: "url_photo",
      plate,
      rating: 4.9,
    };
    this.state.prestadorLocation = { lat: -23.4340, lng: -45.0840 };
  }

  public driverArrive() {
    if (this.state.status !== "accepted") {
      throw new Error(`Cannot arrive from state: ${this.state.status}`);
    }
    this.state.status = "arriving";
  }

  public startTrip() {
    if (this.state.status !== "arriving" && this.state.status !== "accepted") {
      throw new Error(`Cannot start trip from state: ${this.state.status}`);
    }
    this.state.status = "in_progress";
  }

  public completeTrip() {
    if (this.state.status !== "in_progress") {
      throw new Error(`Cannot complete trip from state: ${this.state.status}`);
    }
    this.state.status = "completed";
    this.state.finalPrice = this.state.estimatedPrice;
  }

  public rateDriver(rating: number) {
    if (this.state.status !== "completed") {
      throw new Error(`Cannot rate driver from state: ${this.state.status}`);
    }
    this.state.status = "rating";
  }

  public cancelRide() {
    const allowed = ["searching", "accepted", "arriving"];
    if (!allowed.includes(this.state.status)) {
      throw new Error(`Cannot cancel ride from state: ${this.state.status}`);
    }
    this.state.status = "idle";
    this.state.rideId = null;
    this.state.prestadorInfo = null;
  }
}

describe("Mototáxi Journey State Transitions & Financial Calculations", () => {
  
  describe("Unit Tests: calcPrice and Financial Math", () => {
    it("should calculate base price correctly for 0km distance", () => {
      const price = calcPrice(0);
      expect(price).toBe(4.0); // Base fixed rate
    });

    it("should calculate correct price for 1km distance", () => {
      const price = calcPrice(1);
      expect(price).toBe(6.5); // 4.0 + 2.5 * 1
    });

    it("should calculate correct price for fractional distance (3.4km)", () => {
      const price = calcPrice(3.4);
      expect(price).toBe(12.5); // 4.0 + 2.5 * 3.4 = 4.0 + 8.5 = 12.5
    });

    it("should handle floating precision correctly with rounding", () => {
      const price = calcPrice(2.78);
      // 4.0 + 2.5 * 2.78 = 4.0 + 6.95 = 10.95
      expect(price).toBe(10.95);
    });

    it("should apply round-trip (2x km) rule when distance >= kmGatilhoIdaVolta", () => {
      // 12 km >= 8 km gatilho => 24 km cobrados => 4.0 + 2.5 * 24 = 64.0
      const quote = calculateMototaxiQuote(12, {
        taxaUnica: 4.0,
        valorPorKm: 2.5,
        kmGatilhoIdaVolta: 8.0,
        fatorDemanda: 1.0,
        fatorHorario: 1.0,
        fatorClima: 1.0,
      });
      expect(quote.idaEVoltaAtivada).toBe(true);
      expect(quote.kmCobrados).toBe(24);
      expect(quote.precoBase).toBe(64.0);
      expect(quote.precoFinal).toBe(64.0);
      expect(quote.repasseMototaxista).toBe(57.6);
      expect(quote.taxaPlataforma).toBe(6.4);
    });

    it("should apply dynamic multipliers on top of round-trip base price", () => {
      // 10 km >= 8 km => 20 km cobrados => base = 4 + 2.5*20 = 54.0
      // multiplicadores: 1.3 * 1.2 * 1.0 = 1.56 => 54 * 1.56 = 84.24
      const quote = calculateMototaxiQuote(10, {
        taxaUnica: 4.0,
        valorPorKm: 2.5,
        kmGatilhoIdaVolta: 8.0,
        fatorDemanda: 1.3,
        fatorHorario: 1.2,
        fatorClima: 1.0,
      });
      expect(quote.idaEVoltaAtivada).toBe(true);
      expect(quote.precoBase).toBe(54.0);
      expect(quote.precoFinal).toBe(84.24);
      expect(quote.repasseMototaxista).toBe(75.82);
    });

    it("should disable round-trip rule when kmGatilhoIdaVolta is 0", () => {
      const quote = calculateMototaxiQuote(12, {
        taxaUnica: 4.0,
        valorPorKm: 2.5,
        kmGatilhoIdaVolta: 0,
      });
      expect(quote.idaEVoltaAtivada).toBe(false);
      expect(quote.kmCobrados).toBe(12);
      expect(quote.precoFinal).toBe(34.0);
    });

    it("should calculate splits correctly based on total transaction amount (7-way split)", () => {
      const total = 10.0;
      const splits = calcSplit(total);

      expect(splits.prestador).toBe(9.00); // 90%
      expect(splits.ubt).toBe(0.75); // 7.5%
      expect(splits.padrinhoPrestador).toBe(0.05); // 0.5%
      expect(splits.padrinhoTomador).toBe(0.05); // 0.5%
      expect(splits.associacao).toBe(0.05); // 0.5%
      expect(splits.premioTrabalhador).toBe(0.05); // 0.5%
      expect(splits.premioConsumidor).toBe(0.05); // 0.5%
      
      // Sum verification: exactly 10.00
      const sum = +(
        splits.prestador +
        splits.ubt +
        splits.padrinhoPrestador +
        splits.padrinhoTomador +
        splits.associacao +
        splits.premioTrabalhador +
        splits.premioConsumidor
      ).toFixed(2);
      expect(sum).toBe(10.00);
    });
  });

  describe("Integration Tests: RideState Machine Lifecycle", () => {
    it("should execute the complete happy path journey of a ride", () => {
      const machine = new RideStateMachine();
      expect(machine.getState().status).toBe("idle");

      // 1. Requesting
      machine.requestRide("carona", "Rua das Toninhas, 120", "Praia Grande", 3.4);
      let state = machine.getState();
      expect(state.status).toBe("searching");
      expect(state.rideId).toBe("ride_12345");
      expect(state.estimatedPrice).toBe(12.5);
      expect(state.distanceKm).toBe(3.4);

      // 2. Acceptance
      machine.acceptRide("driver_998", "Jorge Mototaxi", "ABC-1234");
      state = machine.getState();
      expect(state.status).toBe("accepted");
      expect(state.prestadorInfo?.name).toBe("Jorge Mototaxi");
      expect(state.prestadorInfo?.plate).toBe("ABC-1234");
      expect(state.prestadorLocation).toEqual({ lat: -23.4340, lng: -45.0840 });

      // 3. Driver arriving
      machine.driverArrive();
      state = machine.getState();
      expect(state.status).toBe("arriving");

      // 4. Ride starts
      machine.startTrip();
      state = machine.getState();
      expect(state.status).toBe("in_progress");

      // 5. Completion
      machine.completeTrip();
      state = machine.getState();
      expect(state.status).toBe("completed");
      expect(state.finalPrice).toBe(12.5);

      // 6. Rating
      machine.rateDriver(5);
      state = machine.getState();
      expect(state.status).toBe("rating");
    });

    it("should handle driver acceptance cancellation gracefully", () => {
      const machine = new RideStateMachine();
      
      // Request
      machine.requestRide("entrega", "Rua Centro", "Rua Estufa", 2.0);
      expect(machine.getState().status).toBe("searching");

      // Driver accepts
      machine.acceptRide("driver_55", "Ana Entregas", "XYZ-9876");
      expect(machine.getState().status).toBe("accepted");

      // Cancel
      machine.cancelRide();
      const state = machine.getState();
      expect(state.status).toBe("idle");
      expect(state.rideId).toBeNull();
      expect(state.prestadorInfo).toBeNull();
    });

    it("should enforce valid transition state rules and prevent invalid jumps", () => {
      const machine = new RideStateMachine();

      // Cannot accept from idle
      expect(() => machine.acceptRide("dr", "Name", "Plate")).toThrow();

      // Request
      machine.requestRide("carona", "A", "B", 1.0);
      
      // Cannot start trip directly from searching
      expect(() => machine.startTrip()).toThrow();
    });
  });
});
