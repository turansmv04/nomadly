import 'dotenv/config';
import { Telegraf, Context } from 'telegraf';
import { message } from 'telegraf/filters';
import axios from 'axios';

type InlineKeyboardMarkupFinal = {
    inline_keyboard: {
        text: string;
        callback_data: string;
    }[][];
};

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const NEXTJS_SUBSCRIBE_URL = 'http://localhost:3000/api/subscribe';

if (!BOT_TOKEN) {
    throw new Error('TELEGRAM_BOT_TOKEN .env faylında tapılmayıb.');
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

    ctx.reply(
        '👋 Salam! Axtarış etmək istədiyiniz açar sözü yazın.',
        { parse_mode: 'Markdown' }
    );
});

bot.on(message('text'), async (ctx, next) => {
    if (!ctx.chat) return next();
    
    const chatId = ctx.chat.id;
    const state = userStates.get(chatId);

    if (state && !state.keyword) {
        const keyword = ctx.message.text.trim();
        state.keyword = keyword;

        ctx.reply(
            `Keyword: *${keyword}*\nTezlik seçin:`,
            {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'Günlük (Daily)', callback_data: 'freq_daily' }],
                        [{ text: 'Həftəlik (Weekly)', callback_data: 'freq_weekly' }]
                    ]
                } as InlineKeyboardMarkupFinal,
                parse_mode: 'Markdown'
            }
        );
        userStates.set(chatId, state);
    } else {
        return next();
    }
});

bot.on('callback_query', async (ctx) => {
    if (!('data' in ctx.callbackQuery) || !ctx.chat) return;

    const callbackData = ctx.callbackQuery.data;
    const chatId = ctx.chat.id;
    const state = userStates.get(chatId);

    if (state && state.keyword && callbackData.startsWith('freq_')) {
        const frequency = callbackData.replace('freq_', '') as 'daily' | 'weekly';
        state.frequency = frequency;

        await ctx.answerCbQuery();
        await ctx.editMessageReplyMarkup({ inline_keyboard: [] } as InlineKeyboardMarkupFinal);

        try {
            const postData = {
                ch_id: String(chatId),
                keyword: state.keyword,
                frequency: state.frequency
            };

            const response = await axios.post(NEXTJS_SUBSCRIBE_URL, postData);

            if (response.data.status === 'success') {
                await ctx.reply(
                    `🎉 \`${state.keyword}\` sözünə *${state.frequency.toUpperCase()}* abunə oldunuz.`,
                    { parse_mode: 'Markdown' }
                );
            } else {
                await ctx.reply(`❌ Abunəlik olmadı: ${response.data.message}`);
            }

        } catch (error: any) {
            await ctx.reply(`❌ Server xətası: ${error.message}`);
        }

        userStates.delete(chatId);
    } else {
        await ctx.answerCbQuery('Artıq etibarlı deyil.');
    }
});

bot.launch()
    .then(() => {
        console.log('🤖 Bot işə düşdü');
    })
    .catch(err => {
        console.error('Bot açılmadı:', err);
    });

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
