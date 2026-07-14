-- 07_indexes_and_performance_2026_07_14.sql
-- UBT SuperApp — Otimização de Performance e Indexação do Banco de Dados
-- Data de Criação: 14/07/2026

-- =========================================================================
-- PARTE 1: ÍNDICES DE CHAVES ESTRANGEIRAS (FOREIGN KEYS) - Para JOINS rápidos
-- =========================================================================

-- Core e Perfis
CREATE INDEX IF NOT EXISTS idx_profiles_padrinho_id ON public.profiles(padrinho_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_padrinho_id ON public.usuarios(padrinho_id);

-- Mototaxi
CREATE INDEX IF NOT EXISTS idx_mototaxi_corridas_tomador ON public.mototaxi_corridas(tomador_id);
CREATE INDEX IF NOT EXISTS idx_mototaxi_corridas_prestador ON public.mototaxi_corridas(prestador_id);

-- Diaristas
CREATE INDEX IF NOT EXISTS idx_diarista_agendamentos_tomador ON public.diarista_agendamentos(tomador_id);
CREATE INDEX IF NOT EXISTS idx_diarista_agendamentos_diarista ON public.diarista_agendamentos(diarista_id);
CREATE INDEX IF NOT EXISTS idx_diarista_materiais_precos_declarados_prestador ON public.diarista_materiais_precos_declarados(prestador_id);
CREATE INDEX IF NOT EXISTS idx_diarista_materiais_precos_declarados_material ON public.diarista_materiais_precos_declarados(material_id);

-- Ambulantes
CREATE INDEX IF NOT EXISTS idx_ambulante_sessions_prestador ON public.ambulante_sessions(prestador_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_tomador ON public.pedidos(tomador_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_prestador ON public.pedidos(prestador_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_session ON public.pedidos(session_id);
CREATE INDEX IF NOT EXISTS idx_pedido_itens_pedido ON public.pedido_itens(pedido_id);
CREATE INDEX IF NOT EXISTS idx_pedido_itens_produto ON public.pedido_itens(produto_id);

-- Reciclagem: Côco & Cia
CREATE INDEX IF NOT EXISTS idx_coco_caminhoes_prestador ON public.coco_caminhoes(prestador_id);
CREATE INDEX IF NOT EXISTS idx_coco_pontos_tomador ON public.coco_pontos(tomador_id);
CREATE INDEX IF NOT EXISTS idx_coco_pontos_caminhao ON public.coco_pontos(caminhao_id);

-- Financeiro (Split)
CREATE INDEX IF NOT EXISTS idx_pagamentos_split_entity ON public.pagamentos_split(entity_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_split_godparent ON public.pagamentos_split(godparent_id);

-- Logs e Suporte
CREATE INDEX IF NOT EXISTS idx_admin_logs_admin ON public.admin_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_actor ON public.audit_events(actor_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_requester ON public.support_tickets(requester_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned_admin ON public.support_tickets(assigned_admin);


-- =========================================================================
-- PARTE 2: ÍNDICES DE FILTROS FREQUENTES - Para WHERE e ORDER BY rápidos
-- =========================================================================

-- Filtros de Status e Cobertura Transacional (Ambulantes)
CREATE INDEX IF NOT EXISTS idx_pedidos_created_status ON public.pedidos(created_at DESC, status);

-- Filtros de Status (Mototaxi)
CREATE INDEX IF NOT EXISTS idx_mototaxi_corridas_status ON public.mototaxi_corridas(status);

-- Filtro de Notificações Não Lidas por Usuário
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, read);

-- Filtro parcial de Sessões de Motoristas Online
CREATE INDEX IF NOT EXISTS idx_mototaxi_sessoes_online ON public.mototaxi_sessoes(is_online) WHERE is_online = true;

-- Filtro parcial de Sessões de Ambulantes Online
CREATE INDEX IF NOT EXISTS idx_ambulante_sessions_online ON public.ambulante_sessions(is_online) WHERE is_online = true;


-- =========================================================================
-- NOTIFY: Recarregar cache do esquema no PostgREST
-- =========================================================================
NOTIFY pgrst, 'reload schema';


-- =========================================================================
-- PROCEDIMENTO DE ROLLBACK (COPIE E EXECUTE CASO QUEIRA DESFAZER):
-- =========================================================================
/*
DROP INDEX IF EXISTS public.idx_profiles_padrinho_id;
DROP INDEX IF EXISTS public.idx_usuarios_padrinho_id;
DROP INDEX IF EXISTS public.idx_mototaxi_corridas_tomador;
DROP INDEX IF EXISTS public.idx_mototaxi_corridas_prestador;
DROP INDEX IF EXISTS public.idx_diarista_agendamentos_tomador;
DROP INDEX IF EXISTS public.idx_diarista_agendamentos_diarista;
DROP INDEX IF EXISTS public.idx_diarista_materiais_precos_declarados_prestador;
DROP INDEX IF EXISTS public.idx_diarista_materiais_precos_declarados_material;
DROP INDEX IF EXISTS public.idx_ambulante_sessions_prestador;
DROP INDEX IF EXISTS public.idx_pedidos_tomador;
DROP INDEX IF EXISTS public.idx_pedidos_prestador;
DROP INDEX IF EXISTS public.idx_pedidos_session;
DROP INDEX IF EXISTS public.idx_pedido_itens_pedido;
DROP INDEX IF EXISTS public.idx_pedido_itens_produto;
DROP INDEX IF EXISTS public.idx_coco_caminhoes_prestador;
DROP INDEX IF EXISTS public.idx_coco_pontos_tomador;
DROP INDEX IF EXISTS public.idx_coco_pontos_caminhao;
DROP INDEX IF EXISTS public.idx_pagamentos_split_entity;
DROP INDEX IF EXISTS public.idx_pagamentos_split_godparent;
DROP INDEX IF EXISTS public.idx_admin_logs_admin;
DROP INDEX IF EXISTS public.idx_audit_events_actor;
DROP INDEX IF EXISTS public.idx_notifications_user;
DROP INDEX IF EXISTS public.idx_support_tickets_requester;
DROP INDEX IF EXISTS public.idx_support_tickets_assigned_admin;
DROP INDEX IF EXISTS public.idx_pedidos_created_status;
DROP INDEX IF EXISTS public.idx_mototaxi_corridas_status;
DROP INDEX IF EXISTS public.idx_notifications_user_read;
DROP INDEX IF EXISTS public.idx_mototaxi_sessoes_online;
DROP INDEX IF EXISTS public.idx_ambulante_sessions_online;

NOTIFY pgrst, 'reload schema';
*/
