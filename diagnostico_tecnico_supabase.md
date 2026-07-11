# Relatório Técnico da Infraestrutura Supabase — UBT SuperApp

Este relatório apresenta o mapeamento completo e detalhado da modelagem de dados, esquemas DDL (Data Definition Language), políticas de segurança RLS (Row Level Security), views, triggers, buckets e migrações do banco de dados oficial **Supabase** da plataforma UBT Digital.

---

## 1. Lista Completa das Tabelas do Banco de Dados

A base de dados conta com **16 tabelas** ativas no schema `public` do Supabase, responsáveis por gerenciar autenticação, geolocalização por CEP, faturamento, perfis de profissionais e os fluxos das quatro categorias integradas (Mototaxi, Diaristas, Ambulantes e Côco & Cia).

| Nome da Tabela | Categoria / Finalidade | Status |
| :--- | :--- | :--- |
| `public.usuarios` | Perfis centrais e perfis de controle de acesso (Roles) | **Ativa** |
| `public.profiles` | Metadados adicionais vinculados às contas do Supabase Auth | **Ativa** |
| `public.ceps_ubatuba` | Catálogo de CEPs de Ubatuba para geolocalização e cache do Leaflet | **Ativa** |
| `public.mototaxi_sessoes` | Sessões online (GPS ativo) de prestadores de Mototaxi | **Ativa** |
| `public.mototaxi_corridas` | Solicitações e andamento de corridas de carona e entregas | **Ativa** |
| `public.diarista_perfis` | Perfis, valores e disponibilidade das prestadoras diaristas | **Ativa** |
| `public.diarista_agendamentos` | Registro de reservas e contratações de diaristas feitas pelos tomadores | **Ativa** |
| `public.diarista_materiais_padrao` | Lista de utensílios e insumos de limpeza padrão e preços de referência | **Ativa** |
| `public.diarista_materiais_precos_declarados` | Histórico de preços informados individualmente pelos prestadores | **Ativa** |
| `public.produtos` | Catálogo global de itens vendidos por ambulantes na praia | **Ativa** |
| `public.ambulante_sessions` | Sessões de venda ativas na praia com geolocalização de ambulantes | **Ativa** |
| `public.ambulante_session_produtos` | Associação dos produtos e preços personalizados de cada ambulante ativo | **Ativa** |
| `public.pedidos` | Cabeçalho de compras efetuadas por tomadores (Ambulantes) | **Ativa** |
| `public.pedido_itens` | Detalhamento dos produtos e quantidades de cada pedido de ambulante | **Ativa** |
| `public.coco_caminhoes` | Cadastro de veículos de coleta ecológicos da ONG Côco & Cia | **Ativa** |
| `public.coco_pontos` | Pontos de descarte ecológicos criados por tomadores nos mapas | **Ativa** |

---

## 2. SQL de Criação das Tabelas (DDL)

Abaixo estão os scripts DDL de criação e alteração de todas as tabelas ativas no Supabase.

### 2.1 Core e Segurança

#### Tabela `usuarios`
```sql
CREATE TABLE public.usuarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  role text NOT NULL CHECK (role IN ('tomador', 'prestador', 'admin', 'cocoecia')),
  avatar_url text,
  created_at timestamp with time zone DEFAULT now()
);
```

#### Tabela `profiles`
```sql
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text,
  role text CHECK (role IN ('tomador', 'prestador', 'admin', 'client', 'provider', 'user', 'authenticated', 'cocoecia')),
  created_at timestamp with time zone DEFAULT now()
);
```

---

### 2.2 Geolocalização e Endereços

#### Tabela `ceps_ubatuba`
```sql
CREATE TABLE public.ceps_ubatuba (
  cep text PRIMARY KEY,
  logradouro text NOT NULL,
  bairro text NOT NULL,
  lat numeric(10,6),
  lng numeric(10,6),
  created_at timestamp with time zone DEFAULT now()
);
```

---

### 2.3 Categoria: Mototaxi e Caronas

