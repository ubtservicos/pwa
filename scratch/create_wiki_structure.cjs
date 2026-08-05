const fs = require('fs');
const path = require('path');

const wikiRoot = 'C:\\Users\\MacInBox\\Documents\\profissional\\ubt\\wiki';

// 1. Directories List
const dirs = [
  '00_GOVERNANCE',
  '01_COMPANY',
  '01_COMPANY/institucional',
  '01_COMPANY/organizacao',
  '01_COMPANY/cultura',
  '01_COMPANY/estrategia',
  '02_PRODUCTS_SERVICES',
  '02_PRODUCTS_SERVICES/geral',
  '02_PRODUCTS_SERVICES/mototaxi',
  '02_PRODUCTS_SERVICES/diaristas',
  '02_PRODUCTS_SERVICES/ambulantes',
  '02_PRODUCTS_SERVICES/coco_e_cia',
  '03_CUSTOMER_SUPPORT',
  '03_CUSTOMER_SUPPORT/tomador',
  '03_CUSTOMER_SUPPORT/prestador',
  '03_CUSTOMER_SUPPORT/faq',
  '03_CUSTOMER_SUPPORT/troubleshooting',
  '03_CUSTOMER_SUPPORT/escalonamento',
  '04_OPERATIONS',
  '04_OPERATIONS/procedimentos',
  '04_OPERATIONS/incidentes',
  '04_OPERATIONS/cancelamentos',
  '04_OPERATIONS/seguranca',
  '04_OPERATIONS/escalonamento',
  '05_FINANCE',
  '05_FINANCE/pagamentos',
  '05_FINANCE/repasses',
  '05_FINANCE/reembolsos',
  '05_FINANCE/premios',
  '05_FINANCE/split',
  '06_ENGINEERING',
  '06_ENGINEERING/architecture',
  '06_ENGINEERING/frontend',
  '06_ENGINEERING/backend',
  '06_ENGINEERING/database',
  '06_ENGINEERING/edge_functions',
  '06_ENGINEERING/integrations',
  '06_ENGINEERING/deployment',
  '06_ENGINEERING/observability',
  '06_ENGINEERING/security',
  '06_ENGINEERING/rbac',
  '07_COMMUNICATION_MARKETING',
  '07_COMMUNICATION_MARKETING/marca',
  '07_COMMUNICATION_MARKETING/comunicacao',
  '07_COMMUNICATION_MARKETING/marketing',
  '07_COMMUNICATION_MARKETING/campanhas',
  '07_COMMUNICATION_MARKETING/conteudo',
  '08_LEGAL',
  '08_LEGAL/termos',
  '08_LEGAL/privacidade',
  '08_LEGAL/lgpd',
  '08_LEGAL/contratos',
  '08_LEGAL/juridico_restrito',
  '09_ADMINISTRATION',
  '09_ADMINISTRATION/procedimentos',
  '09_ADMINISTRATION/pessoas',
  '09_ADMINISTRATION/fornecedores',
  '09_ADMINISTRATION/administrativo_restrito',
  '10_AI_KNOWLEDGE',
  '10_AI_KNOWLEDGE/customer_support',
  '10_AI_KNOWLEDGE/customer_support/tomador',
  '10_AI_KNOWLEDGE/customer_support/prestador',
  '10_AI_KNOWLEDGE/customer_support/geral',
  '10_AI_KNOWLEDGE/customer_support/escalation',
  '10_AI_KNOWLEDGE/internal_agents',
  '10_AI_KNOWLEDGE/internal_agents/atendimento',
  '10_AI_KNOWLEDGE/internal_agents/operacional',
  '10_AI_KNOWLEDGE/internal_agents/financeiro',
  '10_AI_KNOWLEDGE/internal_agents/engenharia',
  '10_AI_KNOWLEDGE/internal_agents/outros',
  '10_AI_KNOWLEDGE/policies',
  '11_TEMPLATES',
  '12_INBOX',
  '12_INBOX/to_validate',
  '12_INBOX/to_classify',
  '12_INBOX/pending_sources',
  '90_ARCHIVE',
  '90_ARCHIVE/deprecated',
  '99_INDEX'
];

