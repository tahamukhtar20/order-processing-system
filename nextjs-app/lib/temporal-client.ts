import { Client, Connection } from '@temporalio/client';

const TEMPORAL_ADDRESS = process.env['TEMPORAL_ADDRESS'] ?? 'localhost:7233';

// Survive Next.js dev HMR by caching on globalThis
const g = globalThis as typeof globalThis & { __temporalClient?: Client };

export async function getTemporalClient(): Promise<Client> {
  if (g.__temporalClient) return g.__temporalClient;
  const connection = await Connection.connect({ address: TEMPORAL_ADDRESS });
  g.__temporalClient = new Client({ connection, namespace: 'default' });
  return g.__temporalClient;
}
