import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/database.types';

// Credenciais de Homologação / Dev
const HOMOLOG_URL = 'https://xqujubbqcfqxkfczbidq.supabase.co';
const HOMOLOG_ANON_KEY = 'sb_publishable_WpSlHCmKqb3WMbtT-wWU0w_drB6GksT';

// Credenciais de Produção
const PROD_URL = 'https://bfqidoduceusbqlnrsol.supabase.co';
const PROD_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmcWlkb2R1Y2V1c2JxbG5yc29sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxNzAwNjEsImV4cCI6MjA4Nzc0NjA2MX0.g9iKskJ9-0E2D12m03-cZg3N44f5P-yR6Q_hS_0z1Z8';

function resolveSupabaseConfig() {
  const envUrl = import.meta.env.VITE_SUPABASE_URL;
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname.toLowerCase();

    // Se for localhost ou preview da Vercel (ex: app-git-feature-*, *-projects.vercel.app)
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
    const isVercelPreview = hostname.includes('vercel.app') && !hostname.startsWith('ubtservicos.vercel.app');
    const isDevHomologHost = hostname.includes('dev') || hostname.includes('homolog') || hostname.includes('git');

    if (isLocal || isVercelPreview || isDevHomologHost) {
      console.log('⚡ [Supabase] Ambiente de HOMOLOGAÇÃO / PREVIEW detectado:', HOMOLOG_URL);
      return {
        url: HOMOLOG_URL,
        key: HOMOLOG_ANON_KEY,
        env: 'homologation'
      };
    }

    // Se for domínio estrito de Produção
    const isStrictProd =
      hostname === 'ubtservicos.com.br' ||
      hostname === 'www.ubtservicos.com.br' ||
      hostname === 'ubtservicos.vercel.app';

    if (isStrictProd) {
      console.log('🛡️ [Supabase] Ambiente de PRODUÇÃO detectado:', PROD_URL);
      return {
        url: PROD_URL,
        key: PROD_ANON_KEY,
        env: 'production'
      };
    }
  }

  // Fallback para variáveis de ambiente
  if (envUrl && envKey) {
    return {
      url: envUrl,
      key: envKey,
      env: envUrl.includes('bfqidoduceusbqlnrsol') ? 'production' : 'homologation'
    };
  }

  return {
    url: HOMOLOG_URL,
    key: HOMOLOG_ANON_KEY,
    env: 'homologation'
  };
}

const config = resolveSupabaseConfig();

export const supabase = createClient<Database>(config.url, config.key);
