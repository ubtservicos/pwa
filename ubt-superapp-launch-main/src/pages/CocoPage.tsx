import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { ArrowLeft, Check, CheckCircle, Crosshair, MapPin } from "lucide-react";
import { MATERIAIS_COCO, getMaterial } from "@/mocks/cocoMateriais";
import {
  MOCK_COCO_CONFIG,
  type PontoColeta,
  type CaminhaoCoco,
} from "@/mocks/cocoMock";
import { getPinIcon, getTruckIcon, getTruckIconUrl } from "@/utils/cocoIcons";
import { tomadorIcon } from "@/lib/mapIcons";
import { reverseGeocode } from "@/lib/geoService";
import { MapRef, DARK_TILES, ATTRIBUTION, UBATUBA_CENTER } from "@/components/UBTMap";
import { supabase } from "@/lib/supabase";
import { useCurrentUser } from "@/hooks/useCurrentUser";

type Tab = "informar" | "acompanhar" | "contribuir";

const FALLBACK_CENTER = { lat: -23.432, lng: -45.083 };

const MapFallback = ({ pontos }: { pontos: PontoColeta[] }) => (
  <div
    className="absolute inset-0"
    style={{
      background: "radial-gradient(circle at 50% 40%, #1C3261 0%, #132348 40%, #0B1B3E 100%)",
    }}
  >
    <div
      className="absolute inset-0 opacity-30"
      style={{
        backgroundImage:
          "linear-gradient(rgba(28,50,97,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(28,50,97,0.6) 1px, transparent 1px)",
        backgroundSize: "48px 48px",
      }}
    />
    {pontos.slice(0, 5).map((p, i) => {
      const m = getMaterial(p.material);
      const angle = (i / pontos.length) * Math.PI * 2;
      const r = 100 + (i % 2) * 40;
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      return (
        <div
          key={p.id}
          className="absolute left-1/2 top-1/3 rounded-full flex items-center justify-center"
          style={{
            transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
            width: 36,
            height: 36,
            background: m.cor,
            border: "2px solid white",
            opacity: p.status === "coletado" ? 0.4 : 1,
            fontSize: 16,
          }}
        >
          {m.emoji}
        </div>
      );
    })}
  </div>
);

