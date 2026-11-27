import { useState } from "react";
import { Facebook, Instagram } from "lucide-react";
import UbtVectorLogo from "@/components/landing/UbtVectorLogo";
import LegalDocumentModal from "@/components/legal/LegalDocumentModal";
import type { LegalDocumentKey } from "@/content/legalDocuments";

export default function PublicFooter() {
  const [activeLegalDoc, setActiveLegalDoc] = useState<LegalDocumentKey | null>(null);

  return (
    <>
      <footer className="bg-[#09090B] px-6 md:px-12 py-12 border-t border-zinc-800/80 relative z-20">
        <div className="max-w-[1200px] mx-auto flex flex-col md:flex-row items-center md:items-start justify-between gap-10">
          <div className="flex flex-col items-center md:items-start gap-3">
            <UbtVectorLogo className="h-12 sm:h-14 w-auto antialiased" />
            <p className="text-xs text-zinc-400 font-sans max-w-xs text-center md:text-left leading-relaxed m-0">
              Fortalecendo a economia caiçara através da tecnologia e da colaboração.
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-10 text-xs font-sans text-zinc-400">
            <div className="flex flex-col items-center md:items-start gap-3">
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
                Legal
              </span>
              <button
                type="button"
                onClick={() => setActiveLegalDoc("terms")}
                className="text-left text-zinc-400 hover:text-[#00E676] transition-colors bg-transparent border-0 p-0 cursor-pointer font-sans text-xs"
              >
                Termos de Uso
              </button>
              <button
                type="button"
                onClick={() => setActiveLegalDoc("privacy")}
                className="text-left text-zinc-400 hover:text-[#00E676] transition-colors bg-transparent border-0 p-0 cursor-pointer font-sans text-xs"
              >
                Política de Privacidade
              </button>
            </div>

            <div className="flex flex-col items-center md:items-start gap-3">
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
                Redes Sociais
              </span>
              <a
                href="https://www.instagram.com/ubt_servicos"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white transition-colors flex items-center gap-1.5"
              >
                <Instagram className="w-3.5 h-3.5" /> Instagram
              </a>
              <a
                href="https://www.facebook.com/share/1VTCFi4vLo/?mibextid=wwXIfr"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white transition-colors flex items-center gap-1.5"
              >
                <Facebook className="w-3.5 h-3.5" /> Facebook
              </a>
            </div>
          </div>
        </div>

        <div className="max-w-[1200px] mx-auto border-t border-zinc-800/70 mt-10 pt-6 text-center text-[10px] font-mono text-zinc-500">
          <span>
            &copy; {new Date().getFullYear()} UBT Plataforma Digital Ltda · CNPJ 68.394.558/0001-32. Todos os direitos reservados.
          </span>
        </div>
      </footer>

      <LegalDocumentModal
        documentKey={activeLegalDoc}
        onClose={() => setActiveLegalDoc(null)}
      />
    </>
  );
}
