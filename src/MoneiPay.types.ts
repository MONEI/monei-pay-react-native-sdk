/**
 * Parameters for accepting a payment.
 */
export interface AcceptPaymentParams {
  /** Raw JWT auth token (no "Bearer " prefix — SDK adds it internally). */
  token: string;
  /** Payment amount in cents (e.g. 1500 = 15.00 EUR). */
  amount: number;
  /** Optional payment description. */
  description?: string;
  /** Optional customer name. */
  customerName?: string;
  /** Optional customer email. */
  customerEmail?: string;
  /** Optional customer phone. */
  customerPhone?: string;
  /**
   * Your app's registered URL scheme for receiving the post-payment redirect (iOS only, required).
   * Must be registered in Info.plist. UX redirect only (NOT trusted); never base business decisions on it.
   */
  completeScheme?: string;
  /**
   * Optional https webhook URL to receive a signed payment notification (trusted).
   * Use this for order fulfillment. Must be https, ≤ 2048 chars.
   */
  callbackUrl?: string;
  /**
   * Optional merchant order reference. Used as the payment's orderId for
   * reconciliation in the webhook callback. If empty, MONEI generates one.
   */
  orderId?: string;
  /**
   * Optional transaction type (SALE / AUTH / REFUND / CAPTURE / CANCEL /
   * PAYOUT / VERIF). Backend validates; invalid values are rejected.
   */
  transactionType?: string;
  /**
   * Android payment mode: 'direct' (CloudCommerce) or 'via-monei-pay' (MONEI Pay intent).
   * Default: 'direct'. Ignored on iOS.
   */
  mode?: "direct" | "via-monei-pay";
}

/**
 * Result of a processed payment.
 */
export interface PaymentResult {
  /** Unique transaction identifier. */
  transactionId: string;
  /** Whether the payment was approved. */
  success: boolean;
  /** Payment amount in cents. */
  amount: number;
  /** Card brand (e.g. "visa", "mastercard"). */
  cardBrand: string;
  /** Masked card number (e.g. "****1234"). */
  maskedCardNumber: string;
}

/**
 * Error codes thrown by the SDK.
 */
export type MoneiPayErrorCode =
  | "NOT_INSTALLED"
  | "PAYMENT_IN_PROGRESS"
  | "PAYMENT_FAILED"
  | "PAYMENT_TIMEOUT"
  | "CANCELLED"
  | "INVALID_PARAMS"
  | "INVALID_TOKEN"
  | "TOKEN_EXPIRED"
  | "INVALID_AMOUNT"
  | "INVALID_CALLBACK_URL"
  | "INVALID_COMPLETE_URL"
  | "NOT_AUTHENTICATED"
  | "ACCOUNT_NOT_CONFIGURED"
  | "NO_ACTIVITY"
  | "FAILED_TO_OPEN";
