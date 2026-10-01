export type PaymentDetails = { venmo: string; zelle: string };
export const emptyPaymentDetails: PaymentDetails = { venmo: '', zelle: '' };

export function normalizePaymentDetails(details: PaymentDetails): PaymentDetails {
  const venmo = details.venmo.trim().replace(/^@/, '');
  const zelle = details.zelle.trim();
  if (venmo && !/^[a-zA-Z0-9_-]{1,30}$/.test(venmo)) {
    throw new Error('Enter your Venmo username, such as @your-name.');
  }
  if (zelle && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(zelle) && !/^\+?[\d ()-]{7,25}$/.test(zelle)) {
    throw new Error('Enter the email address or phone number you use for Zelle.');
  }
  return { venmo, zelle };
}

export function paymentRequestText(details: PaymentDetails): string {
  const methods = [];
  if (details.venmo) methods.push(`Venmo: https://venmo.com/${encodeURIComponent(details.venmo)}`);
  if (details.zelle) methods.push(`Zelle: ${details.zelle}`);
  return methods.length ? ` You can pay me via ${methods.join(' or ')}.` : '';
}
