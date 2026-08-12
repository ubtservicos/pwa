# Epic 02 — User Profile Synchronization & TypeScript Database Types

Este documento registra as diretrizes, regras de negócio e especificações para o Épico 02, focando em tipagem estrita do banco de dados e sincronização de sessão do usuário no PWA da UBT.

---

## 1. Regras de Negócio e Funcionalidades

### 1.1. Centralização e Exportação de Interfaces
- As principais interfaces de domínio mapeadas (`RealUser`, `RideState`, `AmbulantePedidoState`, etc.) devem ser centralizadas e exportadas a partir do arquivo [`src/types/database.types.ts`](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/types/database.types.ts).
- Isso garante consistência de contrato entre as visualizações de páginas, contextos globais e a camada de integração com o Supabase.

### 1.2. Integração Tipada com o Supabase Client
- A instância do cliente do Supabase em [`src/lib/supabase.ts`](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/lib/supabase.ts) deve receber a estrutura de tipos do banco de dados, promovendo autocompletes seguros e validações em tempo de compilação nas consultas.

### 1.3. Sincronização do Perfil de Usuário
- O hook [`useCurrentUser.ts`](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/hooks/useCurrentUser.ts) deve utilizar as queries tipadas na tabela `usuarios` para resgatar os metadados do usuário autenticado no Supabase Auth.
- O mapeamento deve popular corretamente todos os campos exigidos pela interface `RealUser`.