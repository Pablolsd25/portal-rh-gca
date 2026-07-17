import type { SupabaseClient } from '@supabase/supabase-js';

export interface Producto {
  id: string;
  sku: string | null;
  nombre: string;
  unidad: string;
  stock: number;
  stock_minimo: number;
  activo: boolean;
  notas: string | null;
  created_at: string;
  updated_at: string;
}

export interface MovimientoInventario {
  id: string;
  producto_id: string;
  tipo: 'entrada' | 'salida' | 'ajuste';
  cantidad: number;
  stock_antes: number;
  stock_despues: number;
  referencia: string | null;
  notas: string | null;
  creado_por: string | null;
  created_at: string;
  productos?: { nombre: string; unidad: string; sku: string | null } | null;
}

function err(error: { message: string; details?: string; hint?: string }): Error {
  return new Error([error.message, error.details, error.hint].filter(Boolean).join(' — '));
}

export async function listProductos(supabase: SupabaseClient, soloActivos = false): Promise<Producto[]> {
  let q = supabase.from('productos').select('*').order('nombre');
  if (soloActivos) q = q.eq('activo', true);
  const { data, error } = await q;
  if (error) throw err(error);
  return (data ?? []).map(p => ({
    ...p,
    stock: Number(p.stock),
    stock_minimo: Number(p.stock_minimo),
  }));
}

export async function crearProducto(
  supabase: SupabaseClient,
  input: { nombre: string; sku?: string; unidad?: string; stock?: number; stock_minimo?: number; notas?: string },
): Promise<Producto> {
  const { data, error } = await supabase
    .from('productos')
    .insert({
      nombre: input.nombre.trim(),
      sku: input.sku?.trim() || null,
      unidad: input.unidad?.trim() || 'pza',
      stock: input.stock ?? 0,
      stock_minimo: input.stock_minimo ?? 0,
      notas: input.notas?.trim() || null,
    })
    .select('*')
    .single();
  if (error) throw err(error);
  return { ...data, stock: Number(data.stock), stock_minimo: Number(data.stock_minimo) };
}

export async function actualizarProducto(
  supabase: SupabaseClient,
  id: string,
  patch: Partial<Pick<Producto, 'nombre' | 'sku' | 'unidad' | 'stock_minimo' | 'activo' | 'notas'>>,
): Promise<void> {
  const { error } = await supabase
    .from('productos')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw err(error);
}

export async function registrarMovimiento(
  supabase: SupabaseClient,
  input: {
    producto_id: string;
    tipo: 'entrada' | 'salida' | 'ajuste';
    cantidad: number;
    referencia?: string;
    notas?: string;
    userId: string;
  },
): Promise<void> {
  const { error } = await supabase.rpc('registrar_movimiento_inventario', {
    p_producto_id: input.producto_id,
    p_tipo: input.tipo,
    p_cantidad: input.cantidad,
    p_referencia: input.referencia ?? null,
    p_notas: input.notas ?? null,
    p_user_id: input.userId,
  });
  if (error) throw err(error);
}

export async function listMovimientos(
  supabase: SupabaseClient,
  limit = 50,
  productoId?: string,
): Promise<MovimientoInventario[]> {
  let q = supabase
    .from('inventario_movimientos')
    .select('*, productos(nombre, unidad, sku)')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (productoId) q = q.eq('producto_id', productoId);
  const { data, error } = await q;
  if (error) throw err(error);
  return (data ?? []).map(m => ({
    ...m,
    cantidad: Number(m.cantidad),
    stock_antes: Number(m.stock_antes),
    stock_despues: Number(m.stock_despues),
    productos: Array.isArray(m.productos) ? m.productos[0] : m.productos,
  }));
}
