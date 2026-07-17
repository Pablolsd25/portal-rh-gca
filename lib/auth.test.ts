import { puedeAccederRuta } from './auth';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

/** Smoke tests — run with: npx tsx lib/auth.test.ts */
assert(
  puedeAccederRuta('vendedor', '/dashboard') === true,
  'vendedor can open /dashboard',
);
assert(
  puedeAccederRuta('vendedor', '/dashboard/aprobacion-pagos') === false,
  'vendedor cannot open aprobacion via /dashboard prefix',
);
assert(
  puedeAccederRuta('vendedor', '/dashboard/cotizaciones') === true,
  'vendedor can open cotizaciones',
);
assert(
  puedeAccederRuta('vendedor', '/dashboard/cotizaciones/x') === true,
  'vendedor can open nested cotizaciones',
);
assert(
  puedeAccederRuta('contabilidad', '/dashboard/creditos') === false,
  'contabilidad cannot open creditos',
);
assert(
  puedeAccederRuta('admin', '/dashboard/reporte-ventas') === true,
  'admin can open reporte ventas',
);
assert(
  puedeAccederRuta('logistica', '/dashboard/rutas') === true,
  'logistica can open rutas',
);
assert(
  puedeAccederRuta('logistica', '/dashboard/nomina') === false,
  'logistica cannot open nomina',
);

console.log('auth path checks OK');
