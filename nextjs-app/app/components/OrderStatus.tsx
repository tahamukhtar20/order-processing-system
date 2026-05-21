'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { formatCurrency } from '@/lib/format';
import type { OrderStatusData } from '@/lib/order-status';
import type {
  CalculateShippingResult,
  CheckInventoryResult,
  ProcessPaymentResult,
} from '@worker-types';

import ActivityCard, { type ActivityState } from './ActivityCard';
import ErrorBanner from './ErrorBanner';
import OrderSummary from './OrderSummary';

const POLL_INTERVAL_MS = 1000;
const TERMINAL_STATUSES = new Set(['COMPLETED', 'FAILED', 'TIMED_OUT']);

interface Props {
  workflowId: string;
  initialState: OrderStatusData;
  productId: string;
}

type DerivedActivities = {
  inventory: { state: ActivityState; data?: CheckInventoryResult };
  payment: { state: ActivityState; data?: ProcessPaymentResult };
  shipping: { state: ActivityState; data?: CalculateShippingResult };
};

function deriveActivities(status: OrderStatusData): DerivedActivities {
  if (status.status === 'RUNNING') {
    return {
      inventory: {
        state: status.inventory
          ? 'done'
          : status.phase === 'checking-inventory'
            ? 'active'
            : 'pending',
        data: status.inventory,
      },
      payment: {
        state: status.payment
          ? 'done'
          : status.phase === 'processing-payment'
            ? 'active'
            : 'pending',
        data: status.payment,
      },
      shipping: {
        state: status.shipping
          ? 'done'
          : status.phase === 'calculating-shipping'
            ? 'active'
            : 'pending',
        data: status.shipping,
      },
    };
  }

  if (status.status === 'COMPLETED') {
    const { result } = status;
    if ('cancelled' in result) {
      return {
        inventory: { state: 'skipped' },
        payment: { state: 'skipped' },
        shipping: { state: 'skipped' },
      };
    }
    return {
      inventory: { state: 'done', data: result.inventory },
      payment: { state: 'done', data: result.payment },
      shipping: { state: 'done', data: result.shipping },
    };
  }

  // FAILED / TIMED_OUT - derive from errorType
  switch (status.errorType) {
    case 'InventoryUnavailable':
    case 'UnknownProduct':
    case 'InvalidInput':
      return {
        inventory: { state: 'failed' },
        payment: { state: 'skipped' },
        shipping: { state: 'skipped' },
      };
    case 'PaymentDeclined':
      return {
        inventory: { state: 'done' },
        payment: { state: 'failed' },
        shipping: { state: 'skipped' },
      };
    default:
      return {
        inventory: { state: 'skipped' },
        payment: { state: 'skipped' },
        shipping: { state: 'skipped' },
      };
  }
}

function statusBadgeClass(status: OrderStatusData): string {
  if (status.status === 'RUNNING') return 'badge badge-running';
  if (status.status === 'COMPLETED' && status.phase === 'cancelled') return 'badge badge-cancelled';
  if (status.status === 'COMPLETED') return 'badge badge-completed';
  return 'badge badge-failed';
}

function statusBadgeLabel(status: OrderStatusData): string {
  if (status.status === 'RUNNING') return 'Running';
  if (status.status === 'COMPLETED' && status.phase === 'cancelled') return 'Cancelled';
  if (status.status === 'COMPLETED') return 'Completed';
  if (status.status === 'TIMED_OUT') return 'Timed Out';
  return 'Failed';
}

export default function OrderStatus({ workflowId, initialState, productId }: Props) {
  const [state, setState] = useState<OrderStatusData>(initialState);
  const [cancelling, setCancelling] = useState(false);
  const [pollError, setPollError] = useState(false);

  useEffect(() => {
    if (TERMINAL_STATUSES.has(state.status)) return;

    let cancelled = false;
    const id = setInterval(async () => {
      try {
        const res = await fetch(`/api/orders/${workflowId}`);
        if (!res.ok) {
          if (!cancelled) setPollError(true);
          return;
        }
        const data = (await res.json()) as OrderStatusData;
        if (!cancelled) {
          setState(data);
          setPollError(false);
        }
      } catch {
        if (!cancelled) setPollError(true);
      }
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [state.status, workflowId]);

  const handleCancel = useCallback(async () => {
    setCancelling(true);
    try {
      await fetch(`/api/orders/${workflowId}/cancel`, { method: 'POST' });
    } finally {
      setCancelling(false);
    }
  }, [workflowId]);

  const activities = useMemo(() => deriveActivities(state), [state]);
  const isRunning = state.status === 'RUNNING';

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <p className="muted">Order {workflowId}</p>
          <span className={statusBadgeClass(state)}>{statusBadgeLabel(state)}</span>
        </div>
        {isRunning && (
          <button
            type="button"
            onClick={handleCancel}
            disabled={cancelling}
            className="btn btn-secondary"
          >
            {cancelling ? 'Cancelling...' : 'Cancel order'}
          </button>
        )}
      </header>

      {pollError && (
        <div className="alert alert-warning" role="status">
          Connection to the server was lost. Retrying...
        </div>
      )}

      <div className="space-y-3">
        <ActivityCard title="Check Inventory" state={activities.inventory.state}>
          {activities.inventory.data && (
            <p className="muted">
              Reserved {activities.inventory.data.reservedQuantity} x{' '}
              {formatCurrency(activities.inventory.data.unitPrice)}
            </p>
          )}
        </ActivityCard>

        <ActivityCard title="Process Payment" state={activities.payment.state}>
          {activities.payment.data && (
            <>
              <p className="muted">Charged {formatCurrency(activities.payment.data.totalAmount)}</p>
              {activities.payment.data.transactionId && (
                <p className="muted">Transaction: {activities.payment.data.transactionId}</p>
              )}
            </>
          )}
        </ActivityCard>

        <ActivityCard title="Calculate Shipping" state={activities.shipping.state}>
          {activities.shipping.data && (
            <p className="muted">
              Shipping {formatCurrency(activities.shipping.data.shippingCost)} / Final{' '}
              {formatCurrency(activities.shipping.data.finalTotal)}
            </p>
          )}
        </ActivityCard>
      </div>

      {state.status === 'COMPLETED' && !('cancelled' in state.result) && (
        <OrderSummary
          productId={productId}
          inventory={state.result.inventory}
          payment={state.result.payment}
          shipping={state.result.shipping}
        />
      )}

      {(state.status === 'FAILED' || state.status === 'TIMED_OUT') && (
        <ErrorBanner
          errorType={state.status === 'TIMED_OUT' ? 'TIMED_OUT' : state.errorType}
          error={state.error}
        />
      )}

      {state.status === 'COMPLETED' && 'cancelled' in state.result && (
        <ErrorBanner phase="cancelled" />
      )}
    </div>
  );
}
