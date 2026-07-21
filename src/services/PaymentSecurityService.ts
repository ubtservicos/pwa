/**
 * Serviço de Segurança de Pagamentos e Telemetria Antifraude (Mercado Pago Produção)
 */

// Gera e armazena um Device Fingerprint estável no localStorage
export function getDeviceFingerprint(): string {
  try {
    let fingerprint = localStorage.getItem("ubt_device_fingerprint");
    if (!fingerprint) {
      // Fingerprint básico concatenando atributos do browser e UUID randômico
      const screenInfo = `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`;
      const randomPart = Math.random().toString(36).substring(2, 15);
      fingerprint = `ubt_df_${btoa(screenInfo).substring(0, 8)}_${randomPart}`;
      localStorage.setItem("ubt_device_fingerprint", fingerprint);
    }
    return fingerprint;
  } catch {
    return "ubt_df_fallback_" + Math.random().toString(36).substring(2, 10);
  }
}

// Identifica o Sistema Operacional
export function getOSName(): string {
  const userAgent = navigator.userAgent;
  if (userAgent.indexOf("Win") !== -1) return "Windows";
  if (userAgent.indexOf("Mac") !== -1) return "macOS";
  if (userAgent.indexOf("X11") !== -1) return "UNIX";
  if (userAgent.indexOf("Linux") !== -1) return "Linux";
  if (/Android/i.test(userAgent)) return "Android";
  if (/iPhone|iPad|iPod/i.test(userAgent)) return "iOS";
  return "Unknown OS";
}

// Coleta o payload completo de segurança financeira
export function collectPaymentMetadata(cardHash?: string): Record<string, any> {
  return {
    device_fingerprint: getDeviceFingerprint(),
    user_agent: navigator.userAgent,
    ip_hash: null, // Para ser preenchido no servidor pela Edge Function / Gateway
    os: getOSName(),
    app_version: "1.0.0", // Versão estável do SuperApp
    card_hash: cardHash || null,
    collected_at: new Date().toISOString()
  };
}
