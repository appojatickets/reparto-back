# ADR 0002: Supabase (no Firebase) como adaptador de salida

Fecha: 2026-10-04 · Estado: aceptada

Cloud Storage for Firebase exige plan Blaze desde febrero de 2026 (rompe «todo gratis») y Firestore no ofrece
SQL, trigramas ni PostGIS. Supabase (Postgres, Auth, Storage) vive solo en `adapters/out`; reemplazable sin tocar el dominio.
