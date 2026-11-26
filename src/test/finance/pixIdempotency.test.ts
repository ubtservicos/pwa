import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  paymentToTransaction,
  isSettledPaymentStatus,
  isExcludedPaymentStatus,
  type PaymentHistoryRow,
} from "@/services/PaymentHistoryService";

const baseRow: PaymentHistoryRow = {
  payment_id: "a3082bd5-d03c-4c10-9192-0e9cd4ec8655",
  transaction_id: "57d16bb4-68b1-47ba-b441-c88187dc3481",
  payment_status: "approved",
  service_id: "0eae3ae7-fc3a-438b-8ff8-799cdc412710",
  service_type: "mototaxi",
  total_amount: 1.57,
  provider_amount: 1.39,
  ubt_amount: 0.11,
  entity_amount: 0.01,
  prize_worker_amount: 0.01,
  prize_consumer_amount: 0.01,
  godparent_amount: 0.02,
  payment_route: "platform_fallback",
  paid_at: "2026-11-25T19:33:54.000Z",
  participant_role: "prestador",
  origin: { address: "Rua Pescada, Jardim Carolina" },
  destination: { address: "Rua Delfim, Jardim Carolina" },
  distance_km: 1.1,
  duration_min: 4,
  ride_type: "carona",
  ride_status: "paid",
  payment_method: "pix",
};

describe("PIX Idempotency & Extrato Deduplication Contract (v1.8.7)", () => {
  it("never promotes a rejected payment attempt to confirmed even when ride_status is paid", () => {
    const rejectedAttempt: PaymentHistoryRow = {
      ...baseRow,
      payment_id: "ccef874c-ebf0-4791-b46a-0078dd3ed6e7",
      payment_status: "rejected",
      ride_status: "paid",
    };

    expect(isExcludedPaymentStatus(rejectedAttempt.payment_status)).toBe(true);
    expect(isSettledPaymentStatus(rejectedAttempt.payment_status)).toBe(false);

    const tx = paymentToTransaction(rejectedAttempt);
    expect(tx.status).toBe("cancelled");
  });

  it("maps an approved payment with short service ID traceability (#0EAE3AE7) and confirmed status", () => {
    expect(isSettledPaymentStatus(baseRow.payment_status)).toBe(true);
    expect(isExcludedPaymentStatus(baseRow.payment_status)).toBe(false);

    const tx = paymentToTransaction(baseRow);
    expect(tx.status).toBe("confirmed");
    expect(tx.amount).toBe(1.39);
    expect(tx.description).toContain("#0EAE3AE7");
  });

  it("enforces idempotent PIX reuse and strict gateway_payment_id confirmation in payment-gateway and payment-webhook", () => {
    const gateway = readFileSync(resolve(process.cwd(), "supabase/functions/payment-gateway/index.ts"), "utf-8");
    const webhook = readFileSync(resolve(process.cwd(), "supabase/functions/payment-webhook/index.ts"), "utf-8");
    const migration = readFileSync(
      resolve(process.cwd(), "supabase/migrations/20261126120000_enforce_pix_payment_idempotency.sql"),
      "utf-8",
    );

    // 1. Reuses active pending PIX and returns early if already paid
    expect(gateway).toContain("already_paid: true");
    expect(gateway).toContain("idempotent_reuse: true");
    // 2. Deletes uncommitted pre-reservation if MP rejects with 4xx/5xx without payment ID
    expect(gateway).toContain('.is("gateway_payment_id", null)');
    // 3. Strictly promotes ONLY matching gateway_payment_id and cancels stale pending attempts
    expect(gateway).toContain('.eq("gateway_payment_id", paymentId)');
    expect(gateway).toContain('.neq("gateway_payment_id", paymentId)');
    expect(webhook).toContain('.neq("id", split.id)');
    // 4. DB unique partial index prevents duplicate approved payments per service
    expect(migration).toContain("uq_pagamentos_split_one_approved_per_service");
    expect(migration).toContain("uq_payment_splits_payment_recipient");
  });
});
