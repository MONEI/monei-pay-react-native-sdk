# Changelog

# [1.2.0](https://github.com/MONEI/monei-pay-react-native-sdk/compare/v1.1.0...v1.2.0) (2026-06-09)


### Features

* **ios:** launch MONEI Pay via Universal Link to skip the system prompt ([#1](https://github.com/MONEI/monei-pay-react-native-sdk/issues/1)) ([767501b](https://github.com/MONEI/monei-pay-react-native-sdk/commit/767501b3d90cd4e068250614ac2c0fbbe85c5c84))

# [1.1.0](https://github.com/MONEI/monei-pay-react-native-sdk/compare/v1.0.0...v1.1.0) (2026-05-22)


### Features

* forward orderId and transactionType through SDK ([dd0936b](https://github.com/MONEI/monei-pay-react-native-sdk/commit/dd0936bfa86481f2c26bcc78649478c3dc9e8c86))

## [1.0.0](https://github.com/MONEI/monei-pay-react-native-sdk/compare/v0.2.2...v1.0.0) (2026-05-21)

### BREAKING CHANGES

* **wire format:** `callback` query param removed from the MONEI Pay deep link in favor of `complete_url` (UX redirect) + `callback_url` (signed webhook). Two channels with different trust models. See https://docs.monei.com/monei-pay/app-integration/getting-started for the trust split.
* **public API:** renamed `callbackScheme` → `completeScheme` in `AcceptPaymentParams`.
* **public API:** renamed `handleCallback` → `handleCompleteRedirect` (TS + iOS native module).

### Features

* add optional `callbackUrl` to `AcceptPaymentParams`. When provided, a signed webhook is delivered to that URL on payment completion. https only, ≤ 2048 chars; private/loopback hosts rejected server-side by mcc-service.
* expanded `MoneiPayErrorCode`: `TOKEN_EXPIRED`, `INVALID_AMOUNT`, `INVALID_CALLBACK_URL`, `INVALID_COMPLETE_URL`, `NOT_AUTHENTICATED`, `ACCOUNT_NOT_CONFIGURED` now surface from the monei-pay app.
* iOS and Android natives forward `callbackUrl` through both the DIRECT (CloudCommerce `merchantCustomData`) and VIA_MONEI_PAY (intent extra) paths.

### Migration

```ts
// before
MoneiPay.acceptPayment({ token, amount, callbackScheme: 'myapp' });
Linking.addEventListener('url', ({ url }) => MoneiPay.handleCallback(url));

// after
MoneiPay.acceptPayment({
  token,
  amount,
  completeScheme: 'myapp',
  callbackUrl: 'https://merchant.example.com/webhook', // optional, signed webhook
});
Linking.addEventListener('url', ({ url }) => MoneiPay.handleCompleteRedirect(url));
```

## [0.2.2](https://github.com/MONEI/monei-pay-react-native-sdk/compare/v0.2.1...v0.2.2) (2026-05-13)


### Features

* **example:** support master account flow via MONEI-Account-ID and User-Agent ([21b8337](https://github.com/MONEI/monei-pay-react-native-sdk/commit/21b8337c699af755cdfb7d2f4211d6e369eb0477))

## [0.2.1](https://github.com/MONEI/monei-pay-react-native-sdk/compare/v0.2.0...v0.2.1) (2026-03-30)
