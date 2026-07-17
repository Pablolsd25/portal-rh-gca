import type { SupabaseClient } from '@supabase/supabase-js';
import { BUCKET_DOCS } from './constants';

export async function uploadCreditDocuments(
  supabase: SupabaseClient,
  opts: {
    clientId: string;
    creditId: string;
    staffId: string;
    files: Record<string, File | null>;
  },
): Promise<string[]> {
  const errors: string[] = [];
  for (const [docType, file] of Object.entries(opts.files)) {
    if (!file) continue;
    const ext = file.name.split('.').pop() || 'bin';
    const filePath = `credits/${opts.creditId}/${docType}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from(BUCKET_DOCS)
      .upload(filePath, file, { upsert: false });
    if (upErr) {
      errors.push(`${docType}: ${upErr.message}`);
      continue;
    }
    const { error: dbErr } = await supabase.from('documents').insert({
      client_id: opts.clientId,
      credit_id: opts.creditId,
      document_type: docType,
      file_path: filePath,
      file_name: file.name,
      uploaded_by_staff_id: opts.staffId,
      verification_status: 'pendiente',
    });
    if (dbErr) errors.push(`${docType} (db): ${dbErr.message}`);
  }
  return errors;
}

/** Remove a credit and its products/docs if document upload failed mid-create. */
export async function deleteOrphanCredit(
  supabase: SupabaseClient,
  creditId: string,
): Promise<void> {
  await supabase.from('documents').delete().eq('credit_id', creditId);
  await supabase.from('credit_products').delete().eq('credit_id', creditId);
  await supabase.from('credits').delete().eq('id', creditId);
}

export function hasPendingFiles(files: Record<string, File | null>): boolean {
  return Object.values(files).some(Boolean);
}

export function docPublicUrl(filePath: string): string {
  if (filePath.startsWith('http')) return filePath;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return `${base}/storage/v1/object/public/${BUCKET_DOCS}/${filePath}`;
}
