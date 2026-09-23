# Especificação: Integração Supabase
**Status:** Planejamento
**Stack:** Vite, React, TypeScript, Supabase-js

## 1. Variáveis de Ambiente
O projeto deve consumir obrigatoriamente as seguintes chaves do arquivo `.env`:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## 2. Utilitário de Conexão
Deve ser criado um client Singleton em `src/lib/supabase.ts` para garantir que múltiplas instâncias não sejam geradas na aplicação.

## 3. Regras de Tipagem (TypeScript)
O client deve estar preparado para receber um Generic de tipagem `Database` (que será gerado futuramente via Supabase CLI), garantindo inferência de tipos nas consultas.