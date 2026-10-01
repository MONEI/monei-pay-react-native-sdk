# MONEI Pay React Native SDK

Accept NFC tap-to-pay payments in your React Native app via [MONEI Pay](https://monei.com/monei-pay/).

Built as an Expo module — works with both Expo and bare React Native projects.

## Requirements

- React Native 0.73+
- Expo SDK 50+
- iOS 15.0+ / Android 8.0+ (API 26)
- POS auth token from your backend (`POST /v1/pos/auth-token`)

## Installation

The package is on npm: [@monei-js/monei-pay-react-native-sdk](https://www.npmjs.com/package/@monei-js/monei-pay-react-native-sdk).

```bash
npx expo install @monei-js/monei-pay-react-native-sdk
```

Or with npm or pnpm:

```bash
npm install @monei-js/monei-pay-react-native-sdk
pnpm add @monei-js/monei-pay-react-native-sdk
```

### iOS Setup

Add to your `app.json` or `app.config.js`:

```json
{
  "expo": {
    "ios": {
      "infoPlist": {
        "LSApplicationQueriesSchemes": ["monei-pay"]
      }
    },
    "scheme": "your-app-scheme"
  }
}
```

On iOS the SDK launches MONEI Pay via a Universal Link (`https://pay.monei.com/accept-payment`), which
opens the app directly with **no "Open in MONEI Pay?" prompt**. Installs that predate Universal Link
support fall back to the `monei-pay://` custom scheme, so the `LSApplicationQueriesSchemes` entry above
is still required. No extra merchant configuration is needed.

### Android Setup

No additional setup needed — the SDK's AndroidManifest includes the required `<queries>` entries.

## Usage

```tsx
import { useEffect } from 'react';
import { Button, Linking, Platform } from 'react-native';
import * as MoneiPay from '@monei-js/monei-pay-react-native-sdk';
import type { MoneiPayError } from '@monei-js/monei-pay-react-native-sdk';

function PaymentScreen() {
  // iOS only: send the MONEI Pay redirect URL to the SDK.
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    const sub = Linking.addEventListener('url', ({ url }) => {
      MoneiPay.handleCompleteRedirect(url);
    });
    return () => sub.remove();
  }, []);

  const handlePayment = async () => {
    try {
      const result = await MoneiPay.acceptPayment({
        token: 'eyJ...',                   // Raw JWT from your backend
        amount: 1500,                      // Amount in cents (1500 = 15.00 EUR)
        description: 'Order #123',         // Optional
        orderId: 'order-123',              // Optional. Your order reference
        callbackUrl: 'https://example.com/monei-webhook', // Optional. Signed webhook for fulfillment
        completeScheme: 'your-app-scheme', // iOS only, required. Your registered URL scheme
        mode: 'direct',                    // Android only. 'direct' or 'via-monei-pay'
      });

      // Display data only. Confirm the payment on your server before fulfillment.
      console.log('Payment approved:', result.transactionId, result.status);
      console.log('Card:', result.cardBrand, result.maskedCardNumber);
    } catch (e) {
      const error = e as MoneiPayError;
      if (error.code === 'PAYMENT_FAILED' && error.payment) {
        console.log('Declined:', error.payment.statusCode, error.payment.statusMessage);
      } else {
        console.error('Payment failed:', error.code, error.message);
      }
    }
  };

  return <Button title="Pay" onPress={handlePayment} />;
}
```

## API Reference

### `acceptPayment(params)`

Accept an NFC payment. Returns a Promise.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `token` | `string` | Yes | Raw JWT auth token (no "Bearer " prefix) |
| `amount` | `number` | Yes | Amount in cents |
| `description` | `string` | No | Payment description |
| `customerName` | `string` | No | Customer name |
| `customerEmail` | `string` | No | Customer email |
| `customerPhone` | `string` | No | Customer phone |
| `callbackUrl` | `string` | No | HTTPS endpoint for the signed webhook. Trusted channel — use for fulfillment. Must be `https://`, max 2048 chars. |
| `orderId` | `string` | No | Merchant order reference. Surfaced in the webhook callback for reconciliation. Max 2048 chars. If omitted, the SDK generates one. |
| `transactionType` | `string` | No | Optional: `'SALE'` (default), `'AUTH'`, `'REFUND'`, `'CAPTURE'`, `'CANCEL'`, `'PAYOUT'`, `'VERIF'`. Server-validated. |
| `completeScheme` | `string` | iOS | Your app's registered URL scheme. MONEI Pay opens `<completeScheme>://payment-result` on completion. |
| `mode` | `string` | No | Android: `'direct'` (default) or `'via-monei-pay'` |

Returns `PaymentResult`. Throws on failure.

### `handleCompleteRedirect(url)`

Handle the post-payment redirect URL from MONEI Pay (iOS only). Wire into your `Linking` handler.

### `cancelPendingPayment()`

Cancel any pending payment.

### `PaymentResult`

| Property | Type | Description |
|----------|------|-------------|
| `transactionId` | `string` | Unique transaction ID |
| `success` | `boolean` | Whether payment was approved |
| `amount` | `number` | Amount in cents |
| `cardBrand` | `string` | Card brand (visa, mastercard, etc.) |
| `maskedCardNumber` | `string` | Masked card number (****1234) |
| `orderId` | `string?` | Merchant order reference |
| `currency` | `string?` | ISO 4217 currency code (`EUR`) |
| `status` | `string?` | MONEI payment status (`SUCCEEDED`, `AUTHORIZED`, `FAILED`, ...) |
| `statusCode` | `string?` | MONEI status code (`E000`, `E301`, ...) |
| `statusMessage` | `string?` | Human readable status (`Insufficient funds`) |
| `authorizationCode` | `string?` | Issuer authorization code. Approved payments only. |
| `last4` | `string?` | Last 4 digits of the card |
| `cardType` | `string?` | `credit`, `debit` or `prepaid` |
| `cardCountry` | `string?` | ISO 3166-1 alpha-2 country of the card issuer |

The optional fields are set only when MONEI Pay sends them. Android `direct` mode does not set them.

> **The result is display data only.** Use it to show a result screen. Before you fulfill the order, confirm the payment on your server with the signed webhook (`callbackUrl`) or `GET /payments/{id}`.

### Declined payments

A declined payment rejects with `PAYMENT_FAILED`, as before. When MONEI Pay sends the payment id, the error has a `payment` property: a `PaymentResult` with `success: false` and the decline reason.

```ts
import type { MoneiPayError } from '@monei-js/monei-pay-react-native-sdk';

try {
  await MoneiPay.acceptPayment(params);
} catch (e) {
  const error = e as MoneiPayError;
  if (error.code === 'PAYMENT_FAILED' && error.payment) {
    console.log('Declined:', error.payment.transactionId, error.payment.statusMessage);
  }
}
```

### Error Codes

| Code | Description |
|------|-------------|
| `NOT_INSTALLED` | MONEI Pay or CloudCommerce not on device |
| `PAYMENT_IN_PROGRESS` | Another payment is active |
| `CANCELLED` | User cancelled |
| `PAYMENT_FAILED` | Payment declined/failed |
| `INVALID_PARAMS` | Invalid input parameters |
| `INVALID_TOKEN` | Auth token expired or invalid |
| `PAYMENT_TIMEOUT` | Callback not received in time (iOS) |

## Example App

The [`example/`](example/) directory contains a merchant demo app that demonstrates the full payment flow:

1. Enter your MONEI API key
2. Fetch a POS auth token
3. Enter an amount and accept an NFC payment
4. View the payment result

To run:

```bash
cd example
npm install
npx expo run:ios    # or npx expo run:android
```

> Requires a physical device — NFC is not available in simulators/emulators.

## Token Generation

Your backend generates POS auth tokens via the MONEI API:

```bash
curl -X POST https://api.monei.com/v1/pos/auth-token \
  -H "Authorization: YOUR_API_KEY" \
  -H "Content-Type: application/json"
```

**Partner / master account integrations:** use your master account API key, set the sub-account ID via `MONEI-Account-ID`, and **identify yourself with a partner `User-Agent`** (`MONEI/<PARTNER_NAME>/<VERSION>`). A custom `User-Agent` is required whenever `MONEI-Account-ID` is set.

```bash
curl -X POST https://api.monei.com/v1/pos/auth-token \
  -H "Authorization: pk_live_MASTER_KEY" \
  -H "MONEI-Account-ID: SUB_ACCOUNT_ID" \
  -H "User-Agent: MONEI/MyPartner/0.1.0" \
  -H "Content-Type: application/json"
```

See [docs.monei.com/monei-connect](https://docs.monei.com/monei-connect) for details.

See the [MONEI API docs](https://docs.monei.com) for details.

## License

MIT
