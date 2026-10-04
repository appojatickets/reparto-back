import { writeFileSync } from 'node:fs';
import { buildServer } from '../src/adapters/in/http/server.js';

const app = await buildServer({
  frontOrigin: 'http://localhost',
  checkHealth: () => Promise.resolve({ status: 'ok', database: 'ok', timestamp: new Date(0).toISOString() }),
});
await app.ready();
writeFileSync('openapi.json', `${JSON.stringify(app.swagger(), null, 2)}\n`);
await app.close();
