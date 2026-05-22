// TS bridge regression tests for the v1.0 wire-format rename:
//   callbackScheme -> completeScheme
//   adds callbackUrl
//   handleCallback -> handleCompleteRedirect
// Native modules are mocked; URL building itself lives in Swift/Kotlin.

import * as MoneiPay from "../index";

jest.mock("expo-modules-core", () => {
  const mockAcceptPayment = jest.fn(async () => ({
    transactionId: "tx_123",
    success: true,
    amount: 1500,
    cardBrand: "visa",
    maskedCardNumber: "****1234",
  }));
  const mockHandleCompleteRedirect = jest.fn(() => true);
  const mockCancelPendingPayment = jest.fn();
  return {
    requireNativeModule: () => ({
      acceptPayment: mockAcceptPayment,
      handleCompleteRedirect: mockHandleCompleteRedirect,
      cancelPendingPayment: mockCancelPendingPayment,
    }),
    Platform: { OS: "ios" },
  };
});

const nativeModule = (
  require("expo-modules-core") as { requireNativeModule: () => any }
).requireNativeModule();

describe("acceptPayment", () => {
  beforeEach(() => {
    nativeModule.acceptPayment.mockClear();
    nativeModule.handleCompleteRedirect.mockClear();
    nativeModule.cancelPendingPayment.mockClear();
  });

  it("forwards completeScheme + callbackUrl to native module (no old callbackScheme key)", async () => {
    await MoneiPay.acceptPayment({
      token: "jwt",
      amount: 1500,
      completeScheme: "myapp",
      callbackUrl: "https://merchant.example.com/webhook",
    });

    expect(nativeModule.acceptPayment).toHaveBeenCalledTimes(1);
    const args = nativeModule.acceptPayment.mock.calls[0][0];
    expect(args.completeScheme).toBe("myapp");
    expect(args.callbackUrl).toBe("https://merchant.example.com/webhook");
    expect(args.token).toBe("jwt");
    expect(args.amount).toBe(1500);
    expect(args.mode).toBe("direct");
    // Old field must NOT appear.
    expect("callbackScheme" in args).toBe(false);
  });

  it("requires completeScheme on iOS", async () => {
    await expect(
      MoneiPay.acceptPayment({ token: "jwt", amount: 1500 })
    ).rejects.toThrow("completeScheme is required on iOS");
  });

  it("rejects missing token", async () => {
    await expect(
      // @ts-expect-error intentionally missing token
      MoneiPay.acceptPayment({ amount: 1500, completeScheme: "myapp" })
    ).rejects.toThrow("token is required");
  });

  it("rejects non-positive amount", async () => {
    await expect(
      MoneiPay.acceptPayment({
        token: "jwt",
        amount: 0,
        completeScheme: "myapp",
      })
    ).rejects.toThrow("amount must be a positive number");
  });

  it("forwards undefined callbackUrl when omitted", async () => {
    await MoneiPay.acceptPayment({
      token: "jwt",
      amount: 1500,
      completeScheme: "myapp",
    });
    const args = nativeModule.acceptPayment.mock.calls[0][0];
    expect(args.callbackUrl).toBeUndefined();
  });

  // orderId is the merchant reconciliation key surfaced in the webhook.
  // transactionType is the SALE/AUTH override; backend validates the enum.
  it("forwards orderId + transactionType to native module", async () => {
    await MoneiPay.acceptPayment({
      token: "jwt",
      amount: 1500,
      completeScheme: "myapp",
      orderId: "qmrid:abc-123",
      transactionType: "AUTH",
    });
    const args = nativeModule.acceptPayment.mock.calls[0][0];
    expect(args.orderId).toBe("qmrid:abc-123");
    expect(args.transactionType).toBe("AUTH");
  });

  it("forwards undefined orderId + transactionType when omitted", async () => {
    await MoneiPay.acceptPayment({
      token: "jwt",
      amount: 1500,
      completeScheme: "myapp",
    });
    const args = nativeModule.acceptPayment.mock.calls[0][0];
    expect(args.orderId).toBeUndefined();
    expect(args.transactionType).toBeUndefined();
  });
});

describe("handleCompleteRedirect", () => {
  beforeEach(() => {
    nativeModule.handleCompleteRedirect.mockClear();
  });

  it("delegates to native handleCompleteRedirect", () => {
    const ok = MoneiPay.handleCompleteRedirect(
      "myapp://payment-result?success=true"
    );
    expect(ok).toBe(true);
    expect(nativeModule.handleCompleteRedirect).toHaveBeenCalledWith(
      "myapp://payment-result?success=true"
    );
  });

  it("legacy handleCallback export is removed", () => {
    expect((MoneiPay as any).handleCallback).toBeUndefined();
  });
});

describe("cancelPendingPayment", () => {
  it("delegates to native cancelPendingPayment", () => {
    MoneiPay.cancelPendingPayment();
    expect(nativeModule.cancelPendingPayment).toHaveBeenCalled();
  });
});
