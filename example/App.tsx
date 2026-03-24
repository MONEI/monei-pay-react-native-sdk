import React, { useEffect, useState } from 'react';
import { View, Text, Button, StyleSheet, Alert, Linking, Platform } from 'react-native';
import * as MoneiPay from '@monei-pay/react-native';

export default function App() {
  const [result, setResult] = useState<MoneiPay.PaymentResult | null>(null);

  useEffect(() => {
    // Wire URL callback handler for iOS
    if (Platform.OS === 'ios') {
      const subscription = Linking.addEventListener('url', ({ url }) => {
        MoneiPay.handleCallback(url);
      });
      return () => subscription.remove();
    }
  }, []);

  const handlePayment = async () => {
    try {
      const paymentResult = await MoneiPay.acceptPayment({
        token: 'YOUR_JWT_TOKEN_HERE', // Get from your backend
        amount: 1500, // 15.00 EUR
        description: 'Test Payment',
        customerName: 'John Doe',
        callbackScheme: 'monei-pay-example', // iOS only — register in Info.plist
        mode: 'direct', // Android only — 'direct' or 'via-monei-pay'
      });

      setResult(paymentResult);
      Alert.alert('Payment Approved', `Transaction: ${paymentResult.transactionId}`);
    } catch (error: any) {
      Alert.alert('Payment Failed', error.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>MONEI Pay SDK Example</Text>
      <Button title="Accept Payment (15.00 EUR)" onPress={handlePayment} />
      {result && (
        <View style={styles.result}>
          <Text>Transaction: {result.transactionId}</Text>
          <Text>Card: {result.cardBrand} {result.maskedCardNumber}</Text>
          <Text>Amount: {(result.amount / 100).toFixed(2)} EUR</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 20 },
  result: { marginTop: 20, padding: 16, backgroundColor: '#f0f0f0', borderRadius: 8 },
});
