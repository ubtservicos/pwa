import { jsPDF } from "jspdf";
import { formatBRLNumber } from "@/utils/dateFilter";

export interface ReceiptSplitLine {
  label: string;
  percent: string;
  amount: number;
}

export interface ReceiptPdfData {
  id: string;
  serviceId?: string;
  transactionId?: string;
  statusLabel: string;
  dateLabel: string;
  timeLabel: string;
  typeLabel: string;
  description: string;
  paymentMethodLabel?: string;
  durationLabel?: string;
  origin?: string;
  destination?: string;
  amount: number;
  isDebit?: boolean;
  splits?: ReceiptSplitLine[];
}

function buildFilename(data: ReceiptPdfData): string {
  const raw = (data.serviceId || data.transactionId || data.id || "servico")
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 12)
    .toUpperCase();
  return `comprovante-ubt-${raw || "SERVICO"}.pdf`;
}

export function buildReceiptWhatsAppText(data: ReceiptPdfData): string {
  const shortService = data.serviceId
    ? `#${data.serviceId.slice(0, 8).toUpperCase()}`
    : `#${data.id.slice(0, 8).toUpperCase()}`;
  const shortTrack = data.transactionId ? `#${data.transactionId.slice(0, 8).toUpperCase()}` : null;
  const sign = data.isDebit ? "-" : "+";
  const lines: string[] = [
    "*UBT Serviços · Comprovante de Serviço*",
    `• Status: ${data.statusLabel}`,
    `• Valor: ${sign} R$ ${formatBRLNumber(data.amount)}`,
    `• Data/Hora: ${data.dateLabel} às ${data.timeLabel}`,
    `• Serviço: ${data.description} (${shortService})`,
  ];
  if (data.paymentMethodLabel) lines.push(`• Pagamento: ${data.paymentMethodLabel}`);
  if (data.durationLabel && data.durationLabel !== "—") lines.push(`• Duração: ${data.durationLabel}`);
  if (shortTrack) lines.push(`• Rastreio: ${shortTrack}`);
  if (data.origin) lines.push(`• Origem: ${data.origin}`);
  if (data.destination) lines.push(`• Destino: ${data.destination}`);
  if (data.splits && data.splits.length > 0) {
    lines.push("", "*Como foi dividido:*");
    data.splits.forEach((s) => {
      lines.push(`- ${s.label} (${s.percent}%): R$ ${formatBRLNumber(s.amount)}`);
    });
  }
  return lines.join("\n");
}

export function generateReceiptPdfBlob(data: ReceiptPdfData): {
  blob: Blob;
  file: File;
  filename: string;
} {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 18;

  // Cabeçalho
  doc.setFillColor(9, 9, 11);
  doc.rect(0, 0, pageWidth, 34, "F");
  doc.setTextColor(0, 230, 118);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("UBT Serviços · Comprovante de Serviço", 16, y);

  y += 8;
  doc.setTextColor(220, 220, 226);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Status: ${data.statusLabel}  |  Tipo: ${data.typeLabel}`, 16, y);

  // Valor Principal
  y = 48;
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  const sign = data.isDebit ? "- " : "+ ";
  doc.text(`${sign}R$ ${formatBRLNumber(data.amount)}`, 16, y);

  y += 6;
  doc.setDrawColor(226, 232, 240);
  doc.line(16, y, pageWidth - 16, y);

  // Metadados do Serviço
  y += 9;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text("Detalhes do Serviço", 16, y);
  y += 7;

  const shortService = data.serviceId
    ? `#${data.serviceId.slice(0, 8).toUpperCase()}`
    : `#${data.id.slice(0, 8).toUpperCase()}`;
  const shortTrack = data.transactionId ? `#${data.transactionId.slice(0, 8).toUpperCase()}` : "—";

  const rows: Array<[string, string]> = [
    ["Serviço", data.description],
    ["ID do Serviço", shortService],
    ["Código de Rastreio", shortTrack],
    ["Data", data.dateLabel],
    ["Horário", data.timeLabel],
  ];
  if (data.paymentMethodLabel) rows.push(["Forma de Pagamento", data.paymentMethodLabel]);
  if (data.durationLabel && data.durationLabel !== "—") rows.push(["Duração", data.durationLabel]);
  if (data.origin) rows.push(["Origem", data.origin]);
  if (data.destination) rows.push(["Destino", data.destination]);

  doc.setFontSize(10);
  for (const [label, val] of rows) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(71, 85, 105);
    doc.text(`${label}:`, 16, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(15, 23, 42);
    const wrapped = doc.splitTextToSize(val || "—", pageWidth - 76);
    doc.text(wrapped, 60, y);
    y += Math.max(6.5, wrapped.length * 5.2);
  }

  // Tabela Como foi dividido
  if (data.splits && data.splits.length > 0) {
    y += 4;
    doc.setDrawColor(226, 232, 240);
    doc.line(16, y, pageWidth - 16, y);
    y += 9;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text("Como foi dividido", 16, y);
    y += 7;

    doc.setFillColor(241, 245, 249);
    doc.rect(16, y - 4.5, pageWidth - 32, 7, "F");
    doc.setFontSize(9.5);
    doc.setTextColor(51, 65, 85);
    doc.text("Destinatário", 18, y);
    doc.text("Percentual", pageWidth - 68, y, { align: "right" });
    doc.text("Valor", pageWidth - 18, y, { align: "right" });
    y += 6.5;

    doc.setFont("helvetica", "normal");
    doc.setTextColor(15, 23, 42);
    for (const s of data.splits) {
      doc.text(s.label, 18, y);
      doc.text(`${s.percent}%`, pageWidth - 68, y, { align: "right" });
      doc.text(`R$ ${formatBRLNumber(s.amount)}`, pageWidth - 18, y, { align: "right" });
      y += 6;
    }
  }

  // Rodapé
  const emittedAt = new Date().toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
  });
  doc.setDrawColor(226, 232, 240);
  doc.line(16, 276, pageWidth - 16, 276);
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Documento emitido eletronicamente por UBT Serviços em ${emittedAt}.`, 16, 282);

  const filename = buildFilename(data);
  const blob = doc.output("blob");
  const file = new File([blob], filename, { type: "application/pdf" });
  return { blob, file, filename };
}

export function downloadReceiptPdf(data: ReceiptPdfData): string {
  const { blob, filename } = generateReceiptPdfBlob(data);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return filename;
}

export async function shareReceiptViaWhatsApp(data: ReceiptPdfData): Promise<"shared" | "fallback"> {
  const { file, blob, filename } = generateReceiptPdfBlob(data);
  const summaryText = buildReceiptWhatsAppText(data);

  if (
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [file] })
  ) {
    await navigator.share({
      files: [file],
      title: "Comprovante de Serviço — UBT Serviços",
      text: summaryText,
    });
    return "shared";
  }

  // Fallback desktop/browser sem Web Share de arquivos: baixa PDF + abre WhatsApp com resumo
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  const waUrl = `https://wa.me/?text=${encodeURIComponent(summaryText)}`;
  window.open(waUrl, "_blank", "noopener,noreferrer");
  return "fallback";
}
