import { requireNativeModule, Platform } from "expo-modules-core";

import type { AcceptPaymentParams, PaymentResult } from "./MoneiPay.types";

export type {
  AcceptPaymentParams,
  PaymentResult,
  MoneiPayErrorCode,
} from "./MoneiPay.types";

interface MoneiPayNativeModule {
  acceptPayment(params: Record<string, unknown>): Promise<PaymentResult>;
  handleCallback(url: string): boolean;
  cancelPendingPayment(): void;
}

const NativeModule = requireNativeModule<MoneiPayNativeModule>("MoneiPay");

/**
 * Accept an NFC payment via MONEI Pay.
 *
 * On iOS: opens MONEI Pay via URL scheme. You must wire `handleCallback` in your URL handler.
 * On Android: launches MONEI Pay intent or CloudCommerce directly (based on `mode`).
 *
 * @param params - Payment parameters.
 * @returns Payment result with transaction details.
 * @throws Error with code from `MoneiPayErrorCode`.
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
  if (Platform.OS === "ios" && !params.callbackScheme) {
    throw new Error("callbackScheme is required on iOS");
  }

  return NativeModule.acceptPayment({
    token: params.token,
    amount: params.amount,
    description: params.description,
    customerName: params.customerName,
    customerEmail: params.customerEmail,
    customerPhone: params.customerPhone,
    callbackScheme: params.callbackScheme,
    mode: params.mode ?? "direct",
  });
}

/**
 * Handle a callback URL from MONEI Pay (iOS only).
 *
 * Wire this into your app's URL handler:
 * ```tsx
 * import { Linking } from 'react-native';
 * import * as MoneiPay from '@monei-pay/react-native';
 *
 * Linking.addEventListener('url', ({ url }) => {
 *   MoneiPay.handleCallback(url);
 * });
 * ```
 *
 * @param url - The incoming callback URL.
 * @returns `true` if the URL was handled by the SDK.
 */
export function handleCallback(url: string): boolean {
  return NativeModule.handleCallback(url);
}

/**
 * Cancel any pending payment. The promise will reject with 'CANCELLED'.
 */
export function cancelPendingPayment(): void {
  NativeModule.cancelPendingPayment();
}
