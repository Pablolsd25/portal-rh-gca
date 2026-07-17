/** Geocoding (Nominatim) + optimización de paradas (OSRM / nearest-neighbor). */

export type Coord = { lat: number; lng: number };

export type ParadaGps = {
  id: string;
  direccion: string;
  lat?: number | null;
  lng?: number | null;
};

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

function haversineKm(a: Coord, b: Coord): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Geocodifica una dirección en México vía Nominatim (OpenStreetMap). */
export async function geocodeAddress(direccion: string): Promise<Coord | null> {
  const q = direccion.trim();
  if (!q) return null;

  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', q.includes('México') || q.includes('Mexico') ? q : `${q}, México`);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');
  url.searchParams.set('countrycodes', 'mx');

  const res = await fetch(url.toString(), {
    headers: {
      'User-Agent': 'Portal-GCA/1.0 (logistica@castroacero)',
      Accept: 'application/json',
    },
    next: { revalidate: 86400 },
  });

  if (!res.ok) return null;
  const data = (await res.json()) as { lat: string; lon: string }[];
  if (!data?.[0]) return null;
  return { lat: Number(data[0].lat), lng: Number(data[0].lon) };
}

export async function geocodeParadas(paradas: ParadaGps[]): Promise<(ParadaGps & Coord)[]> {
  const out: (ParadaGps & Coord)[] = [];
  for (const p of paradas) {
    if (p.lat != null && p.lng != null && Number.isFinite(p.lat) && Number.isFinite(p.lng)) {
      out.push({ ...p, lat: p.lat, lng: p.lng });
      continue;
    }
    const c = await geocodeAddress(p.direccion);
    if (c) out.push({ ...p, ...c });
    await sleep(1100); // Nominatim: máx ~1 req/s
  }
  return out;
}

/** Nearest-neighbor desde depot (o primera parada). */
export function nearestNeighborOrder(paradas: (ParadaGps & Coord)[], depot?: Coord | null): string[] {
  if (paradas.length === 0) return [];
  const remaining = [...paradas];
  const order: string[] = [];
  let current: Coord = depot ?? remaining[0];

  if (!depot) {
    order.push(remaining[0].id);
    current = remaining[0];
    remaining.splice(0, 1);
  }

  while (remaining.length > 0) {
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineKm(current, remaining[i]);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    const next = remaining.splice(best, 1)[0];
    order.push(next.id);
    current = next;
  }
  return order;
}

/** OSRM Trip API — orden óptimo por calles. Fallback a nearest-neighbor. */
export async function optimizeStopOrder(
  paradas: (ParadaGps & Coord)[],
  depot?: Coord | null,
): Promise<{ order: string[]; method: 'osrm' | 'nearest'; kmAprox?: number }> {
  if (paradas.length <= 1) {
    return { order: paradas.map(p => p.id), method: 'nearest' };
  }

  try {
    const points: Coord[] = depot ? [depot, ...paradas] : [...paradas];
    const coords = points.map(p => `${p.lng},${p.lat}`).join(';');
    const url = new URL(`https://router.project-osrm.org/trip/v1/driving/${coords}`);
    url.searchParams.set('source', depot ? 'first' : 'any');
    url.searchParams.set('destination', 'any');
    url.searchParams.set('roundtrip', 'false');
    url.searchParams.set('overview', 'false');

    const res = await fetch(url.toString(), { next: { revalidate: 0 } });
    if (!res.ok) throw new Error(`OSRM ${res.status}`);
    const data = (await res.json()) as {
      code?: string;
      trips?: { distance: number }[];
      waypoints?: { waypoint_index: number; trips_index: number }[];
    };
    if (data.code !== 'Ok' || !data.waypoints?.length) throw new Error('OSRM sin waypoints');

    // waypoints[i] corresponde a points[i]; ordenar por waypoint_index en el trip
    const indexed = data.waypoints
      .map((wp, i) => ({ i, wp }))
      .filter(x => x.wp.trips_index === 0)
      .sort((a, b) => a.wp.waypoint_index - b.wp.waypoint_index)
      .map(x => x.i);

    const order: string[] = [];
    for (const idx of indexed) {
      if (depot && idx === 0) continue; // punto de partida (bodega)
      const pIdx = depot ? idx - 1 : idx;
      if (pIdx >= 0 && pIdx < paradas.length) order.push(paradas[pIdx].id);
    }

    if (order.length !== paradas.length) throw new Error('OSRM orden incompleto');

    const kmAprox = data.trips?.[0]?.distance != null ? data.trips[0].distance / 1000 : undefined;
    return { order, method: 'osrm', kmAprox };
  } catch {
    return { order: nearestNeighborOrder(paradas, depot), method: 'nearest' };
  }
}

/** Link de Google Maps con el orden de paradas (navegación del chofer). */
export function googleMapsDirectionsUrl(paradas: Coord[], depot?: Coord | null): string {
  if (paradas.length === 0) return 'https://www.google.com/maps';
  const origin = depot ?? paradas[0];
  const dest = paradas[paradas.length - 1];
  const params = new URLSearchParams({
    api: '1',
    origin: `${origin.lat},${origin.lng}`,
    destination: `${dest.lat},${dest.lng}`,
    travelmode: 'driving',
  });
  const mid = depot ? paradas.slice(0, -1) : paradas.slice(1, -1);
  if (mid.length > 0) {
    params.set('waypoints', mid.map(p => `${p.lat},${p.lng}`).join('|'));
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function depotFromEnv(): Coord | null {
  const lat = Number(process.env.NEXT_PUBLIC_DEPOT_LAT);
  const lng = Number(process.env.NEXT_PUBLIC_DEPOT_LNG);
  if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  return null;
}
