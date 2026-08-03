# UBT-DEV-012-PRODUCT-REQUIREMENTS-ANALYSIS

## 1. CURRENT_STATE
O formulário atual da Landing Page (`Index.tsx`) coleta Nome, E-mail, WhatsApp, Cidade (dropdown) e Perfis selecionados via checkbox múltipla. Os dados são persistidos na tabela `public.waitlist` que foi migrada no passo UBT-DEV-004. Não há coleta de CEP ou informações de bairro/localização detalhadas. 

## 2. PROFILE_MODEL
O modelo `text[]` (array de strings) na coluna `perfil` da tabela `public.waitlist` é **totalmente adequado e flexível**. Ele permite que um único lead possua múltiplos perfis simultaneamente (ex: tomador de serviços e prestador de serviços ao mesmo tempo). A substituição do perfil "empresa" pelo perfil "Sou uma Associação de Trabalhadores" é uma mera alteração de rótulo no frontend e regras de strings permitidas, sem exigir mudanças de tipagem na coluna do banco de dados. Os novos perfis serão mapeados como:
- `morador` (Sou morador / tomador de serviços)
- `diarista` (Sou diarista)
- `mototaxista` (Sou mototaxista)
- `ambulante` (Sou ambulante)
- `associacao` (Sou uma Associação de Trabalhadores)

## 3. WAITLIST_SCHEMA_CURRENT
O schema atual da tabela `public.waitlist` (conforme migrações 32 e 33) contém os seguintes campos:
- `id` (uuid PRIMARY KEY)
- `created_at_utc` (timestamptz)
- `created_at_local` (text)
- `nome` (text)
- `email` (text)
- `telefone` (text)
- `cidade` (text)
- `perfil` (text[] - modificado pela migração 33)
- `origem`, `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `referer` (text)
- `device_type`, `browser`, `os`, `ip_hash` (text)
- `consentimento_lgpd` (boolean)
- `status` (text)
- `observacoes` (text)

## 4. REQUIRED_FIELDS
Os novos dados requeridos pelo produto são:
- `cep_moradia` (text): CEP de residência para geocodificação territorial.
- `bairro_moradia` (text): Bairro declarativo de moradia.
- `bairro_trabalho` (text): Bairro declarativo de atuação profissional (principalmente relevante para prestadores).

## 5. DATABASE_CHANGES_REQUIRED
Recomenda-se adicionar 3 colunas opcionais (nullable) na tabela `public.waitlist`:
```sql
ALTER TABLE public.waitlist ADD COLUMN IF NOT EXISTS cep_moradia text;
ALTER TABLE public.waitlist ADD COLUMN IF NOT EXISTS bairro_moradia text;
ALTER TABLE public.waitlist ADD COLUMN IF NOT EXISTS bairro_trabalho text;
```
Manter os campos como nullable garante compatibilidade retroativa com os leads já existentes na base e evita erros caso visitantes insiram CEPs de fora de Ubatuba.

## 6. FRONTEND_CHANGES_REQUIRED
- **Ajuste de Rótulos de Perfis:** Substituir a opção "Sou uma empresa" por "Sou uma Associação de Trabalhadores" nos checkboxes de perfis.
- **Formulário de Inscrição:** Adicionar inputs para CEP de moradia, Bairro de moradia e Bairro de trabalho no fluxo de cadastro.
- **Lógica de CEP/Bairro no Frontend:** Implementar uma busca local que, ao preencher um CEP válido, realize uma busca na tabela `public.ceps_ubatuba` via cliente Supabase para auto-completar o campo `bairro_moradia` (melhorando a UX e a padronização dos bairros no banco de dados).

## 7. ADMIN_CHANGES_REQUIRED
- **Detalhamento do Lead:** Atualizar a janela modal de detalhes em `AdminWaitlistPage.tsx` para apresentar as colunas `cep_moradia`, `bairro_moradia` e `bairro_trabalho`.
- **Tabela de Leads:** Opcionalmente adicionar o Bairro de Moradia e de Trabalho como colunas rápidas ou filtros na listagem de leads do painel.

## 8. FUTURE_MAP_READINESS
A estrutura é perfeitamente adequada para a construção futura do "Mapa de Fundadores".
- **Cruzamento de Dados:** As coordenadas geográficas (latitude/longitude) para renderizar os marcadores no mapa não precisam ser salvas diretamente na tabela `waitlist`. Elas podem ser consultadas em tempo de renderização (ou agregadas) fazendo um INNER JOIN entre `public.waitlist.cep_moradia` e a tabela existente `public.ceps_ubatuba(cep)`, que já possui as colunas `lat` e `lng` geocodificadas para Ubatuba.
- **Fallback de Geolocalização:** Caso o CEP não seja encontrado na base pré-existente de Ubatuba, a latitude/longitude do bairro de moradia declarativo (`bairro_moradia`) pode ser resolvida via tabela de cache de geocodificação `public.endereco_cache`, que possui cobertura para buscas nominais.

## 9. LGPD_CONSIDERATIONS
- A coleta restrita a CEP e Bairro (sem número ou complemento da residência) está em conformidade com o princípio de **minimização de dados** da LGPD, pois impede a reidentificação direta da residência física exata do fundador e a formação de perfis invasivos, mas fornece precisão territorial suficiente para fins operacionais (análise de adensamento).
- O consentimento explícito do usuário é mantido via checkbox obrigatório atrelado à submissão do formulário.

## 10. MIGRATION_REQUIRED
- **YES** (É necessária uma migração simples para adicionar as colunas `cep_moradia`, `bairro_moradia` e `bairro_trabalho` na tabela `public.waitlist`).

## 11. DEPLOY_REQUIRED
- **YES** (A implantação do novo frontend com os inputs do formulário e das visualizações administrativas na Vercel).

## 12. RISKS
- **Duplicidade e Padronização de Bairros:** Bairros preenchidos manualmente sem autocomplemento de CEP podem sofrer variações de grafia (ex: "Itamambuca", "Praia de Itamambuca", "itamambuca").
- **Solução de mitigação:** Utilizar obrigatoriamente a tabela de cache `ceps_ubatuba` no frontend para resolver o nome do bairro de forma padronizada sempre que um CEP for inserido.

## 13. RECOMMENDED_NEXT_STEP
1. Criar a migração `34_waitlist_geo_fields.sql` contendo os comandos de `ALTER TABLE` para inclusão dos três campos de localização na tabela `waitlist`.
2. Desenvolver no frontend a interface contendo os campos de CEP e Bairros, integrando a consulta do CEP à tabela `ceps_ubatuba`.
3. Atualizar as exibições administrativas no painel `AdminWaitlistPage.tsx`.
