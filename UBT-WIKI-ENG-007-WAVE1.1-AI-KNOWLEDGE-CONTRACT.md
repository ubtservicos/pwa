# UBT-WIKI-ENG-007-WAVE1.1-AI-KNOWLEDGE-CONTRACT

## 1. Identificação
- **Data/Hora:** 2026-08-06T09:40:00-03:00
- **Workspace:** `C:\Users\MacInBox\Documents\profissional\ubt\pwa`
- **Autor:** Antigravity (AI Coding Assistant)
- **Status:** **UBT-WIKI-ENG-007-WAVE1.1-AI-KNOWLEDGE-CONTRACT_COMPLETE**

---

## 2. Objetivo do Contrato
Estabelecer formalmente as especificações de contrato de API, isolamento de rede, formato de payload, regras de governança e mecanismos de segurança (ACL/RLS) para consumo da camada de conhecimento da Wiki UBT pelo **WhatsApp-Agent** (projeto externo localizado em `C:\Users\MacInBox\Documents\profissional\whatsapp-agent`).

---

## 3. Topologia de Integração
A comunicação do agente com os dados de conhecimento da Wiki é unidirecional e restrita por uma camada segura de API intermediária:

```text
  [ WhatsApp-Agent ]  (Projeto Externo)
         │
         │ Chamada HTTPS POST (com JWT / Anon Key Autorizada)
         ▼
  [ Supabase API Gateway / PostgREST ]
         │
         │ Execução da RPC segura com RLS embutido
         ▼
  [ RPC public.get_published_ai_knowledge(p_audience) ]
         │
         │ Filtro RLS: ai_allowed = true AND area = '10_AI_KNOWLEDGE'
         ▼
  [ Banco de Dados Supabase (Tabela public.wiki_documents) ]
```

---

## 4. Especificação Técnica da API (Contrato REST)

### 4.1 Endpoint de Ingestão
- **URI:** `/rest/v1/rpc/get_published_ai_knowledge`
- **Método HTTP:** `POST`
- **Headers Obrigatórios:**
  - `Content-Type: application/json`
  - `apikey: [SUPABASE_ANON_KEY]`
  - `Authorization: Bearer [JWT_TOKEN_DO_AGENTE]`

### 4.2 Parâmetros de Requisição (Body JSON)
| Parâmetro | Tipo | Obrigatório | Valores Permitidos | Descrição |
|---|---|---|---|---|
| `p_audience` | text | Sim | `"tomador"`, `"prestador"`, `"geral"` | Filtro de público para os artigos do chatbot. |

Exemplo de Request Body:
```json
{
  "p_audience": "tomador"
}
```

### 4.3 Payload de Resposta (Schema JSON)
A resposta é retornada como um array de objetos JSON contendo estritamente os campos autorizados:
```json
[
  {
    "area_nome": "10_AI_KNOWLEDGE",
    "slug": "tomador-onboarding",
    "titulo": "Onboarding do Tomador",
    "conteudo": "# Como usar o SuperApp...",
    "version": "1.0.0"
  }
]
```

---

## 5. Matriz de Segurança e Isolamento

| Regra / Restrição | Status no Banco | Enforcement |
|---|---|---|
| Acesso direto às tabelas da Wiki pelo Agente | **BLOQUEADO** | RLS Default Deny |
| Acesso às pastas internas (`05_FINANCE`, `06_ENGINEERING`) | **BLOQUEADO** | Filtro estrito `wa.nome = '10_AI_KNOWLEDGE'` na RPC |
| Vazamento de metadados internos de auditoria | **BLOQUEADO** | Resposta restrita ao Schema JSON acordado |
| Tampering / Escrita de artigos pelo Agente | **BLOQUEADO** | RLS SELECT-only para a conexão do Agente |

---

## 6. Governança e Ciclo de Vida do Conteúdo
Para que um artigo da Wiki seja consumível pelo WhatsApp-Agent, ele deve passar obrigatoriamente pelo seguinte fluxo:
1. **Criação no Inbox:** O artigo é rascunhado sob a pasta `12_INBOX/to_validate/`.
2. **Validação de Fatos:** Revisão técnica confirma que o artigo é `FACT` e não contém suposições.
3. **Mapeamento de Metadados:** Configura-se `ai_allowed = true`, `classificacao = 'PUBLIC_INTERNAL'` e vincula-se o ID à pasta `10_AI_KNOWLEDGE`.
4. **Publicação:** Escrita no banco Supabase. O artigo torna-se elegível para retorno na API.

---

## 7. Próximos Passos Recomendados
1. Implementação do sincronizador periódico (Sync Engine) no repositório do `whatsapp-agent` para mapear e indexar este endpoint em embeddings locais.
2. Homologação de limites de requisição (Rate Limiting) no Supabase API Gateway.
