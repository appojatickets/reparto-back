import { describe, expect, it } from 'vitest';
import { err, ok, type Result } from './result.js';

describe('Result', () => {
  it('ok envuelve el valor', () => {
    const r: Result<number, string> = ok(3);
    expect(r).toEqual({ ok: true, value: 3 });
  });

  it('err envuelve el error', () => {
    const r: Result<number, string> = err('falla');
    expect(r).toEqual({ ok: false, error: 'falla' });
  });
});
