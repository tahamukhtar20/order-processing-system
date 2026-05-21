import OrderForm from '@/app/components/OrderForm';
import { PRODUCTS } from '@/lib/products';

export default function Home() {
  return (
    <div className="page">
      <header className="bg-white shadow-sm">
        <div className="page-container py-5">
          <h1 className="heading-1">Order Processing System</h1>
          <p className="subtitle mt-1">Powered by Temporal workflows</p>
        </div>
      </header>

      <main className="page-container py-10">
        <div className="card">
          <h2 className="heading-2 mb-6">Place an Order</h2>
          <OrderForm products={PRODUCTS} />
        </div>
      </main>
    </div>
  );
}
