import { describe, it, expect } from "vitest";
import { founderFormSchema } from "@/components/FounderForm";

// Port of sha256 and User-Agent parsing logic from Index.tsx for testing validation
async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function parseUserAgent(userAgent: string) {
  let device_type = "Desktop";
  if (/mobile/i.test(userAgent)) device_type = "Mobile";
  if (/tablet/i.test(userAgent)) device_type = "Tablet";
  
  let browser = "Outro";
  if (/chrome|crios/i.test(userAgent)) browser = "Chrome";
  else if (/firefox|fxios/i.test(userAgent)) browser = "Firefox";
  else if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) browser = "Safari";
  else if (/edge|edg/i.test(userAgent)) browser = "Edge";
  
  let os = "Outro";
  if (/iphone|ipad|ipod/i.test(userAgent)) os = "iOS";
  else if (/windows/i.test(userAgent)) os = "Windows";
  else if (/macintosh|mac os x/i.test(userAgent)) os = "MacOS";
  else if (/android/i.test(userAgent)) os = "Android";

  return { device_type, browser, os };
}

describe("Waitlist Helpers & Data Sanitization", () => {
  it("should hash IP seed securely via SHA-256 without exposing raw inputs", async () => {
    const seed1 = "Mozilla/5.0-pt-BR-1920x1080";
    const seed2 = "Mozilla/5.0-en-US-1024x768";
    
    const hash1 = await sha256(seed1);
    const hash2 = await sha256(seed2);

    expect(hash1).toHaveLength(64);
    expect(hash2).toHaveLength(64);
    expect(hash1).not.toBe(hash2);
    expect(hash1).toBe("30b94c43c714a5242056706d6102ebe52312e00913c0d00660ca32d48b2ade6e");
  });

  it("should correctly identify Mobile devices, Safari browser, and iOS operating system", () => {
    const ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1";
    const parsed = parseUserAgent(ua);

    expect(parsed.device_type).toBe("Mobile");
    expect(parsed.browser).toBe("Safari");
    expect(parsed.os).toBe("iOS");
  });

  it("should correctly identify Desktop devices, Chrome browser, and Windows operating system", () => {
    const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36";
    const parsed = parseUserAgent(ua);

    expect(parsed.device_type).toBe("Desktop");
    expect(parsed.browser).toBe("Chrome");
    expect(parsed.os).toBe("Windows");
  });
});

