/**
 * Feature Flags de Verticais por Ambiente (UBT Serviços)
 *
 * Em Produção (`ubtservicos.vercel.app` / `bfqidoduceusbqlnrsol`), as verticais
 * `diaristas` e `ambulantes` ficam ocultas por padrão, mantendo 100% do código
 * intacto e compartilhado em fast-forward entre `main` (Homologação) e `prod`.
 *
 * Para reativar no futuro sem alterar código, basta definir na Vercel (Production):
 *   VITE_ENABLE_DIARISTAS=true
 *   VITE_ENABLE_AMBULANTES=true
 */

export type VerticalKey = "mototaxi" | "carros" | "diaristas" | "ambulantes" | "coco_cia";

/**
 * Controle temporário de exibição do botão público de login ("FAZER LOGIN" / "Entrar")
 * nas páginas públicas (`/`, `/saiba-mais`, navbar pública).
 * A rota `/login` (e `/admin/login`) permanece 100% desobstruída via link direto.
 * Para reativar em 1 linha: definir `VITE_ENABLE_PUBLIC_LOGIN_BUTTON=true` na Vercel.
 */
export const SHOW_PUBLIC_LOGIN_BUTTON =
  import.meta.env.VITE_ENABLE_PUBLIC_LOGIN_BUTTON === "true";

export const PROD_SUPABASE_PROJECT_REF = "bfqidoduceusbqlnrsol";
export const HOMOLOG_SUPABASE_PROJECT_REF = "xqujubbqcfqxkfczbidq";

const PROD_EXACT_HOSTNAMES = new Set([
  "ubtservicos.vercel.app",
  "ubtservicos.com.br",
  "www.ubtservicos.com.br",
  "app.ubtservicos.com.br",
]);

export interface VerticalEnvContext {
  appEnv?: string;
  hostname?: string;
  supabaseUrl?: string;
  envOverrides?: Partial<Record<string, string | undefined>>;
}

function readRuntimeEnv(ctx?: VerticalEnvContext) {
  const metaEnv = (import.meta.env || {}) as Record<string, string | undefined>;
  const appEnv = String(ctx?.appEnv ?? metaEnv.VITE_APP_ENV ?? "")
    .trim()
    .toLowerCase();
  const hostname = String(
    ctx?.hostname ??
      (typeof window !== "undefined" ? window.location.hostname : ""),
  )
    .trim()
    .toLowerCase();
  const supabaseUrl = String(ctx?.supabaseUrl ?? metaEnv.VITE_SUPABASE_URL ?? "")
    .trim()
    .toLowerCase();
  const envOverrides = ctx?.envOverrides ?? metaEnv;

  return { appEnv, hostname, supabaseUrl, envOverrides };
}

function isNonProdHostname(hostname: string): boolean {
  if (!hostname) return false;
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    hostname === "ubt-homologacao.vercel.app" ||
    hostname.includes("-git-") ||
    hostname.includes("homolog") ||
    hostname.includes("staging")
  ) {
    return true;
  }
  return false;
}

/**
 * Retorna `true` exclusivamente no ambiente oficial de Produção.
 * Em Homologação (`ubt-homologacao.vercel.app` / `xqujubbqcfqxkfczbidq`),
 * previews (`-git-`) e desenvolvimento local (`localhost`), retorna `false`.
 */
export function isProductionEnv(ctx?: VerticalEnvContext): boolean {
  const { appEnv, hostname, supabaseUrl } = readRuntimeEnv(ctx);

  if (appEnv === "production") return true;
  if (supabaseUrl.includes(PROD_SUPABASE_PROJECT_REF)) return true;
  if (isNonProdHostname(hostname)) return false;
  if (PROD_EXACT_HOSTNAMES.has(hostname)) return true;
  if (hostname.endsWith(".ubtservicos.com.br")) return true;

  return false;
}

const OVERRIDE_ENV_MAP: Record<VerticalKey, string> = {
  mototaxi: "VITE_ENABLE_MOTOTAXI",
  carros: "VITE_ENABLE_CARROS",
  diaristas: "VITE_ENABLE_DIARISTAS",
  ambulantes: "VITE_ENABLE_AMBULANTES",
  coco_cia: "VITE_ENABLE_COCO_CIA",
};

/**
 * Indica se uma vertical está habilitada no ambiente atual.
 * - Produção: `diaristas` e `ambulantes` => `false`; `mototaxi`, `carros` e `coco_cia` => `true`.
 * - Homologação / Dev: todas => `true`.
 * - Override opcional via `VITE_ENABLE_CARROS`, `VITE_ENABLE_DIARISTAS`, `VITE_ENABLE_AMBULANTES`.
 */
export function isVerticalEnabled(
  vertical: VerticalKey,
  ctx?: VerticalEnvContext,
): boolean {
  const { envOverrides } = readRuntimeEnv(ctx);
  const overrideKey = OVERRIDE_ENV_MAP[vertical];
  const rawOverride = String(envOverrides?.[overrideKey] ?? "")
    .trim()
    .toLowerCase();

  if (rawOverride === "true" || rawOverride === "1") return true;
  if (rawOverride === "false" || rawOverride === "0") return false;

  if (isProductionEnv(ctx)) {
    if (vertical === "diaristas" || vertical === "ambulantes") {
      return false;
    }
  }

  return true;
}

/**
 * Indica se uma vertical deve ficar acessível no Painel Administrativo (BackOffice).
 * Diferente do app público (`isVerticalEnabled`), `diaristas` e `ambulantes` permanecem
 * liberadas para o Admin/Superadmin tanto em Homologação quanto em Produção para gestão
 * pré-lançamento, mantendo o app público em modo "Em breve" em Produção.
 */
export function isAdminVerticalEnabled(
  vertical: VerticalKey,
  ctx?: VerticalEnvContext,
): boolean {
  if (vertical === "diaristas" || vertical === "ambulantes") {
    return true;
  }
  return isVerticalEnabled(vertical, ctx);
}

export function getVerticalFlags(ctx?: VerticalEnvContext): Record<VerticalKey, boolean> {
  return {
    mototaxi: isVerticalEnabled("mototaxi", ctx),
    carros: isVerticalEnabled("carros", ctx),
    diaristas: isVerticalEnabled("diaristas", ctx),
    ambulantes: isVerticalEnabled("ambulantes", ctx),
    coco_cia: isVerticalEnabled("coco_cia", ctx),
  };
}
