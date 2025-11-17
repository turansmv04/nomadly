import { createSupabaseClient } from './supabase';
import axios from 'axios';
import 'dotenv/config';

// Database tipini düzgün yolla import edirik
import type { Database } from '../database.types'; 

// Tipləri database.types.ts faylından çıxarırıq
type SubscribeRow = Database['public']['Tables']['subscribe']['Row'];
type JobRow = Database['public']['Tables']['jobs']['Row'];

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!TELEGRAM_BOT_TOKEN) {
    throw new Error("TELEGRAM_BOT_TOKEN tapılmadı.");
}
const TELEGRAM_API_BASE_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;


/**
 * Mətn hissələri üçün HTML maskalaması.
 */
function escapeHtml(text: string | null | undefined): string {
    if (!text) return '';
    return text.replace(/&/g, '&amp;')
               .replace(/</g, '&lt;')
               .replace(/>/g, '&gt;');
}

// Yenidən cəhd etməyə imkan verən gecikmə funksiyası
function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Göndəriləcək işlərin siyahısını Telegram formatına çevirir (HTML formatı).
 */
function formatJobsForTelegram(jobs: JobRow[], keyword: string): string {
    if (jobs.length === 0) {
        return `<b>${escapeHtml(keyword.toUpperCase())}</b> açar sözü üzrə yeni elan tapılmadı. 😔`;
    }

    const safeKeyword = escapeHtml(keyword || 'Açar Sözü');
    let message = `🎉 <b>YENİ ELANLAR!</b> (${safeKeyword.toUpperCase()})\n\n`;
    
    // id, title, url, posted_at, created_at sahələrini kənarlaşdırırıq
    const EXCLUDE_KEYS = ['id', 'title', 'url', 'posted_at', 'created_at'];

    jobs.forEach(job => {
        // 1. Əsas Sahələr
        const safeTitle = escapeHtml(job.title);
        const urlForLink = job.url || '#'; 
        
        // 2. Mesajın Formatlanması
        message += `<b>${safeTitle}</b>\n`; 
        
        const jobEntries = Object.entries(job) as [string, unknown][]; 

        jobEntries.forEach(([key, value]) => {
            // Kənarlaşdırılmalı sahələri yoxlayırıq
            if (EXCLUDE_KEYS.includes(key)) {
                return;
            }

            // Dəyərin mövcudluğunu yoxlamaq: null, undefined və ya 'N/A' olmayan hər şeyi göstəririk
            const isRelevantValue = value !== null && value !== undefined && String(value).toUpperCase() !== 'N/A' && String(value).trim() !== '';
            
            if (isRelevantValue) {
                const safeKey = key.replace(/_/g, ' '); 
                const safeValue = escapeHtml(String(value));

                // Sahə adı və Dəyər (bold)
                message += `${safeKey.charAt(0).toUpperCase() + safeKey.slice(1)}: <b>${safeValue}</b>\n`;
            }
        });
        
        // 3. Link və ID
        message += `<a href="${urlForLink}">Tam Elana Bax</a>\n`; 
        
        message += `<i>ID: ${escapeHtml(job.id.toString())}</i>\n`; 
        message += `----------------------------------------------------\n`;
    });

    message += `\nÜmumi: ${jobs.length} yeni elan.`;
    return message;
}


/**
 * Tək bir istifadəçiyə bildiriş göndərir və onun last_job_id dəyərini yeniləyir.
 * Şəbəkə xətaları üçün yenidən cəhd (Retry) və log optimallaşdırması.
 */
