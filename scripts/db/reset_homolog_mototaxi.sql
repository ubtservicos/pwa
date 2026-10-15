-- Reset cirurgico do Mototaxi — SOMENTE HOMOLOGACAO.
--
-- Este arquivo e deliberadamente mantido fora de supabase/migrations.
-- Execute apenas com `supabase db query --project-ref xqujubbqcfqxkfczbidq`.
-- A selecao do projeto no comando e a fronteira que impede atingir Producao.
--
-- Preserva: auth.users, usuarios/perfis, prestadores, marketplace_accounts,
-- marketplace_oauth_connections, split_config e quaisquer credenciais OAuth.

BEGIN;

DO $reset$
BEGIN
  RAISE NOTICE 'RESET AUTORIZADO SOMENTE PARA HOMOLOG: xqujubbqcfqxkfczbidq';
END
$reset$;

-- Impede dois resets concorrentes nesta base.
SELECT pg_advisory_xact_lock(hashtext('ubt:homolog:reset:mototaxi'));

CREATE TEMP TABLE _reset_mototaxi_rides ON COMMIT DROP AS
SELECT id
FROM public.mototaxi_corridas;

CREATE UNIQUE INDEX ON _reset_mototaxi_rides (id);

CREATE TEMP TABLE _reset_mototaxi_splits ON COMMIT DROP AS
SELECT
  id,
  transaction_id,
  gateway_payment_id
FROM public.pagamentos_split
WHERE service_type = 'mototaxi';

CREATE UNIQUE INDEX ON _reset_mototaxi_splits (id);

CREATE TEMP TABLE _reset_counts (
  entity text PRIMARY KEY,
  rows_deleted bigint NOT NULL
) ON COMMIT DROP;

-- Mensagens sao removidas explicitamente para contabilizacao. A FK tambem usa
-- ON DELETE CASCADE, portanto mensagens residuais nao sobrevivem ao DELETE final.
DO $reset$
DECLARE
  affected bigint;
BEGIN
  IF to_regclass('public.mototaxi_mensagens') IS NOT NULL THEN
    DELETE FROM public.mototaxi_mensagens AS message
    WHERE EXISTS (
      SELECT 1
      FROM _reset_mototaxi_rides AS ride
      WHERE ride.id = message.corrida_id
    );
    GET DIAGNOSTICS affected = ROW_COUNT;
    INSERT INTO _reset_counts VALUES ('mototaxi_mensagens', affected);
  END IF;
END
$reset$;

-- Eventos de webhook sao apagados somente quando o external_id coincide com um
-- payment_id de um split de Mototaxi capturado antes da limpeza.
DO $reset$
DECLARE
  affected bigint;
BEGIN
  IF to_regclass('public.marketplace_webhook_events') IS NOT NULL THEN
    DELETE FROM public.marketplace_webhook_events AS event
    WHERE EXISTS (
      SELECT 1
      FROM _reset_mototaxi_splits AS split
      WHERE split.gateway_payment_id IS NOT NULL
        AND split.gateway_payment_id = event.external_id
    );
    GET DIAGNOSTICS affected = ROW_COUNT;
    INSERT INTO _reset_counts VALUES ('marketplace_webhook_events', affected);
  END IF;
END
$reset$;

-- Auditoria financeira: remove apenas linhas com correlacao exata a uma corrida,
-- split, transaction_id ou gateway_payment_id do conjunto alvo.
DO $reset$
DECLARE
  affected bigint;
BEGIN
  IF to_regclass('public.financial_audit_logs') IS NOT NULL THEN
    DELETE FROM public.financial_audit_logs AS audit
    WHERE
      EXISTS (
        SELECT 1
        FROM _reset_mototaxi_rides AS ride
        WHERE ride.id::text IN (
          audit.payload ->> 'service_id',
          audit.payload ->> 'ride_id',
          audit.payload #>> '{request,service_id}',
          audit.payload #>> '{context,service_id}'
        )
      )
      OR EXISTS (
        SELECT 1
        FROM _reset_mototaxi_splits AS split
        WHERE split.id::text = audit.payload ->> 'split_id'
           OR split.transaction_id IN (
             audit.payload ->> 'transaction_id',
             audit.payload ->> 'external_reference',
             audit.payload #>> '{request,payment_attempt_id}'
           )
           OR (
             split.gateway_payment_id IS NOT NULL
             AND split.gateway_payment_id IN (
               audit.payload ->> 'mp_payment_id',
               audit.payload ->> 'gateway_payment_id',
               audit.payload ->> 'payment_id'
             )
           )
      );
    GET DIAGNOSTICS affected = ROW_COUNT;
    INSERT INTO _reset_counts VALUES ('financial_audit_logs', affected);
  END IF;
END
$reset$;

-- Analytics de Mototaxi nao possuem FK para a corrida; vertical e o discriminador
-- oficial e evita tocar nos eventos de Diarista, Ambulante ou Coco & Cia.
DO $reset$
DECLARE
  affected bigint;
BEGIN
  IF to_regclass('public.analytics_events') IS NOT NULL THEN
    DELETE FROM public.analytics_events AS event
    WHERE to_jsonb(event) ->> 'vertical' = 'mototaxi'
       OR EXISTS (
         SELECT 1
         FROM _reset_mototaxi_rides AS ride
         WHERE ride.id::text IN (
           to_jsonb(event) #>> '{properties,ride_id}',
           to_jsonb(event) #>> '{metadata,ride_id}'
         )
       );
    GET DIAGNOSTICS affected = ROW_COUNT;
    INSERT INTO _reset_counts VALUES ('analytics_events', affected);
  END IF;
END
$reset$;

WITH deleted AS (
  DELETE FROM public.pagamentos_split
  WHERE service_type = 'mototaxi'
  RETURNING 1
)
INSERT INTO _reset_counts
SELECT 'pagamentos_split', count(*) FROM deleted;

-- telemetry_flags (quando existente) e mototaxi_mensagens residuais sao
-- eliminadas pelas FKs ON DELETE CASCADE da corrida.
WITH deleted AS (
  DELETE FROM public.mototaxi_corridas AS ride
  WHERE EXISTS (
    SELECT 1
    FROM _reset_mototaxi_rides AS target
    WHERE target.id = ride.id
  )
  RETURNING 1
)
INSERT INTO _reset_counts
SELECT 'mototaxi_corridas', count(*) FROM deleted;

-- Pos-condicoes: qualquer linha retornada aborta toda a transacao.
DO $reset$
BEGIN
  IF EXISTS (SELECT 1 FROM public.pagamentos_split WHERE service_type = 'mototaxi') THEN
    RAISE EXCEPTION 'Reset incompleto: ainda existem pagamentos_split de Mototaxi.';
  END IF;

  IF EXISTS (SELECT 1 FROM public.mototaxi_corridas) THEN
    RAISE EXCEPTION 'Reset incompleto: ainda existem corridas de Mototaxi.';
  END IF;
END
$reset$;

TABLE _reset_counts;

COMMIT;
