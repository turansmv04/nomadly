// pages/api/telegram.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import { Telegraf, Context } from 'telegraf';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!BOT_TOKEN) {
    throw new Error('TELEGRAM_BOT_TOKEN tapılmadı');
}

let bot: Telegraf<Context> | null = null;

function getBot() {
    if (!bot && BOT_TOKEN) {
        bot = new Telegraf<Context>(BOT_TOKEN);
        setupBot(bot);
    }
    return bot!;
}

interface SubscriptionState {
    keyword: string | null;
    frequency: 'daily' | 'weekly' | null;
}
const userStates: Map<number, SubscriptionState> = new Map();

function setupBot(bot: Telegraf<Context>) {
    
    bot.command('start', (ctx) => {
        ctx.reply(
            `👋 *Xoş gəldiniz!*

🤖 Mən remote iş elanları bildiriş bot-uyam!

📋 *Necə istifadə etməli?*
1️⃣ /subscribe əmrini göndərin
2️⃣ Keyword yazın (developer, python və s.)
3️⃣ Gündəlik və ya həftəlik seçin

💼 *Mənbə:* WorkingNomads

🚀 *Başlayın:* /subscribe`,
            { parse_mode: 'Markdown' }
        );
    });

    bot.command('subscribe', (ctx) => {
        if (!ctx.chat) return;
        userStates.set(ctx.chat.id, { keyword: null, frequency: null });
        
        ctx.reply(
            '👋 Salam! Zəhmət olmasa, axtarış etmək istədiyiniz *Keyword*-ü daxil edin.',
            { parse_mode: 'Markdown' }
        );
    });

    bot.on('text', async (ctx) => {
        if (!ctx.chat) return;

        const chatId = ctx.chat.id;
        const state = userStates.get(chatId);

        if (state && !state.keyword) {
            const keyword = ctx.message.text.trim();
            state.keyword = keyword;

            await ctx.reply(
                `Keyword: *${keyword}*. İndi bildirişləri hansı tezliklə almaq istədiyinizi seçin:`,
                {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: 'Günlük (Daily)', callback_data: 'freq_daily' }],
                            [{ text: 'Həftəlik (Weekly)', callback_data: 'freq_weekly' }]
                        ]
                    },
                    parse_mode: 'Markdown'
                }
            );
            userStates.set(chatId, state);
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
            
            try {
                await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
            } catch (e) {
                
            }

            try {
                const postData = {
                    ch_id: String(chatId),
                    keyword: state.keyword,
                    frequency: state.frequency
                };

                const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://yeni-projem-1.onrender.com';
                
                const response = await fetch(`${apiUrl}/api/subscribe`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(postData)
                });
                
                const data = await response.json();
                
                if (data.status === 'success') {
                    await ctx.reply(
                        `🎉 *Təbrik edirik!* Siz \`${state.keyword}\` sözünə *${frequency.toUpperCase()}* abunə oldunuz.`,
                        { parse_mode: 'Markdown' }
                    );
                } else {
                    await ctx.reply(`❌ Abunəlik uğursuz oldu: ${data.message || 'Xəta.'}`);
                }

            } catch (error: any) {
                console.error("API xətası:", error);
                await ctx.reply(`❌ Xəta baş verdi.`);
            }

            userStates.delete(chatId);
        } else {
            await ctx.answerCbQuery('Bu seçim artıq etibarlı deyil.');
        }
    });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'POST') {
        try {
            const botInstance = getBot();
            await botInstance.handleUpdate(req.body);
            res.status(200).json({ ok: true });
        } catch (error: any) {
            console.error('Telegram webhook xətası:', error.message);
            res.status(500).json({ error: error.message });
        }
    } else {
        res.status(405).json({ error: 'Method not allowed' });
    }
}