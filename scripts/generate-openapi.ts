import { writeFileSync } from 'node:fs';
import { buildServer } from '../src/adapters/in/http/server.js';
import { casosVacios } from '../src/adapters/in/http/casos-vacios.js';

const app = await buildServer({ frontOrigin: 'http://localhost', casos: casosVacios() });
await app.ready();
writeFileSync('openapi.json', `${JSON.stringify(app.swagger(), null, 2)}\n`);
await app.close();
