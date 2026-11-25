import React from "react";
import { AlertCircle, RefreshCw, ArrowLeft } from "lucide-react";

interface Props {
  children: React.ReactNode;
  fallbackPath?: string;
  fallbackLabel?: string;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

const CHUNK_RELOAD_KEY = "ubt_mototaxi_chunk_reload_ts";

export class MototaxiErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error?.message || "Erro inesperado na tela de Mototáxi.",
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[MototaxiErrorBoundary] Caught render error:", error, info);

    // Auto-recover once from post-deploy ChunkLoadError / failed dynamic import
    const msg = String(error?.message || "");
    const isChunkError =
      error?.name === "ChunkLoadError" ||
      /Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk/i.test(msg);

    if (isChunkError && typeof window !== "undefined") {
      try {
        const lastReload = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) || "0");
        if (Date.now() - lastReload > 15_000) {
          sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
          window.location.reload();
        }
      } catch {
        // noop
      }
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, errorMessage: "" });
  };

  handleGoBack = () => {
    const target = this.props.fallbackPath || "/app/prestador/mototaxi/online";
    window.location.href = target;
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-[100svh] bg-[#09090B] text-zinc-50 flex items-center justify-center p-6 font-sans">
        <div className="w-full max-w-sm rounded-2xl bg-[#121215] border border-zinc-800 p-6 text-center shadow-2xl space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center">
            <AlertCircle size={28} className="text-red-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Algo deu errado na tela da corrida</h2>
            <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
              {this.state.errorMessage || "Ocorreu uma falha temporária ao carregar os dados da corrida."}
            </p>
          </div>
          <div className="flex flex-col gap-2.5 pt-2">
            <button
              type="button"
              onClick={this.handleRetry}
              className="w-full py-3 rounded-xl bg-[#00E676] text-black font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw size={16} />
              Tentar novamente
            </button>
            <button
              type="button"
              onClick={this.handleGoBack}
              className="w-full py-3 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-200 font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <ArrowLeft size={16} />
              {this.props.fallbackLabel || "Voltar para Online"}
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default MototaxiErrorBoundary;
