import type { CalculateShippingInput, CalculateShippingResult } from '../shared/types';

const BASE_SHIPPING = 5.0;
const PER_UNIT_RATE = 1.5;
const REMOTE_SURCHARGE = 10.0;
const REMOTE_PATTERNS = [/\bAK\b/, /\bHI\b/, /\bPR\b/];

function addBusinessDays(from: Date, days: number): Date {
  const date = new Date(from);
  let added = 0;
  while (added < days) {
    date.setDate(date.getDate() + 1);
    const dow = date.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return date;
}

export async function calculateShippingActivity(
  input: CalculateShippingInput,
): Promise<CalculateShippingResult> {
  const { reservedQuantity, totalAmount, customerAddress } = input;

  let shippingCost = BASE_SHIPPING + PER_UNIT_RATE * reservedQuantity;

  if (REMOTE_PATTERNS.some((p) => p.test(customerAddress.toUpperCase()))) {
    shippingCost += REMOTE_SURCHARGE;
  }

  shippingCost = Math.round(shippingCost * 100) / 100;

  const deliveryDays = Math.floor(Math.random() * 5) + 3;
  const estimatedDelivery = addBusinessDays(new Date(), deliveryDays)
    .toISOString()
    .split('T')[0] as string;

  const finalTotal = Math.round((totalAmount + shippingCost) * 100) / 100;

  return { shippingCost, estimatedDelivery, finalTotal };
}
