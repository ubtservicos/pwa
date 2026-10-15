/**
 * UBT-PAY-006: Tipagens do Checkout Universal
 *
 * Contratos de interface para o componente <CheckoutUniversal />,
 * agnóstico em relação ao serviço prestado (mototáxi, delivery, frete, etc.).
 */

/** Tipos de serviço suportados pelo SuperApp */
export type ServiceType = "mototaxi" | "delivery" | "freight" | "services";

/** Resultado de um pagamento aprovado devolvido pela Edge Function */
export interface PaymentResult {
  /** ID do pagamento gerado pelo Mercado Pago */
  payment_id?: string | number;
  /** Status retornado ("approved", "pending", etc.) */
  status?: string;
  /** Extrato do split de 7 vias */
  split?: {
    statement?: string;
    [key: string]: unknown;
  };
  /** Dados de Pix (QR Code), caso o método seja Pix */
  pix?: {
    qr_code_base64?: string;
    qr_code?: string;
  };
  /** Dados brutos extras vindos da Edge Function */
  [key: string]: unknown;
}

/** Props do componente <CheckoutUniversal /> */
export interface CheckoutUniversalProps {
  /** Valor total da transação em BRL (float, ex: 12.50) */
  amount: number;

  /** UUID do prestador de serviço (Seller/Provider) */
  providerId: string;

  /** Nome do prestador (para descrição do pagamento) */
  providerName?: string;

  /** Tipo do serviço sendo pago */
  serviceType: ServiceType;

  /** ID da transação/corrida/pedido — usado como external_reference */
  serviceId?: string;

  /** Metadados opcionais (telemetria, device fingerprint, etc.) */
  metadata?: Record<string, unknown>;

  /** Callback disparado quando o pagamento é aprovado */
  onSuccess: (result: PaymentResult) => void;

  /** Callback disparado em caso de erro */
  onError: (error: string) => void;
}
