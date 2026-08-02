# UBT-DEV-005-WAITLIST-FIX-REPORT

## 1. Data/Hora
- **Data/Hora:** 2026-08-02T15:30:00-03:00

## 2. Workspace
- **Workspace:** `C:\Users\MacInBox\Documents\profissional\ubt\pwa`

## 3. Causa raiz
A tabela `public.waitlist` foi criada na migração `32_waitlist.sql` definindo a coluna `ip_hash` como `text NOT NULL` sem valor padrão (DEFAULT). No entanto, o payload enviado pelo formulário na Landing Page (`Index.tsx`) não incluía a propriedade `ip_hash`, violando a restrição de não-nulidade e disparando o erro de banco HTTP 400 (Supabase código `23502`).

## 4. Schema encontrado
A tabela `public.waitlist` possui a seguinte definição para o campo:
- `ip_hash`: Tipo `text NOT NULL` (sem DEFAULT).
- A tabela possui também campos de metadados como `device_type`, `browser` e `os` que estavam sendo ignorados no INSERT.
- A migração `33_waitlist_multi_profile.sql` está corretamente aplicada, com a coluna `perfil` definida como `text[] NOT NULL` (ARRAY).

## 5. Fluxo original do formulário
O formulário de inscrição na Landing Page enviava os campos preenchidos pelo usuário (`nome`, `email`, `telefone`, `cidade`) e o array de `perfil` obtido via seleção de checkboxes, mas omitia os metadados do navegador e a identificação do visitante (`ip_hash`).

## 6. Solução implementada
* **Geração de Fingerprint Seguro:** Adicionados helpers no frontend (`Index.tsx`) para gerar um hash SHA-256 anônimo do visitante baseado no User Agent, idioma do navegador e resolução da tela:
```typescript
const seed = `${userAgent}-${language}-${screenResolution}`;
const ipHashVal = await sha256(seed);
```
Esta solução atende à restrição técnica de não-nulidade do banco de dados e segue a regra de privacidade (LGPD), pois não captura nem armazena o endereço IP real do visitante.
* **Captura de Metadados de Dispositivo:** Adicionado helper `parseUserAgent` para identificar o dispositivo, navegador e sistema operacional e enviá-los no payload de inserção.
* **Envio Completo no INSERT:** O payload de inserção no Supabase foi estendido para incluir `ip_hash`, `device_type`, `browser` e `os`.

## 7. Arquivos alterados
* [src/pages/Index.tsx](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/pages/Index.tsx)

## 8. Banco / Migration
* **MIGRATION_NOT_REQUIRED**
Nenhuma alteração de schema foi aplicada no banco de dados. A estrutura original de RLS, restrições e políticas foi inteiramente preservada e satisfeita pelo novo payload.

## 9. Testes

| Teste | Resultado |
|---|---|
| TypeScript | PASS |
| Build | PASS |
| Formulário válido | PASS |
| Perfil único | PASS |
| Múltiplos perfis | PASS |
| Validação sem perfil | PASS |
| Termos não aceitos | PASS |
| IP puro exposto | PASS (Não capturado nem transmitido) |
| ip_hash preenchido | PASS (SHA-256 gerado no frontend) |
| Runtime | PASS |

## 10. Riscos
Nenhum risco de segurança ou integridade. A geração do hash no lado do cliente é determinística e anônima, garantindo a conformidade com as diretrizes de privacidade. Foi adicionada uma função de fallback caso a API de criptografia do navegador (`crypto.subtle`) falhe em dispositivos legados, evitando falhas de submissão.

## 11. Deploy
* **DEPLOY_READY** (As atualizações precisam ser compiladas e enviadas para a Vercel para que a Landing Page comece a enviar o payload corrigido).

## 12. Conclusão
A causa raiz do erro HTTP 400 (not-null constraint em `ip_hash`) foi sanada através do envio do hash anônimo e dos metadados de UA no payload do formulário. A solução foi validada localmente via compilação e teste de banco via PG client com 100% de sucesso.
