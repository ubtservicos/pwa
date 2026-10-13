# UBT SuperApp — Production Release Manifest

Release candidate: `2026-10-13`

Target branch: `main`

Production project/domain: intentionally unresolved until the release operator supplies them.

## Release gate

This candidate must not be pushed or deployed until all of these values are known and verified:

- Supabase Production project ref and database password;
- official HTTPS production origin;
- Mercado Pago Live Public Key, Live platform Access Token, application Client ID/Secret and webhook secret;
- production OAuth callback registered in the Mercado Pago application;
- official Mercado Pago homologation/quality approval, when applicable.

The repository contains no production secret. A database password found in obsolete local diagnostic scripts was removed from tracking; rotate that credential before release because it remains present in prior Git history.

## Edge Functions

| Function | Release responsibility | Auth |
|---|---|---|
| `payment-gateway` | Server-side Payments API call, Seller OAuth split via `application_fee`, auditable platform fallback, idempotency, Live/Sandbox separation, OAuth exchange and dynamic CORS. Production requires the scoped Live token and HTTPS OAuth callback. | Supabase JWT |
| `checkout` | Authenticated, read-only reconciliation of a mototaxi payment status. Legacy payment creation is disabled (`410`). Dynamic CORS uses `ALLOWED_ORIGINS`. | Supabase JWT |
| `payment-webhook` | HMAC validation, canonical payment lookup at Mercado Pago, environment validation, idempotent ledger update, and server-authoritative transition of Pix/card services to `paid`. | Mercado Pago HMAC; no Supabase JWT |

## SQL migrations in the release window

| Migration | Production effect | Data review |
|---|---|---|
| `20261005170000_mercadopago_routing_fallback.sql` | Adds Marketplace OAuth accounts/connections, secret-safe grants, routing/audit fields and idempotency indexes. | DDL only; no user, token or test ID insert. `plain:` is documented and accepted by runtime only in Sandbox. |
| `20261013173000_mototaxi_paid_realtime.sql` | Adds `paid` to the ride lifecycle and publishes `mototaxi_corridas` to Supabase Realtime if absent. | DDL only; no test data. Preflight existing status values before applying. |
| `20261013223000_user_payment_history.sql` | Adds participant-scoped history RPC joining ledger and route data. | `SECURITY DEFINER` is constrained by `auth.uid()`; Public revoked, Authenticated granted. |
| `20261013233000_drop_split_simulator.sql` | Permanently drops the former write-capable split simulator. | Required hardening; no replacement mock exists. |

Historical source `20260907_simulate_7way_split.sql` is now an intentional no-op so a fresh database cannot install the old simulator. Existing databases are cleaned by the new drop migration. The change in `20260902_broadcast_campaigns.sql` is comment-only.

## Frontend and runtime surface

- `CheckoutUniversal.tsx`: explicit `VITE_MP_ENVIRONMENT`, route-aware Public Key, tokenized card data only, Sandbox payer rules, actionable MP errors and stable attempt IDs.
- `MototaxiTomador.tsx` and `PrestadorMototaxiActive.tsx`: no browser-side transition to `paid`; Pix/card confirmation is backend-authoritative; provider evaluation follows confirmed payment.
- `FullscreenConfetti.tsx`: body portal and viewport overlay.
- `RidePaymentSummary.tsx`, `GerenciarPage.tsx`, `TransacaoDetailPage.tsx`, `PaymentHistoryService.ts`: history/detail/rating hydration with origin, destination, split and tracking ID.
- `useRealtimeChannel.ts`, `lib/supabase.ts`, `RideContext.tsx`: singleton client, bounded subscriptions, cleanup and reduced retry noise.
- `ConfigFinanceiroPage.tsx`: OAuth workflow remains environment-aware; fake card tokens removed.
- `appUrl.ts` and invitation/admin call sites: production origin comes from `VITE_APP_URL` or the current browser origin, not Homologation.
- Diarista/Ambulante payment screens now fail closed. Their legacy `checkout` creation route is disabled, so those payment buttons must remain unavailable until migrated to `payment-gateway`.

Removed from the release: test-user/E2E scripts, local Supabase link metadata, one-off repair/seed scripts, plaintext diagnostic credentials, and the legacy browser Mercado Pago helper/fallback.

## Environment contract

### Vercel Production

- `VITE_APP_URL=https://<PRODUCTION_DOMAIN>`
- `VITE_SUPABASE_URL=https://<PROD_REF>.supabase.co`
- `VITE_SUPABASE_ANON_KEY=<PRODUCTION_PUBLISHABLE_KEY>`
- `VITE_MP_ENVIRONMENT=production`
- `VITE_MP_PUBLIC_KEY=<MERCADO_PAGO_LIVE_PUBLIC_KEY>`
- `VITE_WHATSAPP_AGENT_URL=<PRODUCTION_AGENT_HTTPS_ENDPOINT>`
- Do not define `VITE_MP_TEST_PAYER_EMAIL` or `VITE_MP_TEST_PAYER_CPF`.
- Never expose an Access Token, Client Secret, service-role key or webhook secret through `VITE_*`.

