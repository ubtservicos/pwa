import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const hook = read("src/hooks/useMototaxiQuickMessages.ts");
const component = read("src/components/mototaxi/QuickStatusMessages.tsx");
const passenger = read("src/pages/MototaxiTomador.tsx");
const provider = read("src/pages/PrestadorMototaxiActive.tsx");
const migration = read("supabase/migrations/20261014103000_mototaxi_quick_messages.sql");

describe("Mototaxi quick-message contract", () => {
  it("persists messages before rendering them", () => {
    expect(hook).toContain('.from("mototaxi_mensagens")');
    expect(hook).toContain(".insert({");
    expect(hook).toContain("if (insertError) throw insertError");
  });

  it("receives ride-scoped inserts through the stable realtime hook", () => {
    expect(hook).toContain("useRealtimeChannel(");
    expect(hook).toContain('event: "INSERT"');
    expect(hook).toContain('filter: rideId ? `corrida_id=eq.${rideId}`');
  });

  it("does not create disposable quick-message broadcast channels", () => {
    expect(passenger).not.toContain("event: 'quick_message'");
    expect(provider).not.toContain("event: 'quick_message'");
  });

  it("protects messages with participant RLS and realtime publication", () => {
    expect(migration).toContain('CREATE POLICY "Mototaxi participants read messages"');
    expect(migration).toContain('CREATE POLICY "Mototaxi participants send own messages"');
    expect(migration).toContain("corrida.tomador_id = auth.uid()");
    expect(migration).toContain("corrida.prestador_id = auth.uid()");
    expect(migration).toContain("ALTER PUBLICATION supabase_realtime ADD TABLE public.mototaxi_mensagens");
  });

  it("renders an accessible conversation log with automatic scrolling", () => {
    expect(component).toContain('role="log"');
    expect(component).toContain('aria-live="polite"');
    expect(component).toContain("scrollIntoView");
  });
});
