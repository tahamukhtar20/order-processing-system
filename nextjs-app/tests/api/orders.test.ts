/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';

import { getTemporalClient } from '@/lib/temporal-client';
import { POST } from '../../app/api/orders/route';

jest.mock('@/lib/temporal-client', () => ({ getTemporalClient: jest.fn() }));

const mockGetTemporalClient = getTemporalClient as jest.MockedFunction<typeof getTemporalClient>;

function makePostRequest(body: unknown) {
  return new NextRequest('http://localhost/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const validBody = {
  productId: 'SKU-1001',
  quantity: 2,
  customerId: 'CUST-001',
  customerAddress: '123 Main St, New York, NY 10001',
};

describe('POST /api/orders', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 400 when required fields are missing', async () => {
    const res = await POST(makePostRequest({ productId: 'SKU-1001' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for non-integer quantity', async () => {
    const res = await POST(makePostRequest({ ...validBody, quantity: 1.5 }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for quantity less than 1', async () => {
    const res = await POST(makePostRequest({ ...validBody, quantity: 0 }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid JSON body', async () => {
    const req = new NextRequest('http://localhost/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 201 with workflowId on success', async () => {
    const mockStart = jest.fn().mockResolvedValue(undefined);
    mockGetTemporalClient.mockResolvedValue({
      workflow: { start: mockStart },
    } as never);

    const res = await POST(makePostRequest(validBody));

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.workflowId).toMatch(/^order-CUST-001-\d+$/);
    expect(mockStart).toHaveBeenCalledWith(
      'processOrderWorkflow',
      expect.objectContaining({
        taskQueue: 'order-processing',
        args: [validBody],
      }),
    );
  });

  it('returns 503 when Temporal is unavailable', async () => {
    mockGetTemporalClient.mockRejectedValue(new Error('Connection refused'));

    const res = await POST(makePostRequest(validBody));
    expect(res.status).toBe(503);
  });
});
