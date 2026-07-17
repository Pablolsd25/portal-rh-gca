'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  actualizarProducto,
  crearProducto,
  registrarMovimiento,
  type MovimientoInventario,
  type Producto,
} from '@/lib/inventario';

type Props = {
  userId: string;
  productos: Producto[];
  movimientos: MovimientoInventario[];
};

function fmtStock(n: number, unidad: string) {
  const s = Number.isInteger(n) ? String(n) : n.toLocaleString('es-MX', { maximumFractionDigits: 2 });
  return `${s} ${unidad}`;
}

export default function InventarioClient({ userId, productos, movimientos }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<'productos' | 'movimientos'>('productos');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [nuevo, setNuevo] = useState({ nombre: '', sku: '', unidad: 'pza', stock: '', stock_minimo: '0' });
  const [showNuevo, setShowNuevo] = useState(false);

  const [mov, setMov] = useState({
    producto_id: '',
    tipo: 'entrada' as 'entrada' | 'salida' | 'ajuste',
    cantidad: '',
    referencia: '',
    notas: '',
  });
  const [showMov, setShowMov] = useState(false);

  const bajos = productos.filter(p => p.activo && p.stock <= p.stock_minimo);

  const guardarProducto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevo.nombre.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      await crearProducto(supabase, {
        nombre: nuevo.nombre,
        sku: nuevo.sku || undefined,
        unidad: nuevo.unidad || 'pza',
        stock: Number(nuevo.stock) || 0,
        stock_minimo: Number(nuevo.stock_minimo) || 0,
      });
      setNuevo({ nombre: '', sku: '', unidad: 'pza', stock: '', stock_minimo: '0' });
      setShowNuevo(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear');
    } finally {
      setLoading(false);
    }
  };

  const guardarMovimiento = async (e: React.FormEvent) => {
    e.preventDefault();
    const cantidad = Number(mov.cantidad);
    if (!mov.producto_id || !(cantidad > 0 || (mov.tipo === 'ajuste' && cantidad >= 0))) {
      setError('Completa producto y cantidad');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      await registrarMovimiento(supabase, {
        producto_id: mov.producto_id,
        tipo: mov.tipo,
        cantidad: mov.tipo === 'ajuste' ? cantidad : cantidad,
        referencia: mov.referencia || undefined,
        notas: mov.notas || undefined,
        userId,
      });
      setMov({ producto_id: '', tipo: 'entrada', cantidad: '', referencia: '', notas: '' });
      setShowMov(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar');
    } finally {
      setLoading(false);
    }
  };

  const toggleActivo = async (p: Producto) => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      await actualizarProducto(supabase, p.id, { activo: !p.activo });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-700">{error}</div>
      )}

      {bajos.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-900">
          <p className="font-medium">Stock bajo ({bajos.length})</p>
          <p className="mt-1 text-amber-800">
            {bajos
              .slice(0, 6)
              .map(p => `${p.nombre} (${fmtStock(p.stock, p.unidad)})`)
              .join(' · ')}
            {bajos.length > 6 ? '…' : ''}
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
          <button
            onClick={() => setTab('productos')}
            className={`px-4 py-2 text-sm font-medium rounded-md ${
              tab === 'productos' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600'
            }`}
          >
            Productos
          </button>
          <button
            onClick={() => setTab('movimientos')}
            className={`px-4 py-2 text-sm font-medium rounded-md ${
              tab === 'movimientos' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600'
            }`}
          >
            Movimientos
          </button>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setShowMov(true);
              setShowNuevo(false);
            }}
            className="px-3 py-2 border border-slate-300 text-sm rounded-lg hover:bg-slate-50"
          >
            Entrada / salida
          </button>
          <button
            onClick={() => {
              setShowNuevo(true);
              setShowMov(false);
            }}
            className="px-3 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700"
          >
            Nuevo producto
          </button>
        </div>
      </div>

      {showNuevo && (
        <form onSubmit={guardarProducto} className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          <p className="font-medium text-slate-800">Nuevo producto</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              required
              placeholder="Nombre *"
              value={nuevo.nombre}
              onChange={e => setNuevo({ ...nuevo, nombre: e.target.value })}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900"
            />
            <input
              placeholder="SKU (opcional)"
              value={nuevo.sku}
              onChange={e => setNuevo({ ...nuevo, sku: e.target.value })}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900"
            />
            <input
              placeholder="Unidad (pza, ton, kg…)"
              value={nuevo.unidad}
              onChange={e => setNuevo({ ...nuevo, unidad: e.target.value })}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900"
            />
            <input
              type="number"
              step="any"
              min="0"
              placeholder="Stock inicial"
              value={nuevo.stock}
              onChange={e => setNuevo({ ...nuevo, stock: e.target.value })}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900"
            />
            <input
              type="number"
              step="any"
              min="0"
              placeholder="Stock mínimo"
              value={nuevo.stock_minimo}
              onChange={e => setNuevo({ ...nuevo, stock_minimo: e.target.value })}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg disabled:opacity-50"
            >
              Guardar
            </button>
            <button type="button" onClick={() => setShowNuevo(false)} className="px-4 py-2 text-sm text-slate-600">
              Cancelar
            </button>
          </div>
        </form>
      )}

      {showMov && (
        <form onSubmit={guardarMovimiento} className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          <p className="font-medium text-slate-800">Registrar movimiento</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <select
              required
              value={mov.producto_id}
              onChange={e => setMov({ ...mov, producto_id: e.target.value })}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900"
            >
              <option value="">Producto…</option>
              {productos
                .filter(p => p.activo)
                .map(p => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} ({fmtStock(p.stock, p.unidad)})
                  </option>
                ))}
            </select>
            <select
              value={mov.tipo}
              onChange={e => setMov({ ...mov, tipo: e.target.value as typeof mov.tipo })}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900"
            >
              <option value="entrada">Entrada (compra / recepción)</option>
              <option value="salida">Salida (venta / uso)</option>
              <option value="ajuste">Ajuste (fijar stock exacto)</option>
            </select>
            <input
              required
              type="number"
              step="any"
              min="0"
              placeholder={mov.tipo === 'ajuste' ? 'Nuevo stock' : 'Cantidad'}
              value={mov.cantidad}
              onChange={e => setMov({ ...mov, cantidad: e.target.value })}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900"
            />
            <input
              placeholder="Referencia (factura, nota…)"
              value={mov.referencia}
              onChange={e => setMov({ ...mov, referencia: e.target.value })}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900"
            />
            <input
              placeholder="Notas"
              value={mov.notas}
              onChange={e => setMov({ ...mov, notas: e.target.value })}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 sm:col-span-2"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg disabled:opacity-50"
            >
              Registrar
            </button>
            <button type="button" onClick={() => setShowMov(false)} className="px-4 py-2 text-sm text-slate-600">
              Cancelar
            </button>
          </div>
        </form>
      )}

      {tab === 'productos' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Producto</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">SKU</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600">Stock</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600">Mínimo</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-600">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {productos.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    No hay productos. Crea el primero con “Nuevo producto”.
                  </td>
                </tr>
              )}
              {productos.map(p => {
                const bajo = p.activo && p.stock <= p.stock_minimo;
                return (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{p.nombre}</td>
                    <td className="px-4 py-3 text-slate-500 font-mono text-xs">{p.sku ?? '—'}</td>
                    <td className={`px-4 py-3 text-right font-mono ${bajo ? 'text-amber-700 font-semibold' : 'text-slate-700'}`}>
                      {fmtStock(p.stock, p.unidad)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-500 font-mono">
                      {fmtStock(p.stock_minimo, p.unidad)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          p.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {p.activo ? (bajo ? 'Bajo' : 'OK') : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => toggleActivo(p)}
                        disabled={loading}
                        className="text-xs text-slate-500 hover:text-slate-800"
                      >
                        {p.activo ? 'Desactivar' : 'Activar'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'movimientos' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Fecha</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Producto</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Tipo</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600">Cantidad</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600">Stock</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Ref.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {movimientos.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    Sin movimientos aún.
                  </td>
                </tr>
              )}
              {movimientos.map(m => (
                <tr key={m.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                    {new Date(m.created_at).toLocaleString('es-MX', {
                      timeZone: 'America/Mexico_City',
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-800">{m.productos?.nombre ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        m.tipo === 'entrada'
                          ? 'bg-emerald-100 text-emerald-700'
                          : m.tipo === 'salida'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {m.tipo}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-slate-700">
                    {m.tipo === 'salida' ? '−' : m.tipo === 'entrada' ? '+' : '='}
                    {m.cantidad} {m.productos?.unidad ?? ''}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-500 font-mono text-xs">
                    {m.stock_antes} → {m.stock_despues}
                  </td>
                  <td className="px-4 py-3 text-slate-500 truncate max-w-[10rem]" title={m.referencia ?? ''}>
                    {m.referencia ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
