import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Star, Plus, Minus, ShoppingCart, Package } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAmbulantePedido } from "@/contexts/AmbulantePedidoContext";
import { UBATUBA_CENTER } from "@/lib/googleMapsConfig";
import AmbulanteTrustBadges, {
  formatDistanceLabel,
  haversineDistanceKm,
} from "@/components/ambulantes/AmbulanteTrustBadges";

interface CatalogVendor {
  id: string;
  nome: string;
  emoji: string;
  rating: number;
  isOnline: boolean;
  kycApproved: boolean;
  deliveryFee: number;
  modalidades: string[];
  praiaReferencia: string | null;
  pontoReferencia: string | null;
  tipoEstrutura: string | null;
  estruturaPhotoUrl: string | null;
  possuiAlvara: boolean;
  possuiVigilanciaSanitaria: boolean;
  lat: number | null;
  lng: number | null;
}

interface CatalogProduct {
  prodId: string;
  nome: string;
  emoji: string;
  foto_url: string | null;
  categoriaNome: string;
  preco: number;
  estoque: number;
}

const AmbulanteCatalogPage = () => {
  const navigate = useNavigate();
  const { sessionId } = useParams<{ sessionId: string }>();
  const { state, setSession, addItem, removeItem } = useAmbulantePedido();
  const [vendor, setVendor] = useState<CatalogVendor | null>(null);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number }>(UBATUBA_CENTER);

  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {},
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 },
      );
    }
  }, []);

  useEffect(() => {
    const fetchCatalog = async () => {
      if (!sessionId) return;
      setLoading(true);
      try {
        const [{ data: sess }, { data: profile }, { data: estoqueRows }, { data: ratingRows }] =
          await Promise.all([
            supabase
              .from("ambulante_sessions")
              .select("id, is_online, categoria_slug, modalidades, lat, lng, delivery_fee, praia_referencia, ponto_referencia, usuarios(nome)")
              .eq("id", sessionId)
              .maybeSingle(),
            supabase
              .from("prestador_ambulante")
              .select(
                "user_id, nome_comercial, delivery_fee, modalidades, praia_referencia, ponto_referencia, tipo_estrutura, estrutura_photo_url, possui_alvara, possui_vigilancia_sanitaria, kyc_status",
              )
              .eq("user_id", sessionId)
              .maybeSingle(),
            supabase
              .from("estoque_ambulante")
              .select("produto_id, preco_venda, quantidade, disponivel, produtos_padrao(id, nome, foto_url, categorias_ambulante(nome, emoji))")
              .eq("prestador_id", sessionId)
              .eq("disponivel", true)
              .gt("quantidade", 0),
            supabase
              .from("ambulante_avaliacoes")
              .select("nota")
              .eq("avaliado_id", sessionId),
          ]);

        if (!sess && !profile) {
          setVendor(null);
          return;
        }

        const avgRating =
          ratingRows && ratingRows.length > 0
            ? +(
                ratingRows.reduce((acc: number, r: any) => acc + Number(r.nota || 0), 0) /
                ratingRows.length
              ).toFixed(1)
            : 5.0;

        const firstCatEmoji =
          (estoqueRows || []).find((r: any) => r?.produtos_padrao?.categorias_ambulante?.emoji)
            ?.produtos_padrao?.categorias_ambulante?.emoji || "🛍️";

        const modalidades: string[] =
          Array.isArray(profile?.modalidades) && profile.modalidades.length > 0
            ? profile.modalidades
            : Array.isArray(sess?.modalidades) && sess.modalidades.length > 0
              ? sess.modalidades
              : ["entrega", "retirada"];

        const deliveryFee = Math.max(
          0,
          Number(sess?.delivery_fee ?? profile?.delivery_fee ?? 0) || 0,
        );

        const vendorObj: CatalogVendor = {
          id: sessionId,
          nome: profile?.nome_comercial || (sess as any)?.usuarios?.nome || "Ambulante UBT",
          emoji: firstCatEmoji,
          rating: avgRating,
          isOnline: Boolean(sess?.is_online),
          kycApproved: profile?.kyc_status === "approved",
          deliveryFee,
          modalidades,
          praiaReferencia: sess?.praia_referencia || profile?.praia_referencia || null,
          pontoReferencia: sess?.ponto_referencia || profile?.ponto_referencia || null,
          tipoEstrutura: profile?.tipo_estrutura || null,
          estruturaPhotoUrl: profile?.estrutura_photo_url || null,
          possuiAlvara: Boolean(profile?.possui_alvara),
          possuiVigilanciaSanitaria: Boolean(profile?.possui_vigilancia_sanitaria),
          lat: sess?.lat !== null && sess?.lat !== undefined ? Number(sess.lat) : null,
          lng: sess?.lng !== null && sess?.lng !== undefined ? Number(sess.lng) : null,
        };

        setVendor(vendorObj);

        setSession(sessionId, {
          prestadorId: sessionId,
          nome: vendorObj.nome,
          emoji: vendorObj.emoji,
          rating: vendorObj.rating,
          deliveryFee: vendorObj.deliveryFee,
          modalidades: vendorObj.modalidades,
          praiaReferencia: vendorObj.praiaReferencia,
          pontoReferencia: vendorObj.pontoReferencia,
          tipoEstrutura: vendorObj.tipoEstrutura,
          estruturaPhotoUrl: vendorObj.estruturaPhotoUrl,
          possuiAlvara: vendorObj.possuiAlvara,
          possuiVigilanciaSanitaria: vendorObj.possuiVigilanciaSanitaria,
          lat: vendorObj.lat,
          lng: vendorObj.lng,
        });

        const mappedProducts: CatalogProduct[] = (estoqueRows || [])
          .filter((r: any) => r?.produtos_padrao)
          .map((r: any) => ({
            prodId: r.produto_id || r.produtos_padrao.id,
            nome: r.produtos_padrao.nome,
            emoji: r.produtos_padrao.categorias_ambulante?.emoji || "🛍️",
            foto_url: r.produtos_padrao.foto_url || null,
            categoriaNome: r.produtos_padrao.categorias_ambulante?.nome || "Produtos",
            preco: Number(r.preco_venda || 0),
            estoque: Math.max(0, Number(r.quantidade || 0)),
          }));

        setProducts(mappedProducts);
      } catch (err) {
        console.error("Erro ao carregar catálogo do ambulante:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchCatalog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const totalQty = state.itens.reduce((acc, i) => acc + i.qty, 0);
  const distKm = vendor ? haversineDistanceKm(userCoords.lat, userCoords.lng, vendor.lat, vendor.lng) : null;
  const distLabel = formatDistanceLabel(distKm);

  if (loading) {
    return (
      <div
        className="min-h-[100svh] flex items-center justify-center text-white/60 font-sans text-[14px]"
        style={{ background: "#0B1B3E" }}
      >
        Carregando cardápio...
      </div>
    );
  }

  if (!vendor) {
    return (
      <div
        className="min-h-[100svh] flex flex-col items-center justify-center p-6 text-center text-white"
        style={{ background: "#0B1B3E" }}
      >
        <p className="font-display text-[18px] font-bold">Ambulante não encontrado</p>
        <button
          type="button"
          onClick={() => navigate("/app/ambulantes")}
          className="mt-4 px-5 py-2.5 rounded-xl bg-[#0DB87E] text-white font-display font-bold text-[14px] border-none cursor-pointer"
        >
          Voltar à busca
        </button>
      </div>
    );
  }

  return (
    <div
      className="min-h-[100svh] overflow-y-auto"
      style={{ background: "#0B1B3E", padding: 24, paddingBottom: totalQty > 0 ? 110 : 48 }}
    >
      {/* Header */}
      <header className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Voltar"
          className="flex items-center justify-center rounded-full border-none cursor-pointer shrink-0"
          style={{ width: 40, height: 40, background: "rgba(255,255,255,0.08)", color: "#fff" }}
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-[19px] font-bold text-white truncate">{vendor.nome}</h1>
          <div className="flex items-center gap-2 text-[12px] font-sans text-white/65">
            <span className="inline-flex items-center gap-1 font-bold text-[#F5A623]">
              <Star size={12} fill="#F5A623" color="#F5A623" />
              {vendor.rating.toFixed(1)}
            </span>
            {distLabel && <span>• {distLabel}</span>}
            <span className={vendor.isOnline ? "text-[#0DB87E] font-semibold" : "text-white/45"}>
              • {vendor.isOnline ? "Online agora" : "Offline"}
            </span>
          </div>
        </div>
      </header>

      {/* Vendor info card with optional structure photo & trust badges */}
      <section
        className="mt-4 rounded-2xl overflow-hidden"
        style={{
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.10)",
        }}
      >
        {vendor.estruturaPhotoUrl && (
          <img
            src={vendor.estruturaPhotoUrl}
            alt={`Estrutura de ${vendor.nome}`}
            className="w-full h-36 object-cover"
          />
        )}
        <div className="p-4">
          <AmbulanteTrustBadges
            info={{
              possuiAlvara: vendor.possuiAlvara,
              possuiVigilanciaSanitaria: vendor.possuiVigilanciaSanitaria,
              tipoEstrutura: vendor.tipoEstrutura,
              praiaReferencia: vendor.praiaReferencia,
              pontoReferencia: vendor.pontoReferencia,
              deliveryFee: vendor.deliveryFee,
              modalidades: vendor.modalidades,
            }}
          />
        </div>
      </section>

      {(!vendor.isOnline || !vendor.kycApproved) && (
        <div
          className="mt-4 rounded-xl p-3 font-sans text-[13px]"
          style={{
            background: "rgba(245,166,35,0.12)",
            border: "1px solid rgba(245,166,35,0.35)",
            color: "#F5A623",
          }}
        >
          Este ambulante não está recebendo pedidos no momento.
        </div>
      )}

      {/* Products */}
      <section className="mt-6">
        <h2 className="font-display text-[16px] font-bold text-white mb-3">Cardápio disponível</h2>

        {products.length === 0 ? (
          <div
            className="rounded-2xl p-6 text-center"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <Package size={32} className="mx-auto text-white/30 mb-2" />
            <p className="font-sans text-[13px] text-white/60">
              Nenhum produto com estoque disponível no momento.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {products.map((prod) => {
              const inCart = state.itens.find((i) => i.prodId === prod.prodId);
              const qty = inCart?.qty || 0;
              const atMaxStock = qty >= prod.estoque;
              const canOrder = vendor.isOnline && vendor.kycApproved;

              return (
                <div
                  key={prod.prodId}
                  className="flex items-center gap-3 rounded-2xl p-3.5"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.09)",
                  }}
                >
                  {prod.foto_url ? (
                    <img
                      src={prod.foto_url}
                      alt={prod.nome}
                      className="w-14 h-14 rounded-xl object-cover shrink-0 border border-white/10"
                    />
                  ) : (
                    <div
                      className="w-14 h-14 rounded-xl flex items-center justify-center text-[26px] shrink-0"
                      style={{ background: "rgba(255,255,255,0.08)" }}
                    >
                      {prod.emoji}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <p className="font-display text-[15px] font-bold text-white truncate">
                      {prod.nome}
                    </p>
                    <p className="font-sans text-[12px] text-white/55">
                      Disponível: {prod.estoque} {prod.estoque === 1 ? "un." : "un."}
                    </p>
                    <p className="font-display text-[15px] font-bold text-[#0DB87E] mt-0.5">
                      R$ {prod.preco.toFixed(2).replace(".", ",")}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {qty > 0 && (
                      <>
                        <button
                          type="button"
                          onClick={() => removeItem(prod.prodId)}
                          aria-label={`Remover ${prod.nome}`}
                          className="w-8 h-8 rounded-full flex items-center justify-center border-none cursor-pointer"
                          style={{ background: "rgba(255,255,255,0.12)", color: "#fff" }}
                        >
                          <Minus size={14} />
                        </button>
                        <span className="font-display text-[15px] font-bold text-white min-w-[20px] text-center">
                          {qty}
                        </span>
                      </>
                    )}
                    <button
                      type="button"
                      disabled={!canOrder || atMaxStock}
                      onClick={() =>
                        addItem(prod.prodId, prod.preco, prod.nome, prod.emoji, prod.estoque)
                      }
                      aria-label={`Adicionar ${prod.nome}`}
                      className="w-8 h-8 rounded-full flex items-center justify-center border-none transition-opacity"
                      style={{
                        background: !canOrder || atMaxStock ? "rgba(255,255,255,0.15)" : "#0DB87E",
                        color: "#fff",
                        cursor: !canOrder || atMaxStock ? "not-allowed" : "pointer",
                        opacity: !canOrder || atMaxStock ? 0.5 : 1,
                      }}
                    >
                      <Plus size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Floating Cart Bar */}
      {totalQty > 0 && (
        <div
          className="fixed left-4 right-4 bottom-5 z-30"
          style={{ maxWidth: 480, margin: "0 auto" }}
        >
          <button
            type="button"
            onClick={() => navigate("/app/ambulantes/carrinho")}
            className="w-full flex items-center justify-between rounded-2xl border-none cursor-pointer shadow-xl"
            style={{
              background: "#0DB87E",
              color: "#fff",
              padding: "16px 20px",
              boxShadow: "0 10px 30px rgba(13,184,126,0.35)",
            }}
          >
            <div className="flex items-center gap-2.5">
              <ShoppingCart size={20} />
              <span className="font-display text-[15px] font-bold">
                Ver carrinho ({totalQty})
              </span>
            </div>
            <span className="font-display text-[16px] font-extrabold">
              R$ {state.total.toFixed(2).replace(".", ",")}
            </span>
          </button>
        </div>
      )}
    </div>
  );
};

export default AmbulanteCatalogPage;
