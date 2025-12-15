// src/supabase.ts

import { createClient } from '@supabase/supabase-js';
// 🔥 Düzəliş: Yeni NodeNext konfiqurasiyası üçün .ts yerine .js istifadə olunur
import type { Database } from '../database.types.js'; 
import type { ScrapedJobData } from './scrape.js'; 


type JobInsert = Database['public']['Tables']['jobs']['Insert']; 


export function createSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    // ⚠️ Əlavə LOG: Əmin olmaq üçün ətraf mühit dəyişənlərini yoxlayırıq
    console.error("❌ SUPABASE CONXETA: SUPABASE_URL və ya KEY tapılmadı. Secrets yoxlanılmalıdır!");
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

    // ⚠️ Əlavə LOG: Yazılacaq datanın sayını təkrar yoxlayırıq
    console.log(`[SUPABASE LOG] ${results.length} nəticə Supabase-ə yazılır...`);


    const dataToInsert: JobInsert[] = results.map(job => ({
        title: job.title,
        company: job.companyName, 
        url: job.url,
        salary: job.salary,
        siteUrl: job.siteUrl, 
    }));

    const { data, error } = await supabase
        .from('jobs')
        .upsert(dataToInsert, {
            onConflict: 'url', 
            ignoreDuplicates: false 
        })
        .select();

    if (error) {
        // 🔥 KRİTİK ƏLAVƏ: Xətanı daha aydın və böyük hərflərlə çap edirik
        console.error("==================================================================");
        console.error("❌ KRİTİK SUPABASE XƏTASI: MƏLUMATI YAZA BİLMƏDİ! (RLS ola bilər)", error);
        console.error("==================================================================");
        
        // Prosesi məcburi dayandırırıq ki, Actions qırmızı yansın
        throw new Error(`Bazaya yazılarkən kritik xəta: ${error.message}. RLS Policy yoxlayın!`);
    } else {
        console.log(`✅ [SUPABASE LOG] ${data?.length || 0} elan uğurla yazıldı/yeniləndi.`);
    }

    return { data, error };
}