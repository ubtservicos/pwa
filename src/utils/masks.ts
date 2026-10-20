export const maskCPF = (v: string) =>
  v
    .replace(/\D/g, "")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})/, "$1-$2")
    .slice(0, 14);

export const maskPhone = (v: string) =>
  v
    .replace(/\D/g, "")
    .replace(/(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2")
    .slice(0, 15);

export const isValidEmail = (v: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

export const maskCardNumber = (v: string) =>
  v
    .replace(/\D/g, "")
    .replace(/(\d{4})(\d)/, "$1 $2")
    .replace(/(\d{4})(\d)/, "$1 $2")
    .replace(/(\d{4})(\d)/, "$1 $2")
    .slice(0, 19);

export const maskExpiry = (v: string) =>
  v
    .replace(/\D/g, "")
    .replace(/(\d{2})(\d)/, "$1/$2")
    .slice(0, 5);

export const maskCNPJ = (v: string) =>
  v
    .replace(/\D/g, "")
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})/, "$1-$2")
    .slice(0, 18);

export const generateReferralSlug = (name?: string, docOrId?: string): string => {
  const rawFirstName = (name || "fundador").trim().split(/[\s\-_]+/)[0] || "fundador";
  const cleanFirstName = rawFirstName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, "");

  const safeName = cleanFirstName || "fundador";

  // Se docOrId contém dígitos (ex: CPF), extrai os 3 primeiros dígitos numéricos
  const digits = (docOrId || "").replace(/\D/g, "");
  if (digits.length >= 3) {
    return `${safeName}-${digits.slice(0, 3)}`;
  }

  // Alphanumeric 4-character short code fallback
  let shortCode = "4d1e";
  if (docOrId) {
    const cleanId = docOrId.replace(/[^a-zA-Z0-9]/g, "");
    shortCode = cleanId.slice(-4) || "4d1e";
  } else {
    shortCode = Math.random().toString(36).substring(2, 6);
  }

  return `${safeName}-${shortCode.toLowerCase()}`;
};

