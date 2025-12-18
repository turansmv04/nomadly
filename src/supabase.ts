import { createClient } from '@supabase/supabase-js';
import type { Database } from '../database.types'; 

export type JobInsert = Database['public']['Tables']['jobs']['Insert'];

export function createSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("❌ Supabase URL və ya Key .env-də tapılmadı.");
  }
  return createClient<Database>(supabaseUrl, supabaseKey);
}

export async function insertOrUpdateSupabase(jobs: JobInsert[]) {
    const supabase = createSupabaseClient();
    if (jobs.length === 0) return;

    const { data, error } = await supabase
        .from('jobs')
        .upsert(jobs, { onConflict: 'url' })
        .select();
    
    const writtenData = data as any[] | null;

    if (error) {
        console.error("❌ Supabase xətası:", error.message);
    } else {
        console.log(`✅ ${writtenData?.length || 0} elan uğurla yazıldı.`);
    }
}