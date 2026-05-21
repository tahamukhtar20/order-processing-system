export default function OrderStatusPage({ params }: { params: { workflowId: string } }) {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <p className="text-gray-500">Loading order {params.workflowId}…</p>
    </div>
  );
}
