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
   * Your app's registered URL scheme for receiving callbacks (iOS only, required).
   * Must be registered in Info.plist.
   */
  callbackScheme?: string;
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
  | "NO_ACTIVITY"
  | "FAILED_TO_OPEN";
