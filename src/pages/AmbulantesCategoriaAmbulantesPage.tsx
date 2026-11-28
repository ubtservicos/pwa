import { useEffect, useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, MapPin, ShoppingBag, Star } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { reverseGeocode } from "@/lib/geoService";
import { UBATUBA_CENTER } from "@/lib/googleMapsConfig";
import AmbulanteTrustBadges, {
  formatDistanceLabel,
  haversineDistanceKm,
  isDeliveryModalidade,
} from "@/components/ambulantes/AmbulanteTrustBadges";

interface AmbulanteCardData {
  sessionId: string;
  prestadorId: string;
  nome: string;
  emoji: string;
  rating: number;
  lat: number | null;
  lng: number | null;
  distanceKm: number | null;
  deliveryFee: number;
  modalidades: string[];
  praiaReferencia: string | null;
  pontoReferencia: string | null;
  tipoEstrutura: string | null;
  estruturaPhotoUrl: string | null;
  possuiAlvara: boolean;
  possuiVigilanciaSanitaria: boolean;
  itensDisponiveis: number;
  previewItens: Array<{ nome: string; preco: number }>;
}

const AmbulantesCategoriaAmbulantesPage = () => {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const [cat, setCat] = useState<{ id: string; nome: string; emoji: string; slug: string } | null>(null);
  const [ambulantes, setAmbulantes] = useState<AmbulanteCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [locationLabel, setLocationLabel] = useState("Ubatuba, SP");
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number }>(UBATUBA_CENTER);
  const [modalFilter, setModalFilter] = useState<"todos" | "entrega" | "retirada">("todos");

  useEffect(() => {
    let active = true;
    const resolveCoords = async (lat: number, lng: number) => {
      if (active) setUserCoords({ lat, lng });
      try {
        const label = await reverseGeocode(lat, lng);
        if (active && label) setLocationLabel(label);
      } catch {
        // Keep Ubatuba fallback
      }
    };

    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolveCoords(pos.coords.latitude, pos.coords.longitude),
        () => resolveCoords(UBATUBA_CENTER.lat, UBATUBA_CENTER.lng),
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 },
      );
    } else {
      resolveCoords(UBATUBA_CENTER.lat, UBATUBA_CENTER.lng);
    }

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const fetchAmbulantes = async () => {
      if (!slug) return;
      setLoading(true);
      try {
        // 1. Category details
        const { data: catData } = await supabase
          .from("categorias_ambulante")
          .select("*")
          .eq("slug", slug)
          .maybeSingle();

        if (!catData) {
          setCat(null);
          setAmbulantes([]);
          return;
        }
        setCat(catData);

        // 2. Strict filter: ONLY online sessions AND KYC-approved prestador_ambulante
        const [{ data: sessions }, { data: approvedProfiles }] = await Promise.all([
          supabase
            .from("ambulante_sessions")
            .select(
              "id, is_online, categoria_slug, modalidades, lat, lng, delivery_fee, praia_referencia, ponto_referencia, usuarios(nome)",
            )
            .eq("is_online", true),
          supabase
            .from("prestador_ambulante")
            .select(
              "user_id, nome_comercial, delivery_fee, modalidades, praia_referencia, ponto_referencia, tipo_estrutura, estrutura_photo_url, possui_alvara, possui_vigilancia_sanitaria, kyc_status",
            )
            .eq("kyc_status", "approved"),
        ]);

        const profileMap = new Map<string, any>();
        (approvedProfiles || []).forEach((p: any) => profileMap.set(p.user_id, p));

        const eligibleSessions = (sessions || []).filter((s: any) => profileMap.has(s.id));
        if (eligibleSessions.length === 0) {
          setAmbulantes([]);
          return;
        }

        const eligibleIds = eligibleSessions.map((s: any) => s.id);

        // 3. Stock > 0 and disponivel = true for eligible vendors
        const [{ data: stockRows }, { data: ratingRows }] = await Promise.all([
          supabase
            .from("estoque_ambulante")
            .select(
              "prestador_id, preco_venda, quantidade, disponivel, produtos_padrao(nome, categoria_id)",
            )
            .in("prestador_id", eligibleIds)
            .eq("disponivel", true)
            .gt("quantidade", 0),
          supabase
            .from("ambulante_avaliacoes")
            .select("avaliado_id, nota")
            .in("avaliado_id", eligibleIds),
        ]);

        // Aggregate ratings
        const ratingMap = new Map<string, { sum: number; count: number }>();
        (ratingRows || []).forEach((r: any) => {
          const cur = ratingMap.get(r.avaliado_id) || { sum: 0, count: 0 };
          cur.sum += Number(r.nota || 0);
          cur.count += 1;
          ratingMap.set(r.avaliado_id, cur);
        });

        // Group active stock per vendor (matching category OR vendor's primary slug)
        const stockByVendor = new Map<string, Array<{ nome: string; preco: number; matchesCat: boolean }>>();
        (stockRows || []).forEach((row: any) => {
          const pid = row.prestador_id;
          if (!pid) return;
          const matchesCat = row?.produtos_padrao?.categoria_id === catData.id;
          if (!stockByVendor.has(pid)) stockByVendor.set(pid, []);
          stockByVendor.get(pid)!.push({
            nome: row?.produtos_padrao?.nome || "Produto",
            preco: Number(row.preco_venda || 0),
            matchesCat,
          });
        });

        const list: AmbulanteCardData[] = [];
        for (const sess of eligibleSessions as any[]) {
          const prof = profileMap.get(sess.id);
          const allVendorStock = stockByVendor.get(sess.id) || [];
          const catStock = allVendorStock.filter((i) => i.matchesCat);
          const effectiveStock =
            catStock.length > 0
              ? catStock
              : sess.categoria_slug === slug
                ? allVendorStock
                : [];

          // Must have at least 1 active product in stock
          if (effectiveStock.length === 0) continue;

          const lat = sess.lat !== null && sess.lat !== undefined ? Number(sess.lat) : null;
          const lng = sess.lng !== null && sess.lng !== undefined ? Number(sess.lng) : null;
          const dist = haversineDistanceKm(userCoords.lat, userCoords.lng, lat, lng);
          const rInfo = ratingMap.get(sess.id);
          const avgRating = rInfo && rInfo.count > 0 ? +(rInfo.sum / rInfo.count).toFixed(1) : 5.0;

          const modalidadesRaw: string[] = Array.isArray(prof?.modalidades) && prof.modalidades.length > 0
            ? prof.modalidades
            : Array.isArray(sess.modalidades) && sess.modalidades.length > 0
              ? sess.modalidades
              : ["entrega", "retirada"];

          const deliveryFee = Math.max(
            0,
            Number(sess.delivery_fee ?? prof?.delivery_fee ?? 0) || 0,
          );

          list.push({
            sessionId: sess.id,
            prestadorId: sess.id,
            nome: prof?.nome_comercial || sess.usuarios?.nome || "Ambulante UBT",
            emoji: catData.emoji || "🛍️",
            rating: avgRating,
            lat,
            lng,
            distanceKm: dist,
            deliveryFee,
            modalidades: modalidadesRaw,
            praiaReferencia: sess.praia_referencia || prof?.praia_referencia || null,
            pontoReferencia: sess.ponto_referencia || prof?.ponto_referencia || null,
            tipoEstrutura: prof?.tipo_estrutura || null,
            estruturaPhotoUrl: prof?.estrutura_photo_url || null,
            possuiAlvara: Boolean(prof?.possui_alvara),
            possuiVigilanciaSanitaria: Boolean(prof?.possui_vigilancia_sanitaria),
            itensDisponiveis: effectiveStock.length,
            previewItens: effectiveStock.slice(0, 3).map((i) => ({ nome: i.nome, preco: i.preco })),
          });
        }

        // Sort by real distance when available
        list.sort((a, b) => {
          if (a.distanceKm === null && b.distanceKm === null) return 0;
          if (a.distanceKm === null) return 1;
          if (b.distanceKm === null) return -1;
          return a.distanceKm - b.distanceKm;
        });

        setAmbulantes(list);
      } catch (err) {
        console.error("Erro ao buscar ambulantes da categoria:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAmbulantes();
  }, [slug, userCoords.lat, userCoords.lng]);

  const filteredAmbulantes = useMemo(() => {
    if (modalFilter === "todos") return ambulantes;
    return ambulantes.filter((amb) =>
      modalFilter === "entrega"
        ? amb.modalidades.some((m) => isDeliveryModalidade(m))
        : amb.modalidades.some((m) => !isDeliveryModalidade(m)),
    );
  }, [ambulantes, modalFilter]);

  return (
    <div
      className="min-h-[100svh] overflow-y-auto"
      style={{ background: "#0B1B3E", padding: 24, paddingBottom: 48 }}
    >
      {/* Header */}
      <header className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate("/app/ambulantes")}
          aria-label="Voltar"
          className="flex items-center justify-center rounded-full border-none cursor-pointer shrink-0"
          style={{ width: 40, height: 40, background: "rgba(255,255,255,0.08)", color: "#fff" }}
        >
          <ArrowLeft size={20} />
        </button>

        <div className="flex-1 min-w-0">
          <h1 className="font-display text-[18px] font-bold text-white truncate">
            {cat ? `${cat.emoji} ${cat.nome}` : "Ambulantes"}
          </h1>
          <p className="font-sans text-[12px] text-white/60 flex items-center gap-1 truncate">
            <MapPin size={11} color="#0DB87E" className="shrink-0" />
            <span className="truncate">{locationLabel}</span>
          </p>
        </div>
      </header>

      {/* Filter pills */}
      <div className="mt-4 flex gap-2">
        {(
          [
            { key: "todos", label: "Todos" },
            { key: "entrega", label: "Com Entrega" },
            { key: "retirada", label: "Retirada no Ponto" },
          ] as const
        ).map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setModalFilter(f.key)}
            className="font-sans text-[12px] font-semibold rounded-full cursor-pointer transition-colors"
            style={{
              padding: "6px 14px",
              background: modalFilter === f.key ? "#0DB87E" : "rgba(255,255,255,0.06)",
              color: modalFilter === f.key ? "#fff" : "rgba(255,255,255,0.65)",
              border: `1px solid ${modalFilter === f.key ? "#0DB87E" : "rgba(255,255,255,0.10)"}`,
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Vendor list */}
      {loading ? (
        <div className="mt-16 text-center text-white/50 font-sans text-[14px]">
          Procurando ambulantes online verificados...
        </div>
      ) : filteredAmbulantes.length === 0 ? (
        <div className="mt-16 flex flex-col items-center text-center px-4">
          <ShoppingBag size={44} color="rgba(255,255,255,0.25)" />
          <p className="font-display text-[17px] font-bold text-white mt-3">
            Nenhum ambulante online agora
          </p>
          <p className="font-sans text-[13px] mt-1.5" style={{ color: "rgba(255,255,255,0.55)" }}>
            Apenas ambulantes aprovados, online e com estoque disponível aparecem nesta lista.
          </p>
        </div>
      ) : (
        <div className="mt-5 flex flex-col gap-3">
          {filteredAmbulantes.map((amb) => {
            const distText = formatDistanceLabel(amb.distanceKm);
            return (
              <button
                key={amb.sessionId}
                type="button"
                onClick={() => navigate(`/app/ambulantes/${amb.sessionId}`)}
                className="w-full text-left cursor-pointer transition-transform active:scale-[0.99]"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  borderRadius: 18,
                  padding: 16,
                }}
              >
                <div className="flex items-start gap-3">
                  {amb.estruturaPhotoUrl ? (
                    <img
                      src={amb.estruturaPhotoUrl}
                      alt={amb.nome}
                      className="w-12 h-12 rounded-2xl object-cover shrink-0 border border-white/15"
                    />
                  ) : (
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center text-[24px] shrink-0"
                      style={{ background: "rgba(13,184,126,0.15)" }}
                    >
                      {amb.emoji}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="font-display text-[16px] font-bold text-white truncate">
                        {amb.nome}
                      </h2>
                      <span
                        className="inline-flex items-center gap-1 font-sans text-[12px] font-bold shrink-0"
                        style={{ color: "#F5A623" }}
                      >
                        <Star size={12} fill="#F5A623" color="#F5A623" />
                        {amb.rating.toFixed(1)}
                      </span>
                    </div>

                    <div className="mt-1 flex items-center gap-2 text-[12px] font-sans text-white/60">
                      <span className="inline-flex items-center gap-1 text-[#0DB87E] font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#0DB87E]" />
                        Online
                      </span>
                      {distText && <span>• {distText}</span>}
                      <span>
                        • {amb.itensDisponiveis} {amb.itensDisponiveis === 1 ? "item" : "itens"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Trust badges + location + delivery fee */}
                <div className="mt-3">
                  <AmbulanteTrustBadges
                    compact
                    info={{
                      possuiAlvara: amb.possuiAlvara,
                      possuiVigilanciaSanitaria: amb.possuiVigilanciaSanitaria,
                      tipoEstrutura: amb.tipoEstrutura,
                      praiaReferencia: amb.praiaReferencia,
                      pontoReferencia: amb.pontoReferencia,
                      deliveryFee: amb.deliveryFee,
                      modalidades: amb.modalidades,
                    }}
                  />
                </div>

                {/* Preview of available items */}
                {amb.previewItens.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-white/10 flex flex-wrap gap-1.5">
                    {amb.previewItens.map((item, idx) => (
                      <span
                        key={idx}
                        className="font-sans text-[11px] rounded-lg px-2 py-1"
                        style={{
                          background: "rgba(255,255,255,0.05)",
                          color: "rgba(255,255,255,0.78)",
                        }}
                      >
                        {item.nome} · R$ {item.preco.toFixed(2).replace(".", ",")}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AmbulantesCategoriaAmbulantesPage;
