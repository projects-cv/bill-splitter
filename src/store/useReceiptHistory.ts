import { useCallback, useEffect, useRef, useState } from 'react';
import { Receipt } from '../types';
import { hasLegacyHistory, importLegacyHistory, loadReceiptHistory, mergeReceiptHistory, saveReceiptHistory } from '../utils/receiptHistory';

export function useReceiptHistory(userId: string) {
  const [savedReceipts, setSavedReceipts] = useState<Receipt[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [historyReady, setHistoryReady] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [hasLegacyReceipts, setHasLegacyReceipts] = useState(false);
  const [isImportingHistory, setIsImportingHistory] = useState(false);
  const mounted = useRef(false);

  const loadHistory = useCallback(async () => {
    setIsHistoryLoading(true);
    setHistoryError(null);
    try {
      const stored = await loadReceiptHistory(userId);
      if (!mounted.current) return;
      // A new split may have been created while storage was loading.
      setSavedReceipts(current => mergeReceiptHistory(current, stored));
      setHistoryReady(true);
      const hasLegacy = await hasLegacyHistory();
      if (mounted.current) setHasLegacyReceipts(hasLegacy);
    } catch {
      if (mounted.current) setHistoryError('Could not load saved splits. Please try again.');
    } finally {
      if (mounted.current) setIsHistoryLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    mounted.current = true;
    void loadHistory();
    return () => { mounted.current = false; };
  }, [loadHistory]);

  useEffect(() => {
    // Never overwrite storage before a successful read.
    if (!historyReady) return;
    let current = true;
    saveReceiptHistory(savedReceipts, userId).then(() => {
      if (current) setHistoryError(null);
    }).catch(() => {
      if (current) setHistoryError('Changes could not be saved on this device. Please try again.');
    });
    return () => { current = false; };
  }, [savedReceipts, historyReady, retryCount, userId]);

  const saveReceipt = useCallback((receipt: Receipt) => {
    setSavedReceipts(current => current[0] === receipt
      ? current
      : [receipt, ...current.filter(saved => saved.id !== receipt.id)]);
  }, []);

  const retryHistory = () => {
    if (historyReady) setRetryCount(count => count + 1);
    else void loadHistory();
  };

  const importLegacyReceipts = async () => {
    if (!historyReady || isImportingHistory) return;
    setIsImportingHistory(true);
    try {
      const imported = await importLegacyHistory(userId);
      if (!mounted.current) return;
      setSavedReceipts(current => mergeReceiptHistory(current, imported));
      setHasLegacyReceipts(false);
      setHistoryError(null);
    } catch {
      if (mounted.current) setHistoryError('Could not import old splits. Please try again.');
    } finally {
      if (mounted.current) setIsImportingHistory(false);
    }
  };

  return { savedReceipts, saveReceipt, isHistoryLoading, historyError, retryHistory,
    hasLegacyReceipts, isImportingHistory, importLegacyReceipts };
}
