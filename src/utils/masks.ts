export const maskCPF = (v: string) =>
  v
    .replace(/\D/g, "")
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");

export const maskPhone = (v: string) => {
  const clean = v.replace(/\D/g, "").slice(0, 11);
  if (clean.length <= 10) {
    return clean
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d{1,4})$/, "$1-$2");
  }
  return clean
    .replace(/(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d{1,4})$/, "$1-$2");
};

export const maskCNPJ = (v: string) =>
  v
    .replace(/\D/g, "")
    .slice(0, 14)
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");

export const maskEVP = (v: string) => {
  const clean = v.replace(/[^a-fA-F0-9]/g, "").slice(0, 32).toLowerCase();
  let res = clean;
  if (clean.length > 8) {
    res = `${clean.slice(0, 8)}-${clean.slice(8)}`;
  }
  if (clean.length > 12) {
    res = `${clean.slice(0, 8)}-${clean.slice(8, 12)}-${clean.slice(12)}`;
  }
  if (clean.length > 16) {
    res = `${clean.slice(0, 8)}-${clean.slice(8, 12)}-${clean.slice(12, 16)}-${clean.slice(16)}`;
  }
  if (clean.length > 20) {
    res = `${clean.slice(0, 8)}-${clean.slice(8, 12)}-${clean.slice(12, 16)}-${clean.slice(16, 20)}-${clean.slice(20, 32)}`;
  }
  return res;
};

export const applyPixMask = (value: string, tipo?: string): string => {
  if (!value) return "";
  const t = (tipo || "").toLowerCase().trim();

  switch (t) {
    case "telefone":
    case "celular":
    case "phone":
      return maskPhone(value);

    case "cpf":
      return maskCPF(value);

    case "cnpj":
      return maskCNPJ(value);

    case "aleatoria":
    case "evp":
    case "chave_aleatoria":
      return maskEVP(value);

    case "email":
      return value.replace(/\s+/g, "").slice(0, 80);

    default:
      return value;
  }
};

export const getPixPlaceholder = (tipo?: string): string => {
  const t = (tipo || "").toLowerCase().trim();
  switch (t) {
    case "telefone":
    case "celular":
    case "phone":
      return "(12) 99999-9999";
    case "cpf":
      return "000.000.000-00";
    case "cnpj":
      return "00.000.000/0000-00";
    case "email":
      return "seu.email@exemplo.com";
    case "aleatoria":
    case "evp":
    case "chave_aleatoria":
      return "00000000-0000-0000-0000-000000000000";
    default:
      return "Digite sua Chave Pix";
  }
};

export const getPixMaxLength = (tipo?: string): number => {
  const t = (tipo || "").toLowerCase().trim();
  switch (t) {
    case "telefone":
    case "celular":
    case "phone":
      return 15;
    case "cpf":
      return 14;
    case "cnpj":
      return 18;
    case "aleatoria":
    case "evp":
    case "chave_aleatoria":
      return 36;
    case "email":
      return 80;
    default:
      return 80;
  }
};

export const isValidCPF = (cpf: string): boolean => {
  const clean = cpf.replace(/\D/g, "");
  if (clean.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(clean)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(clean.charAt(i), 10) * (10 - i);
  }
  let rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(clean.charAt(9), 10)) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(clean.charAt(i), 10) * (11 - i);
  }
  rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(clean.charAt(10), 10)) return false;

  return true;
};

export const isValidCNPJ = (cnpj: string): boolean => {
  const clean = cnpj.replace(/\D/g, "");
  if (clean.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(clean)) return false;

  let size = clean.length - 2;
  let numbers = clean.substring(0, size);
  const digits = clean.substring(size);
  let sum = 0;
  let pos = size - 7;
  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i), 10) * pos--;
    if (pos < 2) pos = 9;
  }
  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(0), 10)) return false;

  size = size + 1;
  numbers = clean.substring(0, size);
  sum = 0;
  pos = size - 7;
  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i), 10) * pos--;
    if (pos < 2) pos = 9;
  }
  result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(1), 10)) return false;

  return true;
};

export const isValidEVP = (evp: string): boolean => {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(evp.trim());
};

export const isValidEmail = (v: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

export const isValidPixPhone = (phone: string): boolean => {
  const clean = phone.replace(/\D/g, "");
  if (clean.length !== 10 && clean.length !== 11) return false;
  const ddd = parseInt(clean.slice(0, 2), 10);
  if (ddd < 11 || ddd > 99) return false;
  return true;
};

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

