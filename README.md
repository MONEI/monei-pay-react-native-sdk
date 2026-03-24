# MONEI Pay React Native SDK

Accept NFC tap-to-pay payments in your React Native app via [MONEI Pay](https://monei.com/monei-pay/).

Built as an Expo module — works with both Expo and bare React Native projects.

## Requirements

- React Native 0.73+
- Expo SDK 50+
- iOS 15.0+ / Android 8.0+ (API 26)
- POS auth token from your backend (`POST /v1/pos/auth-token`)

## Installation

```bash
npx expo install @monei-pay/react-native
```

Or with npm/yarn:

```bash
npm install @monei-pay/react-native
# or
yarn add @monei-pay/react-native
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

### Android Setup

No additional setup needed — the SDK's AndroidManifest includes the required `<queries>` entries.

## Usage

```tsx
import { useEffect } from 'react';
import { Linking, Platform } from 'react-native';
import * as MoneiPay from '@monei-pay/react-native';

function PaymentScreen() {
  // Wire URL callback handler (iOS only)
  useEffect(() => {
    if (Platform.OS === 'ios') {
      const sub = Linking.addEventListener('url', ({ url }) => {
        MoneiPay.handleCallback(url);
      });
      return () => sub.remove();
    }
  }, []);

  const handlePayment = async () => {
    try {
      const result = await MoneiPay.acceptPayment({
        token: 'eyJ...',              // Raw JWT from your backend
        amount: 1500,                 // Amount in cents (1500 = 15.00 EUR)
        description: 'Order #123',    // Optional
        customerName: 'John Doe',     // Optional
        customerEmail: 'john@ex.com', // Optional
        callbackScheme: 'your-app',   // iOS only — your registered URL scheme
        mode: 'direct',               // Android only — 'direct' or 'via-monei-pay'
      });

      console.log('Payment approved:', result.transactionId);
      console.log('Card:', result.cardBrand, result.maskedCardNumber);
    } catch (error) {
      console.error('Payment failed:', error.message);
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
| `callbackScheme` | `string` | iOS | Your app's registered URL scheme |
| `mode` | `string` | No | Android: `'direct'` (default) or `'via-monei-pay'` |

Returns `PaymentResult`. Throws on failure.

### `handleCallback(url)`

Handle incoming callback URL from MONEI Pay (iOS only). Wire into your Linking handler.

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

## Token Generation

Your backend generates POS auth tokens via the MONEI API:

```bash
curl -X POST https://api.monei.com/v1/pos/auth-token \
  -H "Authorization: YOUR_API_KEY" \
  -H "Content-Type: application/json"
```

See the [MONEI API docs](https://docs.monei.com) for details.

## License

MIT
