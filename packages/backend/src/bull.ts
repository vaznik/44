import { Queue, Worker } from 'bullmq';
import { env } from './env';
import { redis } from './redis';
import { settleRound, ensureOpenRound } from './services/roomService';

const connection = redis.duplicate();

export const roomQueue = new Queue('room', {
  connection,
  prefix: env.bullPrefix,
});

export function startWorkers() {
  new Worker(
    'room',
    async (job) => {
      const { name, data } = job;
      if (name === 'settle_round') {
        await settleRound(data.roundId);
      }
      if (name === 'ensure_open_round') {
        await ensureOpenRound(data.roomId);
      }
    },
    { connection, prefix: env.bullPrefix },
  );
}
