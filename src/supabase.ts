// my-scrape-project/src/supabase.ts

import { createClient } from '@supabase/supabase-js';
import type { Database } from '../database.types'; 
import type { ScrapedJobData } from './scrape'; 

// Database tipləri avtomatik olaraq gəlir
type JobInsert = Database['public']['Tables']['jobs']['Insert']; 


export function createSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("❌ Supabase URL və ya Key .env-də tapılmadı.");
    throw new Error("Supabase Bağlantı Xətası: .env dəyərləri server mühitində tapılmadı.");
  }
  return createClient<Database>(supabaseUrl, supabaseAnonKey);
}

export async function insertOrUpdateSupabase(results: ScrapedJobData[]) {
    const supabase = createSupabaseClient();
    
    if (results.length === 0) {
        console.log("ℹ️ Yazılacaq nəticə yoxdur.");
        return { data: null, error: null };
    }

    console.log(`Supabase-ə ${results.length} nəticə yazılır...`);

    // 🛑 KRİTİK DÜZƏLİŞ: dataToInsert obyektindəki sahə adları (keys)
    // Sizin DB şemasındakı sütun adları ilə (Database['public']['Tables']['jobs']['Insert']) tam üst-üstə düşməlidir!
    
    // Əgər sizin DB-dən generated olan 'JobInsert' tipində sahə adı 'siteUrl' kimidirsə:
    const dataToInsert: JobInsert[] = results.map(job => ({
        title: job.title,
        company: job.companyName, 
        url: job.url,
        salary: job.salary,
        // YENİ DƏYİŞİKLİK: 'site_url' yerinə 'siteUrl' istifadə etdik.
        // Əgər DB-dəki sütun adı 'siteUrl' idisə, bu xətanı həll edir.
        siteUrl: job.siteUrl, 
    }));

    // 'url' üzərində upsert (Duplicate Key xətasını aradan qaldırır)
    const { data, error } = await supabase
        .from('jobs')
        .upsert(dataToInsert, {
            onConflict: 'url', 
            ignoreDuplicates: false 
        })
        .select();

    if (error) {
        console.error("❌ Supabase upsert xətası:", error);
        throw new Error(`Bazaya yazılarkən kritik xəta: ${error.message}`);
    } else {
        console.log(`✅ ${data?.length || 0} elan uğurla yazıldı/yeniləndi.`);
    }

    return { data, error };
}