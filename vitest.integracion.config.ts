import { defineConfig } from 'vitest/config';

// Pruebas contra un Postgres real (TEST_DATABASE_URL). Se ejecutan en serie: comparten una base y el reloj importa.
export default defineConfig({
  test: {
    include: ['test/integracion/**/*.test.ts'],
    globalSetup: ['test/integracion/preparar-db.ts'],
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
});
