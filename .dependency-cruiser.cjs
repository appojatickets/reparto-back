/** Regla de dependencias: domain <- application <- adapters <- main. */
module.exports = {
  forbidden: [
    {
      name: 'domain-puro',
      comment: 'domain no importa nada fuera de domain ni librerías externas.',
      severity: 'error',
      from: { path: '^src/domain' },
      to: { pathNot: '^src/domain', dependencyTypesNot: ['type-only'] },
    },
    {
      name: 'domain-sin-npm',
      severity: 'error',
      from: { path: '^src/domain' },
      to: { dependencyTypes: ['npm', 'npm-dev', 'npm-peer', 'npm-optional', 'core'] },
    },
    {
      name: 'application-solo-domain',
      comment: 'application solo importa de domain y de sí misma, sin librerías.',
      severity: 'error',
      from: { path: '^src/application' },
      to: {
        pathNot: '^src/(domain|application)',
        dependencyTypesNot: ['type-only'],
      },
    },
    {
      name: 'application-sin-npm',
      severity: 'error',
      from: { path: '^src/application' },
      to: { dependencyTypes: ['npm', 'npm-dev', 'npm-peer', 'npm-optional', 'core'] },
    },
    {
      name: 'adapters-no-importan-main',
      severity: 'error',
      from: { path: '^src/adapters' },
      to: { path: '^src/main' },
    },
    {
      name: 'adapters-no-se-importan-entre-si',
      comment: 'Un adaptador no depende de otro adaptador (salvo de sí mismo).',
      severity: 'error',
      from: { path: '^src/adapters/([^/]+/[^/]+)/' },
      to: { path: '^src/adapters/', pathNot: '^src/adapters/$1/' },
    },
    {
      name: 'config-no-importa-adapters',
      severity: 'error',
      from: { path: '^src/config' },
      to: { path: '^src/(adapters|application|main)' },
    },
    {
      name: 'zod-solo-en-entrada',
      comment: 'zod solo en adaptadores de entrada y config.',
      severity: 'error',
      from: { pathNot: '^src/(adapters/in|config)' },
      to: { path: 'node_modules/zod' },
    },
    {
      name: 'sin-circulares',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    tsConfig: { fileName: 'tsconfig.json' },
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '\\.test\\.ts$' },
    moduleSystems: ['es6', 'cjs'],
  },
};