#### Tabela `mototaxi_sessoes`
```sql
CREATE TABLE public.mototaxi_sessoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prestador_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  is_online boolean DEFAULT true,
  lat numeric(10,6) NOT NULL,
  lng numeric(10,6) NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE (prestador_id)
);
```

#### Tabela `mototaxi_corridas`
```sql
CREATE TABLE public.mototaxi_corridas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tomador_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  prestador_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  status text NOT NULL CHECK (status IN ('searching', 'accepted', 'in_progress', 'completed', 'cancelled')),
  type text NOT NULL CHECK (type IN ('carona', 'entrega')),
  origin jsonb NOT NULL,
  destination jsonb NOT NULL,
  distance_km numeric(5,2) NOT NULL,
  duration_min integer NOT NULL,
  estimated_price numeric(10,2) NOT NULL,
  final_price numeric(10,2),
  payment_method text CHECK (payment_method IN ('pix', 'card')),
  created_at timestamp with time zone DEFAULT now(),
  accepted_at timestamp with time zone
);
```

---

### 2.4 Categoria: Diaristas

#### Tabela `diarista_perfis`
```sql
CREATE TABLE public.diarista_perfis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.usuarios(id) ON DELETE CASCADE,
  nome text,
  cpf text,
  sexo text,
  gender text,
  endereco jsonb,
  valor_por_m2 numeric,
  minimo_m2 numeric,
  materiais text[],
  materiais_custom jsonb DEFAULT '[]'::jsonb,
  disponibilidade jsonb,
  is_online boolean DEFAULT false,
  location point,
  rating numeric DEFAULT 5.0,
  total_servicos integer DEFAULT 0,
  horarios_por_dia jsonb DEFAULT '{}'::jsonb,
  materiais_detalhes jsonb DEFAULT '[]'::jsonb,
  prestador_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
```

#### Tabela `diarista_agendamentos`
```sql
CREATE TABLE public.diarista_agendamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL,
  tomador_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  diarista_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  data date NOT NULL,
  hora time NOT NULL,
  local jsonb NOT NULL,
  materiais_solicitados text[],
  valor_base numeric,
  valor_materiais numeric,
  valor_total numeric,
  payment_method text,
  payment_status text DEFAULT 'pending',
  rating_tomador numeric,
  rating_diarista numeric,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  confirmed_at timestamp with time zone,
  started_at timestamp with time zone,
  completed_at timestamp with time zone
);
```

#### Tabela `diarista_materiais_padrao`
```sql
CREATE TABLE public.diarista_materiais_padrao (
  id text PRIMARY KEY,
  nome text NOT NULL,
  emoji text NOT NULL,
  categoria text NOT NULL,
  preco_medio numeric NOT NULL
);
```

#### Tabela `diarista_materiais_precos_declarados`
```sql
CREATE TABLE public.diarista_materiais_precos_declarados (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  prestador_id uuid NOT NULL,
  material_id text NOT NULL,
  preco numeric NOT NULL,
  created_at timestamptz DEFAULT now()
);
```

---

### 2.5 Categoria: Ambulantes (Praias)

#### Tabela `produtos`
```sql
CREATE TABLE public.produtos (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome text NOT NULL,
  emoji text,
  descricao text,
  preco_sugerido numeric(10,2),
  categoria text,
  created_at timestamp with time zone DEFAULT now()
);
```

#### Tabela `ambulante_sessions`
```sql
CREATE TABLE public.ambulante_sessions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  prestador_id uuid REFERENCES public.usuarios(id) ON DELETE CASCADE,
  modalidade text CHECK (modalidade IN ('local_fixo', 'delivery', 'both')),
  lat numeric(10,6),
  lng numeric(10,6),
  address text,
  is_online boolean DEFAULT true,
  rating numeric(3,1) DEFAULT 5.0,
  total_pedidos integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);
```

