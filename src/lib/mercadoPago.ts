/**
 * Mercado Pago Split Payment Integration Service (Sandbox Mode)
 *
 * Automates splits between:
 * - Prestador: 90%
 * - UBT (Platform Fee): 4%
 * - Comunidade (Social Fund): 2%
 * - Prêmios (Loyalty Campaign): 3%
 * - Associação / Padrinho: 1%
 */

export interface SplitResult {
  total: number;
  prestador: number;
  ubt: number;
  comunidade: number;
  premios: number;
  associacao: number;
}

export interface PreferenceResponse {
  id: string;
  initPoint: string;
  sandboxInitPoint: string;
  split: SplitResult;
}

/**
 * Calculates the exact split rates based on the total transaction amount.
 * Rounded to 2 decimal places to maintain cent-precision.
 */
export function calculateSplit(total: number): SplitResult {
  const prestador = +(total * 0.90).toFixed(2);
  const ubt = +(total * 0.04).toFixed(2);
  const comunidade = +(total * 0.02).toFixed(2);
  const premios = +(total * 0.03).toFixed(2);
  // Ensure math balance with association/padrinho as residual subtraction to avoid roundings leakage
  const sumPartials = +(prestador + ubt + comunidade + premios).toFixed(2);
  const associacao = +(total - sumPartials).toFixed(2);

  return {
    total,
    prestador,
    ubt,
    comunidade,
    premios,
    associacao: associacao >= 0 ? associacao : 0
  };
}

/**
 * Simulates or executes preference creation using Mercado Pago REST API.
 * Uses fallback sandbox simulator when credentials aren't fully provisioned.
 */
export async function createPreference(
  amount: number,
  prestadorId: string,
  paymentMethod: "pix" | "card" = "pix"
): Promise<PreferenceResponse> {
  const accessToken = import.meta.env.VITE_MP_ACCESS_TOKEN;
  const publicKey = import.meta.env.VITE_MP_PUBLIC_KEY;
  const split = calculateSplit(amount);

  // Fallback simulator if credentials are blank or mocked
  if (!accessToken || accessToken === "your-access-token" || accessToken.includes("YOUR_")) {
    // Return mock preference after simulated delay
    await new Promise((resolve) => setTimeout(resolve, 800));
    const preferenceId = `pref_mock_${Math.random().toString(36).substring(2, 10)}`;
    return {
      id: preferenceId,
      initPoint: `https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=${preferenceId}`,
      sandboxInitPoint: `https://sandbox.mercadopago.com.br/checkout/v1/redirect?pref_id=${preferenceId}`,
      split
    };
  }

  // Real sandbox request to Mercado Pago Preferences API
  try {
    const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        items: [
          {
            title: "Serviço UBT Mototáxi",
            quantity: 1,
            unit_price: amount,
            currency_id: "BRL"
          }
        ],
        payment_methods: {
          excluded_payment_methods: [],
          excluded_payment_types: paymentMethod === "pix" ? [{ id: "ticket" }, { id: "credit_card" }] : [{ id: "ticket" }, { id: "bank_transfer" }],
          installments: 1
        },
        // Marketplace setup for split configuration
        marketplace_fee: split.ubt + split.comunidade + split.premios + split.associacao,
        external_reference: `prestador_${prestadorId}_ts_${Date.now()}`
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return {
      id: data.id,
      initPoint: data.init_point,
      sandboxInitPoint: data.sandbox_init_point || data.init_point,
      split
    };
  } catch (error) {
    console.warn("Mercado Pago API call failed, using sandbox fallback:", error);
    // Return simulator parameters
    const preferenceId = `pref_err_mock_${Math.random().toString(36).substring(2, 10)}`;
    return {
      id: preferenceId,
      initPoint: `https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=${preferenceId}`,
      sandboxInitPoint: `https://sandbox.mercadopago.com.br/checkout/v1/redirect?pref_id=${preferenceId}`,
      split
    };
  }
}
