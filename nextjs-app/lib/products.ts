export interface Product {
  id: string;
  name: string;
  unitPrice: number;
  stockLabel: string;
}

export const PRODUCTS: Product[] = [
  { id: 'SKU-1001', name: 'Widget', unitPrice: 19.99, stockLabel: 'In Stock' },
  { id: 'SKU-1002', name: 'Gadget', unitPrice: 49.99, stockLabel: 'In Stock' },
  { id: 'SKU-1003', name: 'Gizmo', unitPrice: 9.99, stockLabel: 'In Stock' },
  { id: 'SKU-1004', name: 'Doohickey', unitPrice: 129.0, stockLabel: 'Low Stock' },
  { id: 'SKU-1005', name: 'Thingamajig', unitPrice: 4.5, stockLabel: 'Out of Stock' },
];