### Supabase Production secrets

- `MP_ENVIRONMENT=production`
- `MP_ACCESS_TOKEN_PRODUCTION=<MERCADO_PAGO_LIVE_PLATFORM_ACCESS_TOKEN>`
- `MERCADOPAGO_CLIENT_ID=<LIVE_MARKETPLACE_APP_CLIENT_ID>`
- `MERCADOPAGO_CLIENT_SECRET=<LIVE_MARKETPLACE_APP_CLIENT_SECRET>`
- `MP_TOKEN_ENCRYPTION_KEY=<BASE64_32_RANDOM_BYTES>`
- `MP_REDIRECT_URIS=https://<PRODUCTION_DOMAIN>/app/config/financeiro`
- `ALLOWED_ORIGINS=https://<PRODUCTION_DOMAIN>`
- `MP_WEBHOOK_SECRET=<MERCADO_PAGO_WEBHOOK_HMAC_SECRET>`
- Do not define `MP_TEST_*`, `MP_ACCESS_TOKEN_SANDBOX` or a generic `MP_ACCESS_TOKEN` in Production.

Production OAuth omits `test_token` entirely. Sandbox alone sends `test_token: true`. Production redirects are rejected unless allowlisted and HTTPS.

## Production flight plan (PowerShell)

Replace placeholders locally; never commit the resulting values.

```powershell
$PROD_REF = "<SUPABASE_PRODUCTION_PROJECT_REF>"
$PROD_ORIGIN = "https://<PRODUCTION_DOMAIN>"

npx supabase login
npx supabase link --project-ref $PROD_REF
npx supabase migration list --linked
npx supabase db push --dry-run --linked
```

Before `db push`, query Production and stop if unknown statuses are returned:

```sql
select status, count(*)
from public.mototaxi_corridas
where status not in (
  'searching','pending','buscando','solicitado','accepted',
  'arriving','in_progress','completed','paid','cancelled'
)
group by status;
```

Take a Supabase PITR/manual backup, then apply the reviewed migration plan:

```powershell
npx supabase db push --linked
```

Create the ignored `.supabase-secrets.production.env` from the mapping above, then:

```powershell
npx supabase secrets set --env-file .supabase-secrets.production.env --project-ref $PROD_REF
npx supabase secrets list --project-ref $PROD_REF

npx supabase functions deploy payment-gateway --project-ref $PROD_REF
npx supabase functions deploy checkout --project-ref $PROD_REF
npx supabase functions deploy payment-webhook --no-verify-jwt --project-ref $PROD_REF
```

In Mercado Pago Developers, register and validate:

- OAuth callback: `$PROD_ORIGIN/app/config/financeiro`;
- webhook URL: `https://$PROD_REF.supabase.co/functions/v1/payment-webhook`;
- payment events and the same HMAC secret stored as `MP_WEBHOOK_SECRET`;
- Marketplace 1:1 / split permissions for the Live application.

Configure Vercel Production interactively so values do not enter shell history:

```powershell
npx vercel env add VITE_APP_URL production
npx vercel env add VITE_SUPABASE_URL production
npx vercel env add VITE_SUPABASE_ANON_KEY production
npx vercel env add VITE_MP_ENVIRONMENT production
npx vercel env add VITE_MP_PUBLIC_KEY production
npx vercel env add VITE_WHATSAPP_AGENT_URL production
```

Only after migrations, secrets, functions and Vercel Production variables are verified, promote the audited local `main` commit:

```powershell
git push origin main
```

If the Production Vercel project is not Git-integrated, deploy it explicitly after the push:

```powershell
npx vercel deploy --prod
```

## Go-live verification

1. `OPTIONS` from the official origin returns `204` on `payment-gateway` and `checkout`.
2. OAuth redirects to the registered HTTPS callback and stores an encrypted Live token; no `plain:` value is accepted.
3. Execute one minimum-value real transaction with an authorized account; confirm MP `live_mode=true`.
4. Confirm `pagamentos_split.environment='production'`, correct `payment_route`, gateway ID and exact split sum.
5. Confirm `mototaxi_corridas.status='paid'`, both clients receive Realtime, and payment history displays the same tracking ID.
6. Confirm a signed webhook is accepted once and a replay is idempotently acknowledged.
7. Confirm an invalid origin, invalid HMAC, missing Live token and failed payment all fail closed.

Do not perform a production mock transaction or seed any Test User. Roll back application/functions to the previous Git commit if smoke tests fail; do not reverse the additive ledger migrations or restore the simulator.
