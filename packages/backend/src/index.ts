import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';
import { env } from './env';
import { registerRoutes } from './routes';
import { startWorkers } from './bull';
import { prisma } from './prisma';
import { jsonSafe } from './utils/jsonSafe';

async function main() {
  const app = Fastify({ logger: true });

  // Make Prisma BigInt fields JSON-serializable (Telegram IDs, etc.)
  app.addHook('preSerialization', async (_req, _reply, payload) => jsonSafe(payload));

  await app.register(helmet);
  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      const ok = env.corsOrigins.some((o) => o === origin || (o.includes('*') && origin.endsWith(o.replace('*', ''))));
      cb(null, ok);
    },
    credentials: true,
  });
  await app.register(rateLimit, { max: env.rateLimitMax, timeWindow: env.rateLimitWindowMs });

  await app.register(swagger, {
    openapi: { info: { title: 'tgcasino backend', version: '0.1.0' } },
  });
  await app.register(swaggerUI, { routePrefix: '/docs' });

  // fastify-sensible for httpErrors without extra dep: minimal
  app.decorate('httpErrors', {
    badRequest: (m: string) => Object.assign(new Error(m), { statusCode: 400 }),
    unauthorized: (m: string) => Object.assign(new Error(m), { statusCode: 401 }),
    notFound: (m: string) => Object.assign(new Error(m), { statusCode: 404 }),
  });

  app.setErrorHandler((err: any, req: any, res: any) => {
    const code = err.statusCode ?? 500;
    req.log.error(err);
    res.status(code).send({ ok: false, error: err.message ?? 'error', code });
  });

  await registerRoutes(app);

  startWorkers();

  await app.listen({ port: env.backendPort, host: env.backendHost });
}

main().catch(async (e) => {
  console.error(e);
  try { await prisma.$disconnect(); } catch {}
  process.exit(1);
});
