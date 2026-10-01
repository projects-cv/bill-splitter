import { useCallback, useEffect, useRef, useState } from 'react';
import { Receipt } from '../types';
import { hasLegacyHistory, importLegacyHistory, loadReceiptHistory, mergeReceiptHistory, saveReceiptHistory } from '../utils/receiptHistory';

export function useReceiptHistory(userId?: string) {
  const [owner, setOwner] = useState(userId);
  const [savedReceipts, setSavedReceipts] = useState<Receipt[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [historyReady, setHistoryReady] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [hasLegacyReceipts, setHasLegacyReceipts] = useState(false);
  const [isImportingHistory, setIsImportingHistory] = useState(false);
  const mounted = useRef(false);
  const generation = useRef(0);

  const loadHistory = useCallback(async () => {
    const request = generation.current;
    if (!userId) { setIsHistoryLoading(false); return; }
    setIsHistoryLoading(true);
    setHistoryError(null);
    try {
      const stored = await loadReceiptHistory(userId);
      if (!mounted.current || request !== generation.current) return;
      // A new split may have been created while storage was loading.
      setSavedReceipts(current => mergeReceiptHistory(current, stored));
      setHistoryReady(true);
      const hasLegacy = await hasLegacyHistory();
      if (mounted.current && request === generation.current) setHasLegacyReceipts(hasLegacy);
    } catch {
      if (mounted.current && request === generation.current) setHistoryError('Could not load saved splits. Please try again.');
    } finally {
      if (mounted.current && request === generation.current) setIsHistoryLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    mounted.current = true;
    setOwner(userId);
    setSavedReceipts([]);
    setHistoryReady(false);
    setHasLegacyReceipts(false);
    setHistoryError(null);
    setIsImportingHistory(false);
    void loadHistory();
    return () => { mounted.current = false; generation.current++; };
  }, [loadHistory]);

  useEffect(() => {
    // Never overwrite storage before a successful read.
    if (!userId || owner !== userId || !historyReady) return;
    let current = true;
    saveReceiptHistory(savedReceipts, userId).then(() => {
      if (current) setHistoryError(null);
    }).catch(() => {
      if (current) setHistoryError('Changes could not be saved on this device. Please try again.');
    });
    return () => { current = false; };
  }, [savedReceipts, historyReady, retryCount, userId, owner]);

  const saveReceipt = useCallback((receipt: Receipt) => {
    if (!userId || owner !== userId) return;
    setSavedReceipts(current => current[0] === receipt
      ? current
      : [receipt, ...current.filter(saved => saved.id !== receipt.id)]);
  }, [userId, owner]);

  const retryHistory = () => {
    if (historyReady) setRetryCount(count => count + 1);
    else void loadHistory();
  };

  const importLegacyReceipts = async () => {
    if (!userId || owner !== userId || !historyReady || isImportingHistory) return;
    const request = generation.current;
    setIsImportingHistory(true);
    try {
      const imported = await importLegacyHistory(userId);
      if (!mounted.current || request !== generation.current) return;
      setSavedReceipts(current => mergeReceiptHistory(current, imported));
      setHasLegacyReceipts(false);
      setHistoryError(null);
    } catch {
      if (mounted.current && request === generation.current) setHistoryError('Could not import old splits. Please try again.');
    } finally {
      if (mounted.current && request === generation.current) setIsImportingHistory(false);
    }
  };

  return { savedReceipts: owner === userId ? savedReceipts : [], saveReceipt, isHistoryLoading: !!userId && (owner !== userId || isHistoryLoading), historyError: owner === userId ? historyError : null, retryHistory,
    hasLegacyReceipts, isImportingHistory, importLegacyReceipts };
}
