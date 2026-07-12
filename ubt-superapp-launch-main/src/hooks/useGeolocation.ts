import { useState, useEffect, useCallback, useRef } from "react";
import { reverseGeocode } from "@/lib/geoService";

interface GeolocationState {
  coords: { lat: number; lng: number } | null;
  address: string;
  loading: boolean;
  error: string | null;
}

export const useGeolocation = (watch: boolean = false) => {
  const [state, setState] = useState<GeolocationState>({
    coords: null,
    address: "",
    loading: true,
    error: null,
  });

  const watchIdRef = useRef<number | null>(null);

  const getPosition = useCallback(async () => {
    if (!navigator.geolocation) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: "Geolocalização não suportada pelo navegador.",
      }));
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        try {
          const resolvedAddress = await reverseGeocode(lat, lng);
          setState({
            coords: { lat, lng },
            address: resolvedAddress,
            loading: false,
            error: null,
          });
        } catch (err) {
          setState({
            coords: { lat, lng },
            address: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
            loading: false,
            error: null,
          });
        }
      },
      (err) => {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: "Não foi possível obter sua localização. Ative o GPS.",
        }));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  }, []);

  useEffect(() => {
    getPosition();

    if (watch && navigator.geolocation) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          try {
            const resolvedAddress = await reverseGeocode(lat, lng);
            setState((prev) => ({
              ...prev,
              coords: { lat, lng },
              address: resolvedAddress,
              loading: false,
            }));
          } catch {
            setState((prev) => ({
              ...prev,
              coords: { lat, lng },
              loading: false,
            }));
          }
        },
        (err) => {
          console.warn("Watch position error:", err);
        },
        { enableHighAccuracy: true, maximumAge: 5000 }
      );
    }

    return () => {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [watch, getPosition]);

  return { ...state, refresh: getPosition };
};
