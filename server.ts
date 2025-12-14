// server.ts (Bütün Bot, Cron və İşləmə Məntiqi Birləşdirilib, TS Xətaları Həll Edilib)

import express from 'express';
import { Telegraf, Context } from 'telegraf';
import 'dotenv/config'; 
import cron from 'node-cron'; // İndi @types/node-cron paketini quraşdırdıqdan sonra işləməlidir
import { processBotCommands } from './bot'; 

// Supabase və Tip Importları
import { createSupabaseClient } from './src/supabase';
import type { Database } from './database.types.js'; 

const app = express();
const PORT = process.env.PORT || 3001; 
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!BOT_TOKEN) {
    console.error('❌ KRİTİK XƏTA: TELEGRAM_BOT_TOKEN təyin edilməyib.');
    throw new Error('TELEGRAM_BOT_TOKEN not found.');
}
const bot = new Telegraf<Context>(BOT_TOKEN);
const supabase = createSupabaseClient(); 

// Cədvəl adları və tiplər
const SUBSCRIPTIONS_TABLE = 'subscribe' as 'subscribe'; 
const JOBS_TABLE = 'jobs' as 'jobs'; 
type SubscriptionRow = Database['public']['Tables']['subscribe']['Row'];
type JobRow = Database['public']['Tables']['jobs']['Row'];


// --- 1. TELEGRAM MESAJ GÖNDƏRİLMƏ FUNKSİYASI ---
async function sendJobNotification(chatId: number, keyword: string, newJobs: JobRow[]) {
    let message = `📣 **Yeni İş Bildirişi** 📣\n\n`;
    message += `Sizin **${keyword.toUpperCase()}** açar sözünüzə uyğun *${newJobs.length}* yeni iş tapıldı:\n\n`;
    
    newJobs.slice(0, 5).forEach((job, index) => { 
        message += `${index + 1}. **${job.title}**\n`;
        // 🔥 DÜZƏLİŞ: job.link əvəzinə Supabase tipinə uyğun job.url istifadə edildi
        message += `Link: [Baxın](${job.url})\n`; 
        message += `***\n`;
    });

    if (newJobs.length > 5) {
        message += `\n...və daha çox (${newJobs.length - 5} ədəd) iş var.`;
    }

    try {
        await bot.telegram.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    } catch (error) {
        console.error(`❌ Chat ID ${chatId}-yə mesaj göndərilərkən xəta:`, error);
    }
}


// --- 2. ƏSAS ABUNƏLİK İŞLƏMƏ FUNKSİYASI (CRON tərəfindən çağırılır) ---
async function processSubscriptions(frequency: 'daily' | 'weekly') {
    console.log(`\n--- ${frequency.toUpperCase()} ABUNƏLİKLƏRİ İŞLƏNİR ---`);

    try {
        // A. Aktiv abunəlikləri çəkirik
        const { data: activeSubscriptions, error: subError } = await supabase
            .from(SUBSCRIPTIONS_TABLE)
            .select('*')
            .eq('frequency', frequency)
            .returns<SubscriptionRow[]>();

        if (subError) throw subError;
        
        if (!activeSubscriptions || activeSubscriptions.length === 0) {
            console.log(`✅ ${frequency} üçün aktiv abunəlik yoxdur.`);
            return;
        }
        
        console.log(`✅ ${activeSubscriptions.length} ədəd ${frequency} abunəliyi tapıldı.`);

        // B. Hər abunəlik üçün axtarış
        for (const sub of activeSubscriptions) {
            const { chat_id, keyword, last_job_id } = sub;
            
            console.log(`[${chat_id}] Keyword: "${keyword}" üçün Jobs cədvəlində axtarış başlayır...`);
            
            const minJobId = last_job_id || 0; 
            
            // C. JOBS cədvəlində filtrlənmiş axtarış
            const { data: newJobs, error: jobError } = await supabase
                .from(JOBS_TABLE)
                .select('*')
                .gt('id', minJobId) 
                .ilike('title', `%${keyword}%`) 
                // Description sütununuz varsa, bura əlavə edin.
                .order('id', { ascending: true }) 
                .returns<JobRow[]>();

            if (jobError) {
                console.error(`❌ Jobs cədvəlində axtarış xətası (${keyword}):`, jobError);
                continue; 
            }

            if (newJobs && newJobs.length > 0) {
                console.log(`[${chat_id}] Yeni ${newJobs.length} iş tapıldı.`);
                
                // D. İstifadəçiyə bildiriş göndəririk
                await sendJobNotification(chat_id, keyword, newJobs); 

                // E. Ən yüksək ID-ni tapırıq
                const highestJobId = Math.max(...newJobs.map(job => job.id));

                // F. Supabase-də last_job_id-ni yeniləyirik
                const { error: updateError } = await supabase
                    .from(SUBSCRIPTIONS_TABLE)
                    .update({ last_job_id: highestJobId })
                    .eq('chat_id', chat_id)
                    .eq('keyword', keyword);

                if (updateError) {
                    console.error(`❌ last_job_id yenilənərkən xəta (${chat_id}, ${keyword}):`, updateError);
                } else {
                    console.log(`[${chat_id}] last_job_id uğurla ${highestJobId} olaraq yeniləndi.`);
                }
            } else {
                console.log(`[${chat_id}] Yeni iş tapılmadı.`);
            }
        } 

    } catch (error) {
        console.error('❌ KRİTİK İŞLƏMƏ XƏTASI:', error);
    }
    console.log(`--- ${frequency.toUpperCase()} İŞLƏMƏ BİTDİ ---`);
}


// --- 3. CRON İŞLƏMƏSİ VƏ ZAMANLAMA ---
console.log('⏳ Cron tapşırıqları təyin edilir...');

// Gündəlik abunəliklər (Hər gün saat 09:00-da işləsin)
cron.schedule('0 9 * * *', () => {
    console.log('🔥 CRON: Gündəlik abunəliklər işə salındı.');
    processSubscriptions('daily');
});

// Həftəlik abunəliklər (Hər Bazar ertəsi 09:00-da işləsin)
cron.schedule('0 9 * * 1', () => { 
    console.log('🔥 CRON: Həftəlik abunəliklər işə salındı.');
    processSubscriptions('weekly');
});

// --- 4. BOT VƏ SERVER İŞƏ SALINMASI ---

// Telegram komandalarını (subscribe, myinfo, etc) bot.ts-dən yükləyirik
processBotCommands(bot); 

bot.launch()
    .then(() => {
        console.log('🤖 Telegram Botu uğurla işə düşdü! (Bot launch OK)');
    })
    .catch(err => {
        console.error('❌ KRİTİK BOT BAŞLANĞIC XƏTASI: Bot qoşula bilmədi.', err);
    });

app.get('/', (req, res) => {
    res.status(200).send('Telegram Botu və Express Serveri işləkdir!');
});

app.listen(PORT, () => {
    console.log(`📡 Express serveri http://localhost:${PORT} portunda dinləyir.`);
});

process.once('SIGINT', () => { bot.stop('SIGINT'); process.exit(0); });
process.once('SIGTERM', () => { bot.stop('SIGTERM'); process.exit(0); });