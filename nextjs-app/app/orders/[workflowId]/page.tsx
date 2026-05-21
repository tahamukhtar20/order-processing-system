import Link from 'next/link';
import { notFound } from 'next/navigation';

import OrderStatus from '@/app/components/OrderStatus';
import { getOrderStatus, OrderNotFoundError } from '@/lib/order-status';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { workflowId: string };
  searchParams: { p?: string };
}

export default async function OrderStatusPage({ params, searchParams }: PageProps) {
  let initial;
  try {
    initial = await getOrderStatus(params.workflowId);
  } catch (e) {
    if (e instanceof OrderNotFoundError) notFound();
    throw e;
  }

  return (
    <div className="page">
      <header className="bg-white shadow-sm">
        <div className="page-container py-5">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
            >
              <path
                d="M10 3L5 8l5 5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            New order
          </Link>
          <h1 className="heading-1 mt-2">Order Status</h1>
        </div>
      </header>

      <main className="page-container py-10">
        <div className="card">
          <OrderStatus
            workflowId={params.workflowId}
            initialState={initial}
            productId={searchParams.p ?? '-'}
          />
        </div>
      </main>
    </div>
  );
}
