import { memo } from 'react';

interface Props {
  errorType?: string;
  error?: string;
  phase?: string;
}

const FRIENDLY_MESSAGES: Record<string, string> = {
  InventoryUnavailable: "Sorry, that quantity isn't available in stock.",
  PaymentDeclined: 'Your payment was declined. Please try a different method.',
  UnknownProduct: 'The selected product could not be found.',
  InvalidInput: 'The order details look invalid. Please review and try again.',
  TIMED_OUT: 'The order timed out. Please try again.',
};

function ErrorBanner({ errorType, error, phase }: Props) {
  const isCancelled = phase === 'cancelled';
  const headline = isCancelled
    ? 'Order Cancelled'
    : (errorType && FRIENDLY_MESSAGES[errorType]) || 'The order could not be completed.';
  const detail = isCancelled ? 'This order was cancelled before it could complete.' : error;

  return (
    <div
      className={isCancelled ? 'alert alert-warning' : 'alert alert-error'}
      role="alert"
      aria-live="polite"
    >
      <p className="font-semibold">{headline}</p>
      {detail && <p className="mt-1 text-xs opacity-80">{detail}</p>}
    </div>
  );
}

export default memo(ErrorBanner);
