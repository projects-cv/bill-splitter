import AsyncStorage from '@react-native-async-storage/async-storage';
import { Receipt } from '../types';

const STORAGE_KEY = 'bill-splitter.receipts.v1';
let pendingWrite: Promise<void> = Promise.resolve();

const isAmount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

function isReceipt(value: unknown): value is Receipt {
  if (!value || typeof value !== 'object') return false;
  const receipt = value as Receipt;
  return typeof receipt.id === 'string' && typeof receipt.storeName === 'string'
    && typeof receipt.date === 'string'
    && [receipt.subtotal, receipt.tax, receipt.fees, receipt.total].every(isAmount)
    && (receipt.promoDiscount === undefined || isAmount(receipt.promoDiscount))
    && (receipt.promoCode === undefined || typeof receipt.promoCode === 'string')
    && (receipt.promoSplitMethod === undefined
      || ['item_cost_percent', 'item_count_percent', 'equal'].includes(receipt.promoSplitMethod))
    && Array.isArray(receipt.participants) && receipt.participants.every(person =>
      person && typeof person.id === 'string' && typeof person.name === 'string' && typeof person.color === 'string')
    && Array.isArray(receipt.items) && receipt.items.every(item =>
      item && typeof item.id === 'string' && typeof item.name === 'string' && isAmount(item.price)
      && Array.isArray(item.assignedTo) && item.assignedTo.every(id => typeof id === 'string'));
}

function storageKey(userId?: string) {
  return userId ? `${STORAGE_KEY}.user.${encodeURIComponent(userId)}` : STORAGE_KEY;
}

async function readReceiptHistory(userId?: string): Promise<Receipt[]> {
  const stored = await AsyncStorage.getItem(storageKey(userId));
  if (stored === null) return [];
  const parsed: unknown = JSON.parse(stored);
  if (!Array.isArray(parsed) || !parsed.every(isReceipt)) {
    throw new Error('Saved receipt history is invalid.');
  }
  return parsed;
}

export async function loadReceiptHistory(userId?: string): Promise<Receipt[]> {
  // A remounted account must see edits already queued by its previous screen.
  await pendingWrite;
  return readReceiptHistory(userId);
}

export function saveReceiptHistory(receipts: Receipt[], userId?: string): Promise<void> {
  const snapshot = JSON.stringify(receipts);
  // Serialize writes so an older snapshot cannot finish after a newer edit.
  const write = pendingWrite.then(() => AsyncStorage.setItem(storageKey(userId), snapshot));
  pendingWrite = write.catch(() => undefined);
  return write;
}

export async function hasLegacyHistory(): Promise<boolean> {
  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  return stored !== null && stored !== '[]';
}

export function importLegacyHistory(userId: string): Promise<Receipt[]> {
  const write = pendingWrite.then(async () => {
    const current = await readReceiptHistory(userId);
    const legacy = await readReceiptHistory();
    const merged = mergeReceiptHistory(current, legacy);
    await AsyncStorage.setItem(storageKey(userId), JSON.stringify(merged));
    // The original remains available if saving the imported copy fails.
    await AsyncStorage.removeItem(STORAGE_KEY);
    return merged;
  });
  pendingWrite = write.then(() => undefined, () => undefined);
  return write;
}

export function mergeReceiptHistory(recent: Receipt[], stored: Receipt[]): Receipt[] {
  const byId = new Map<string, Receipt>();
  for (const receipt of [...recent, ...stored]) {
    if (!byId.has(receipt.id)) byId.set(receipt.id, receipt);
  }
  return [...byId.values()];
}
