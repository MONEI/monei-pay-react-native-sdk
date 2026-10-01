import { CodedError, requireNativeModule, Platform } from "expo-modules-core";

import type {
  AcceptPaymentParams,
  MoneiPayError,
  PaymentResult,
} from "./MoneiPay.types";

export type {
  AcceptPaymentParams,
  PaymentResult,
  MoneiPayError,
  MoneiPayErrorCode,
} from "./MoneiPay.types";

// Expo native promises drop extra data on reject. So native resolves a decline
// with errorCode + errorMessage, and acceptPayment throws it here with the result.
interface NativePaymentResult extends PaymentResult {
  errorCode?: string;
  errorMessage?: string;
}

interface MoneiPayNativeModule {
  acceptPayment(params: Record<string, unknown>): Promise<NativePaymentResult>;
  handleCompleteRedirect(url: string): boolean;
  cancelPendingPayment(): void;
}

const NativeModule = requireNativeModule<MoneiPayNativeModule>("MoneiPay");

/**
 * Accept an NFC payment via MONEI Pay.
 *
 * On iOS: opens MONEI Pay via URL scheme. You must wire `handleCompleteRedirect` in your URL handler.
 * On Android: launches MONEI Pay intent or CloudCommerce directly (based on `mode`).
 *
 * @param params - Payment parameters.
 * @returns Payment result with transaction details.
 * @throws MoneiPayError. On `PAYMENT_FAILED` it can carry the declined payment in `result`.
 */
export async function acceptPayment(
  params: AcceptPaymentParams
): Promise<PaymentResult> {
  if (!params.token) {
    throw new Error("token is required");
  }
  if (!params.amount || params.amount <= 0) {
    throw new Error("amount must be a positive number");
  }
  if (Platform.OS === "ios" && !params.completeScheme) {
    throw new Error("completeScheme is required on iOS");
  }

  const { errorCode, errorMessage, ...result } =
    await NativeModule.acceptPayment({
      token: params.token,
      amount: params.amount,
      description: params.description,
      customerName: params.customerName,
      customerEmail: params.customerEmail,
      customerPhone: params.customerPhone,
      completeScheme: params.completeScheme,
      callbackUrl: params.callbackUrl,
      orderId: params.orderId,
      transactionType: params.transactionType,
      mode: params.mode ?? "direct",
    });
  if (errorCode) {
    const error = new CodedError(
      errorCode,
      errorMessage ?? errorCode
    ) as MoneiPayError;
    error.result = result;
    throw error;
  }
  return result;
}

/**
 * Handle a complete-redirect URL from MONEI Pay (iOS only).
 *
 * Wire this into your app's URL handler:
 * ```tsx
 * import { Linking } from 'react-native';
 * import * as MoneiPay from '@monei-pay/react-native';
 *
 * Linking.addEventListener('url', ({ url }) => {
 *   MoneiPay.handleCompleteRedirect(url);
 * });
 * ```
 *
 * @param url - The incoming complete-redirect URL.
 * @returns `true` if the URL was handled by the SDK.
 */
export function handleCompleteRedirect(url: string): boolean {
  return NativeModule.handleCompleteRedirect(url);
}

/**
 * Cancel any pending payment. The promise will reject with 'CANCELLED'.
 */
export function cancelPendingPayment(): void {
  NativeModule.cancelPendingPayment();
}