// Helper to write files safely
function write(subpath, content) {
  const full = path.join(wikiRoot, subpath);
  fs.writeFileSync(full, content.trim() + '\n', 'utf8');
}

async function main() {
  console.log('Creating structure at:', wikiRoot);
  if (!fs.existsSync(wikiRoot)) {
    fs.mkdirSync(wikiRoot, { recursive: true });
  }

  // Create all subdirectories
  for (const d of dirs) {
    const dirPath = path.join(wikiRoot, d);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  // 00_GOVERNANCE Files
  write('00_GOVERNANCE/README.md', `
# 00_GOVERNANCE

Esta pasta contém as políticas e diretrizes oficiais de governança de conteúdo, versionamento e regras de permissionamento da Base de Conhecimento / Wiki UBT.

## Nível de Acesso Esperado
- Leitura: Colaboradores da UBT e Administradores.
- Escrita: Equipe de Gestão de Conhecimento e Superadmin.

## Uso por IA
- Autorizado apenas para uso interno dos agentes corporativos.
`);

  write('00_GOVERNANCE/WIKI_GOVERNANCE.md', `
# Governança Geral da Wiki UBT

Esta Wiki constitui a fonte oficial de verdade para procedimentos internos, regras financeiras e atendimento ao cliente da UBT.

## Princípio Geral
Todo artigo publicado deve seguir as regras de clareza, rastreabilidade e segregação de acesso definidas nestas políticas.

## Classificação do Conteúdo
Todo arquivo publicado deve conter em seu cabeçalho o nível de acesso e o status de fidedignidade da informação.
`);

  write('00_GOVERNANCE/CONTENT_STATUS.md', `
# Status de Validação do Conteúdo

Para garantir que a base de conhecimento seja factual e livre de presunções, cada documento ou seção de informação deve adotar uma destas tags de status:

- **FACT:** Informação factual comprovada no código, banco de dados ou infraestrutura atual.
- **REQUIREMENT:** Requisito de produto definido, porém pendente de desenvolvimento ou verificação operacional.
- **IMPLEMENTED — NOT VALIDATED:** Implementado tecnicamente no repositório, mas sem validação operacional final em produção.
- **INFERENCE:** Dedução ou hipótese baseada em evidências parciais, aguardando validação explícita.
- **RECOMMENDATION:** Sugestão técnica ou de processo operacional.
- **ROADMAP:** Funcionalidade ou plano de ação agendado para sprints futuras.
- **CONFLICT:** Divergência de informações entre diferentes fontes (ex: documentação declarando comportamento X enquanto o código implementa comportamento Y).
- **GAP:** Funcionalidade ou documentação necessária ainda não existente ou incompleta.
`);

  write('00_GOVERNANCE/SOURCE_POLICY.md', `
# Política de Rastreabilidade de Fontes

## Diretriz
Nenhuma informação pode ser inserida na Wiki sem que a fonte seja declarada explicitamente.

## Fontes Válidas
As seguintes fontes de evidência direta devem ser preferidas:
1. Comportamento operacional observado em ambiente de homologação/produção.
2. Banco de dados PostgreSQL e configurações de infraestrutura.
3. Código-fonte do repositório Git.
4. Migrations aplicadas.
5. Termos jurídicos e requisitos de produto formais.
`);

  write('00_GOVERNANCE/VERSIONING_POLICY.md', `
# Política de Versionamento de Artigos

## Diretriz
Todas as alterações no conteúdo devem seguir um controle estrito de versões (SemVer-like para governança documental ou sequencial v1, v2, v3).

## Regras
- Cada documento conterá metadados de versão no cabeçalho.
- Alterações em regras de faturamento (split, taxas) requerem nova versão maior.
`);

  write('00_GOVERNANCE/ACCESS_CONTROL_POLICY.md', `
# Política de Controle de Acesso (RBAC)

## Regras de Visualização
- **Wiki Interna:** Acesso exclusivo aos colaboradores administrativos autenticados.
- **Superadmin:** Visão completa sobre todos os artigos, incluindo conteúdo jurídico sensível.
- **Atendimento e Operadores:** Acesso restrito a procedimentos operacionais e de suporte.
- **Usuários Finais (Tomadores e Prestadores):** NÃO possuem acesso direto a nenhuma área da Wiki.
`);

  write('00_GOVERNANCE/AI_KNOWLEDGE_POLICY.md', `
# Diretrizes para Ingestão por IA

## Ingestão de Dados
Os agentes de inteligência artificial (ex: bots de WhatsApp) somente poderão ingerir arquivos e artigos que contenham a tag explícita:
\`\`\`yaml
ai_ingestion: allowed
\`\`\`

## Proteção de Dados
Qualquer artigo contendo dados pessoais (PII) ou segredos corporativos industriais deve ter a tag \`ai_ingestion: restricted\` para impedir vazamentos em interações com o público final.
`);

  // Section READMEs
  write('01_COMPANY/README.md', `
# 01_COMPANY

Pasta contendo informações institucionais, cultura organizacional, organogramas corporativos e objetivos estratégicos da UBT.

- Nível de Acesso: Colaboradores gerais.
- Ingestão por IA: Autorizado para treinamento de agentes internos.
`);

  write('02_PRODUCTS_SERVICES/README.md', `
# 02_PRODUCTS_SERVICES

Documentação descritiva de todas as verticais e serviços da UBT (Mototáxi, Diaristas, Ambulantes, Côco & Cia).

- Nível de Acesso: Atendimento, Operações e Marketing.
- Ingestão por IA: Autorizado para suporte ao cliente.
`);

  write('03_CUSTOMER_SUPPORT/README.md', `
# 03_CUSTOMER_SUPPORT

Manual de procedimentos de suporte, FAQs oficiais de atendimento e fluxos de escalonamento para problemas com clientes e prestadores.

- Nível de Acesso: Atendimento.
- Ingestão por IA: Altamente recomendado (camada base para o bot de WhatsApp).
`);

  write('04_OPERATIONS/README.md', `
# 04_OPERATIONS

Rotinas operacionais diárias do BackOffice, tratamento de incidentes críticos em corridas, cancelamentos e políticas de segurança física.

- Nível de Acesso: Operadores de Rota e Operations Manager.
- Ingestão por IA: Restrito a agentes administrativos internos.
`);

  write('05_FINANCE/README.md', `
# 05_FINANCE

Detalhamento factual dos fluxos financeiros, depósitos do Mercado Pago, estornos (refunds), prêmios acumulados e regras de split.

- Nível de Acesso: Financeiro e Superadmin.
- Ingestão por IA: Proibido para o agente de suporte público.
`);

  write('06_ENGINEERING/README.md', `
# 06_ENGINEERING

Especificações de arquitetura de software, infraestrutura de nuvem, banco de dados PostgreSQL, Deno Edge Functions e configurações de segurança e RLS.

- Nível de Acesso: Equipe de Engenharia e Superadmin.
- Ingestão por IA: Autorizado exclusivamente para agentes de desenvolvimento de software e IA de codificação corporativa.
`);

  write('07_COMMUNICATION_MARKETING/README.md', `
# 07_COMMUNICATION_MARKETING

Identidade visual de marca, campanhas promocionais ativas e manuais de comunicação integrada com a comunidade de Ubatuba.

- Nível de Acesso: Comunicação & Marketing.
- Ingestão por IA: Permitido para o agente de marketing institucional.
`);

  write('08_LEGAL/README.md', `
# 08_LEGAL

Termos de uso da plataforma, políticas de privacidade, termos de adesão dos Fundadores e governança de privacidade LGPD.

- Nível de Acesso: Jurídico, DPO e Superadmin.
- Ingestão por IA: Somente para fins de compliance regulatório de agentes internos.
`);

  write('09_ADMINISTRATION/README.md', `
# 09_ADMINISTRATION

Processos internos de departamento pessoal, contratação de fornecedores de infraestrutura e serviços gerais administrativos.

- Nível de Acesso: Administrativo e Superadmin.
- Ingestão por IA: Não recomendado.
`);

  write('10_AI_KNOWLEDGE/README.md', `
# 10_AI_KNOWLEDGE

Camada de conhecimento otimizada em formato simplificado (markdown/JSON) estruturada especificamente para alimentar o contexto dos agentes de IA conversacionais (WhatsApp/Web).

## Subpastas
- \`customer_support/\`: Dividido entre tomador, prestador, geral e escalation.
- \`internal_agents/\`: Agentes de BackOffice específicos por departamento.
`);

  // AI Knowledge support readmes
  write('10_AI_KNOWLEDGE/customer_support/tomador/README.md', 'PENDING — INFORMATION NOT YET PROVIDED\nEsta subpasta armazenará o repositório de conhecimento para o bot de atendimento ao Tomador de Serviços.');
  write('10_AI_KNOWLEDGE/customer_support/prestador/README.md', 'PENDING — INFORMATION NOT YET PROVIDED\nEsta subpasta armazenará o repositório de conhecimento para o bot de atendimento ao Prestador de Serviços.');
  write('10_AI_KNOWLEDGE/customer_support/geral/README.md', 'PENDING — INFORMATION NOT YET PROVIDED\nInformações comuns a tomadores e prestadores.');
  write('10_AI_KNOWLEDGE/customer_support/escalation/README.md', 'PENDING — INFORMATION NOT YET PROVIDED\nRegras críticas de transição do bot IA para o suporte humano.');

  // Templates
  write('11_TEMPLATES/README.md', `
# 11_TEMPLATES

Contém os padrões estruturais de documentos em markdown que devem ser copiados e preenchidos na criação de novos arquivos.
`);

  write('11_TEMPLATES/article_template.md', `
---
id: "WIKI-XXX"
title: "Título do Artigo"
status: "FACT | REQUIREMENT | IMPLEMENTED — NOT VALIDATED | INFERENCE | ROADMAP"
source: "Código / Banco / Requisito do PO"
date: "AAAA-MM-DD"
version: "1.0.0"
responsible: "Nome do Autor"
target_audience: "Colaboradores / Engenharia"
access_level: "Público / Restrito / Superadmin"
ai_ingestion: "allowed | restricted"
---

# Título do Artigo

## Introdução
[Propósito do documento]

## Conteúdo Factual
[Descrição objetiva baseada em fontes técnicas ou operacionais]

## Limitações conhecidas
[Anotações técnicas de infraestrutura]

## Perguntas em Aberto
[Dúvidas ou lacunas operacionais]
`);

  write('11_TEMPLATES/faq_template.md', `
---
id: "FAQ-XXX"
title: "Pergunta Frequente"
status: "FACT"
source: "Procedimentos do Suporte"
date: "AAAA-MM-DD"
version: "1.0.0"
responsible: "Suporte N1"
target_audience: "Tomador / Prestador"
access_level: "Público"
ai_ingestion: "allowed"
---

# Pergunta: [Descreva a pergunta aqui]

## Resposta Curta (IA)
[Resposta direta e sucinta com até 3 linhas]

## Detalhamento
[Instruções passo a passo detalhadas]
`);

  write('11_TEMPLATES/procedure_template.md', `
---
id: "PROC-XXX"
title: "Título do Procedimento"
status: "FACT"
source: "Manual Operacional"
date: "AAAA-MM-DD"
version: "1.0.0"
responsible: "Operações"
target_audience: "Operadores / Suporte"
access_level: "Restrito"
ai_ingestion: "restricted"
---

# Procedimento: [Nome do Processo]

## Objetivo
[Meta a ser alcançada]

## Fluxo Passo a Passo
1. [Ação 1]
2. [Ação 2]
3. [Ação 3]

## Escalonamento
[Quem acionar em caso de erro]
`);

  write('11_TEMPLATES/policy_template.md', `
---
id: "POL-XXX"
title: "Título da Política"
status: "FACT"
source: "Jurídico / Governança"
date: "AAAA-MM-DD"
version: "1.0.0"
responsible: "Compliance"
target_audience: "Todos os Colaboradores"
access_level: "Público Interno"
ai_ingestion: "allowed"
---

# Diretriz de Compliance: [Nome da Política]

## Regra Geral
[Descrição da norma obrigatória]

## Aplicação
[Quais departamentos ou casos estão sujeitos]
`);

  write('11_TEMPLATES/ai_knowledge_template.md', `
---
id: "AIK-XXX"
title: "Nome do Fluxo Conversacional"
status: "FACT"
source: "FAQ Consolidados"
date: "AAAA-MM-DD"
version: "1.0.0"
responsible: "Equipe Conversacional"
target_audience: "Agente IA"
access_level: "Público"
ai_ingestion: "allowed"
---

# Contexto IA: [Nome do Conceito]

## Gatilhos / Intent
- "como fazer cadastro"
- "não consigo logar"

## Resposta Estruturada
[Texto formatado para envio direto via chat/WhatsApp]
`);

  write('11_TEMPLATES/decision_template.md', `
---
id: "DEC-XXX"
title: "Título da Decisão Arquitetural"
status: "DECISION"
source: "Engenharia / CTO"
date: "AAAA-MM-DD"
version: "1.0.0"
responsible: "Líder Técnico"
target_audience: "Engenharia"
access_level: "Interno"
ai_ingestion: "restricted"
---

# Decisão: [Nome da Decisão Arquitetural]

## Contexto
[Problema enfrentado]

## Opções Consideradas
- Opção A
- Opção B

## Decisão Tomada e Justificativa
[O que foi escolhido e por quê]
`);

  // 12_INBOX Files
  write('12_INBOX/README.md', `
# 12_INBOX

Espaço temporário para novos rascunhos, bases de conhecimento coletadas por times de suporte ou logs informais que ainda precisam passar pela triagem de governança.

## Subpastas
- \`to_validate/\`: Artigos aguardando validação técnica de engenharia.
- \`to_classify/\`: Textos sem enquadramento de status.
- \`pending_sources/\`: Conteúdos sem a indicação formal de suas fontes.
`);

  // 90_ARCHIVE Files
  write('90_ARCHIVE/README.md', `
# 90_ARCHIVE

Repositório histórico de documentação obsoleta, versões depreciadas de regras ou migrações inativas mantidas exclusivamente para fins de auditoria histórica.
`);

  // 99_INDEX Files
  write('99_INDEX/README.md', `
# 99_INDEX

Arquivos de catalogação e índices mestres que mapeiam o estado atual da Base de Conhecimento e da ingestão por IA.
`);

  write('99_INDEX/WIKI_MASTER_INDEX.md', `
# Wiki UBT — Master Index

Índice mestre consolidando a arquitetura de informação e mapeando os arquivos de entrada em todas as 13 subpastas estruturadas.

- 00_GOVERNANCE
- 01_COMPANY
- 02_PRODUCTS_SERVICES
- 03_CUSTOMER_SUPPORT
- 04_OPERATIONS
- 05_FINANCE
- 06_ENGINEERING
- 07_COMMUNICATION_MARKETING
- 08_LEGAL
- 09_ADMINISTRATION
- 10_AI_KNOWLEDGE
- 11_TEMPLATES
- 12_INBOX
- 90_ARCHIVE
`);

  write('99_INDEX/CONTENT_CATALOG.md', `
# Catálogo Geral de Artigos

Tabela de catalogação futura para controle de integridade dos artigos publicados:

| ID | Título | Categoria | Status | Fonte | Versão | Responsável | Nível de Acesso | Pode usar por IA? | Público-Alvo |
|---|---|---|---|---|---|---|---|---|---|
| PENDING | | | | | | | | | |
`);

  write('99_INDEX/AI_KNOWLEDGE_CATALOG.md', `
# Catálogo de Ingestão de IA

Índice para controle estrito dos arquivos consumidos em lote para embeddings ou context windows de agentes de conversação públicos (WhatsApp) e corporativos:

| ID | Conceito | Público (Tomador/Prestador) | Ingestão Status | Versão Consumida | Última Sincronização |
|---|---|---|---|---|---|
| PENDING | | | | | |
`);

  write('99_INDEX/OPEN_QUESTIONS.md', `
# Perguntas em Aberto

Lista consolidada de lacunas documentais que exigem verificação das equipes operacionais, de produto e engenharia:

1. **[INFORMAÇÃO A LEVANTAR]:** Parâmetros exatos e fluxos de homologação de pagamentos em produção com o Mercado Pago.
2. **[INFORMAÇÃO A LEVANTAR]:** Qual a periodicidade oficial de sincronização da base territorial de CEPs de Ubatuba junto aos Correios.
`);

  console.log('Structure created successfully.');
}

main();
