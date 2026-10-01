import { useCallback, useEffect, useRef, useState } from 'react';
import { Receipt } from '../types';
import { loadReceiptHistory, mergeReceiptHistory, saveReceiptHistory } from '../utils/receiptHistory';

export function useReceiptHistory() {
  const [savedReceipts, setSavedReceipts] = useState<Receipt[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [historyReady, setHistoryReady] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const mounted = useRef(false);

  const loadHistory = useCallback(async () => {
    setIsHistoryLoading(true);
    setHistoryError(null);
    try {
      const stored = await loadReceiptHistory();
      if (!mounted.current) return;
      // A new split may have been created while storage was loading.
      setSavedReceipts(current => mergeReceiptHistory(current, stored));
      setHistoryReady(true);
    } catch {
      if (mounted.current) setHistoryError('Could not load saved splits. Please try again.');
    } finally {
      if (mounted.current) setIsHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void loadHistory();
    return () => { mounted.current = false; };
  }, [loadHistory]);

  useEffect(() => {
    // Never overwrite storage before a successful read.
    if (!historyReady) return;
    let current = true;
    saveReceiptHistory(savedReceipts).then(() => {
      if (current) setHistoryError(null);
    }).catch(() => {
      if (current) setHistoryError('Changes could not be saved on this device. Please try again.');
    });
    return () => { current = false; };
  }, [savedReceipts, historyReady, retryCount]);

  const saveReceipt = useCallback((receipt: Receipt) => {
    setSavedReceipts(current => current[0] === receipt
      ? current
      : [receipt, ...current.filter(saved => saved.id !== receipt.id)]);
  }, []);

  const retryHistory = () => {
    if (historyReady) setRetryCount(count => count + 1);
    else void loadHistory();
  };

  return { savedReceipts, saveReceipt, isHistoryLoading, historyError, retryHistory };
}