#### Tabela `ambulante_session_produtos`
```sql
CREATE TABLE public.ambulante_session_produtos (
  session_id uuid REFERENCES public.ambulante_sessions(id) ON DELETE CASCADE,
  produto_id uuid REFERENCES public.produtos(id) ON DELETE CASCADE,
  preco numeric(10,2),
  disponivel boolean DEFAULT true,
  PRIMARY KEY (session_id, produto_id)
);
```

#### Tabela `pedidos`
```sql
CREATE TABLE public.pedidos (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tomador_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  prestador_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  session_id uuid REFERENCES public.ambulante_sessions(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  modalidade text CHECK (modalidade IN ('local_fixo', 'delivery')),
  total numeric(10,2) NOT NULL,
  delivery_lat numeric(10,6),
  delivery_lng numeric(10,6),
  delivery_address text,
  delivery_referencia text,
  payment_method text,
  payment_status text,
  created_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone
);
```

#### Tabela `pedido_itens`
```sql
CREATE TABLE public.pedido_itens (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  pedido_id uuid REFERENCES public.pedidos(id) ON DELETE CASCADE,
  produto_id uuid REFERENCES public.produtos(id) ON DELETE SET NULL,
  nome text NOT NULL,
  emoji text,
  qty integer NOT NULL DEFAULT 1,
  preco_unit numeric(10,2) NOT NULL,
  subtotal numeric(10,2) NOT NULL
);
```

---

### 2.6 Responsabilidade Ambiental: Côco & Cia

#### Tabela `coco_caminhoes`
```sql
CREATE TABLE public.coco_caminhoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prestador_id uuid REFERENCES public.usuarios(id) ON DELETE CASCADE,
  plate text NOT NULL UNIQUE,
  apelido text NOT NULL,
  is_online boolean DEFAULT false,
  lat numeric(10,6),
  lng numeric(10,6),
  collections_today integer DEFAULT 0,
  total_collections integer DEFAULT 0,
  areas_atendidas text[] DEFAULT ARRAY['Centro']::text[],
  pix_key text,
  status_aprovacao text DEFAULT 'pending' CHECK (status_aprovacao IN ('pending', 'approved', 'rejected')),
  created_at timestamp with time zone DEFAULT now()
);
```

#### Tabela `coco_pontos`
```sql
CREATE TABLE public.coco_pontos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tomador_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  lat numeric(10,6) NOT NULL,
  lng numeric(10,6) NOT NULL,
  address text NOT NULL,
  material text NOT NULL,
  foto_url text,
  status text DEFAULT 'aguardando' CHECK (status IN ('aguardando', 'confirmado', 'coletado', 'recusado')),
  caminhao_id uuid REFERENCES public.coco_caminhoes(id) ON DELETE SET NULL,
  horario_previsto text,
  created_at timestamp with time zone DEFAULT now(),
  coletado_at timestamp with time zone
);
```

---

## 3. Políticas de Segurança de Linha (RLS)

Por se tratar de um ambiente de desenvolvimento ágil integrado à Vercel, o projeto adota políticas de RLS extremamente permissivas (`Allow All`) para acelerar a sincronização dos PWAs móveis.

*   **Padrão de Desenvolvimento:** Todas as tabelas têm o RLS habilitado e aplicam uma política universal que libera requisições de `SELECT`, `INSERT`, `UPDATE` e `DELETE` sem restrições.
*   **Exceção de Regras Baseadas em Papéis:** A tabela `diarista_materiais_precos_declarados` restringe a inserção de preços declarados a usuários autenticados.

### Listagem das Políticas Cadastradas

