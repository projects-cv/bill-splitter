import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Receipt, Participant, LineItem, PromoSplitMethod } from '../types';

interface ReceiptContextType {
  receipt: Receipt | null;
  setReceipt: (receipt: Receipt | null) => void;
  updateReceipt: (updates: Partial<Receipt>) => void;
  addParticipant: (name: string, color: string) => void;
  removeParticipant: (id: string) => void;
  assignItem: (itemId: string, participantId: string) => void;
  unassignItem: (itemId: string, participantId: string) => void;
  addItem: (name: string, price: number) => void;
  updateItem: (id: string, updates: { name?: string; price?: number }) => void;
  removeItem: (id: string) => void;
  applyPromoCode: (amount: number, code?: string, splitMethod?: PromoSplitMethod) => void;
  removePromoCode: () => void;
  setPromoSplitMethod: (method: PromoSplitMethod) => void;
  reset: () => void;
}

const ReceiptContext = createContext<ReceiptContextType | undefined>(undefined);

export const ReceiptProvider = ({ children }: { children: ReactNode }) => {
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  const updateReceipt = (updates: Partial<Receipt>) => {
    setReceipt(prev => prev ? { ...prev, ...updates } : null);
  };

  const addParticipant = (name: string, color: string) => {
    if (!receipt) return;
    const newParticipant: Participant = {
      id: Math.random().toString(36).substring(7),
      name,
      color,
    };
    updateReceipt({ participants: [...receipt.participants, newParticipant] });
  };

  const removeParticipant = (id: string) => {
    if (!receipt) return;
    
    // Remove participant from any assigned items
    const updatedItems = receipt.items.map(item => ({
      ...item,
      assignedTo: item.assignedTo.filter(pId => pId !== id)
    }));

    updateReceipt({ 
      participants: receipt.participants.filter(p => p.id !== id),
      items: updatedItems
    });
  };

  const assignItem = (itemId: string, participantId: string) => {
    if (!receipt) return;
    const updatedItems = receipt.items.map(item => {
      if (item.id === itemId) {
        if (!item.assignedTo.includes(participantId)) {
          return { ...item, assignedTo: [...item.assignedTo, participantId] };
        }
      }
      return item;
    });
    updateReceipt({ items: updatedItems });
  };

  const unassignItem = (itemId: string, participantId: string) => {
    if (!receipt) return;
    const updatedItems = receipt.items.map(item => {
      if (item.id === itemId) {
        return { ...item, assignedTo: item.assignedTo.filter(id => id !== participantId) };
      }
      return item;
    });
    updateReceipt({ items: updatedItems });
  };

  const addItem = (name: string, price: number) => {
    if (!receipt) return;
    const newItem: LineItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      name: name.trim() || 'New Item',
      price: parseFloat(price.toFixed(2)),
      assignedTo: [],
    };
    const updatedItems = [...receipt.items, newItem];
    const newSubtotal = parseFloat(updatedItems.reduce((sum, item) => sum + item.price, 0).toFixed(2));
    const currentPromo = receipt.promoDiscount || 0;
    const wasDerived = Math.abs(receipt.total - (receipt.subtotal + receipt.tax + receipt.fees - currentPromo)) < 0.05;
    const newTotal = wasDerived || receipt.total === 0
      ? parseFloat(Math.max(0, newSubtotal + receipt.tax + receipt.fees - currentPromo).toFixed(2))
      : receipt.total;

    updateReceipt({
      items: updatedItems,
      subtotal: newSubtotal,
      total: newTotal,
    });
  };

  const updateItem = (id: string, updates: { name?: string; price?: number }) => {
    if (!receipt) return;
    const updatedItems = receipt.items.map(item => {
      if (item.id === id) {
        return {
          ...item,
          name: updates.name !== undefined ? updates.name.trim() : item.name,
          price: updates.price !== undefined ? parseFloat(updates.price.toFixed(2)) : item.price,
        };
      }
      return item;
    });
    const newSubtotal = parseFloat(updatedItems.reduce((sum, item) => sum + item.price, 0).toFixed(2));
    const currentPromo = receipt.promoDiscount || 0;
    const wasDerived = Math.abs(receipt.total - (receipt.subtotal + receipt.tax + receipt.fees - currentPromo)) < 0.05;
    const newTotal = wasDerived || receipt.total === 0
      ? parseFloat(Math.max(0, newSubtotal + receipt.tax + receipt.fees - currentPromo).toFixed(2))
      : receipt.total;

    updateReceipt({
      items: updatedItems,
      subtotal: newSubtotal,
      total: newTotal,
    });
  };

  const removeItem = (id: string) => {
    if (!receipt) return;
    const updatedItems = receipt.items.filter(item => item.id !== id);
    const newSubtotal = parseFloat(updatedItems.reduce((sum, item) => sum + item.price, 0).toFixed(2));
    const currentPromo = receipt.promoDiscount || 0;
    const wasDerived = Math.abs(receipt.total - (receipt.subtotal + receipt.tax + receipt.fees - currentPromo)) < 0.05;
    const newTotal = wasDerived || receipt.total === 0
      ? parseFloat(Math.max(0, newSubtotal + receipt.tax + receipt.fees - currentPromo).toFixed(2))
      : receipt.total;

    updateReceipt({
      items: updatedItems,
      subtotal: newSubtotal,
      total: newTotal,
    });
  };

  const applyPromoCode = (amount: number, code?: string, splitMethod?: PromoSplitMethod) => {
    if (!receipt) return;
    const promoDiscount = Math.max(0, parseFloat(amount.toFixed(2)));
    const promoCode = code !== undefined ? code.trim() : (receipt.promoCode || 'PROMO');
    const method = splitMethod || receipt.promoSplitMethod || 'item_cost_percent';
    const oldPromo = receipt.promoDiscount || 0;
    const wasDerived = Math.abs(receipt.total - (receipt.subtotal + receipt.tax + receipt.fees - oldPromo)) < 0.05;
    const newTotal = wasDerived || receipt.total === 0
      ? parseFloat(Math.max(0, receipt.subtotal + receipt.tax + receipt.fees - promoDiscount).toFixed(2))
      : receipt.total;

    updateReceipt({
      promoDiscount,
      promoCode,
      promoSplitMethod: method,
      total: newTotal,
    });
  };

  const removePromoCode = () => {
    if (!receipt) return;
    const oldPromo = receipt.promoDiscount || 0;
    const wasDerived = Math.abs(receipt.total - (receipt.subtotal + receipt.tax + receipt.fees - oldPromo)) < 0.05;
    const newTotal = wasDerived || receipt.total === 0
      ? parseFloat((receipt.subtotal + receipt.tax + receipt.fees).toFixed(2))
      : receipt.total;

    updateReceipt({
      promoDiscount: 0,
      promoCode: undefined,
      total: newTotal,
    });
  };

  const setPromoSplitMethod = (method: PromoSplitMethod) => {
    if (!receipt) return;
    updateReceipt({ promoSplitMethod: method });
  };

  const reset = () => setReceipt(null);

  return (
    <ReceiptContext.Provider value={{
      receipt,
      setReceipt,
      updateReceipt,
      addParticipant,
      removeParticipant,
      assignItem,
      unassignItem,
      addItem,
      updateItem,
      removeItem,
      applyPromoCode,
      removePromoCode,
      setPromoSplitMethod,
      reset
    }}>
      {children}
    </ReceiptContext.Provider>
  );
};

export const useReceipt = () => {
  const context = useContext(ReceiptContext);
  if (context === undefined) {
    throw new Error('useReceipt must be used within a ReceiptProvider');
  }
  return context;
};
