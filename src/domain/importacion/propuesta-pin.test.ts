import { describe, expect, it } from 'vitest';
import { distanciaMetros } from './propuesta-pin.js';

describe('distanciaMetros', () => {
  it('mide en metros', () => {
    const d = distanciaMetros({ lat: -33.4372, lng: -70.6506 }, { lat: -33.4372, lng: -70.6496 });
    expect(d).toBeGreaterThan(85);
    expect(d).toBeLessThan(95);
  });
});
