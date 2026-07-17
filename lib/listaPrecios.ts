import type { SupabaseClient } from '@supabase/supabase-js';

export const IVA = 0.16;

export type ListaPreciosMeta = {
  id: number;
  empresa: string;
  fecha_vigencia: string;
  notas: string | null;
  updated_at?: string;
};

export type Material = {
  id: string;
  orden: number;
  descripcion: string;
  unidad: string;
  precio_materialista: number | null;
  precio_edo_mex: number | null;
  precio_cdmx: number | null;
  destacado: boolean;
  disponible: boolean;
  notas: string | null;
  created_at?: string;
  updated_at?: string;
};

export type MaterialPatch = Partial<
  Pick<
    Material,
    | 'descripcion'
    | 'unidad'
    | 'precio_materialista'
    | 'precio_edo_mex'
    | 'precio_cdmx'
    | 'destacado'
    | 'disponible'
    | 'notas'
    | 'orden'
  >
>;

function err(error: { message: string; details?: string; hint?: string }): Error {
  return new Error([error.message, error.details, error.hint].filter(Boolean).join(' — '));
}

function num(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function mapMaterial(row: Record<string, unknown>): Material {
  return {
    id: String(row.id),
    orden: Number(row.orden) || 0,
    descripcion: String(row.descripcion ?? ''),
    unidad: String(row.unidad ?? ''),
    precio_materialista: num(row.precio_materialista),
    precio_edo_mex: num(row.precio_edo_mex),
    precio_cdmx: num(row.precio_cdmx),
    destacado: Boolean(row.destacado),
    disponible: row.disponible !== false,
    notas: (row.notas as string | null) ?? null,
    created_at: row.created_at as string | undefined,
    updated_at: row.updated_at as string | undefined,
  };
}

export function ivaDe(precio: number | null): number | null {
  if (precio == null) return null;
  return Math.round(precio * IVA * 10000) / 10000;
}

export function netoDe(precio: number | null): number | null {
  if (precio == null) return null;
  return Math.round(precio * (1 + IVA) * 10000) / 10000;
}

export async function getListaMeta(supabase: SupabaseClient): Promise<ListaPreciosMeta> {
  const { data, error } = await supabase.from('lista_precios_meta').select('*').eq('id', 1).maybeSingle();
  if (error) throw err(error);
  if (!data) {
    return {
      id: 1,
      empresa: 'ACEROS Y MATERIALES SIGLO XXI, S.A. DE C.V.',
      fecha_vigencia: new Date().toISOString().slice(0, 10),
      notas: null,
    };
  }
  return data as ListaPreciosMeta;
}

export async function updateListaMeta(
  supabase: SupabaseClient,
  patch: Partial<Pick<ListaPreciosMeta, 'empresa' | 'fecha_vigencia' | 'notas'>>,
): Promise<void> {
  const { error } = await supabase
    .from('lista_precios_meta')
    .upsert({ id: 1, ...patch, updated_at: new Date().toISOString() });
  if (error) throw err(error);
}

export async function listMateriales(supabase: SupabaseClient): Promise<Material[]> {
  const { data, error } = await supabase.from('materiales').select('*').order('orden', { ascending: true });
  if (error) throw err(error);
  return (data ?? []).map(mapMaterial);
}

export async function updateMaterial(supabase: SupabaseClient, id: string, patch: MaterialPatch): Promise<void> {
  const { error } = await supabase
    .from('materiales')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw err(error);
}

export async function createMaterial(
  supabase: SupabaseClient,
  input: Omit<MaterialPatch, never> & { descripcion: string; unidad: string },
): Promise<Material> {
  const { data: maxRow } = await supabase
    .from('materiales')
    .select('orden')
    .order('orden', { ascending: false })
    .limit(1)
    .maybeSingle();
  const orden = (maxRow?.orden ?? 0) + 1;
  const { data, error } = await supabase
    .from('materiales')
    .insert({
      orden,
      descripcion: input.descripcion.trim(),
      unidad: input.unidad.trim() || 'KG',
      precio_materialista: input.precio_materialista ?? null,
      precio_edo_mex: input.precio_edo_mex ?? null,
      precio_cdmx: input.precio_cdmx ?? null,
      destacado: input.destacado ?? true,
      disponible: input.disponible ?? true,
      notas: input.notas ?? null,
    })
    .select('*')
    .single();
  if (error) throw err(error);
  return mapMaterial(data);
}

export async function deleteMaterial(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from('materiales').delete().eq('id', id);
  if (error) throw err(error);
}
