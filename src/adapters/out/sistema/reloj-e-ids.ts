import { randomUUID } from 'node:crypto';
import type { Clock } from '../../../application/ports/out/clock.js';
import type { IdGenerator } from '../../../application/ports/out/id-generator.js';

export const relojDelSistema: Clock = { now: () => new Date() };
export const generadorDeIds: IdGenerator = { uuid: () => randomUUID() };