describe("FounderForm Schema Validation (PF & PJ)", () => {
  describe("Pessoa Física (PF)", () => {
    it("should accept valid PF registration data", () => {
      const validPf = {
        tipoPessoa: "PF",
        nome: "Felipe Santander",
        cpf: "529.982.247-25",
        telefone: "(12) 99822-6782",
        email: "felipe@exemplo.com",
        senha: "senhaSegura123",
        confirmarSenha: "senhaSegura123",
        consentimento_lgpd: true,
      };

      const result = founderFormSchema.safeParse(validPf);
      expect(result.success).toBe(true);
    });

    it("should reject PF with invalid CPF", () => {
      const invalidPf = {
        tipoPessoa: "PF",
        nome: "Felipe Santander",
        cpf: "111.222.333-44",
        telefone: "(12) 99822-6782",
        email: "felipe@exemplo.com",
        senha: "senhaSegura123",
        confirmarSenha: "senhaSegura123",
        consentimento_lgpd: true,
      };

      const result = founderFormSchema.safeParse(invalidPf);
      expect(result.success).toBe(false);
      if (!result.success) {
        const cpfError = result.error.issues.find((i) => i.path.includes("cpf"));
        expect(cpfError).toBeDefined();
        expect(cpfError?.message).toContain("CPF inválido");
      }
    });

    it("should reject PF with name shorter than 3 characters", () => {
      const invalidPf = {
        tipoPessoa: "PF",
        nome: "Al",
        cpf: "529.982.247-25",
        telefone: "(12) 99822-6782",
        email: "al@exemplo.com",
        senha: "senhaSegura123",
        confirmarSenha: "senhaSegura123",
        consentimento_lgpd: true,
      };

      const result = founderFormSchema.safeParse(invalidPf);
      expect(result.success).toBe(false);
      if (!result.success) {
        const nameError = result.error.issues.find((i) => i.path.includes("nome"));
        expect(nameError).toBeDefined();
      }
    });

    it("should reject password mismatch", () => {
      const invalidPf = {
        tipoPessoa: "PF",
        nome: "Felipe Santander",
        cpf: "529.982.247-25",
        telefone: "(12) 99822-6782",
        email: "felipe@exemplo.com",
        senha: "senhaSegura123",
        confirmarSenha: "outraSenhaDiferente",
        consentimento_lgpd: true,
      };

      const result = founderFormSchema.safeParse(invalidPf);
      expect(result.success).toBe(false);
      if (!result.success) {
        const passError = result.error.issues.find((i) => i.path.includes("confirmarSenha"));
        expect(passError).toBeDefined();
        expect(passError?.message).toContain("As senhas não conferem");
      }
    });

    it("should reject when LGPD consent is not accepted", () => {
      const invalidPf = {
        tipoPessoa: "PF",
        nome: "Felipe Santander",
        cpf: "529.982.247-25",
        telefone: "(12) 99822-6782",
        email: "felipe@exemplo.com",
        senha: "senhaSegura123",
        confirmarSenha: "senhaSegura123",
        consentimento_lgpd: false,
      };

      const result = founderFormSchema.safeParse(invalidPf);
      expect(result.success).toBe(false);
      if (!result.success) {
        const lgpdError = result.error.issues.find((i) => i.path.includes("consentimento_lgpd"));
        expect(lgpdError).toBeDefined();
      }
    });
  });

  describe("Pessoa Jurídica (PJ)", () => {
    it("should accept valid PJ registration data", () => {
      const validPj = {
        tipoPessoa: "PJ",
        razao_social: "Associação Comercial de Ubatuba",
        cnpj: "11.222.333/0001-81",
        responsavel_nome: "Maria Silva",
        responsavel_cpf: "529.982.247-25",
        telefone: "(12) 99822-6782",
        email: "contato@associacao.org.br",
        senha: "senhaSegura123",
        confirmarSenha: "senhaSegura123",
        consentimento_lgpd: true,
      };

      const result = founderFormSchema.safeParse(validPj);
      expect(result.success).toBe(true);
    });

    it("should reject PJ with invalid CNPJ", () => {
      const invalidPj = {
        tipoPessoa: "PJ",
        razao_social: "Associação Comercial de Ubatuba",
        cnpj: "00.000.000/0000-00",
        responsavel_nome: "Maria Silva",
        responsavel_cpf: "529.982.247-25",
        telefone: "(12) 99822-6782",
        email: "contato@associacao.org.br",
        senha: "senhaSegura123",
        confirmarSenha: "senhaSegura123",
        consentimento_lgpd: true,
      };

      const result = founderFormSchema.safeParse(invalidPj);
      expect(result.success).toBe(false);
      if (!result.success) {
        const cnpjError = result.error.issues.find((i) => i.path.includes("cnpj"));
        expect(cnpjError).toBeDefined();
        expect(cnpjError?.message).toContain("CNPJ inválido");
      }
    });

    it("should reject PJ without responsible person name", () => {
      const invalidPj = {
        tipoPessoa: "PJ",
        razao_social: "Associação Comercial de Ubatuba",
        cnpj: "11.222.333/0001-81",
        responsavel_nome: "",
        responsavel_cpf: "529.982.247-25",
        telefone: "(12) 99822-6782",
        email: "contato@associacao.org.br",
        senha: "senhaSegura123",
        confirmarSenha: "senhaSegura123",
        consentimento_lgpd: true,
      };

      const result = founderFormSchema.safeParse(invalidPj);
      expect(result.success).toBe(false);
      if (!result.success) {
        const respError = result.error.issues.find((i) => i.path.includes("responsavel_nome"));
        expect(respError).toBeDefined();
      }
    });

    it("should reject PJ with invalid responsible person CPF", () => {
      const invalidPj = {
        tipoPessoa: "PJ",
        razao_social: "Associação Comercial de Ubatuba",
        cnpj: "11.222.333/0001-81",
        responsavel_nome: "Maria Silva",
        responsavel_cpf: "000.000.000-00",
        telefone: "(12) 99822-6782",
        email: "contato@associacao.org.br",
        senha: "senhaSegura123",
        confirmarSenha: "senhaSegura123",
        consentimento_lgpd: true,
      };

      const result = founderFormSchema.safeParse(invalidPj);
      expect(result.success).toBe(false);
      if (!result.success) {
        const respCpfError = result.error.issues.find((i) => i.path.includes("responsavel_cpf"));
        expect(respCpfError).toBeDefined();
        expect(respCpfError?.message).toContain("CPF do responsável legal inválido");
      }
    });
  });
});
