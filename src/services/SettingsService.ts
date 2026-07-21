import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export interface SystemSetting {
  id: string;
  categoria: string;
  chave: string;
  valor: any;
  tipo: string;
  descricao?: string;
  valor_padrao?: any;
  editavel: boolean;
  sensivel: boolean;
  versao: number;
  created_at: string;
  updated_at: string;
  updated_by?: string;
}

export interface SystemSettingVersion {
  id: string;
  setting_id: string;
  chave: string;
  valor: any;
  versao: number;
  updated_by?: string;
  updated_at: string;
  motivo?: string;
}

class SettingsServiceManager {
  private cache = new Map<string, { val: any; ts: number }>();
  private readonly TTL_MS = 60000; // 60s memory TTL
  private initialized = false;

  private initRealtime() {
    if (this.initialized) return;
    this.initialized = true;

    try {
      supabase
        .channel("system_settings_realtime_cache")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "system_settings" },
          (payload: any) => {
            if (payload.new && payload.new.chave) {
              this.cache.set(payload.new.chave, { val: payload.new.valor, ts: Date.now() });
            } else {
              this.cache.clear();
            }
          }
        )
        .subscribe();
    } catch (e) {
      console.warn("[SettingsService] Realtime subscription failed:", e);
    }
  }

  public invalidate() {
    this.cache.clear();
  }

  public async get<T>(chave: string, defaultValue?: T): Promise<T> {
    this.initRealtime();
    const cached = this.cache.get(chave);
    const now = Date.now();

    if (cached && (now - cached.ts) < this.TTL_MS) {
      return cached.val as T;
    }

    try {
      const { data, error } = await supabase
        .from("system_settings")
        .select("valor")
        .eq("chave", chave)
        .maybeSingle();

      if (error || !data) {
        return defaultValue as T;
      }

      this.cache.set(chave, { val: data.valor, ts: now });
      return data.valor as T;
    } catch (err) {
      console.error(`[SettingsService] Erro ao buscar parâmetro '${chave}':`, err);
      return defaultValue as T;
    }
  }

  public async getBoolean(chave: string, defaultValue = false): Promise<boolean> {
    const val = await this.get<any>(chave, defaultValue);
    if (typeof val === "boolean") return val;
    if (typeof val === "string") return val.toLowerCase() === "true";
    return Boolean(val);
  }

  public async getFeatureFlag(chave: string, defaultValue = true): Promise<boolean> {
    return this.getBoolean(chave, defaultValue);
  }

  public async getNumber(chave: string, defaultValue = 0): Promise<number> {
    const val = await this.get<any>(chave, defaultValue);
    const num = Number(val);
    return isNaN(num) ? defaultValue : num;
  }

  public async getJSON<T>(chave: string, defaultValue?: T): Promise<T> {
    const val = await this.get<any>(chave, defaultValue);
    if (typeof val === "object" && val !== null) return val as T;
    try {
      return JSON.parse(val) as T;
    } catch {
      return defaultValue as T;
    }
  }

  public async set(chave: string, novoValor: any, motivo?: string): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.rpc("update_system_setting", {
        p_chave: chave,
        p_novo_valor: novoValor,
        p_user_id: user?.id || null,
        p_motivo: motivo || "Atualização via BackOffice",
      });

      if (error) throw error;
      this.cache.set(chave, { val: novoValor, ts: Date.now() });
      return true;
    } catch (err) {
      console.error(`[SettingsService] Erro ao atualizar parâmetro '${chave}':`, err);
      return false;
    }
  }

  public async rollback(settingId: string, versao: number, motivo?: string): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.rpc("rollback_system_setting", {
        p_setting_id: settingId,
        p_versao: versao,
        p_user_id: user?.id || null,
        p_motivo: motivo || `Rollback para versão ${versao}`,
      });

      if (error) throw error;
      this.invalidate();
      return true;
    } catch (err) {
      console.error(`[SettingsService] Erro no rollback da versão ${versao}:`, err);
      return false;
    }
  }
}

export const SettingsService = new SettingsServiceManager();

export function useFeatureFlag(chave: string, defaultValue = true): boolean {
  const [enabled, setEnabled] = useState<boolean>(defaultValue);

  useEffect(() => {
    let active = true;
    SettingsService.getFeatureFlag(chave, defaultValue).then((val) => {
      if (active) setEnabled(val);
    });
    return () => {
      active = false;
    };
  }, [chave, defaultValue]);

  return enabled;
}
