export type Participant = {
  id: string;
  name: string;
  color: string; // Used for UI identification
};

export type LineItem = {
  id: string;
  name: string;
  price: number;
  assignedTo: string[]; // Array of participant IDs
};

export type PromoSplitMethod = 'item_cost_percent' | 'item_count_percent' | 'equal';

export type Receipt = {
  id: string;
  storeName: string;
  date: string;
  subtotal: number;
  tax: number;
  fees: number;
  promoDiscount?: number;
  promoCode?: string;
  promoSplitMethod?: PromoSplitMethod;
  total: number;
  items: LineItem[];
  participants: Participant[];
};

export type RootStackParamList = {
  Dashboard: undefined;
  Camera: undefined;
  Friends: { receiptId?: string }; // Pass receipt ID if editing
  ItemAssignment: { receiptId?: string };
  Summary: { receiptId?: string };
};
