import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim() ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() ?? "";
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  const allowed = (Deno.env.get("ALLOWED_ORIGINS") || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const allowOrigin = allowed.includes(origin) ? origin : "null";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function json(req: Request, status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

serve(async (req: Request): Promise<Response> => {
  const headers = corsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }
  if (req.method !== "POST") return json(req, 405, { error: "method_not_allowed" });
  if (req.headers.get("origin") && headers["Access-Control-Allow-Origin"] === "null") {
    return json(req, 403, { error: "origin_not_allowed" });
  }

  try {
    const authorization = req.headers.get("authorization") || "";
    const token = authorization.replace(/^Bearer\s+/i, "").trim();
    if (!token) return json(req, 401, { error: "missing_authorization" });

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !authData.user) return json(req, 401, { error: "invalid_session" });

    const body = await req.json().catch(() => ({}));
    const serviceType = String(body.service_type || "");
    const serviceId = String(body.service_id || "");
    const customerId = String(body.customer_id || "");

    if (customerId !== authData.user.id) {
      return json(req, 403, { error: "customer_identity_mismatch" });
    }
    if (serviceType !== "mototaxi" || !serviceId) {
      return json(req, 410, {
        error: "legacy_checkout_disabled",
        message: "Use payment-gateway para criar pagamentos.",
      });
    }

    const { data: ride, error: rideError } = await supabaseAdmin
      .from("mototaxi_corridas")
      .select("id, tomador_id, status, payment_method")
      .eq("id", serviceId)
      .maybeSingle();

    if (rideError) throw rideError;
    if (!ride) return json(req, 404, { error: "service_not_found" });
    if (ride.tomador_id !== authData.user.id) {
      return json(req, 403, { error: "service_owner_mismatch" });
    }

    return json(req, 200, {
      success: ride.status === "paid",
      service_id: ride.id,
      status: ride.status,
      payment_method: ride.payment_method,
    });
  } catch (error) {
    console.error("[checkout] status check failed", error);
    return json(req, 500, { error: "internal_error" });
  }
});
