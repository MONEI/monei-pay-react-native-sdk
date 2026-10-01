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
 * Result of a processed payment. Display data only: confirm the payment on your
 * server (signed webhook or `GET /payments/{id}`) before fulfillment.
 */
export interface PaymentResult {
  /** Unique transaction identifier (the MONEI payment id). */
  transactionId: string;
  /** Whether the payment was approved. */
  success: boolean;
  /** Payment amount in cents. */
  amount: number;
  /** Card brand (e.g. "visa", "mastercard"). */
  cardBrand: string;
  /** Masked card number (e.g. "****1234"). */
  maskedCardNumber: string;
  /** Merchant order reference. */
  orderId?: string;
  /** ISO 4217 currency code (e.g. "EUR"). */
  currency?: string;
  /** MONEI payment status (e.g. "SUCCEEDED", "AUTHORIZED", "FAILED"). */
  status?: string;
  /** MONEI status code (e.g. "E000", "E301"). */
  statusCode?: string;
  /** Human readable status (e.g. "Insufficient funds"). */
  statusMessage?: string;
  /** Issuer authorization code. Approved payments only. */
  authorizationCode?: string;
  /** Last 4 digits of the card. */
  last4?: string;
  /** Card type: "credit", "debit" or "prepaid". */
  cardType?: string;
  /** ISO 3166-1 alpha-2 country of the card issuer. */
  cardCountry?: string;
}

/**
 * Error thrown by `acceptPayment`.
 */
export interface MoneiPayError extends Error {
  code: MoneiPayErrorCode;
  /**
   * The declined payment. Set only on `PAYMENT_FAILED` when MONEI Pay sends a
   * payment id. `success` is `false`. Display data only.
   */
  result?: PaymentResult;
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