const CocoPage = () => {
  const navigate = useNavigate();
  const user = useCurrentUser();
  const [activeTab, setActiveTab] = useState<Tab>("informar");
  const [endereco, setEndereco] = useState("");
  const [coordenadas, setCoordenadas] = useState<{ lat: number; lng: number } | null>(null);
  const [materialSel, setMaterialSel] = useState<string | null>(null);
  const [fotoSel, setFotoSel] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [pontoConfirmadoId, setPontoConfirmadoId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showManualKey, setShowManualKey] = useState(false);
  const [pontos, setPontos] = useState<PontoColeta[]>([]);
  const [caminhoes, setCaminhoes] = useState<CaminhaoCoco[]>([]);
  const [pixDoador, setPixDoador] = useState(MOCK_COCO_CONFIG.pixKey);
  const [bairrosCount, setBairrosCount] = useState(4);
  const [center, setCenter] = useState(FALLBACK_CENTER);
  const [selectedPonto, setSelectedPonto] = useState<PontoColeta | null>(null);
  const [selectedCaminhao, setSelectedCaminhao] = useState<CaminhaoCoco | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  const fetchCaminhoes = async () => {
    const { data, error } = await supabase
      .from("coco_caminhoes")
      .select("*")
      .eq("status_aprovacao", "approved");

    if (data) {
      const mapped = data.map((c) => ({
        id: c.id,
        plate: c.plate,
        apelido: c.apelido,
        isOnline: c.is_online,
        location: { lat: Number(c.lat || -23.432), lng: Number(c.lng || -45.083) },
        collectionsToday: c.collections_today || 0,
        totalCollections: c.total_collections || 0,
        pixKey: c.pix_key
      }));
      setCaminhoes(mapped);

      const activeCaminhoes = mapped.filter(c => c.isOnline);
      if (activeCaminhoes.length > 0) {
        setPixDoador(activeCaminhoes[0].pixKey || MOCK_COCO_CONFIG.pixKey);
      } else if (mapped.length > 0) {
        setPixDoador(mapped[0].pixKey || MOCK_COCO_CONFIG.pixKey);
      }

      const uniqueBairros = new Set<string>();
      data.forEach(c => {
        if (c.areas_atendidas) {
          c.areas_atendidas.forEach((a: string) => uniqueBairros.add(a));
        }
      });
      setBairrosCount(uniqueBairros.size > 0 ? uniqueBairros.size : 4);
    }
  };

  const fetchPontos = async () => {
    if (!user.uid) return;
    const { data, error } = await supabase
      .from("coco_pontos")
      .select("*")
      .eq("tomador_id", user.uid)
      .order("created_at", { ascending: false });

    if (data) {
      const mapped = data.map((p) => ({
        id: p.id,
        lat: Number(p.lat),
        lng: Number(p.lng),
        address: p.address,
        material: p.material,
        status: p.status as any,
        createdAt: new Date(p.created_at).getTime(),
        coletadoAt: p.coletado_at ? new Date(p.coletado_at).getTime() : null,
        fotoUrl: p.foto_url,
        horarioPrevisto: p.horario_previsto
      }));
      setPontos(mapped);
    }
  };

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => { },
      { enableHighAccuracy: true, maximumAge: 30000 }
    );
  }, []);

  useEffect(() => {
    fetchCaminhoes();
    fetchPontos();

    const channelCaminhoes = supabase
      .channel("realtime-caminhoes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "coco_caminhoes" },
        () => {
          fetchCaminhoes();
        }
      )
      .subscribe();

    const channelPontos = supabase
      .channel("realtime-pontos")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "coco_pontos" },
        () => {
          fetchPontos();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channelCaminhoes);
      supabase.removeChannel(channelPontos);
    };
  }, [user.uid]);

  const useGps = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      setCoordenadas({ lat, lng });
      mapRef.current?.panTo([lat, lng]);
      reverseGeocode(lat, lng).then(setEndereco);
    });
  };

  const confirmarPonto = async () => {
    if (!user.uid) {
      alert("Você precisa estar logado para registrar um ponto.");
      return;
    }
    const lat = coordenadas?.lat ?? center.lat;
    const lng = coordenadas?.lng ?? center.lng;

    try {
      const { data, error } = await supabase
        .from("coco_pontos")
        .insert({
          tomador_id: user.uid,
          lat,
          lng,
          address: endereco,
          material: materialSel ?? "misto",
          foto_url: fotoSel || null,
          status: "aguardando"
        })
        .select()
        .single();

      if (error) throw error;
      setPontoConfirmadoId(data.id);
      setShowSuccess(true);
      fetchPontos();
    } catch (err: any) {
      alert("Erro ao salvar ponto no Supabase: " + err.message);
    }
  };

  const resetForm = () => {
    setShowSuccess(false);
    setEndereco("");
    setMaterialSel(null);
    setFotoSel(null);
    setCoordenadas(null);
  };

  const copyPix = async () => {
    try {
      await navigator.clipboard.writeText(pixDoador);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 3000);
    } catch {
      setShowManualKey(true);
    }
  };

  const aguardandoCount = pontos.filter((p) => p.status === "aguardando").length;
  const coletadosCount = pontos.filter((p) => p.status === "coletado").length;
  const onlineCount = caminhoes.filter((c) => c.isOnline).length;

  return (
    <div
      className="relative overflow-hidden"
      style={{ height: "100svh", background: "#0B1B3E" }}
    >
      {/* Top bar */}
      <button
        onClick={() => navigate("/app/home")}
        aria-label="voltar"
        className="absolute z-[1010] flex items-center justify-center rounded-full"
        style={{
          top: 16,
          left: 16,
          width: 40,
          height: 40,
          background: "rgba(11,27,62,0.75)",
          backdropFilter: "blur(8px)",
          border: "1px solid rgba(255,255,255,0.10)",
        }}
      >
        <ArrowLeft size={20} color="white" />
      </button>

      {/* Map */}
      <div style={{ position: "absolute", inset: 0 }}>
        <MapContainer
          center={[center.lat, center.lng]}
          zoom={14}
          style={{ width: "100%", height: "400px" }}
          zoomControl={false}
          attributionControl={false}
        >
          <TileLayer url={DARK_TILES} attribution={ATTRIBUTION} />
          <MapRef mapRef={mapRef} />
          <Marker position={[center.lat, center.lng]} icon={tomadorIcon} />
          {pontos.map((p) => (
            <Marker
              key={p.id}
              position={[p.lat, p.lng]}
              icon={getPinIcon(p.material)}
              opacity={p.status === "coletado" ? 0.4 : 1}
              eventHandlers={{ click: () => setSelectedPonto(p) }}
            >
              {selectedPonto?.id === p.id && (
                <Popup eventHandlers={{ remove: () => setSelectedPonto(null) }}>
                  <div style={{ minWidth: 160, fontFamily: "DM Sans" }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#0B1B3E" }}>
                      {p.address}
                    </p>
                    <p style={{ fontSize: 12, color: "#5B6178", marginTop: 4 }}>
                      {getMaterial(p.material).emoji} {getMaterial(p.material).nome}
                    </p>
                    <span
                      style={{
                        display: "inline-block",
                        marginTop: 6,
                        padding: "2px 8px",
                        borderRadius: 999,
                        fontSize: 10,
                        fontWeight: 600,
                        background: p.status === "coletado" ? "rgba(13,184,126,0.15)" : "rgba(245,166,35,0.15)",
                        color: p.status === "coletado" ? "#0DB87E" : "#F5A623",
                      }}
                    >
                      {p.status === "coletado" ? "✅ Coletado" : "⏳ Aguardando"}
                    </span>
                  </div>
                </Popup>
              )}
            </Marker>
          ))}
          {caminhoes.map((c) => (
            <Marker
              key={c.id}
              position={[c.location.lat, c.location.lng]}
              icon={getTruckIcon(c.isOnline)}
              eventHandlers={{ click: () => setSelectedCaminhao(c) }}
            >
              {selectedCaminhao?.id === c.id && (
                <Popup eventHandlers={{ remove: () => setSelectedCaminhao(null) }}>
                  <div style={{ minWidth: 160, fontFamily: "DM Sans" }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#0B1B3E" }}>
                      🚚 {c.apelido}
                    </p>
                    <p style={{ fontSize: 12, color: "#5B6178", marginTop: 4 }}>
                      {c.plate} · {c.collectionsToday} coletas hoje
                    </p>
                  </div>
                </Popup>
              )}
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* Bottom sheet */}
      <div
        className="absolute left-0 right-0 bottom-0 z-[1010]"
        style={{
          background: "#132348",
          borderRadius: "24px 24px 0 0",
          padding: "12px 20px 96px",
          maxHeight: "70svh",
          overflowY: "auto",
          boxShadow: "0 -4px 24px rgba(0,0,0,0.40)",
        }}
      >
        <div
          style={{
            width: 40,
            height: 4,
            background: "rgba(255,255,255,0.15)",
            borderRadius: 999,
            margin: "0 auto 12px",
          }}
        />

        {/* Tabs */}
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid rgba(255,255,255,0.10)",
            marginBottom: 16,
          }}
        >
          {(
            [
              { key: "informar", label: "📍 Informar" },
              { key: "acompanhar", label: "🗺️ Acompanhar" },
              { key: "contribuir", label: "💚 Contribuir" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                flex: 1,
                padding: "0 0 12px",
                background: "none",
                border: "none",
                cursor: "pointer",
                borderBottom: `2px solid ${activeTab === tab.key ? "#0DB87E" : "transparent"}`,
                fontFamily: "DM Sans",
                fontSize: 13,
                fontWeight: activeTab === tab.key ? 600 : 400,
                color: activeTab === tab.key ? "white" : "rgba(255,255,255,0.45)",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* INFORMAR TAB */}
        {activeTab === "informar" && (
          <div>
            <h2 style={{ fontFamily: "Syne", fontSize: 16, fontWeight: 700, color: "white" }}>
              Onde está seu reciclável?
            </h2>
            <p
              style={{
                fontFamily: "DM Sans",
                fontSize: 13,
                color: "rgba(255,255,255,0.55)",
                marginTop: 4,
              }}
            >
              Informe o local e ajude os caminhões a planejar a rota.
            </p>

            {!showSuccess && (
              <>
                <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 14 }}>
                  <div
                    style={{
                      flex: 1,
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.10)",
                      borderRadius: 12,
                      height: 48,
                      padding: "0 14px",
                    }}
                  >
                    <MapPin size={16} color="#0DB87E" style={{ flexShrink: 0 }} />
                    <input
                      value={endereco}
                      onChange={(e) => setEndereco(e.target.value)}
                      placeholder="Endereço do ponto de coleta"
                      style={{
                        flex: 1,
                        minWidth: 0,
                        background: "transparent",
                        border: "none",
                        outline: "none",
                        fontFamily: "DM Sans",
                        fontSize: 14,
                        color: "white",
                      }}
                    />
                  </div>
                  <button
                    onClick={useGps}
                    aria-label="Usar GPS"
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 999,
                      background: "rgba(13,184,126,0.15)",
                      border: "none",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Crosshair size={18} color="#0DB87E" />
                  </button>
                </div>

                <div style={{ marginTop: 14 }}>
                  <p
                    style={{
                      fontFamily: "DM Sans",
                      fontSize: 12,
                      color: "rgba(255,255,255,0.45)",
                      marginBottom: 8,
                    }}
                  >
                    Tipo de material (opcional)
                  </p>
                  <div
                    style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6 }}
                  >
                    {MATERIAIS_COCO.map((m) => {
                      const sel = materialSel === m.id;
                      return (
                        <button
                          key={m.id}
                          onClick={() => setMaterialSel(sel ? null : m.id)}
                          style={{
                            borderRadius: 10,
                            padding: "8px 4px",
                            cursor: "pointer",
                            border: "1.5px solid",
                            borderColor: sel ? m.cor : "rgba(255,255,255,0.10)",
                            background: sel ? `${m.cor}25` : "rgba(255,255,255,0.04)",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <span style={{ fontSize: 20 }}>{m.emoji}</span>
                          <span
                            style={{
                              fontFamily: "DM Sans",
                              fontSize: 10,
                              fontWeight: 600,
                              color: sel ? m.cor : "rgba(255,255,255,0.55)",
                            }}
                          >
                            {m.nome.split("/")[0]}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div style={{ marginTop: 14 }}>
                  <p style={{ fontFamily: "DM Sans", fontSize: 12, color: "rgba(255,255,255,0.45)", marginBottom: 8 }}>
                    Foto da Embalagem / Sacola (opcional)
                  </p>
                  <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
                    {[
                      { id: "preset_saco_verde", label: "Saco Verde", emoji: "🟢" },
                      { id: "preset_caixa_papelao", label: "Caixa Papelão", emoji: "📦" },
                      { id: "preset_caixote_plastico", label: "Caixote Plástico", emoji: "🗑️" }
                    ].map((p) => {
                      const sel = fotoSel === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setFotoSel(sel ? null : p.id)}
                          style={{
                            borderRadius: 12,
                            padding: "8px 12px",
                            background: sel ? "rgba(13,184,126,0.15)" : "rgba(255,255,255,0.04)",
                            border: "1px solid",
                            borderColor: sel ? "#0DB87E" : "rgba(255,255,255,0.1)",
                            color: "white",
                            fontFamily: "DM Sans",
                            fontSize: 12,
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            whiteSpace: "nowrap"
                          }}
                        >
                          <span>{p.emoji}</span>
                          <span>{p.label}</span>
                        </button>
                      );
                    })}
                    
                    <label
                      style={{
                        borderRadius: 12,
                        padding: "8px 12px",
                        background: fotoSel && !fotoSel.startsWith("preset_") ? "rgba(13,184,126,0.15)" : "rgba(255,255,255,0.04)",
                        border: "1px solid",
                        borderColor: fotoSel && !fotoSel.startsWith("preset_") ? "#0DB87E" : "rgba(255,255,255,0.1)",
                        color: "white",
                        fontFamily: "DM Sans",
                        fontSize: 12,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        cursor: "pointer",
                        whiteSpace: "nowrap"
                      }}
                    >
                      <span>📷</span>
                      <span>{fotoSel && !fotoSel.startsWith("preset_") ? "Foto Carregada" : "Tirar Foto"}</span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setFotoSel(reader.result as string);
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                        style={{ display: "none" }}
                      />
                    </label>
                  </div>
                  {fotoSel && (
                    <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10 }}>
                      {fotoSel.startsWith("preset_") ? (
                        <span style={{ fontSize: 13, color: "#0DB87E", fontFamily: "DM Sans" }}>
                          Selecionado: <strong>{fotoSel === "preset_saco_verde" ? "Saco Verde" : fotoSel === "preset_caixa_papelao" ? "Caixa Papelão" : "Caixote Plástico"}</strong>
                        </span>
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <img src={fotoSel} alt="Preview" style={{ width: 40, height: 40, borderRadius: 8, objectFit: "cover", border: "1px solid rgba(255,255,255,0.2)" }} />
                          <span style={{ fontSize: 12, color: "#0DB87E", fontFamily: "DM Sans" }}>Foto anexada com sucesso!</span>
                        </div>
                      )}
                      <button
                        onClick={() => setFotoSel(null)}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#E84040",
                          fontSize: 12,
                          fontFamily: "DM Sans",
                          cursor: "pointer",
                          marginLeft: "auto"
                        }}
                      >
                        Limpar
                      </button>
                    </div>
                  )}
                </div>

                <button
                  onClick={confirmarPonto}
                  disabled={!endereco}
                  style={{
                    marginTop: 14,
                    width: "100%",
                    minHeight: 48,
                    borderRadius: 999,
                    border: "none",
                    cursor: endereco ? "pointer" : "not-allowed",
                    background: "#0DB87E",
                    color: "white",
                    fontFamily: "Syne",
                    fontSize: 15,
                    fontWeight: 700,
                    opacity: endereco ? 1 : 0.5,
                  }}
                >
                  Confirmar ponto
                </button>
              </>
            )}

            {showSuccess && (
              <div style={{ animation: "ubt-fadeIn 300ms ease" }}>
                <div style={{ textAlign: "center", marginTop: 8 }}>
                  <CheckCircle size={40} color="#0DB87E" style={{ margin: "0 auto" }} />
                </div>
                <p
                  style={{
                    fontFamily: "Syne",
                    fontSize: 18,
                    fontWeight: 700,
                    color: "white",
                    textAlign: "center",
                    marginTop: 12,
                  }}
                >
                  Ponto registrado!
                </p>
                <p
                  style={{
                    fontFamily: "DM Sans",
                    fontSize: 13,
                    color: "rgba(255,255,255,0.65)",
                    textAlign: "center",
                    marginTop: 6,
                  }}
                >
                  Os caminhões da Côco & Cia passarão por lá. Obrigado! 🌱
                </p>
                {(() => {
                  const p = pontos.find((x) => x.id === pontoConfirmadoId);
                  const m = p ? getMaterial(p.material) : null;
                  return (
                    <div
                      style={{
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 12,
                        padding: 14,
                        marginTop: 14,
                        display: "flex",
                        gap: 10,
                        alignItems: "center",
                      }}
                    >
                      <span style={{ fontSize: 24 }}>{m?.emoji}</span>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontFamily: "DM Sans", fontSize: 13, color: "white" }}>
                          {p?.address}
                        </p>
                        <span
                          style={{
                            display: "inline-block",
                            marginTop: 4,
                            background: "rgba(245,166,35,0.15)",
                            border: "1px solid rgba(245,166,35,0.30)",
                            color: "#F5A623",
                            borderRadius: 999,
                            padding: "2px 8px",
                            fontFamily: "DM Sans",
                            fontSize: 10,
                            fontWeight: 600,
                          }}
                        >
                          ⏳ Aguardando coleta
                        </span>
                      </div>
                    </div>
                  );
                })()}
                <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                  <button
                    onClick={resetForm}
                    style={{
                      flex: 1,
                      minHeight: 44,
                      borderRadius: 999,
                      background: "transparent",
                      border: "1px solid rgba(255,255,255,0.15)",
                      color: "white",
                      fontFamily: "DM Sans",
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    Informar outro ponto
                  </button>
                  <button
                    onClick={() => {
                      const p = pontos.find((x) => x.id === pontoConfirmadoId);
                      if (p) {
                        mapRef.current?.flyTo([p.lat, p.lng], 17);
                      }
                    }}
                    style={{
                      flex: 1,
                      minHeight: 44,
                      borderRadius: 999,
                      background: "transparent",
                      border: "1px solid rgba(13,184,126,0.40)",
                      color: "#0DB87E",
                      fontFamily: "DM Sans",
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    Ver no mapa
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ACOMPANHAR TAB */}
        {activeTab === "acompanhar" && (
          <div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
              {[
                { cor: "#0DB87E", label: "Caminhão ativo" },
                { cor: "#9399AD", label: "Caminhão offline" },
                { cor: "#F5A623", label: "Aguardando coleta" },
                { cor: "rgba(255,255,255,0.25)", label: "Coletado" },
              ].map((item, i) => (
                <span
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 999,
                    padding: "4px 10px",
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 999,
                      background: item.cor,
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      fontFamily: "DM Sans",
                      fontSize: 10,
                      color: "rgba(255,255,255,0.65)",
                    }}
                  >
                    {item.label}
                  </span>
                </span>
              ))}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {caminhoes.map((c) => (
                <div
                  key={c.id}
                  onClick={() => {
                    mapRef.current?.flyTo([c.location.lat, c.location.lng], 16);
                  }}
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 12,
                    padding: "12px 14px",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    cursor: "pointer",
                  }}
                >
                  <img
                    src={getTruckIconUrl(c.isOnline)}
                    width={32}
                    height={24}
                    alt=""
                    style={{ flexShrink: 0 }}
                  />
                  <div style={{ flex: 1 }}>
                    <p
                      style={{
                        fontFamily: "Syne",
                        fontSize: 14,
                        fontWeight: 700,
                        color: "white",
                      }}
                    >
                      {c.apelido}
                    </p>
                    <p
                      style={{
                        fontFamily: "DM Sans",
                        fontSize: 11,
                        color: "rgba(255,255,255,0.45)",
                        marginTop: 2,
                      }}
                    >
                      {c.plate}
                    </p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        justifyContent: "flex-end",
                      }}
                    >
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 999,
                          background: c.isOnline ? "#0DB87E" : "#9399AD",
                          animation: c.isOnline ? "ubt-pulse-dot 1.4s infinite" : undefined,
                        }}
                      />
                      <span
                        style={{
                          fontFamily: "DM Sans",
                          fontSize: 11,
                          color: c.isOnline ? "#0DB87E" : "rgba(255,255,255,0.40)",
                        }}
                      >
                        {c.isOnline ? "Online" : "Offline"}
                      </span>
                    </div>
                    <p
                      style={{
                        fontFamily: "DM Sans",
                        fontSize: 11,
                        color: "rgba(255,255,255,0.40)",
                        marginTop: 3,
                      }}
                    >
                      {c.collectionsToday} hoje
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 14 }}>
              <p
                style={{
                  fontFamily: "DM Sans",
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.40)",
                  letterSpacing: 1,
                  marginBottom: 6,
                }}
              >
                Meus pontos
              </p>
              {pontos.map((p) => {
                const m = getMaterial(p.material);
                return (
                  <div
                    key={p.id}
                    onClick={() => {
                      mapRef.current?.flyTo([p.lat, p.lng], 17);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 0",
                      borderBottom: "1px solid rgba(255,255,255,0.07)",
                      cursor: "pointer",
                    }}
                  >
                    <span style={{ fontSize: 20 }}>{m.emoji}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p
                        style={{
                          fontFamily: "DM Sans",
                          fontSize: 13,
                          color: "white",
                          overflow: "hidden",
                          whiteSpace: "nowrap",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {p.address}
                      </p>
                      <p
                        style={{
                          fontFamily: "DM Sans",
                          fontSize: 11,
                          color: "rgba(255,255,255,0.40)",
                          marginTop: 2,
                        }}
                      >
                        {new Date(p.createdAt).toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}{" "}
                        · {m.nome}
                        {p.horarioPrevisto && ` · Previsão: ${p.horarioPrevisto}`}
                      </p>
                    </div>
                    <span
                      style={{
                        borderRadius: 999,
                        padding: "3px 8px",
                        fontFamily: "DM Sans",
                        fontSize: 10,
                        fontWeight: 600,
                        flexShrink: 0,
                        background:
                          p.status === "coletado"
                            ? "rgba(13,184,126,0.12)"
                            : p.status === "confirmado"
                            ? "rgba(13,184,126,0.12)"
                            : p.status === "recusado"
                            ? "rgba(232,64,64,0.12)"
                            : "rgba(245,166,35,0.12)",
                        border: `1px solid ${
                          p.status === "coletado"
                            ? "rgba(13,184,126,0.30)"
                            : p.status === "confirmado"
                            ? "rgba(13,184,126,0.30)"
                            : p.status === "recusado"
                            ? "rgba(232,64,64,0.30)"
                            : "rgba(245,166,35,0.30)"
                        }`,
                        color:
                          p.status === "coletado"
                            ? "#0DB87E"
                            : p.status === "confirmado"
                            ? "#0DB87E"
                            : p.status === "recusado"
                            ? "#E84040"
                            : "#F5A623",
                      }}
                    >
                      {p.status === "coletado"
                        ? "✅"
                        : p.status === "confirmado"
                        ? "🚚"
                        : p.status === "recusado"
                        ? "❌"
                        : "⏳"}
                    </span>
                  </div>
                );
              })}
            </div>

            <div
              style={{
                background: "rgba(255,255,255,0.04)",
                borderRadius: 12,
                padding: 14,
                marginTop: 12,
                display: "grid",
                gridTemplateColumns: "repeat(3,1fr)",
                gap: 8,
                textAlign: "center",
              }}
            >
              {[
                { e: "🗑️", v: aguardandoCount, l: "Aguardando", c: "white" },
                { e: "♻️", v: coletadosCount, l: "Coletados", c: "#0DB87E" },
                { e: "🚚", v: onlineCount, l: "Ativos", c: "#0DB87E" },
              ].map((s, i) => (
                <div key={i}>
                  <p style={{ fontSize: 16 }}>{s.e}</p>
                  <p
                    style={{
                      fontFamily: "Syne",
                      fontSize: 18,
                      fontWeight: 700,
                      color: s.c,
                    }}
                  >
                    {s.v}
                  </p>
                  <p
                    style={{
                      fontFamily: "DM Sans",
                      fontSize: 10,
                      color: "rgba(255,255,255,0.45)",
                    }}
                  >
                    {s.l}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CONTRIBUIR TAB */}
        {activeTab === "contribuir" && (
          <div>
            <div
              style={{
                background: "rgba(13,184,126,0.08)",
                border: "1px solid rgba(13,184,126,0.20)",
                borderRadius: 16,
                padding: 20,
                textAlign: "center",
              }}
            >
              <p style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 700, color: "white" }}>
                🌴 Côco & Cia
              </p>
              <p
                style={{
                  fontFamily: "DM Sans",
                  fontSize: 13,
                  color: "rgba(255,255,255,0.70)",
                  lineHeight: 1.6,
                  marginTop: 8,
                }}
              >
                {MOCK_COCO_CONFIG.missao}
              </p>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3,1fr)",
                  gap: 12,
                  marginTop: 16,
                }}
              >
                {[
                  { v: "312", l: "toneladas recicladas" },
                  { v: String(caminhoes.length || 2), l: "caminhões na frota" },
                  { v: String(bairrosCount), l: "bairros atendidos" },
                ].map((it, i) => (
                  <div key={i} style={{ textAlign: "center" }}>
                    <p
                      style={{
                        fontFamily: "Syne",
                        fontSize: 22,
                        fontWeight: 700,
                        color: "#0DB87E",
                      }}
                    >
                      {it.v}
                    </p>
                    <p
                      style={{
                        fontFamily: "DM Sans",
                        fontSize: 10,
                        color: "rgba(255,255,255,0.55)",
                        marginTop: 2,
                      }}
                    >
                      {it.l}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.10)",
                borderRadius: 14,
                padding: 20,
                marginTop: 16,
                textAlign: "center",
              }}
            >
              <p
                style={{
                  fontFamily: "DM Sans",
                  fontSize: 13,
                  color: "rgba(255,255,255,0.60)",
                }}
              >
                Quer apoiar financeiramente?
              </p>
              <p
                style={{
                  fontFamily: "DM Sans",
                  fontSize: 12,
                  color: "rgba(255,255,255,0.40)",
                  marginTop: 4,
                }}
              >
                Qualquer valor faz diferença. A transferência é feita direto no seu banco.
              </p>

              <button
                onClick={copyPix}
                style={{
                  marginTop: 16,
                  width: "100%",
                  minHeight: 52,
                  borderRadius: 999,
                  border: "none",
                  cursor: "pointer",
                  background: copied ? "#0C9562" : "#0DB87E",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  transition: "background 300ms",
                }}
              >
                {copied ? (
                  <>
                    <Check size={16} color="white" />
                    <span
                      style={{
                        fontFamily: "Syne",
                        fontSize: 15,
                        fontWeight: 700,
                        color: "white",
                      }}
                    >
                      Chave copiada!
                    </span>
                  </>
                ) : (
                  <span
                    style={{
                      fontFamily: "Syne",
                      fontSize: 15,
                      fontWeight: 700,
                      color: "white",
                    }}
                  >
                    💚 Quero Contribuir
                  </span>
                )}
              </button>

              {copied && (
                <div
                  style={{
                    marginTop: 14,
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 12,
                    padding: 16,
                    animation: "ubt-fadeIn 300ms ease",
                    textAlign: "left",
                  }}
                >
                  {[
                    "Abra o app do seu banco",
                    "Vá em Pix → Transferir → Chave Pix",
                    "Cole a chave e transfira o valor que quiser",
                  ].map((step, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        gap: 10,
                        alignItems: "flex-start",
                        marginBottom: i < 2 ? 10 : 0,
                      }}
                    >
                      <div
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 999,
                          background: "#0DB87E",
                          flexShrink: 0,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <span
                          style={{
                            fontFamily: "DM Sans",
                            fontSize: 11,
                            fontWeight: 700,
                            color: "white",
                          }}
                        >
                          {i + 1}
                        </span>
                      </div>
                      <p
                        style={{
                          fontFamily: "DM Sans",
                          fontSize: 13,
                          color: "white",
                          lineHeight: 1.4,
                        }}
                      >
                        {step}
                      </p>
                    </div>
                  ))}
                  <p
                    style={{
                      fontFamily: "DM Sans",
                      fontSize: 11,
                      color: "rgba(255,255,255,0.35)",
                      fontStyle: "italic",
                      marginTop: 12,
                      textAlign: "center",
                    }}
                  >
                    Chave copiada: {pixDoador}
                  </p>
                </div>
              )}

              {showManualKey && (
                <div
                  style={{
                    marginTop: 14,
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.10)",
                    borderRadius: 10,
                    padding: 14,
                    textAlign: "center",
                  }}
                >
                  <p
                    style={{
                      fontFamily: "DM Sans",
                      fontSize: 12,
                      color: "rgba(255,255,255,0.50)",
                      marginBottom: 8,
                    }}
                  >
                    Copie a chave abaixo:
                  </p>
                  <p
                    style={{
                      fontFamily: "DM Sans",
                      fontSize: 15,
                      fontWeight: 600,
                      color: "white",
                      userSelect: "text",
                      letterSpacing: 0.5,
                    }}
                  >
                    {pixDoador}
                  </p>
                  <p
                    style={{
                      fontFamily: "DM Sans",
                      fontSize: 11,
                      color: "rgba(255,255,255,0.35)",
                      marginTop: 8,
                    }}
                  >
                    Use no app do seu banco para transferir o valor que desejar.
                  </p>
                </div>
              )}
            </div>

            <div style={{ marginTop: 20, textAlign: "center" }}>
              <p
                style={{
                  fontFamily: "DM Sans",
                  fontSize: 10,
                  color: "rgba(255,255,255,0.30)",
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  marginBottom: 10,
                }}
              >
                Siga nosso trabalho
              </p>
              <div style={{ display: "flex", justifyContent: "center", gap: 16 }}>
                {["IG", "FB", "WA"].map((n) => (
                  <button
                    key={n}
                    onClick={() => alert("Redes sociais em breve!")}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 999,
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      color: "rgba(255,255,255,0.55)",
                      fontFamily: "DM Sans",
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes ubt-fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes ubt-pulse-dot {
          0%,100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.85); }
        }
      `}</style>
    </div>
  );
};

export default CocoPage;
