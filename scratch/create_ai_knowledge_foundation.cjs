const fs = require('fs');
const path = require('path');

const wikiRoot = 'C:\\Users\\MacInBox\\Documents\\profissional\\ubt\\wiki';

// Helper to write files safely
function write(subpath, content) {
  const full = path.join(wikiRoot, subpath);
  const dir = path.dirname(full);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(full, content.trim() + '\n', 'utf8');
}

async function main() {
  console.log('Writing AI Knowledge Foundation at:', wikiRoot);

  // 1. INTENT_MAP.md
  write('10_AI_KNOWLEDGE/customer_support/INTENT_MAP.md', `
# Mapa de Intenções — WhatsApp-Agent

Este documento mapeia as intenções conversacionais reconhecidas pelo chatbot de suporte da UBT, classificando a audiência e o status do artigo correspondente.

## GERAL (Comum a Tomadores e Prestadores)
- **INTENT_GERAL_WHAT_IS_UBT**
  - **Descrição:** O que é a plataforma UBT?
  - **Público:** Geral
  - **Informação necessária:** Apresentação institucional, área de atuação (Ubatuba) e propósito.
  - **Artigo:** \`10_AI_KNOWLEDGE/customer_support/geral/what_is_ubt.md\`
  - **Status:** READY
  - **Precisa de Escalonamento:** Não

- **INTENT_GERAL_CONTATO_SUPORTE**
  - **Descrição:** Como falar com um atendente humano.
  - **Público:** Geral
  - **Informação necessária:** Horário de atendimento e contato.
  - **Artigo:** \`10_AI_KNOWLEDGE/customer_support/escalation/human_handoff.md\`
  - **Status:** READY
  - **Precisa de Escalonamento:** Sim (Imediato)

## TOMADOR (Clientes / Usuários de Serviço)
- **INTENT_TOMADOR_SOLICITAR_SERVICO**
  - **Descrição:** Como pedir diarista, mototáxi ou ambulante.
  - **Público:** Tomador
  - **Informação necessária:** Passo a passo para solicitar.
  - **Artigo:** \`10_AI_KNOWLEDGE/customer_support/tomador/solicitar_servico.md\`
  - **Status:** PARTIAL (Aguardando detalhamento de telas)
  - **Precisa de Escalonamento:** Não

- **INTENT_TOMADOR_METODO_PAGAMENTO**
  - **Descrição:** Formas de pagamento aceitas pela plataforma.
  - **Público:** Tomador
  - **Informação necessária:** Cartão de crédito, Pix, intermediação Mercado Pago.
  - **Artigo:** PENDING — INFORMATION NOT YET PROVIDED
  - **Status:** PENDING
  - **Precisa de Escalonamento:** Não

- **INTENT_TOMADOR_CANCELAMENTO**
  - **Descrição:** Como cancelar um serviço solicitado.
  - **Público:** Tomador
  - **Informação necessária:** Regras e taxas de cancelamento.
  - **Artigo:** PENDING — INFORMATION NOT YET PROVIDED
  - **Status:** PENDING
  - **Precisa de Escalonamento:** Não

## PRESTADOR (Diaristas, Mototaxistas, Ambulantes)
- **INTENT_PRESTADOR_CADASTRO_ONBOARDING**
  - **Descrição:** Como se cadastrar e como funciona o Onboarding.
  - **Público:** Prestador
  - **Informação necessária:** Cadastro, Waitlist (fila de espera) e verificação KYC.
  - **Artigo:** \`10_AI_KNOWLEDGE/customer_support/prestador/cadastro_onboarding.md\`
  - **Status:** READY
  - **Precisa de Escalonamento:** Não

- **INTENT_PRESTADOR_REPASSES_PAGAMENTOS**
  - **Descrição:** Quando e como são pagos os serviços prestados.
  - **Público:** Prestador
  - **Informação necessária:** Taxas aplicadas (90% do prestador, 10% de repasses corporativos).
  - **Artigo:** PENDING — INFORMATION NOT YET PROVIDED
  - **Status:** BLOCKED (Lógica de split financeiro congelada na Wave 1.2)
  - **Precisa de Escalonamento:** Não

- **INTENT_PRESTADOR_PROBLEMAS_KYC**
  - **Descrição:** Documentação reprovada ou pendente.
  - **Público:** Prestador
  - **Informação necessária:** Motivo de bloqueios de conta.
  - **Artigo:** PENDING — INFORMATION NOT YET PROVIDED
  - **Status:** PENDING
  - **Precisa de Escalonamento:** Sim (Handoff para o KYC Team)

## ESCALATION (Regras de Escalonamento)
- **INTENT_ESCALATION_DISPUTAS_JURIDICAS**
  - **Descrição:** Reclamações de roubo, acidentes ou quebra de termos de privacidade.
  - **Público:** Geral
  - **Informação necessária:** Escalonamento urgente para a gerência.
  - **Artigo:** \`10_AI_KNOWLEDGE/customer_support/escalation/human_handoff.md\`
  - **Status:** READY
  - **Precisa de Escalonamento:** Sim (Obrigatório e imediato)
`);

  // 2. KNOWLEDGE_COVERAGE_MATRIX.md
  write('10_AI_KNOWLEDGE/customer_support/KNOWLEDGE_COVERAGE_MATRIX.md', `
# Matriz de Cobertura de Conhecimento

Esta matriz acompanha o preenchimento de artigos de suporte para o chatbot, cruzando intenções reconhecidas com artigos de IA reais.

| Intent | Público | Existe informação? | Fonte | Artigo AI | Status | Escalonamento |
|---|---|---|---|---|---|---|
| INTENT_GERAL_WHAT_IS_UBT | Geral | Sim | Institucional | geral/what_is_ubt.md | READY | Não |
| INTENT_GERAL_CONTATO_SUPORTE | Geral | Sim | Manual de Operações | escalation/human_handoff.md | READY | Sim |
| INTENT_TOMADOR_SOLICITAR_SERVICO | Tomador | Parcial | Código Frontend (Vite) | tomador/solicitar_servico.md | PARTIAL | Não |
| INTENT_TOMADOR_METODO_PAGAMENTO | Tomador | Não | PENDING | - | PENDING | Não |
| INTENT_TOMADOR_CANCELAMENTO | Tomador | Não | PENDING | - | PENDING | Não |
| INTENT_PRESTADOR_CADASTRO_ONBOARDING | Prestador | Sim | Migration 34 / Waitlist | prestador/cadastro_onboarding.md | READY | Não |
| INTENT_PRESTADOR_REPASSES_PAGAMENTOS | Prestador | Não | PENDING (Financeiro congelado) | - | BLOCKED | Não |
| INTENT_PRESTADOR_PROBLEMAS_KYC | Prestador | Não | PENDING | - | PENDING | Sim |
| INTENT_ESCALATION_DISPUTAS_JURIDICAS | Geral | Sim | Termos de LGPD / Compliance | escalation/human_handoff.md | READY | Sim |
`);

  // 3. First Articles
  // geral/what_is_ubt.md
  write('10_AI_KNOWLEDGE/customer_support/geral/what_is_ubt.md', `
---
id: "AIK-001"
title: "O que é a UBT"
status: "FACT"
source: "Manual Institucional"
date: "2026-08-06"
version: "1.0.0"
responsible: "Comunicação"
target_audience: "Geral"
access_level: "PUBLIC_INTERNAL"
ai_allowed: true
---

# O que é a UBT

A UBT (União de Bairros e Trabalhadores) é um ecossistema tecnológico e operacional sediado em Ubatuba/SP, focado na intermediação de serviços locais. 

## Serviços Disponíveis na Plataforma
- **Diaristas:** Agendamento e contratação de serviços domésticos.
- **Mototáxi:** Solicitação de corridas rápidas no município.
- **Ambulantes:** Localização e pedidos com vendedores locais.
- **Côco & Cia:** Vertical de comércio local.

## Limites de Utilização pelo Agente
- O chatbot pode detalhar as verticais ativas em Ubatuba.
- Não inventar planos de expansão para outros municípios sem confirmação prévia.

## Quando Escalar
- Dúvidas sobre contratações de VPs e parcerias comerciais.
`);

  // tomador/solicitar_servico.md
  write('10_AI_KNOWLEDGE/customer_support/tomador/solicitar_servico.md', `
---
id: "AIK-002"
title: "Como solicitar um serviço"
status: "REQUIREMENT"
source: "UX da Landing Page"
date: "2026-08-06"
version: "1.0.0"
responsible: "Operações"
target_audience: "Tomador"
access_level: "PUBLIC_INTERNAL"
ai_allowed: true
---

# Como solicitar um serviço

## Fluxo Geral do Tomador
1. O usuário acessa a Landing Page ou o SuperApp UBT.
2. Efetua a escolha do perfil (Diarista, Mototáxi, Ambulante, etc.).
3. Preenche a localização geográfica (CEP ou endereço em Ubatuba).
4. O sistema busca os prestadores disponíveis mais próximos.

## Limites de Utilização pelo Agente
- PENDING — INFORMATION NOT YET PROVIDED (Aguardando homologação de telas de solicitação).

## Quando Escalar
- Reclamações de instabilidade no carregamento da tela de busca.
`);

  // prestador/cadastro_onboarding.md
  write('10_AI_KNOWLEDGE/customer_support/prestador/cadastro_onboarding.md', `
---
id: "AIK-003"
title: "Cadastro de Prestador e Waitlist"
status: "FACT"
source: "Migration 34 / waitlist.ts"
date: "2026-08-06"
version: "1.0.0"
responsible: "BackOffice KYC"
target_audience: "Prestador"
access_level: "PUBLIC_INTERNAL"
ai_allowed: true
---

# Cadastro de Prestador e Fila de Espera (Waitlist)

## Cadastro Territorial
O cadastro de prestadores exige o preenchimento de geolocalização no formulário de Waitlist:
- **CEP de Moradia:** CEP válido em Ubatuba. Se o CEP não for localizado no banco \`public.ceps_ubatuba\`, o prestador tem permissão de digitar o nome do bairro manualmente.
- **Bairro de Moradia e Bairro de Trabalho:** Campos obrigatórios no formulário para triagem logística.

## Fila de Espera (Waitlist)
O preenchimento do cadastro insere o prestador na Fila de Espera. A liberação para o Onboarding e prestação de serviços efetiva passa pela análise manual da equipe de KYC.

## Limites de Utilização pelo Agente
- O bot pode orientar a digitação manual do bairro caso o CEP do prestador apresente erro de não encontrado no formulário.
- O bot não deve prometer prazos específicos para aprovação do cadastro na Waitlist.

## Quando Escalar
- Usuário informa que enviou a documentação correta mas permanece bloqueado na fila de espera por mais de 5 dias úteis.
`);

  // escalation/human_handoff.md
  write('10_AI_KNOWLEDGE/customer_support/escalation/human_handoff.md', `
---
id: "AIK-004"
title: "Políticas de Handoff Humano"
status: "FACT"
source: "Termos de Uso / SAC"
date: "2026-08-06"
version: "1.0.0"
responsible: "Suporte N1"
target_audience: "Geral"
access_level: "PUBLIC_INTERNAL"
ai_allowed: true
---

# Políticas de Handoff Humano

Este documento descreve as regras que obrigam o bot de atendimento via WhatsApp a interromper a resposta automática e transferir o usuário para um atendente de suporte humano.

## Casos Gerais de Transferência
1. Solicitação explícita por falar com um atendente ("atendente", "falar com humano", "suporte humano").
2. Reclamação repetida por problemas não solucionados (2 ou mais falhas de entendimento da intenção).

## Casos Críticos de Transição Imediata
- Perda ou extravio de itens durante corridas de Mototáxi.
- Acidentes ou problemas de segurança pessoal reportados por prestadores ou tomadores.
- Questionamentos sobre estornos não creditados em cartão de crédito ou Pix.
`);

  // 4. AGENT_DATA_BOUNDARIES.md
  write('10_AI_KNOWLEDGE/policies/AGENT_DATA_BOUNDARIES.md', `
# AGENT_DATA_BOUNDARIES

Este documento define os limites regulatórios de exposição de informações pelo WhatsApp-Agent.

## O agente PODE Expor:
- Informações gerais e institucionais que estejam ativas no diretório \`10_AI_KNOWLEDGE\` com metadados \`ai_allowed: true\`.
- FAQs de uso público e passo a passo de cadastro e Onboarding.

## O agente NÃO PODE Expor:
- **Informações financeiras internas da UBT:** Percentuais dinâmicos de split cadastrados no banco ou simulações financeiras de taxas de serviços.
- **Informações societárias:** Cotas dos sócios fundadores, participações ou informações confidenciais de diretoria.
- **Informações de Engenharia:** Endpoints de conexões REST do Supabase, API Keys privadas, ou tokens de sessões JWT.
- **Dados Pessoais (PII):** CPF, telefones pessoais de diretores ou colaboradores internos da plataforma.
- **Segredos operacionais:** Acesso de rotas de segurança do BackOffice ou regras de logs de auditoria (\`wiki_audit_logs\`).
`);

  // 5. ESCALATION_POLICY.md
  write('10_AI_KNOWLEDGE/customer_support/escalation/ESCALATION_POLICY.md', `
# Diretrizes de Escalonamento da UBT

Documento que rege o escalonamento para suporte humano do chatbot de suporte UBT.

## 1. Atendimento Humano N1 (Suporte Geral)
- Dúvidas recorrentes sobre o uso do aplicativo.
- Dificuldade na alteração de cadastro ou redefinição de senhas.

## 2. Operações de Rota (Suporte Emergencial N2)
- Acidentes físicos de trânsito em andamento envolvendo mototaxistas.
- Relato de assédio, agressões ou perda de cargas.

## 3. KYC e Compliance (Triagem de Cadastro)
- Reclamações de reprovação cadastral na Waitlist.
- Suspeita de fraude ou falsidade ideológica no envio de CNH/RG.

## 4. Financeiro e Repasses
- Discrepâncias em valores de repasses Pix recebidos pelos prestadores.
- Cobranças duplicadas no cartão de crédito do tomador.
`);

  // 6. 99_INDEX/AI_KNOWLEDGE_CATALOG.md
  write('99_INDEX/AI_KNOWLEDGE_CATALOG.md', `
# Catálogo de Ingestão de IA

Lista de artigos de IA validados sob a pasta \`10_AI_KNOWLEDGE\`:

| ID | Artigo | Público (Tomador/Prestador) | Ingestão Status | Versão Consumida | Última Sincronização |
|---|---|---|---|---|---|
| AIK-001 | geral/what_is_ubt.md | Geral | READY | 1.0.0 | 2026-08-06 |
| AIK-002 | tomador/solicitar_servico.md | Tomador | PARTIAL | 1.0.0 | 2026-08-06 |
| AIK-003 | prestador/cadastro_onboarding.md | Prestador | READY | 1.0.0 | 2026-08-06 |
| AIK-004 | escalation/human_handoff.md | Geral | READY | 1.0.0 | 2026-08-06 |
`);

  // 7. 99_INDEX/OPEN_QUESTIONS.md
  write('99_INDEX/OPEN_QUESTIONS.md', `
# Perguntas em Aberto

Lista consolidada de lacunas documentais que exigem verificação das equipes operacionais, de produto e engenharia:

1. **[INFORMAÇÃO A LEVANTAR]:** Parâmetros exatos e fluxos de homologação de pagamentos em produção com o Mercado Pago.
2. **[INFORMAÇÃO A LEVANTAR]:** Qual a periodicidade oficial de sincronização da base territorial de CEPs de Ubatuba junto aos Correios.
3. **[WIKI-ENG-008]:** Qual a taxa exata de cancelamento cobrada do tomador após aceitação da corrida de mototáxi.
4. **[WIKI-ENG-008]:** Horário exato de atendimento do suporte humano para transição de handoff do bot.
`);

  console.log('AI Knowledge Foundation files generated.');
}

main();
