import { Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { useReveal } from "@/hooks/useReveal";

export const FinalCta = () => {
  const ref = useReveal<HTMLElement>();
  return (
    <section ref={ref} id="cadastro" className="reveal bg-navy py-20 px-6 text-center">
      <div className="max-w-[1100px] mx-auto md:max-w-[640px]">
        <span className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green/[0.12]">
          <Zap size={32} className="text-green" aria-hidden />
        </span>

        <p className="mt-5 text-[11px] font-semibold uppercase tracking-[2px] text-green">
          Faça parte da União
        </p>
        <h2 className="font-display font-extrabold text-white mt-3 text-[26px] leading-tight">
          Conecte-se. Trabalhe. Lucre Mais.
        </h2>
        <p className="mt-3 text-[15px] text-white/65">
          Junte-se à nossa comunidade de empreendedores e comece a lucrar mais hoje mesmo.
        </p>

        <Link
          to="/cadastro"
          className="block mx-auto mt-6 w-full max-w-[320px] min-h-[52px] rounded-full bg-green hover:bg-green-dark transition-colors text-white font-display font-semibold text-sm leading-[52px] shadow-elevated"
        >
          Quero fazer parte
        </Link>

        <Link
          to="/admin/login"
          className="block mt-8 font-sans text-[11px] text-white/25 hover:text-white/50 transition-colors"
        >
          Acesso administrativo
        </Link>
      </div>
    </section>
  );
};
