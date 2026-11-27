import MototaxiMap from "@/components/mototaxi/MototaxiMap";
import type { LatLngAddr, RideStatus } from "@/contexts/RideContext";

interface CarroMapProps {
  origin: LatLngAddr | null;
  destination: LatLngAddr | null;
  prestadorLocation: { lat: number; lng: number } | null;
  status: RideStatus;
  center: { lat: number; lng: number };
  onlineDrivers?: any[];
  height?: string;
}

const CarroMap = (props: CarroMapProps) => (
  <MototaxiMap {...props} vehicleType="carro" />
);

export default CarroMap;
