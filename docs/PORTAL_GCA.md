# Portal GCA

Portal integral de Grupo Castro Acero (Next.js + Supabase).

El **portal-staff** (React/Vite) queda **deprecado**: ventas, mostrador, créditos, contabilidad, rutas y RH viven aquí en Portal GCA.

## Roles (`staff_users.role`)

| Rol | Áreas principales |
|-----|-------------------|
| `admin` | Todo |
| `rh` | Empleados, nómina, periodos, bitácora embarques, inventario, rutas |
| `logistica` | Rutas / báscula |
| `vendedor` | Cotizaciones, prospectos, bitácora comercial, frecuentes, precios |
| `venta mostrador` | Venta y caja mostrador (+ módulos de ventas) |
| `contabilidad` | Contabilidad PPD |

## Módulos de ventas

- Cotizaciones / cotizador / aprobación de pagos
- Venta mostrador y caja
- Prospectos, bitácora comercial, clientes frecuentes
- Créditos, clientes, contabilidad PPD
- Reportes de ventas y precios
- Lista de precios, inventario, rutas

## Schemas SQL útiles

Ejecutar en el SQL Editor de Supabase según necesidad:

- `schema_rutas.sql` / `schema_rutas_gps.sql` / `schema_rutas_rls_fix.sql`
- `schema_venta_bascula_trigger.sql` — al concretar venta → `entregas_programadas`
- `schema_entregas_read_ventas.sql` — vendedores pueden ver badge de entrega
- `schema_inventario.sql`, `schema_lista_precios.sql`
