import { NativeConnection, Worker } from '@temporalio/worker';

const TASK_QUEUE = 'order-processing';
const TEMPORAL_ADDRESS = process.env['TEMPORAL_ADDRESS'] ?? 'localhost:7233';

async function run(): Promise<void> {
  const connection = await NativeConnection.connect({ address: TEMPORAL_ADDRESS });

  const worker = await Worker.create({
    connection,
    namespace: 'default',
    taskQueue: TASK_QUEUE,
  });

  console.log(`Worker started, polling '${TASK_QUEUE}' on ${TEMPORAL_ADDRESS}`);
  await worker.run();
}

run().catch((err) => {
  console.error('Worker failed to start:', err);
  process.exit(1);
});
