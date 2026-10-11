#!/usr/bin/env node
// Revisa los archivos que Git sigue (los que se publican) en busca de claves, contraseñas y datos personales reales.
// El repositorio es público: si algo de esto aparece, NO se debe subir. Uso: node scripts/revisar-secretos.mjs
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';

/** Cada regla: nombre, patrón y, si hace falta, valores de ejemplo que sí se permiten. */
const REGLAS = [
  { nombre: 'clave privada', patron: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { nombre: 'token JWT (clave de Supabase u otra)', patron: /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/ },
  { nombre: 'clave secreta de Supabase', patron: /\bsb_secret_[A-Za-z0-9_-]{16,}/ },
  { nombre: 'clave de OpenRouteService', patron: /\b5b3ce3597851110001cf[0-9a-f]{20,}/ },
  { nombre: 'token de GitHub', patron: /\b(ghp_|gho_|ghs_|github_pat_)[A-Za-z0-9_]{20,}/ },
  { nombre: 'clave de AWS', patron: /\bAKIA[0-9A-Z]{16}\b/ },
  { nombre: 'clave tipo sk-', patron: /\bsk-[A-Za-z0-9]{24,}/ },
  {
    nombre: 'URL de base de datos con contraseña',
    patron: /postgres(?:ql)?:\/\/[^\s:@/'"`]+:([^\s@/'"`]+)@/,
    // Marcadores de ejemplo y datos de pruebas locales.
    permitidos: [/^PASSWORD$/, /^LA_NUEVA_CLAVE$/, /^postgres$/, /^p$/, /^pass(word)?$/i, /^TU_CLAVE/, /^<.*>$/, /^\$\{/, /^\*+$/],
  },
  {
    nombre: 'celular chileno real (usa uno de ejemplo: 9 1234 5678)',
    patron: /(?<![0-9])(?:\+?56 ?)?9[ -]?([0-9]{4})[ -]?([0-9]{4})(?![0-9])/,
    permitidos: [/^12345678$/, /^87654321$/, /^11112222$/, /^98765432$/, /^00000000$/, /^11111111$/, /^22223333$/],
    // el grupo capturado es la parte final de 8 dígitos
    valor: (m) => `${m[1]}${m[2]}`,
  },
];

/** Archivos que no se revisan: dependencias, binarios y este mismo script. */
const IGNORAR = [/(^|\/)package-lock\.json$/, /\.(png|jpe?g|webp|ico|svg|woff2?|pdf)$/i, /(^|\/)scripts\/revisar-secretos\.mjs$/, /(^|\/)schema\.d\.ts$/, /(^|\/)openapi(\/openapi)?\.json$/];

const archivos = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter((f) => f !== '' && !IGNORAR.some((r) => r.test(f)));
const hallazgos = [];
for (const f of archivos) {
  let texto;
  try {
    if (statSync(f).size > 2_000_000) continue;
    texto = readFileSync(f, 'utf8');
  } catch {
    continue;
  }
  texto.split('\n').forEach((linea, i) => {
    for (const r of REGLAS) {
      const m = r.patron.exec(linea);
      if (!m) continue;
      const v = r.valor ? r.valor(m) : (m[1] ?? m[0]);
      if (r.permitidos?.some((p) => p.test(v))) continue;
      hallazgos.push(`${f}:${i + 1}  ${r.nombre}`);
    }
  });
}

if (hallazgos.length > 0) {
  console.error('✖ Posibles secretos o datos personales en archivos que se publicarían:\n' + hallazgos.map((h) => `  ${h}`).join('\n'));
  console.error('\nQuita el dato (usa uno de ejemplo) y vuelve a correr. Nunca subas claves ni datos reales de clientes o choferes.');
  process.exit(1);
}
console.log(`✔ Sin secretos ni datos personales evidentes (${archivos.length} archivos revisados).`);
