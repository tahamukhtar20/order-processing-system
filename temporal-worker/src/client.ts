import { Client, Connection } from '@temporalio/client';

const TEMPORAL_ADDRESS = process.env['TEMPORAL_ADDRESS'] ?? 'localhost:7233';

export async function getClient(): Promise<Client> {
  const connection = await Connection.connect({ address: TEMPORAL_ADDRESS });
  return new Client({ connection, namespace: 'default' });
}

if (require.main === module) {
  getClient()
    .then(async (client) => {
      console.log('Connected to Temporal at', TEMPORAL_ADDRESS);
      await client.connection.close();
      process.exit(0);
    })
    .catch((err) => {
      console.error('Connection failed:', err);
      process.exit(1);
    });
}
