'use client';

import { useEffect, useRef } from 'react';
import type { Coord } from '@/lib/gps';

export type MarcadorRuta = Coord & {
  orden: number;
  label: string;
  direccion?: string;
};

type Props = {
  paradas: MarcadorRuta[];
  depot?: Coord | null;
  depotLabel?: string;
  className?: string;
};

export default function RutaMapa({ paradas, depot, depotLabel = 'Bodega', className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || paradas.length === 0) return;

    let cancelled = false;
    let map: import('leaflet').Map | null = null;

    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !containerRef.current) return;

      const points: Coord[] = depot ? [depot, ...paradas] : [...paradas];
      const center = points[0];

      map = L.map(containerRef.current).setView([center.lat, center.lng], 12);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 19,
      }).addTo(map);

      const bounds = L.latLngBounds([]);

      if (depot) {
        const m = L.circleMarker([depot.lat, depot.lng], {
          radius: 10,
          color: '#0f172a',
          fillColor: '#334155',
          fillOpacity: 1,
          weight: 2,
        })
          .addTo(map)
          .bindPopup(`<strong>${depotLabel}</strong>`);
        bounds.extend(m.getLatLng());
      }

      for (const p of paradas) {
        const icon = L.divIcon({
          className: '',
          html: `<div style="width:28px;height:28px;border-radius:9999px;background:#059669;color:#fff;display:flex;align-items:center;justify-content:center;font:700 12px/1 system-ui;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)">${p.orden}</div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });
        const m = L.marker([p.lat, p.lng], { icon })
          .addTo(map)
          .bindPopup(
            `<strong>#${p.orden} ${p.label}</strong>${p.direccion ? `<br/><span style="font-size:12px">${p.direccion}</span>` : ''}`,
          );
        bounds.extend(m.getLatLng());
      }

      // Polyline en orden
      const line: [number, number][] = [];
      if (depot) line.push([depot.lat, depot.lng]);
      for (const p of [...paradas].sort((a, b) => a.orden - b.orden)) {
        line.push([p.lat, p.lng]);
      }
      if (line.length >= 2) {
        L.polyline(line, { color: '#059669', weight: 3, opacity: 0.75 }).addTo(map);
      }

      if (bounds.isValid()) {
        map.fitBounds(bounds.pad(0.15));
      }
    })();

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [paradas, depot, depotLabel]);

  if (paradas.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className={className ?? 'h-80 w-full rounded-xl border border-slate-200 overflow-hidden z-0 print:hidden'}
    />
  );
}