```sql
-- CEPs Ubatuba
CREATE POLICY "Allow All ceps_ubatuba" ON public.ceps_ubatuba FOR ALL USING (true) WITH CHECK (true);

-- Mototaxi
CREATE POLICY "Allow All mototaxi_sessoes" ON public.mototaxi_sessoes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow All mototaxi_corridas" ON public.mototaxi_corridas FOR ALL USING (true) WITH CHECK (true);

-- Usuários e Perfis
CREATE POLICY "Allow All Usuarios" ON public.usuarios FOR ALL USING (true) WITH CHECK (true);

-- Diaristas
CREATE POLICY "Allow All diarista_agendamentos" ON public.diarista_agendamentos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Leitura pública para diarista_materiais_padrao" ON public.diarista_materiais_padrao FOR SELECT USING (true);
CREATE POLICY "Qualquer um pode ler historico de precos" ON public.diarista_materiais_precos_declarados FOR SELECT USING (true);
CREATE POLICY "Prestadores podem inserir seus proprios precos" ON public.diarista_materiais_precos_declarados FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Ambulantes
CREATE POLICY "Allow All Produtos" ON public.produtos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow All Sessions" ON public.ambulante_sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow All Session Prod" ON public.ambulante_session_produtos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow All Pedidos" ON public.pedidos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow All Pedido Itens" ON public.pedido_itens FOR ALL USING (true) WITH CHECK (true);

-- Côco & Cia
CREATE POLICY "Allow All coco_caminhoes" ON public.coco_caminhoes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow All coco_pontos" ON public.coco_pontos FOR ALL USING (true) WITH CHECK (true);
```

---

## 4. Buckets do Storage (Armazenamento de Mídia)

*   **Não Há Buckets Configurados:** A plataforma UBT SuperApp **não utiliza o Supabase Storage**.
*   **Como as fotos são armazenadas?** As imagens capturadas pelas câmeras dos celulares (como fotos do liveness check, fotos de CNH de prestadores e fotos de locais de descarte do Côco & Cia) são convertidas no frontend em formato de string `Base64` (data URLs) e inseridas diretamente nas colunas de texto (como a coluna `foto_url` de `coco_pontos` e strings de fotos de onboarding).
*   **Justificativa:** Esta abordagem elimina o delay de upload e autenticação de arquivos binários, mantendo toda a integridade no banco de dados.

---

## 5. Edge Functions

*   **Não Há Edge Functions Ativas:** O projeto não contém a pasta `supabase/functions`.
*   **Distribuição de Lógica:** Toda a inteligência da plataforma, incluindo o cálculo de split de pagamentos (90%/4%/2%/1.5%/1.5%/1%), a validação de máscara de CPF/Telefone e o cálculo do Preço Dinâmico (Demanda × Horário × Clima) é processada no frontend (React) e gravada atomicamente nas tabelas do Supabase.

---

## 6. Triggers do Banco de Dados

*   **Triggers Ativos:** Não há scripts de criação de triggers explicitados nas migrações locais.
*   **Observação:** O Supabase cria automaticamente triggers implícitos para o gerenciamento interno de contas (auth schema) e revalidação do PostgREST.

---

## 7. Views do Banco de Dados

Existe **1 view** explícita criada na categoria de Diaristas, responsável por processar o cálculo estatístico de flutuação de preços declarados:

### View `vw_diarista_materiais_media_7d`
Calcula a média do valor e a quantidade de declarações de preços de materiais informados pelas prestadoras nos últimos 7 dias.

#### SQL de Criação da View
```sql
CREATE OR REPLACE VIEW public.vw_diarista_materiais_media_7d AS
SELECT 
  material_id,
  AVG(preco) as preco_medio,
  COUNT(*) as total_declaracoes
FROM diarista_materiais_precos_declarados
WHERE created_at >= now() - interval '7 days'
GROUP BY material_id;
```

---

## 8. Relacionamentos entre Tabelas (Foreign Keys)

Os vínculos relacionais do Supabase garantem a consistência referencial entre usuários e os pedidos realizados.

