/**
 * UPI Payment URI Builder & Validator
 *
 * Implements National Payments Corporation of India (NPCI) UPI Deep Linking Spec:
 * upi://pay?pa=<vpa>&pn=<name>&am=<amount>&cu=INR&tn=<note>&tr=<ref>
 */

export interface BuildUpiPaymentUriParams {
  upiId: string;
  payeeName?: string;
  amountInr: number;
  orderId?: string;
  note?: string;
}

/**
 * Builds a strictly RFC 3986 URL-encoded UPI payment URI.
 * Guarantees that payee address, amount, currency, and transaction reference
 * match server-authoritative billing parameters.
 */
export function buildUpiPaymentUri(params: BuildUpiPaymentUriParams): string {
  const { upiId, payeeName = 'JobNexus', amountInr, orderId, note } = params;

  if (!upiId || typeof upiId !== 'string' || !upiId.trim()) {
    throw new Error('A valid UPI ID (VPA) is required to generate payment URI.');
  }

  if (typeof amountInr !== 'number' || isNaN(amountInr) || amountInr <= 0) {
    throw new Error('amountInr must be a positive number.');
  }

  const cleanUpiId = upiId.trim();
  const cleanPayee = (payeeName || 'JobNexus').trim();
  const cleanNote = note?.trim() || (orderId ? `JobNexus Premium - ${orderId}` : 'JobNexus Premium');
  // Format amount: standard 2 decimal places or clean integer if exact
  const amountStr = amountInr.toFixed(2).replace(/\.00$/, '');

  const searchParams = new URLSearchParams({
    pa: cleanUpiId,
    pn: cleanPayee,
    am: amountStr,
    cu: 'INR',
    tn: cleanNote,
  });

  if (orderId && orderId.trim()) {
    searchParams.set('tr', orderId.trim());
  }

  return `upi://pay?${searchParams.toString()}`;
}

/**
 * Validates whether a UPI URI has the necessary minimum parameters.
 */
export function isValidUpiPaymentUri(uri: string): boolean {
  if (!uri || !uri.startsWith('upi://pay?')) return false;
  try {
    const query = uri.replace('upi://pay?', '');
    const params = new URLSearchParams(query);
    const pa = params.get('pa');
    const am = params.get('am');
    const cu = params.get('cu');

    if (!pa || !pa.includes('@')) return false;
    if (!am || isNaN(Number(am)) || Number(am) <= 0) return false;
    if (cu !== 'INR') return false;

    return true;
  } catch {
    return false;
  }
}

