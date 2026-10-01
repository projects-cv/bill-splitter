import { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { emptyPaymentDetails, normalizePaymentDetails, PaymentDetails } from '../utils/paymentDetails';

export function usePaymentDetails(userId?: string) {
  const [state, setState] = useState<{ owner?: string; details: PaymentDetails; loading: boolean; error: string | null }>({ details: emptyPaymentDetails, loading: false, error: null });
  const currentOwner = useRef(userId);
  currentOwner.current = userId;
  const key = userId ? `bill-splitter.payments.v1.user.${encodeURIComponent(userId)}` : null;
  useEffect(() => {
    let active = true;
    setState({ owner: userId, details: emptyPaymentDetails, loading: !!key, error: null });
    if (key) void AsyncStorage.getItem(key).then(raw => {
      const parsed = raw ? JSON.parse(raw) : emptyPaymentDetails;
      if (typeof parsed.venmo !== 'string' || typeof parsed.zelle !== 'string') throw new Error('Invalid payment details');
      const details = normalizePaymentDetails(parsed);
      if (active) setState({ owner: userId, details, loading: false, error: null });
    }).catch(() => {
      if (active) setState({ owner: userId, details: emptyPaymentDetails, loading: false, error: 'Could not load your payment details. Enter and save them again to replace the saved settings.' });
    });
    return () => { active = false; };
  }, [userId, key]);

  const savePaymentDetails = async (input: PaymentDetails) => {
    if (!key || state.owner !== userId || state.loading) throw new Error('Sign in and wait for your payment details to load.');
    const details = normalizePaymentDetails(input);
    await AsyncStorage.setItem(key, JSON.stringify(details));
    if (currentOwner.current === userId) setState({ owner: userId, details, loading: false, error: null });
  };
  return {
    paymentDetails: state.owner === userId && userId ? state.details : emptyPaymentDetails,
    isPaymentLoading: !!userId && (state.owner !== userId || state.loading),
    paymentError: state.owner === userId ? state.error : null,
    savePaymentDetails,
  };
}
