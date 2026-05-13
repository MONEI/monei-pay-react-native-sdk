import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Linking,
  Platform,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
} from 'react-native';
import * as MoneiPay from '@monei-pay/react-native';

type PaymentMode = 'direct' | 'via-monei-pay';

const DEFAULT_USER_AGENT = 'MONEI/MerchantDemoRN/0.2.1';

export default function App() {
  const [apiKey, setApiKey] = useState('');
  const [accountId, setAccountId] = useState('');
  const [userAgent, setUserAgent] = useState('');
  const [posId, setPosId] = useState('');
  const [authToken, setAuthToken] = useState('');
  const [amountText, setAmountText] = useState('');
  const [mode, setMode] = useState<PaymentMode>('direct');
  const [result, setResult] = useState<MoneiPay.PaymentResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isFetchingToken, setIsFetchingToken] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Wire URL callback handler for iOS
  useEffect(() => {
    if (Platform.OS === 'ios') {
      const subscription = Linking.addEventListener('url', ({url}) => {
        MoneiPay.handleCallback(url);
      });
      return () => subscription.remove();
    }
  }, []);

  const fetchToken = async () => {
    setError(null);

    if (accountId.trim() && !userAgent.trim()) {
      setError('User-Agent must be provided when using Account ID');
      return;
    }

    setIsFetchingToken(true);

    try {
      const body: Record<string, string> = {};
      if (posId.trim()) {
        body.pointOfSaleId = posId.trim();
      }

      const headers: Record<string, string> = {
        Authorization: apiKey.trim(),
        'Content-Type': 'application/json',
        'User-Agent': userAgent.trim() || DEFAULT_USER_AGENT,
      };
      if (accountId.trim()) {
        headers['MONEI-Account-ID'] = accountId.trim();
      }

      const response = await fetch('https://api.monei.com/v1/pos/auth-token', {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text}`);
      }

      const json = await response.json();
      if (json.token) {
        setAuthToken(json.token);
      } else {
        throw new Error('No token in response');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsFetchingToken(false);
    }
  };

  const acceptPayment = async () => {
    const amount = parseInt(amountText, 10);
    if (!amount || amount <= 0) {
      Alert.alert('Invalid Amount', 'Enter a positive amount in cents.');
      return;
    }

    setResult(null);
    setError(null);
    setIsProcessing(true);

    try {
      const paymentResult = await MoneiPay.acceptPayment({
        token: authToken,
        amount,
        callbackScheme: 'monei-pay-example',
        mode,
      });
      setResult(paymentResult);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const canFetchToken = apiKey.trim().length > 0 && !isFetchingToken;
  const canAcceptPayment =
    authToken.length > 0 && amountText.length > 0 && !isProcessing;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Merchant Demo</Text>

        {/* Credentials */}
        <Text style={styles.sectionHeader}>Credentials</Text>
        <TextInput
          style={styles.input}
          placeholder="MONEI API Key"
          value={apiKey}
          onChangeText={setApiKey}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TextInput
          style={styles.input}
          placeholder="MONEI Account ID (optional, partner integrations)"
          value={accountId}
          onChangeText={setAccountId}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TextInput
          style={styles.input}
          placeholder="User-Agent (e.g. MONEI/MyPartner/0.1.0)"
          value={userAgent}
          onChangeText={setUserAgent}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TextInput
          style={styles.input}
          placeholder="Point of Sale ID (optional)"
          value={posId}
          onChangeText={setPosId}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity
          style={[styles.button, !canFetchToken && styles.buttonDisabled]}
          onPress={fetchToken}
          disabled={!canFetchToken}>
          {isFetchingToken ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Get Token</Text>
          )}
        </TouchableOpacity>

        {/* Auth Token */}
        {authToken.length > 0 && (
          <>
            <View style={styles.tokenRow}>
              <Text style={styles.sectionHeader}>Auth Token</Text>
              <TouchableOpacity onPress={() => setAuthToken('')}>
                <Text style={styles.clearText}>Clear</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.tokenText} numberOfLines={2}>
              {authToken}
            </Text>
          </>
        )}

        {/* Payment */}
        <Text style={styles.sectionHeader}>New Payment</Text>
        <TextInput
          style={styles.input}
          placeholder="Amount in cents (e.g. 1500 = 15.00 EUR)"
          value={amountText}
          onChangeText={setAmountText}
          keyboardType="number-pad"
        />

        {Platform.OS === 'android' && (
          <View style={styles.modeRow}>
            <TouchableOpacity
              style={[
                styles.modeButton,
                mode === 'direct' && styles.modeButtonActive,
              ]}
              onPress={() => setMode('direct')}>
              <Text
                style={[
                  styles.modeText,
                  mode === 'direct' && styles.modeTextActive,
                ]}>
                Direct
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.modeButton,
                mode === 'via-monei-pay' && styles.modeButtonActive,
              ]}
              onPress={() => setMode('via-monei-pay')}>
              <Text
                style={[
                  styles.modeText,
                  mode === 'via-monei-pay' && styles.modeTextActive,
                ]}>
                Via MONEI Pay
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.button,
            styles.payButton,
            !canAcceptPayment && styles.buttonDisabled,
          ]}
          onPress={acceptPayment}
          disabled={!canAcceptPayment}>
          {isProcessing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Accept Payment</Text>
          )}
        </TouchableOpacity>

        {/* Result */}
        {result && (
          <View
            style={[
              styles.resultCard,
              result.success ? styles.resultSuccess : styles.resultFailure,
            ]}>
            <Text style={styles.resultTitle}>
              {result.success ? 'Payment Successful' : 'Payment Failed'}
            </Text>
            <Text style={styles.resultDetail}>
              Transaction: {result.transactionId}
            </Text>
            <Text style={styles.resultDetail}>
              Amount: {(result.amount / 100).toFixed(2)} EUR
            </Text>
            {result.cardBrand ? (
              <Text style={styles.resultDetail}>
                Card: {result.cardBrand} {result.maskedCardNumber}
              </Text>
            ) : null}
          </View>
        )}

        {/* Error */}
        {error && (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {flex: 1},
  container: {
    padding: 20,
    paddingTop: 60,
    paddingBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 24,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  payButton: {
    backgroundColor: '#34C759',
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  tokenRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  clearText: {
    color: '#007AFF',
    fontSize: 13,
  },
  tokenText: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#888',
    marginBottom: 8,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  modeButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  modeButtonActive: {
    borderColor: '#007AFF',
    backgroundColor: '#EBF5FF',
  },
  modeText: {
    fontSize: 14,
    color: '#666',
  },
  modeTextActive: {
    color: '#007AFF',
    fontWeight: '600',
  },
  resultCard: {
    marginTop: 16,
    padding: 16,
    borderRadius: 8,
  },
  resultSuccess: {
    backgroundColor: '#E8F8ED',
  },
  resultFailure: {
    backgroundColor: '#FEECEC',
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  resultDetail: {
    fontSize: 14,
    color: '#333',
    marginBottom: 2,
  },
  errorCard: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#FEECEC',
    borderRadius: 8,
  },
  errorText: {
    color: '#D32F2F',
    fontSize: 14,
  },
});
