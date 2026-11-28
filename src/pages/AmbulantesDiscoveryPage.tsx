import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, MapPin, Search, X, ShoppingBag } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { reverseGeocode } from "@/lib/geoService";
import { UBATUBA_CENTER } from "@/lib/googleMapsConfig";

const AmbulantesDiscoveryPage = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [locationLabel, setLocationLabel] = useState("Localizando em Ubatuba...");
  const [categorias, setCategorias] = useState<
    Array<{ id: string; nome: string; slug: string; emoji: string; count: number }>
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const resolveUserLocation = async (lat: number, lng: number) => {
      try {
        const label = await reverseGeocode(lat, lng);
        if (active) {
          setLocationLabel(label || "Ubatuba, SP");
        }
      } catch {
        if (active) setLocationLabel("Ubatuba, SP");
      }
    };

    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolveUserLocation(pos.coords.latitude, pos.coords.longitude);
        },
        () => {
          resolveUserLocation(UBATUBA_CENTER.lat, UBATUBA_CENTER.lng);
        },
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 },
      );
    } else {
      resolveUserLocation(UBATUBA_CENTER.lat, UBATUBA_CENTER.lng);
    }

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const fetchCategorias = async () => {
      setLoading(true);
      try {
        const [{ data: cats, error }, { data: onlineSessions }, { data: approvedProfiles }] =
          await Promise.all([
            supabase.from("categorias_ambulante").select("*").order("nome"),
            supabase.from("ambulante_sessions").select("id, categoria_slug").eq("is_online", true),
            supabase.from("prestador_ambulante").select("user_id").eq("kyc_status", "approved"),
          ]);

        if (error) throw error;

        const approvedSet = new Set((approvedProfiles || []).map((p: any) => p.user_id));
        const onlineApprovedIds = (onlineSessions || [])
          .filter((s: any) => approvedSet.has(s.id))
          .map((s: any) => s.id);

        // Count online + KYC-approved vendors that have active stock > 0 per category
        const vendorIdsWithStock = new Set<string>();
        const categoryVendors = new Map<string, Set<string>>();

        if (onlineApprovedIds.length > 0) {
          const { data: stockRows } = await supabase
            .from("estoque_ambulante")
            .select("prestador_id, quantidade, disponivel, produtos_padrao(categoria_id)")
            .in("prestador_id", onlineApprovedIds)
            .eq("disponivel", true)
            .gt("quantidade", 0);

          (stockRows || []).forEach((row: any) => {
            if (!row?.prestador_id) return;
            vendorIdsWithStock.add(row.prestador_id);
            const catId = row?.produtos_padrao?.categoria_id;
            if (catId) {
              if (!categoryVendors.has(catId)) categoryVendors.set(catId, new Set());
              categoryVendors.get(catId)!.add(row.prestador_id);
            }
          });
        }

        if (cats) {
          setCategorias(
            cats.map((c: any) => {
              const fromStock = categoryVendors.get(c.id)?.size ?? 0;
              const fromSlug = (onlineSessions || []).filter(
                (s: any) =>
                  approvedSet.has(s.id) &&
                  vendorIdsWithStock.has(s.id) &&
                  s.categoria_slug === c.slug,
              ).length;
              return {
                ...c,
                count: Math.max(fromStock, fromSlug),
              };
            }),
          );
        }
      } catch (err) {
        console.error("Erro ao carregar categorias de ambulantes:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchCategorias();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return categorias;
    return categorias.filter(
      (c) =>
        c.nome.toLowerCase().includes(q) ||
        c.slug.toLowerCase().includes(q),
    );
  }, [query, categorias]);

  return (
    <div
      className="min-h-[100svh] overflow-y-auto"
      style={{ background: "#0B1B3E", padding: 24, paddingBottom: 48 }}
    >
      {/* Header */}
      <header className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate("/app/home")}
          aria-label="Voltar"
          className="flex items-center justify-center rounded-full border-none cursor-pointer shrink-0"
          style={{ width: 40, height: 40, background: "rgba(255,255,255,0.08)", color: "#fff" }}
        >
          <ArrowLeft size={20} />
        </button>

        <h1 className="font-display text-[20px] font-bold text-white flex-1 text-center">
          Ambulantes
        </h1>

        <div
          className="inline-flex items-center gap-1.5 rounded-full font-sans text-[12px] shrink-0 max-w-[165px]"
          style={{
            background: "rgba(255,255,255,0.06)",
            color: "rgba(255,255,255,0.75)",
            padding: "6px 12px",
          }}
        >
          <MapPin size={13} color="#0DB87E" className="shrink-0" />
          <span className="truncate">{locationLabel}</span>
        </div>
      </header>

      {/* Search */}
      <div
        className="mt-5 flex items-center gap-2.5"
        style={{
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.10)",
          borderRadius: 12,
          padding: "0 14px",
          height: 48,
        }}
      >
        <Search size={18} color="rgba(255,255,255,0.45)" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar produto ou ambulante..."
          className="flex-1 bg-transparent border-none outline-none font-sans text-[14px] text-white placeholder:text-white/40"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Limpar busca"
            className="bg-transparent border-none cursor-pointer p-1"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Category grid */}
      {loading ? (
        <div className="mt-16 text-center text-white/50 font-sans text-[14px]">
          Buscando categorias na região...
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-16 flex flex-col items-center text-center">
          <ShoppingBag size={40} color="rgba(255,255,255,0.28)" />
          <p className="font-display text-[17px] font-bold text-white mt-3">
            Nenhum ambulante encontrado
          </p>
          <p className="font-sans text-[13px] mt-1" style={{ color: "rgba(255,255,255,0.55)" }}>
            Tente buscar outro termo ou categoria
          </p>
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-2 gap-3">
          {filtered.map((cat) => {
            const hasOnline = cat.count > 0;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => navigate(`/app/ambulantes/categoria/${cat.slug}`)}
                className="flex flex-col items-start text-left cursor-pointer transition-transform active:scale-[0.98]"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 16,
                  padding: 16,
                }}
              >
                <span style={{ fontSize: 32, lineHeight: 1 }}>{cat.emoji}</span>
                <span className="font-display text-[14px] font-bold text-white mt-2.5 leading-snug">
                  {cat.nome}
                </span>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <span
                    className="block rounded-full"
                    style={{
                      width: 6,
                      height: 6,
                      background: hasOnline ? "#0DB87E" : "rgba(255,255,255,0.25)",
                    }}
                  />
                  <span
                    className="font-sans text-[12px]"
                    style={{ color: hasOnline ? "#0DB87E" : "rgba(255,255,255,0.45)" }}
                  >
                    {cat.count} {cat.count === 1 ? "online" : "online"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AmbulantesDiscoveryPage;
