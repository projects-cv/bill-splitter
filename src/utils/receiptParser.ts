import { Receipt, LineItem } from '../types';

/**
 * Deterministic Non-LLM Rule-Based Receipt Text Parser
 * Takes raw OCR text output (e.g. from Tesseract OCR or native OCR engine)
 * and extracts receipt details (store name, items, prices, subtotal, tax, fees, total).
 */
export function parseReceiptText(rawText: string): Receipt {
  const lines = rawText
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0);

  let storeName = '';
  let date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  let subtotal = 0;
  let tax = 0;
  let fees = 0;
  let total = 0;
  const items: LineItem[] = [];

  // Regex patterns
  const priceRegex = /\$?(\d+\.\d{2})/i;
  const dateRegex = /(\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4})|((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{4})/i;
  
  // Keywords to ignore when identifying store name
  const headerIgnoreWords = /welcome|receipt|order|table|guest|server|cashier|date|time|tel|phone|#|store/i;

  let foundStoreName = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 1. Try to extract date
    const dateMatch = line.match(dateRegex);
    if (dateMatch && !dateMatch[0].includes('00/00')) {
      date = dateMatch[0];
    }

    // 2. Identify Store Name from top lines
    if (!foundStoreName && i < 5) {
      if (!headerIgnoreWords.test(line) && !priceRegex.test(line) && line.replace(/[^a-zA-Z]/g, '').length > 2) {
        storeName = line.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '');
        foundStoreName = true;
        continue;
      }
    }

    // 3. Match line containing prices
    const priceMatch = line.match(priceRegex);
    if (priceMatch) {
      const priceVal = parseFloat(priceMatch[1]);
      const lowerLine = line.toLowerCase();

      // Check if this line is Subtotal, Tax, Tip/Fee, or Total
      if (lowerLine.includes('subtotal') || lowerLine.includes('sub total') || lowerLine.includes('sub-total')) {
        subtotal = priceVal;
      } else if (lowerLine.includes('tax') || lowerLine.includes('vat') || lowerLine.includes('hst') || lowerLine.includes('gst')) {
        tax = priceVal;
      } else if (lowerLine.includes('tip') || lowerLine.includes('gratuity') || lowerLine.includes('fee') || lowerLine.includes('service')) {
        fees += priceVal;
      } else if (lowerLine.includes('total') || lowerLine.includes('amount due') || lowerLine.includes('balance')) {
        // Avoid matching subtotal line again
        if (!lowerLine.includes('sub')) {
          total = priceVal;
        }
      } else {
        // It's a line item!
        // Clean item name by removing price and currency symbols
        let itemName = line
          .replace(priceRegex, '')
          .replace(/[\$\*\#]/g, '')
          .replace(/\s+/g, ' ')
          .trim();

        if (itemName.length === 0) {
          itemName = `Item ${items.length + 1}`;
        }

        // Check for quantity multiplier e.g. "2x Burger" or "2 Burger"
        let quantity = 1;
        const qtyMatch = itemName.match(/^(\d+)\s*x?\s+(.+)/i);
        if (qtyMatch) {
          quantity = Math.max(1, parseInt(qtyMatch[1], 10));
          itemName = qtyMatch[2].trim();
        }

        const unitPrice = quantity > 1 ? parseFloat((priceVal / quantity).toFixed(2)) : priceVal;

        for (let q = 0; q < quantity; q++) {
          items.push({
            id: `item-${items.length}-${Math.random().toString(36).substring(7)}`,
            name: quantity > 1 ? `${itemName} (${q + 1}/${quantity})` : itemName,
            price: unitPrice,
            assignedTo: [],
          });
        }
      }
    }
  }

  // Fallbacks if store name, subtotal, or total were not explicitly matched
  if (!storeName) {
    storeName = 'Scanned Receipt';
  }

  const itemsSum = items.reduce((acc, item) => acc + item.price, 0);
  if (subtotal === 0) {
    subtotal = parseFloat(itemsSum.toFixed(2));
  }

  if (total === 0) {
    total = parseFloat((subtotal + tax + fees).toFixed(2));
  }

  return {
    id: Math.random().toString(36).substring(7),
    storeName,
    date,
    subtotal,
    tax,
    fees,
    total,
    items,
    participants: [],
  };
}
