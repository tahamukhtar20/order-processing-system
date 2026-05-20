export interface Product {
  id: string;
  name: string;
  unitPrice: number;
  stock: number;
}

// simulates a database for demo purposes.
const INVENTORY: Record<string, Product> = {
  'SKU-1001': { id: 'SKU-1001', name: 'Widget', unitPrice: 19.99, stock: 50 },
  'SKU-1002': { id: 'SKU-1002', name: 'Gadget', unitPrice: 49.99, stock: 10 },
  'SKU-1003': { id: 'SKU-1003', name: 'Gizmo', unitPrice: 9.99, stock: 200 },
  'SKU-1004': { id: 'SKU-1004', name: 'Doohickey', unitPrice: 129.0, stock: 3 },
  'SKU-1005': { id: 'SKU-1005', name: 'Thingamajig', unitPrice: 4.5, stock: 0 },
};

export function getProduct(productId: string): Product | undefined {
  return INVENTORY[productId];
}

export function reserveStock(productId: string, quantity: number): boolean {
  const product = INVENTORY[productId];
  if (!product || product.stock < quantity) return false;
  product.stock -= quantity;
  return true;
}

export { INVENTORY };
