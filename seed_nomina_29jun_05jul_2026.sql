-- Importación completa: 26/jun – 02/jul/2026
-- Bitácora desglosada (2as ventas por día + tareas) + nómina (bono, hrs extra, descuentos)
-- Ejecutar en Supabase SQL Editor

INSERT INTO public.empleados (nombre, puesto, sueldo_base_semanal, activo)
SELECT 'TELLEZ FALCON OSIEL', 'Empleado', 1915.28, true
WHERE NOT EXISTS (SELECT 1 FROM public.empleados WHERE upper(trim(nombre)) = 'TELLEZ FALCON OSIEL');

UPDATE public.periodos_nomina SET estado = 'cerrado' WHERE estado = 'abierto';

INSERT INTO public.periodos_nomina (fecha_inicio, fecha_fin, estado)
VALUES ('2026-06-26', '2026-07-02', 'cerrado')
ON CONFLICT (fecha_inicio, fecha_fin) DO UPDATE SET estado = 'cerrado';

DO $$
DECLARE pid uuid;
BEGIN
  SELECT id INTO pid FROM public.periodos_nomina WHERE fecha_inicio = '2026-06-26' AND fecha_fin = '2026-07-02';
  DELETE FROM public.produccion_extra WHERE periodo_id = pid;
  DELETE FROM public.bitacora_embarques WHERE periodo_id = pid;
  DELETE FROM public.bonos_doblado WHERE periodo_id = pid;
  DELETE FROM public.bonos_enderezado WHERE periodo_id = pid;
  DELETE FROM public.bonos_anillos WHERE periodo_id = pid;
  DELETE FROM public.bonos_descargas WHERE periodo_id = pid;
END $$;

INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-06-26', '2as ventas', 168.5, 'Bitácora desglosada'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('ALCANTAR MALDONADO CARLOS ADRIAN'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-06-27', '2as ventas', 72.0, 'Bitácora desglosada'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('ALCANTAR MALDONADO CARLOS ADRIAN'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-06-29', '2as ventas', 128.0, 'Bitácora desglosada'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('ALCANTAR MALDONADO CARLOS ADRIAN'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-06-30', '2as ventas', 518.5, 'Bitácora desglosada'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('ALCANTAR MALDONADO CARLOS ADRIAN'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-07-01', '2as ventas', 131.0, 'Bitácora desglosada'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('ALCANTAR MALDONADO CARLOS ADRIAN'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-07-02', '2as ventas', 50.0, 'Bitácora desglosada'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('ALCANTAR MALDONADO CARLOS ADRIAN'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-07-02', 'Tareas', 200.0, 'Bitácora desglosada'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('ALCANTAR MALDONADO CARLOS ADRIAN'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-06-26', '2as ventas', 120.0, 'Bitácora desglosada'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('ALEMAN TORRES LUIS ANTONIO'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-06-27', '2as ventas', 30.0, 'Bitácora desglosada'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('ALEMAN TORRES LUIS ANTONIO'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-06-29', '2as ventas', 40.0, 'Bitácora desglosada'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('ALEMAN TORRES LUIS ANTONIO'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-06-30', '2as ventas', 425.0, 'Bitácora desglosada'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('ALEMAN TORRES LUIS ANTONIO'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-07-02', '2as ventas', 40.0, 'Bitácora desglosada'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('ALEMAN TORRES LUIS ANTONIO'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-07-02', 'Tareas', 400.0, 'Bitácora desglosada'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('ANTONIO RAMIREZ ANGELICA'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-06-26', '2as ventas', 225.0, 'Bitácora desglosada'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('AVELDHA SANCHEZ JONATHAN ALONSO'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-06-27', '2as ventas', 40.0, 'Bitácora desglosada'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('AVELDHA SANCHEZ JONATHAN ALONSO'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-06-29', '2as ventas', 50.0, 'Bitácora desglosada'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('AVELDHA SANCHEZ JONATHAN ALONSO'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-07-02', '2as ventas', 50.0, 'Bitácora desglosada'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('AVELDHA SANCHEZ JONATHAN ALONSO'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-07-02', 'Tareas', 300.0, 'Bitácora desglosada'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('AVELDHA SANCHEZ JONATHAN ALONSO'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-06-26', '2as ventas', 45.0, 'Bitácora desglosada'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('AVENDAÑO ALEMAN SANTOS'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-06-27', '2as ventas', 30.0, 'Bitácora desglosada'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('AVENDAÑO ALEMAN SANTOS'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-06-30', '2as ventas', 25.0, 'Bitácora desglosada'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('AVENDAÑO ALEMAN SANTOS'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-07-02', '2as ventas', 50.0, 'Bitácora desglosada'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('AVENDAÑO ALEMAN SANTOS'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-07-02', 'Tareas', 100.0, 'Bitácora desglosada'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('AVILA BRAVO ROCIO'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-06-26', '2as ventas', 45.0, 'Bitácora desglosada'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('CAMARGO SOLANO MAURICIO DAVID'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-06-27', '2as ventas', 30.0, 'Bitácora desglosada'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('CAMARGO SOLANO MAURICIO DAVID'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-06-29', '2as ventas', 40.0, 'Bitácora desglosada'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('CAMARGO SOLANO MAURICIO DAVID'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-07-02', '2as ventas', 40.0, 'Bitácora desglosada'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('CAMARGO SOLANO MAURICIO DAVID'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-06-26', '2as ventas', 80.0, 'Bitácora desglosada'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('FRANCO CASTILLO MARIO DE JESUS'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-06-27', '2as ventas', 80.0, 'Bitácora desglosada'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('FRANCO CASTILLO MARIO DE JESUS'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-06-29', '2as ventas', 80.0, 'Bitácora desglosada'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('FRANCO CASTILLO MARIO DE JESUS'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-06-30', '2as ventas', 500.0, 'Bitácora desglosada'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('FRANCO CASTILLO MARIO DE JESUS'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-07-01', '2as ventas', 80.0, 'Bitácora desglosada'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('FRANCO CASTILLO MARIO DE JESUS'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-07-02', '2as ventas', 80.0, 'Bitácora desglosada'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('FRANCO CASTILLO MARIO DE JESUS'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-07-02', 'Tareas', 500.0, 'Bitácora desglosada'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('FRANCO CASTILLO MARIO DE JESUS'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-06-27', '2as ventas', 25.0, 'Bitácora desglosada'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('JIMENEZ JIMENEZ OWEN LISANDRO'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-06-30', '2as ventas', 40.0, 'Bitácora desglosada'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('JIMENEZ JIMENEZ OWEN LISANDRO'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-07-01', '2as ventas', 40.0, 'Bitácora desglosada'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('JIMENEZ JIMENEZ OWEN LISANDRO'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-07-02', 'Tareas', 300.0, 'Bitácora desglosada'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('LOPEZ MARTINEZ SAUL'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-06-26', '2as ventas', 45.0, 'Bitácora desglosada'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('MELENDEZ MEDINA MANUEL ALEXANDER'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-06-27', '2as ventas', 30.0, 'Bitácora desglosada'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('MELENDEZ MEDINA MANUEL ALEXANDER'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-06-29', '2as ventas', 40.0, 'Bitácora desglosada'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('MELENDEZ MEDINA MANUEL ALEXANDER'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-07-02', '2as ventas', 25.0, 'Bitácora desglosada'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('MELENDEZ MEDINA MANUEL ALEXANDER'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-06-26', '2as ventas', 120.0, 'Bitácora desglosada'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('MORALES AGUILAR LUIS ALBERTO'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-06-27', '2as ventas', 30.0, 'Bitácora desglosada'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('MORALES AGUILAR LUIS ALBERTO'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-07-02', '2as ventas', 40.0, 'Bitácora desglosada'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('MORALES AGUILAR LUIS ALBERTO'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-06-26', '2as ventas', 162.0, 'Bitácora desglosada'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('NIEVES RODRIGUEZ JULIO'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-06-27', '2as ventas', 119.5, 'Bitácora desglosada'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('NIEVES RODRIGUEZ JULIO'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-06-29', '2as ventas', 70.5, 'Bitácora desglosada'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('NIEVES RODRIGUEZ JULIO'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-06-30', '2as ventas', 126.5, 'Bitácora desglosada'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('NIEVES RODRIGUEZ JULIO'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-07-01', '2as ventas', 149.0, 'Bitácora desglosada'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('NIEVES RODRIGUEZ JULIO'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-07-02', '2as ventas', 76.0, 'Bitácora desglosada'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('NIEVES RODRIGUEZ JULIO'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-07-02', 'Tareas', 200.0, 'Bitácora desglosada'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('REYES LUNA ROCSANA'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-07-01', '2as ventas', 25.0, 'Bitácora desglosada'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('TELLEZ FALCON OSIEL'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-06-26', '2as ventas', 80.0, 'Bitácora desglosada'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('TORRES ALARCON ANTONIO'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-06-27', '2as ventas', 50.0, 'Bitácora desglosada'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('TORRES ALARCON ANTONIO'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-06-29', '2as ventas', 80.0, 'Bitácora desglosada'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('TORRES ALARCON ANTONIO'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-06-30', '2as ventas', 80.0, 'Bitácora desglosada'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('TORRES ALARCON ANTONIO'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-07-01', '2as ventas', 50.0, 'Bitácora desglosada'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('TORRES ALARCON ANTONIO'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-07-02', '2as ventas', 80.0, 'Bitácora desglosada'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('TORRES ALARCON ANTONIO'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-07-02', 'Tareas', 300.0, 'Bitácora desglosada'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('TORRES ALARCON ANTONIO'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-06-26', '2as ventas', 60.0, 'Bitácora desglosada'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('TORRES ALEMAN GABRIEL'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-06-27', '2as ventas', 40.0, 'Bitácora desglosada'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('TORRES ALEMAN GABRIEL'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-07-01', '2as ventas', 40.0, 'Bitácora desglosada'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('TORRES ALEMAN GABRIEL'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-07-02', '2as ventas', 25.0, 'Bitácora desglosada'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('TORRES ALEMAN GABRIEL'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-07-02', 'Tareas', 200.0, 'Bitácora desglosada'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('VALDERRAMA CASILLAS RAMONA MA DE LA LUZ'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-06-26', '2as ventas', 120.0, 'Bitácora desglosada'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('VAZQUEZ SANDOVAL JUAN PABLO'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-06-27', '2as ventas', 30.0, 'Bitácora desglosada'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('VAZQUEZ SANDOVAL JUAN PABLO'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-06-29', '2as ventas', 25.0, 'Bitácora desglosada'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('VAZQUEZ SANDOVAL JUAN PABLO'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-06-30', '2as ventas', 40.0, 'Bitácora desglosada'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('VAZQUEZ SANDOVAL JUAN PABLO'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-07-02', '2as ventas', 40.0, 'Bitácora desglosada'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('VAZQUEZ SANDOVAL JUAN PABLO'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-07-02', 'Bono', 170.0, 'Nómina resumen'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('ALCANTAR MALDONADO CARLOS ADRIAN'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-07-02', 'Horas extra', 165.0, 'Nómina resumen'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('ALCANTAR MALDONADO CARLOS ADRIAN'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-07-02', 'Bono', 170.0, 'Nómina resumen'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('ALEMAN TORRES LUIS ANTONIO'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-07-02', 'Horas extra', 120.0, 'Nómina resumen'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('ALEMAN TORRES LUIS ANTONIO'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-07-02', 'Bono', 200.0, 'Nómina resumen'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('ANTONIO RAMIREZ ANGELICA'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-07-02', 'Horas extra', 150.0, 'Nómina resumen'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('ANTONIO RAMIREZ ANGELICA'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-07-02', 'Bono', 170.0, 'Nómina resumen'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('AVELDHA SANCHEZ JONATHAN ALONSO'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-07-02', 'Horas extra', 120.0, 'Nómina resumen'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('AVELDHA SANCHEZ JONATHAN ALONSO'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-07-02', 'Bono', 220.0, 'Nómina resumen'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('AVENDAÑO ALEMAN SANTOS'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-07-02', 'Horas extra', 245.0, 'Nómina resumen'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('AVENDAÑO ALEMAN SANTOS'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-07-02', 'Horas extra', 150.0, 'Nómina resumen'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('AVILA BRAVO ROCIO'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-07-02', 'Días no trabajados', -271.43, 'Nómina resumen'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('AVILA BRAVO ROCIO'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-07-02', 'Bono', 170.0, 'Nómina resumen'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('CAMARGO SOLANO MAURICIO DAVID'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-07-02', 'Horas extra', 120.0, 'Nómina resumen'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('CAMARGO SOLANO MAURICIO DAVID'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-07-02', 'Bono', 170.0, 'Nómina resumen'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('CONTRERAS CISNEROS BRENDA JAZMIN'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-07-02', 'Horas extra', 120.0, 'Nómina resumen'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('CONTRERAS CISNEROS BRENDA JAZMIN'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-07-02', 'Bono', 210.0, 'Nómina resumen'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('FRANCO CASTILLO MARIO DE JESUS'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-07-02', 'Horas extra', 280.0, 'Nómina resumen'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('FRANCO CASTILLO MARIO DE JESUS'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-07-02', 'Bono', 200.0, 'Nómina resumen'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('HERNANDEZ MORENO ELIZABETH'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-07-02', 'Horas extra', 150.0, 'Nómina resumen'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('HERNANDEZ MORENO ELIZABETH'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-07-02', 'Bono', 170.0, 'Nómina resumen'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('HERNANDEZ PEÑA FERNANDO ANGEL'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-07-02', 'Horas extra', 250.0, 'Nómina resumen'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('HERNANDEZ PEÑA FERNANDO ANGEL'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-07-02', 'INFONAVIT', -644.4, 'Nómina resumen'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('HERNANDEZ PEÑA FERNANDO ANGEL'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-07-02', 'Bono', 170.0, 'Nómina resumen'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('JIMENEZ JIMENEZ OWEN LISANDRO'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-07-02', 'Horas extra', 120.0, 'Nómina resumen'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('JIMENEZ JIMENEZ OWEN LISANDRO'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-07-02', 'Bono', 200.0, 'Nómina resumen'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('LOPEZ MARTINEZ SAUL'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-07-02', 'Horas extra', 350.0, 'Nómina resumen'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('LOPEZ MARTINEZ SAUL'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-07-02', 'Horas extra', 120.0, 'Nómina resumen'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('MELENDEZ MEDINA MANUEL ALEXANDER'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-07-02', 'Días no trabajados', -290.75, 'Nómina resumen'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('MELENDEZ MEDINA MANUEL ALEXANDER'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-07-02', 'Bono', 170.0, 'Nómina resumen'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('MORALES AGUILAR LUIS ALBERTO'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-07-02', 'Horas extra', 120.0, 'Nómina resumen'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('MORALES AGUILAR LUIS ALBERTO'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-07-02', 'Horas extra', 120.0, 'Nómina resumen'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('NIEVES RODRIGUEZ JULIO'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-07-02', 'Vacaciones', 72.69, 'Nómina resumen'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('NIEVES RODRIGUEZ JULIO'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-07-02', 'Bono', 170.0, 'Nómina resumen'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('PACHECO GUZMAN YESENIA'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-07-02', 'Bono', 170.0, 'Nómina resumen'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('REYES LUNA ROCSANA'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-07-02', 'Horas extra', 175.0, 'Nómina resumen'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('REYES LUNA ROCSANA'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-07-02', 'Bono', 170.0, 'Nómina resumen'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('RODRIGUEZ SANTIAGO MARIA DOLORES'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-07-02', 'Horas extra', 120.0, 'Nómina resumen'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('RODRIGUEZ SANTIAGO MARIA DOLORES'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-07-02', 'Bono', 200.0, 'Nómina resumen'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('SANCHEZ ROMERO HUMBERTO'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-07-02', 'Horas extra', 150.0, 'Nómina resumen'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('SANCHEZ ROMERO HUMBERTO'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-07-02', 'Bono', 200.0, 'Nómina resumen'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('TALONIA MARTINEZ JOSE PABLO'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-07-02', 'Horas extra', 150.0, 'Nómina resumen'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('TALONIA MARTINEZ JOSE PABLO'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-07-02', 'INFONAVIT', -713.1, 'Nómina resumen'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('TALONIA MARTINEZ JOSE PABLO'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-07-02', 'Horas extra', 120.0, 'Nómina resumen'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('TELLEZ FALCON OSIEL'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-07-02', 'Días no trabajados', -290.75, 'Nómina resumen'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('TELLEZ FALCON OSIEL'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-07-02', 'Bono', 170.0, 'Nómina resumen'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('TORRES ALARCON ANTONIO'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-07-02', 'Horas extra', 300.0, 'Nómina resumen'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('TORRES ALARCON ANTONIO'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-07-02', 'INFONAVIT', -735.36, 'Nómina resumen'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('TORRES ALARCON ANTONIO'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-07-02', 'Horas extra', 120.0, 'Nómina resumen'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('TORRES ALEMAN GABRIEL'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-07-02', 'Días no trabajados', -581.51, 'Nómina resumen'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('TORRES ALEMAN GABRIEL'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-07-02', 'Bono', 170.0, 'Nómina resumen'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('VALDERRAMA CASILLAS RAMONA MA DE LA LUZ'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-07-02', 'Horas extra', 250.0, 'Nómina resumen'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('VALDERRAMA CASILLAS RAMONA MA DE LA LUZ'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-07-02', 'Horas extra', 120.0, 'Nómina resumen'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('VAZQUEZ SANDOVAL JUAN PABLO'));
INSERT INTO public.produccion_extra (periodo_id, empleado_id, fecha, concepto, importe, observaciones)
SELECT p.id, e.id, '2026-07-02', 'Días no trabajados', -290.75, 'Nómina resumen'
FROM public.periodos_nomina p, public.empleados e
WHERE p.fecha_inicio = '2026-06-26' AND p.fecha_fin = '2026-07-02'
  AND upper(trim(e.nombre)) = upper(trim('VAZQUEZ SANDOVAL JUAN PABLO'));

SELECT e.nombre, count(*) registros, sum(pe.importe) variable
FROM public.produccion_extra pe
JOIN public.empleados e ON e.id = pe.empleado_id
JOIN public.periodos_nomina p ON p.id = pe.periodo_id
WHERE p.fecha_inicio = '2026-06-26'
GROUP BY e.nombre ORDER BY e.nombre;
