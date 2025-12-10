import 'dotenv/config';
import { Telegraf, Context } from 'telegraf';
import { message } from 'telegraf/filters';
import axios from 'axios';

// --- Mühit Dəyişənlərinin Yoxlanılması ---
// Lokal test üçün NODE_ENV nəzərə alınır
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const NEXTJS_SUBSCRIBE_URL = process.env.SUBSCRIBE_API_URL;

if (!BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN təyin edilməyib.');
if (!NEXTJS_SUBSCRIBE_URL) throw new Error('SUBSCRIBE_API_URL təyin edilməyib.');

const bot = new Telegraf<Context>(BOT_TOKEN);

// --- Type Definitions ---
type InlineKeyboardMarkupFinal = {
    inline_keyboard: {
        text: string;
        callback_data: string;
    }[][];
};

interface SubscriptionState {
    keyword: string | null;
    frequency: 'daily' | 'weekly' | null;
}
// Yaddaşda (in-memory) istifadəçi vəziyyətini saxlayan Map
const userStates: Map<number, SubscriptionState> = new Map();

// --- Command and Message Handlers ---

// /subscribe əmri
bot.command('subscribe', (ctx) => {
    if (!ctx.chat) return;
    // İstifadəçi state-ini sıfırlayır/yaradır
    userStates.set(ctx.chat.id, { keyword: null, frequency: null });
    
    ctx.reply(
        'Keyword daxil edin. Misal: CyberSecurity, Developer, Engineer',
        { parse_mode: 'Markdown' }
    );
});

// İstifadəçi mətn göndərəndə işləyir (Keyword qəbulu)
bot.on(message('text'), async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId) return;

    const state = userStates.get(chatId);
    
    // Yoxlama: Abunəlik prosesi başlamayıbsa və ya Keyword artıq təyin edilibsə
    if (!state || state.keyword !== null) return;

    const keyword = ctx.message.text.trim();
    state.keyword = keyword; // Keyword yaddaşda saxlanılır

    const keyboard: InlineKeyboardMarkupFinal = {
        inline_keyboard: [
            [
                { text: '📅 Daily', callback_data: 'freq_daily' },
                { text: '🗓 Weekly', callback_data: 'freq_weekly' }
            ]
        ]
    };

    await ctx.reply(
        `Keyword: *${keyword}* qəbul edildi.\nTezliyi seçin:`,
        { parse_mode: 'Markdown', reply_markup: keyboard }
    );
});

// Düymə seçimi (Frequency qəbulu)
bot.on('callback_query', async (ctx) => {
    if (!('data' in ctx.callbackQuery) || !ctx.chat) return; 
    
    const callbackData = ctx.callbackQuery.data;
    const chatId = ctx.chat.id;
    const state = userStates.get(chatId);
    
    if (state && state.keyword && callbackData.startsWith('freq_')) {
        const frequency = callbackData.replace('freq_', '') as 'daily' | 'weekly';
        state.frequency = frequency;

        await ctx.answerCbQuery(); // Düyməyə basılmanı təsdiqlə
        await ctx.editMessageReplyMarkup({ inline_keyboard: [] } as InlineKeyboardMarkupFinal); // Düymələri təmizlə

        try {
            const postData = {
                ch_id: String(chatId), 
                keyword: state.keyword,
                frequency: state.frequency
            };

            // Timeout müddəti 30 saniyəyə artırıldı (API yuxudan oyanması üçün)
            const response = await axios.post(NEXTJS_SUBSCRIBE_URL, postData, {
                timeout: 30000, 
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.data.status === 'success') {
                await ctx.reply(
                    `🎉 *Təbrik edirik!* Siz \`${state.keyword}\` üçün *${state.frequency.toUpperCase()}* abunə oldunuz.`,
                    { parse_mode: 'Markdown' }
                );
            } else {
                await ctx.reply(`❌ Xəta: ${response.data.message || 'API xətası'}`);
            }

        } catch (error: any) {
            console.error("API Error:", error.message);
            // İstifadəçiyə timeout xətası haqqında məlumat verilir
            await ctx.reply(`❌ Serverlə əlaqə mümkün olmadı. Xəta: ${error.message}. Serverin yuxudan oyanmasını gözləyin və yenidən cəhd edin.`);
        }

        userStates.delete(chatId); // State silinir
    } else {
        await ctx.answerCbQuery('Artıq etibarlı deyil.');
    }
});

// --- Botu İşə Salma Məntiqi (Long Polling) ---

// Lokal test üçün Webhook-u silmək və Long Polling-i başlatmaq üçün
bot.launch().then(async () => {
    console.log('🤖 Telegram Botu uğurla işə düşdü (Long Polling rejimində)!');
    
    // Əgər əvvəlki testlərdən Webhook qalmışsa, onu silin
    try {
        await bot.telegram.deleteWebhook();
        console.log('Webhook təmizləndi.');
    } catch (error) {
        // Webhook yoxdursa, xəta verməyəcək
    }
    
    console.log(`Abunəlik API-si: ${NEXTJS_SUBSCRIBE_URL}`);
}).catch(err => {
    console.error('Bot işə düşərkən kritik xəta:', err);
    process.exit(1);
});

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));