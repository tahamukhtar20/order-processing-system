export interface CheckInventoryInput {
  productId: string;
  quantity: number;
}

export interface CheckInventoryResult {
  available: boolean;
  reservedQuantity: number;
  unitPrice: number;
}

export interface ProcessPaymentInput {
  reservedQuantity: number;
  unitPrice: number;
  customerId: string;
}

export interface ProcessPaymentResult {
  paymentSuccessful: boolean;
  transactionId: string;
  totalAmount: number;
}

export interface CalculateShippingInput {
  reservedQuantity: number;
  totalAmount: number;
  customerAddress: string;
}

export interface CalculateShippingResult {
  shippingCost: number;
  estimatedDelivery: string;
  finalTotal: number;
}

// ─── Workflow I/O ─────────────────────────────────────────────────────────────

export interface ProcessOrderInput {
  productId: string;
  quantity: number;
  customerId: string;
  customerAddress: string;
}

export interface ProcessOrderResult {
  inventory: CheckInventoryResult;
  payment: ProcessPaymentResult;
  shipping: CalculateShippingResult;
}

export type WorkflowPhase =
  | 'pending'
  | 'checking-inventory'
  | 'processing-payment'
  | 'calculating-shipping'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface WorkflowStatus {
  phase: WorkflowPhase;
  progress: number;
  inventory?: CheckInventoryResult;
  payment?: ProcessPaymentResult;
  shipping?: CalculateShippingResult;
  error?: string;
}
