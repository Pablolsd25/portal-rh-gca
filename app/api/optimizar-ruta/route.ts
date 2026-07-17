import { NextResponse } from 'next/server';
import {
  depotFromEnv,
  geocodeParadas,
  optimizeStopOrder,
  type ParadaGps,
} from '@/lib/gps';
import { createClient } from '@/lib/supabase/server';
import { normalizeRole, ROLES_RUTAS } from '@/lib/auth';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** POST { paradas: { id, direccion, lat?, lng? }[] } → orden óptimo + coords */
export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { data: staff } = await supabase
      .from('staff_users')
      .select('role, is_active')
      .eq('id', user.id)
      .single();

    if (!staff?.is_active || !(ROLES_RUTAS as readonly string[]).includes(normalizeRole(staff.role))) {
      return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });
    }

    const body = (await req.json()) as { paradas?: ParadaGps[] };
    const paradas = body.paradas ?? [];
    if (paradas.length === 0) {
      return NextResponse.json({ error: 'Sin paradas' }, { status: 400 });
    }
    if (paradas.length > 25) {
      return NextResponse.json({ error: 'Máximo 25 paradas por optimización' }, { status: 400 });
    }

    const geocoded = await geocodeParadas(paradas);
    if (geocoded.length === 0) {
      return NextResponse.json(
        { error: 'No se pudo geocodificar ninguna dirección. Revisa que tengan colonia y ciudad.' },
        { status: 422 },
      );
    }

    const depot = depotFromEnv();
    const { order, method, kmAprox } = await optimizeStopOrder(geocoded, depot);

    const coordsById = Object.fromEntries(geocoded.map(p => [p.id, { lat: p.lat, lng: p.lng }]));
    const fallidas = paradas.filter(p => !coordsById[p.id]).map(p => p.id);

    return NextResponse.json({
      order,
      method,
      kmAprox,
      coords: coordsById,
      fallidas,
      depot,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error al optimizar ruta' },
      { status: 500 },
    );
  }
}