async function sendNotificationAndUpdate(
    subscriber: SubscribeRow, 
    newJobs: JobRow[], 
    newLastJobId: number, 
    supabase: any
) {
    const keyword = subscriber.keyword || 'Açar Sözü Yoxdur';
    const message = formatJobsForTelegram(newJobs, keyword);
    
    // Log optimallaşdırması: Hər abunəçi üçün daxilolma logunu çıxarırıq
    // console.log(`🎯 Abunəçi ID: ${subscriber.chat_id} (Açar söz: ${keyword})`); 
    
    const MAX_RETRIES = 3;
    let success = false;
    
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            await axios.post(`${TELEGRAM_API_BASE_URL}/sendMessage`, {
                chat_id: subscriber.chat_id, 
                text: message,
                parse_mode: 'HTML', 
                disable_web_page_preview: true
            });

            success = true;
            break; 

        } catch (error: any) {
            // 🚨 YALNIZ XƏTA OLANDA LOGLAYIRIQ
            console.error(`\n🚨 XƏTA (Cəhd ${attempt}/${MAX_RETRIES}): Telegram bildirişi göndərilərkən xəta!`);
            console.error(`Chat ID: ${subscriber.chat_id} | Keyword: ${keyword}`);
            
            let errorMessage = "Naməlum xəta.";
            
            // ETIMEDOUT daxil olmaqla şəbəkə xətalarını idarə edirik
            if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'EHOSTUNREACH') {
                errorMessage = `Şəbəkə Xətası (${error.code}). Əlaqə sıfırlandı, vaxt aşımı və ya əlçatmaz server.`;
            } else if (error.response) {
                errorMessage = `Telegram API Status Kodu: ${error.response.status}. Səhv: ${error.response.data.description || JSON.stringify(error.response.data)}`;
            } else {
                errorMessage = `Başqa Xəta: ${error.message}`;
            }
            console.error(errorMessage);

            if (attempt < MAX_RETRIES) {
                const delay = attempt * 1000; 
                await sleep(delay);
            } else {
                console.error(`❌ UĞURSUZ GÖNDƏRİŞ: Bütün ${MAX_RETRIES} cəhd uğursuz oldu.`);
            }
        }
    }
    
    if (success) {
        // last_job_id yalnız uğurlu göndərişdən sonra yenilənir
        const { error: updateError } = await supabase
            .from('subscribe')
            .update({ last_job_id: newLastJobId })
            .eq('chat_id', subscriber.chat_id)
            .eq('keyword', keyword);

        if (updateError) {
            console.error(`❌ last_job_id yenilənərkən xəta:`, updateError.message);
        } else {
            // ✅ Log optimallaşdırması: Yalnız bir sətirlik uğur logu
            console.log(`✅ UĞURLU GÖNDƏRİŞ: Chat ${subscriber.chat_id} üçün ${newJobs.length} elan (${keyword}) çatdı. Yeni ID: ${newLastJobId}`);
        }
    }
}


/**
 * Bütün abunəçiləri emal edir, yeni elanları tapır və göndərir.
 */
export async function processSubscriptions(frequency: 'daily' | 'weekly') {
    console.log(`--- ${frequency.toUpperCase()} CRON İCAZASI BAŞLADI ---`);
    const supabase = createSupabaseClient();

    // 1. Abunəçiləri tapmaq
    const { data: subscribers, error: subError } = await supabase
        .from('subscribe')
        .select('*')
        .eq('frequency', frequency);

    if (subError || !subscribers || subscribers.length === 0) {
        console.log(`INFO: ${frequency.toUpperCase()} abunəçisi yoxdur.`);
        return { status: 'success', message: `${frequency.toUpperCase()} abunəçisi yoxdur.` };
    }
    
    console.log(`INFO: ${subscribers.length} ${frequency} abunəçisi emal edilir...`);

    let processedCount = 0;
    
    for (const sub of subscribers as SubscribeRow[]) { 
        const currentLastJobId = sub.last_job_id || 0; 
        const keyword = sub.keyword || 'N/A';
        const safeKeyword = keyword.toLowerCase(); 

        // 3. Jobs cədvəlindən yeni elanları tapmaq
        const { data: jobs, error: jobError } = await supabase
            .from('jobs')
            .select('*') 
            .ilike('title', `%${safeKeyword}%`) 
            .gt('id', currentLastJobId) 
            .order('id', { ascending: true }); 

        if (jobError) {
            console.error(`❌ İşlər tapılarkən kritik xəta (${sub.keyword}):`, jobError.message); 
            continue;
        }

        const newJobs = jobs as JobRow[] || []; 
        
        if (newJobs.length > 0) {
            const maxJobId = Math.max(...newJobs.map(j => j.id || 0)); 
            if (maxJobId > 0) {
                await sendNotificationAndUpdate(sub, newJobs, maxJobId, supabase);
                processedCount++;
            }
        } 
        // Log optimallaşdırması: İş tapılmayanda artıq log vermirik
    }
    
    const finalMessage = processedCount > 0 
        ? `✅ ${processedCount} abunəçi üçün bildirişlər göndərildi.` 
        : `INFO: ${subscribers.length} abunəçinin heç biri üçün yeni iş tapılmadı.`;

    console.log(`--- ${frequency.toUpperCase()} CRON İCAZASI BAŞA ÇATDI ---`);
    console.log(finalMessage);
    
    return { status: 'success', message: finalMessage };
}