```
usuarios (id) <─── (prestador_id) ambulante_sessions
usuarios (id) <─── (prestador_id) coco_caminhoes
usuarios (id) <─── (prestador_id) mototaxi_sessoes
usuarios (id) <─── (user_id) diarista_perfis

usuarios (id) <─── (tomador_id) pedidos
usuarios (id) <─── (prestador_id) pedidos
usuarios (id) <─── (tomador_id) mototaxi_corridas
usuarios (id) <─── (prestador_id) mototaxi_corridas
usuarios (id) <─── (tomador_id) diarista_agendamentos
usuarios (id) <─── (diarista_id) diarista_agendamentos

pedidos (id) <─── (pedido_id) pedido_itens
produtos (id) <─── (produto_id) pedido_itens
produtos (id) <─── (produto_id) ambulante_session_produtos
ambulante_sessions (id) <─── (session_id) ambulante_session_produtos

coco_caminhoes (id) <─── (caminhao_id) coco_pontos
```

---

## 9. Arquivos de Migração SQL Existentes

As migrações do banco de dados estão organizadas no diretório raiz do projeto na forma de scripts SQL executáveis de forma sequencial ou combinada:

1.  `supabase_setup_and_seed.sql`: Criação da base e dados semente para o PWA de Ambulantes (`usuarios`, `produtos`, `ambulante_sessions`, `ambulante_session_produtos`, `pedidos`, `pedido_itens`).
2.  `setup_coco.sql`: Configuração da infraestrutura de reciclagem Côco & Cia (`coco_caminhoes`, `coco_pontos`).
3.  `setup_mototaxi.sql`: Inicialização do serviço de caronas e corridas (`mototaxi_sessoes`, `mototaxi_corridas`).
4.  `setup_ceps.sql`: Criação do catálogo e geocodificador geográfico (`ceps_ubatuba`).
5.  `add_horarios_col.sql`: Alteração de dados em `diarista_perfis` para aceitar arrays de horários e materiais adicionais (JSONB).
6.  `seed_diarista_materiais.sql`: Criação e inserção de preços médios em `diarista_materiais_padrao`.
7.  `seed_diarista_media_precos.sql`: Configuração da tabela de histórico declarativo de materiais e View de média semanal (`diarista_materiais_precos_declarados` + `vw_diarista_materiais_media_7d`).
8.  `seed_diaristas_mock.sql`: Mocking de credenciais de usuários e perfis iniciais para testes de autenticação.
9.  `seed_diaristas_reais.sql`: Carga inicial de agendamentos reais e clientes de teste mapeados no município.

---

## 10. Resumo da Arquitetura do Supabase

O ecossistema do Supabase foi integrado ao UBT SuperApp sob o seguinte modelo arquitetural:

```
                  ┌──────────────────────┐
                  │      React PWA       │
                  │   (Vercel Frontend)  │
                  └──────────┬───────────┘
                             │
            ┌────────────────┴────────────────┐
            │         Supabase Client         │
            └──────┬───────────────────┬──────┘
                   │                   │
                   ▼                   ▼
           PostgREST API        Realtime Channels
           (Consultas REST)    (Notificações Push & GPS)
                   │                   │
            ┌──────┴───────────────────┴──────┐
            │          Supabase DB            │
            │          (PostgreSQL)           │
            └─────────────────────────────────┘
```

1.  **Acesso Direto (Sem Backend intermediário):** O frontend se comunica diretamente com a base de dados via o cliente JS/TS do Supabase (`@supabase/supabase-js`), sem necessidade de uma API Rest corporativa intermediária.
2.  **PostgREST (Auto-gerador de Endpoints):** O Supabase expõe automaticamente todas as tabelas e relacionamentos do schema `public` em formato de endpoints REST de alta performance, permitindo que a aplicação faça buscas relacionais avançadas com syntaxe nativa do cliente JS (ex: `.select('*, usuarios(*)')`).
3.  **Realtime Engine (Channels):** A sincronização da posição de mototaxistas no mapa e os alertas instantâneos de novos agendamentos utilizam o recurso de **Realtime PostgreSQL replication** (canais/WebSockets), permitindo ouvir mudanças (`INSERT`, `UPDATE`) diretamente nas tabelas em frações de segundos.
4.  **Autenticação Integrada (GoTrue):** As chaves primárias dos prestadores e tomadores são conectadas à tabela interna do Supabase Auth, facilitando o gerenciamento seguro de sessões através de JWT (JSON Web Tokens).
