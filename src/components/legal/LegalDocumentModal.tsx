import { useEffect } from "react";
import { ShieldCheck, FileText, X } from "lucide-react";
import { getLegalDocument, type LegalDocumentKey } from "@/content/legalDocuments";

interface LegalDocumentModalProps {
  documentKey: LegalDocumentKey | null;
  onClose: () => void;
}

export default function LegalDocumentModal({
  documentKey,
  onClose,
}: LegalDocumentModalProps) {
  useEffect(() => {
    if (!documentKey) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [documentKey, onClose]);

  if (!documentKey) return null;

  const doc = getLegalDocument(documentKey);
  const Icon = documentKey === "terms" ? FileText : ShieldCheck;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="legal-modal-title"
      className="fixed inset-0 z-[250] flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl bg-[#121215] border border-zinc-800 shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho fixo */}
        <div className="px-5 sm:px-6 py-4 border-b border-zinc-800 flex items-start justify-between gap-4 bg-[#09090B]">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/35 flex items-center justify-center text-[#00E676] shrink-0 mt-0.5">
              <Icon className="w-4 h-4" />
            </div>
            <div>
              <h2
                id="legal-modal-title"
                className="font-display font-bold text-sm sm:text-base text-zinc-50 leading-snug m-0"
              >
                {doc.title}
              </h2>
              <p className="text-[11px] font-mono text-zinc-400 mt-0.5 mb-0">
                {doc.updatedAt}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar documento legal"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800/80 transition-colors cursor-pointer bg-transparent border-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo com scroll confortável */}
        <div className="px-5 sm:px-6 py-5 max-h-[75vh] overflow-y-auto space-y-5 text-left">
          {doc.sections.map((section) => (
            <section key={section.heading} className="space-y-2">
              <h3 className="font-display font-bold text-sm text-[#00E676] m-0">
                {section.heading}
              </h3>
              {section.paragraphs.map((p, idx) => (
                <p
                  key={idx}
                  className="text-xs sm:text-[13px] text-zinc-300 leading-relaxed font-sans m-0"
                >
                  {p}
                </p>
              ))}
              {section.bullets && section.bullets.length > 0 && (
                <ul className="list-disc pl-5 space-y-1 text-xs sm:text-[13px] text-zinc-300 font-sans m-0">
                  {section.bullets.map((item, bIdx) => (
                    <li key={bIdx} className="leading-relaxed">
                      {item}
                    </li>
                  ))}
                </ul>
              )}
              {section.postParagraphs?.map((p, pIdx) => (
                <p
                  key={pIdx}
                  className="text-xs sm:text-[13px] text-zinc-300 leading-relaxed font-sans m-0 pt-1"
                >
                  {p}
                </p>
              ))}
            </section>
          ))}
        </div>

        {/* Rodapé fixo */}
        <div className="px-5 sm:px-6 py-3.5 border-t border-zinc-800 bg-[#09090B] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-5 rounded-xl bg-[#00E676] hover:bg-[#00C853] text-zinc-950 font-display font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
