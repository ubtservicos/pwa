import { describe, it, expect } from "vitest";
import {
  applyPixMask,
  getPixPlaceholder,
  getPixMaxLength,
  isValidCPF,
  isValidCNPJ,
  isValidEVP,
  isValidPixPhone,
  isValidEmail,
  maskPhone,
  maskCPF,
  maskCNPJ,
  maskEVP
} from "@/utils/masks";

describe("Pix Masks and Validation Suite", () => {
  describe("applyPixMask & formatters", () => {
    it("formats CPF correctly and clamps to 11 digits", () => {
      const masked = applyPixMask("123456789099999", "cpf");
      expect(masked).toBe("123.456.789-09");
    });

    it("formats CNPJ correctly and clamps to 14 digits", () => {
      const masked = applyPixMask("1234567800019599999", "cnpj");
      expect(masked).toBe("12.345.678/0001-95");
    });

    it("formats phone correctly and clamps to 11 digits", () => {
      const masked10 = applyPixMask("1122334455", "telefone");
      expect(masked10).toBe("(11) 2233-4455");

      const masked11 = applyPixMask("12999998888999", "telefone");
      expect(masked11).toBe("(12) 99999-8888");
    });

    it("formats EVP UUID correctly and clamps to 32 hex chars / 36 formatted", () => {
      const raw = "123e4567e89b12d3a456426614174000extra";
      const masked = applyPixMask(raw, "aleatoria");
      expect(masked).toBe("123e4567-e89b-12d3-a456-426614174000");
    });

    it("trims whitespace and limits email length", () => {
      const masked = applyPixMask("  teste @exemplo.com  ", "email");
      expect(masked).toBe("teste@exemplo.com");
    });
  });

  describe("getPixPlaceholder & getPixMaxLength", () => {
    it("returns expected placeholders", () => {
      expect(getPixPlaceholder("cpf")).toBe("000.000.000-00");
      expect(getPixPlaceholder("cnpj")).toBe("00.000.000/0000-00");
      expect(getPixPlaceholder("telefone")).toBe("(12) 99999-9999");
      expect(getPixPlaceholder("email")).toBe("seu.email@exemplo.com");
      expect(getPixPlaceholder("aleatoria")).toBe("00000000-0000-0000-0000-000000000000");
    });

    it("returns expected max lengths", () => {
      expect(getPixMaxLength("cpf")).toBe(14);
      expect(getPixMaxLength("cnpj")).toBe(18);
      expect(getPixMaxLength("telefone")).toBe(15);
      expect(getPixMaxLength("aleatoria")).toBe(36);
      expect(getPixMaxLength("email")).toBe(80);
    });
  });

  describe("Strict Validators", () => {
    it("validates CPF correctly", () => {
      expect(isValidCPF("111.111.111-11")).toBe(false);
      expect(isValidCPF("00000000000")).toBe(false);
      // Valid CPF checksum example
      expect(isValidCPF("52998224725")).toBe(true);
      expect(isValidCPF("529.982.247-25")).toBe(true);
    });

    it("validates CNPJ correctly", () => {
      expect(isValidCNPJ("11.111.111/1111-11")).toBe(false);
      // Valid CNPJ checksum example
      expect(isValidCNPJ("11.222.333/0001-81")).toBe(true);
    });

    it("validates EVP UUID correctly", () => {
      expect(isValidEVP("123e4567-e89b-12d3-a456-426614174000")).toBe(true);
      expect(isValidEVP("123e4567-e89b-12d3-a456-42661417400")).toBe(false);
      expect(isValidEVP("not-a-uuid")).toBe(false);
    });

    it("validates Pix phone numbers correctly", () => {
      expect(isValidPixPhone("(12) 99999-8888")).toBe(true);
      expect(isValidPixPhone("1234567890")).toBe(true);
      expect(isValidPixPhone("01999998888")).toBe(false); // Invalid DDD < 11
      expect(isValidPixPhone("12345")).toBe(false);
    });

    it("validates Pix email correctly", () => {
      expect(isValidEmail("user@dominio.com.br")).toBe(true);
      expect(isValidEmail("invalido")).toBe(false);
      expect(isValidEmail("invalido@")).toBe(false);
    });
  });
});
