import { createContext, useContext, useState, type ReactNode } from "react";

export type RideStatus =
  | "idle"
  | "searching"
  | "accepted"
  | "arriving"
  | "in_progress"
  | "completed"
  | "rating";

export type RideType = "carona" | "entrega";

export interface LatLngAddr {
  lat: number;
  lng: number;
  address: string;
}

export interface PrestadorInfo {
  name: string;
  photo: string;
  plate: string;
  rating: number;
}

export interface RideMessage {
  text: string;
  from: "tomador" | "prestador";
  ts: number;
}

export interface RideState {
  status: RideStatus;
  rideId: string | null;
  type: RideType | null;
  origin: LatLngAddr | null;
  destination: LatLngAddr | null;
  estimatedPrice: number;
  finalPrice: number;
  distanceKm: number;
  durationMin: number;
  prestadorInfo: PrestadorInfo | null;
  prestadorLocation: { lat: number; lng: number } | null;
  acceptedAt: number | null;
  paymentMethod: "pix" | "card" | null;
  messages: RideMessage[];
}

const initialState: RideState = {
  status: "idle",
  rideId: null,
  type: "carona",
  origin: null,
  destination: null,
  estimatedPrice: 0,
  finalPrice: 0,
  distanceKm: 0,
  durationMin: 0,
  prestadorInfo: null,
  prestadorLocation: null,
  acceptedAt: null,
  paymentMethod: "pix",
  messages: [],
};

interface RideContextValue {
  state: RideState;
  setState: (patch: Partial<RideState>) => void;
  resetRide: () => void;
}

const RideContext = createContext<RideContextValue | undefined>(undefined);

export const RideProvider = ({ children }: { children: ReactNode }) => {
  const [state, setStateRaw] = useState<RideState>(initialState);
  const setState = (patch: Partial<RideState>) =>
    setStateRaw((prev) => ({ ...prev, ...patch }));
  const resetRide = () => setStateRaw(initialState);
  return (
    <RideContext.Provider value={{ state, setState, resetRide }}>
      {children}
    </RideContext.Provider>
  );
};

export const useRide = () => {
  const ctx = useContext(RideContext);
  if (!ctx) throw new Error("useRide must be used inside RideProvider");
  return ctx;
};
