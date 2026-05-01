import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Receipt, Participant, LineItem } from '../types';

interface ReceiptContextType {
  receipt: Receipt | null;
  setReceipt: (receipt: Receipt | null) => void;
  updateReceipt: (updates: Partial<Receipt>) => void;
  addParticipant: (name: string, color: string) => void;
  removeParticipant: (id: string) => void;
  assignItem: (itemId: string, participantId: string) => void;
  unassignItem: (itemId: string, participantId: string) => void;
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

  const reset = () => setReceipt(null);

  return (
    <ReceiptContext.Provider value={{
      receipt, setReceipt, updateReceipt, addParticipant, removeParticipant, assignItem, unassignItem, reset
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
