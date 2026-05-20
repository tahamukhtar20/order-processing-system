export interface Product {
  id: string;
  name: string;
  unitPrice: number;
  stock: number;
}

type InventorySnapshot = Record<string, Omit<Product, 'id'>>;

const INITIAL_STOCK: InventorySnapshot = {
  'SKU-1001': { name: 'Widget', unitPrice: 19.99, stock: 50 },
  'SKU-1002': { name: 'Gadget', unitPrice: 49.99, stock: 10 },
  'SKU-1003': { name: 'Gizmo', unitPrice: 9.99, stock: 200 },
  'SKU-1004': { name: 'Doohickey', unitPrice: 129.0, stock: 3 },
  'SKU-1005': { name: 'Thingamajig', unitPrice: 4.5, stock: 0 },
};

function buildInventory(): Record<string, Product> {
  return Object.fromEntries(
    Object.entries(INITIAL_STOCK).map(([id, data]) => [id, { id, ...data }]),
  );
}

let inventory: Record<string, Product> = buildInventory();

export function getProduct(productId: string): Product | undefined {
  return inventory[productId];
}

export function reserveStock(productId: string, quantity: number): boolean {
  const product = inventory[productId];
  if (!product || product.stock < quantity) return false;
  product.stock -= quantity;
  return true;
}

export function resetInventoryForTesting(): void {
  inventory = buildInventory();
}
