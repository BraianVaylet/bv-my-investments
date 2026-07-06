import './env';
import { buildApp } from './app';
import { config } from './config';
import { connectDb } from './db';
import { seedMasters } from './modules/masters/routes';
import { scheduleSnapshotJob } from './modules/snapshots/service';

async function main() {
  await connectDb();
  await seedMasters();
  const app = await buildApp();
  scheduleSnapshotJob((msg) => app.log.info(msg));
  await app.listen({ port: config.port, host: '0.0.0.0' });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
