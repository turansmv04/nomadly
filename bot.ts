import 'dotenv/config';
import { Telegraf, Context } from 'telegraf';
import { message } from 'telegraf/filters';
import axios from 'axios';

type InlineKeyboardMarkupFinal = {
  inline_keyboard: { text: string; callback_data: string }[][];
};

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// Public URL təyin edildi
const NEXTJS_SUBSCRIBE_URL = 'https://yeni-projem-1.onrender.com/api/subscribe';

if (!BOT_TOKEN) {
  throw new Error('TELEGRAM_BOT_TOKEN .env faylında təyin edilməyib.');
}

const bot = new Telegraf<Context>(BOT_TOKEN);

interface SubscriptionState {
  keyword: string | null;
  frequency: 'daily' | 'weekly' | null;
}

const userStates: Map<number, SubscriptionState> = new Map();

bot.command('subscribe', (ctx) => {
  if (!ctx.chat) return;
  userStates.set(ctx.chat.id, { keyword: null, frequency: null });
  console.log(`[DEBUG] /subscribe əmri alındı. Chat ID: ${ctx.chat.id}`);
  ctx.reply(
    '👋 Salam! Zəhmət olmasa, axtarış etmək istədiyiniz *Keyword*-ü (məsələn: CyberSecurity, Developer, Engineer) daxil edin.',
    { parse_mode: 'Markdown' }
  );
});

// ✅ Keyword-ü tutan handler (Donma probleminin həlli)
bot.on(message('text'), async (ctx) => {
    if (!ctx.chat) return;

    const chatId = ctx.chat.id;
    const state = userStates.get(chatId);

    // Əgər state mövcuddursa və keyword hələ qeyd edilməyibsə
    if (state && state.keyword === null) {
        state.keyword = ctx.message.text.trim();
        console.log(`[DEBUG] Keyword qeyd edildi: ${state.keyword}`);

        const inlineKeyboard: InlineKeyboardMarkupFinal = {
            inline_keyboard: [
                [
                    { text: 'Gündəlik', callback_data: 'freq_daily' },
                    { text: 'Həftəlik', callback_data: 'freq_weekly' },
                ],
            ],
        };

        await ctx.reply(
            `✅ Keyword olaraq **${state.keyword}** seçildi.\nZəhmət olmasa, *Tezlik*-i (Frequency) seçin:`,
            { parse_mode: 'Markdown', reply_markup: inlineKeyboard }
        );
    } else if (state && state.keyword !== null && state.frequency === null) {
        await ctx.reply('Zəhmət olmasa, yuxarıdakı düymələrdən birini seçin: Gündəlik və ya Həftəlik.');
    }
});

// ✅ Callback (Düymə) handler (Debug logları ilə)
bot.on('callback_query', async (ctx) => {
    if (!('data' in ctx.callbackQuery) || !ctx.chat) return;
    const callbackData = ctx.callbackQuery.data;
    const chatId = ctx.chat.id;
    const state = userStates.get(chatId);

    // DEBUG: 1. Callback-in alındığını yoxla
    console.log(`[DEBUG] Callback alındı. Chat ID: ${chatId}, Data: ${callbackData}`);

    if (state && state.keyword && callbackData.startsWith('freq_')) {
        console.log('[DEBUG] Şərtlər ödənir. Prosesə başlanılır...');
        
        const frequency = callbackData.replace('freq_', '') as 'daily' | 'weekly';
        state.frequency = frequency;

        await ctx.answerCbQuery('Seçim qeydə alındı.');
        
        // Düymələri silmək (Təhlükəsiz try/catch əlavə edildi)
        try {
            await ctx.editMessageReplyMarkup({ inline_keyboard: [] } as InlineKeyboardMarkupFinal);
        } catch (error) {
            console.error("[DEBUG] Düymə silinərkən kiçik xəta (normal ola bilər):", error);
        }

        try {
            const postData = {
                ch_id: String(chatId),
                keyword: state.keyword,
                frequency: state.frequency,
            };
            
            console.log("[DEBUG] API-yə göndərilən data:", postData);
            
            const response = await axios.post(NEXTJS_SUBSCRIBE_URL, postData);
            
            console.log("[DEBUG] API-dən gələn status kodu:", response.status);
            console.log("[DEBUG] API-dən gələn DATA:", response.data);

            if (response.data.status === 'success') {
                await ctx.reply(
                    `🎉 *Təbrik edirik!* Siz **${state.keyword}** sözünə *${state.frequency.toUpperCase()}* abunə oldunuz.`,
                    { parse_mode: 'Markdown' }
                );
            } else {
                await ctx.reply(
                    `❌ Abunəlik uğursuz oldu: ${response.data.message || 'Daxili API xətası.'}`
                );
            }

        } catch (error: any) {
            // DEBUG: 6. Əsas Xəta bloku
            console.error("❌❌ KRİTİK XƏTA: API-yə qoşularkən xəta:", error.message);
            await ctx.reply(
                `❌ Xəta baş verdi. Zəhmət olmasa, serverin işlək olduğundan əmin olun.\nXəta: ${error.message}`
            );
        }
        userStates.delete(chatId);
    } else {
        await ctx.answerCbQuery('Bu seçim artıq etibarlı deyil və ya proses bitib.');
    }
});

bot.launch()
  .then(() => {
    console.log('🤖 Telegram Botu uğurla işə düşdü!');
    console.log(`Abunəlik API-si: ${NEXTJS_SUBSCRIBE_URL}`);
  })
  .catch(err => {
    console.error('Bot işə düşərkən kritik xəta:', err);
  });

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));