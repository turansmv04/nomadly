import * as dotenv from 'dotenv'; 
dotenv.config(); 
import { Telegraf, Context } from 'telegraf';
import { message } from 'telegraf/filters';
import { createSupabaseClient } from './src/supabase'; 

const supabase = createSupabaseClient(); 
const userStates: Map<number, any> = new Map();

export function processBotCommands(bot: Telegraf<Context>) {
    
    bot.command('start', (ctx) => {
        ctx.reply('👋 Salam! Vakansiya Botuna xoş gəldiniz.\n\nƏmrlər:\n/subscribe - Abunə ol\n/unsubscribe - Abunəliyi ləğv et\n/myinfo - Aktiv abunəliklərim');
    });

    bot.command('subscribe', (ctx) => {
        if (!ctx.chat) return;
        userStates.set(ctx.chat.id, { step: 'waitingForKeyword' });
        ctx.reply('🔍 Hansı sahədə iş axtarırsınız? (Məs: Python, Designer)');
    });

    bot.command('unsubscribe', (ctx) => {
        if (!ctx.chat) return;
        userStates.set(ctx.chat.id, { step: 'waitingForUnsubscribe' });
        ctx.reply('❌ Ləğv etmək istədiyiniz abunəliyin **Keyword**-ünü yazın: (Məs: Python)', { parse_mode: 'Markdown' });
    });

    bot.command('myinfo', async (ctx) => {
        if (!ctx.chat) return;
        const chatId = ctx.chat.id;

        const { data: subs, error } = await supabase
            .from('subscribe')
            .select('keyword, frequency')
            .eq('chat_id', chatId);

        if (error) {
            return ctx.reply('❌ Məlumatları çəkərkən xəta baş verdi.');
        }

        if (!subs || subs.length === 0) {
            return ctx.reply('ℹ️ Sizin aktiv abunəliyiniz tapılmadı.');
        }

        let infoMsg = '⭐ **Sizin Aktiv Abunəlikləriniz** ⭐\n\n';
        subs.forEach((s, i) => {
            infoMsg += `${i + 1}. **${s.keyword.toUpperCase()}** - ${s.frequency === 'daily' ? 'Gündəlik ☀️' : 'Həftəlik 📅'}\n`;
        });

        ctx.reply(infoMsg, { parse_mode: 'Markdown' });
    });

    bot.on(message('text'), async (ctx) => {
        const chatId = ctx.chat.id;
        const state = userStates.get(chatId);
        const userText = ctx.message.text.trim().toLowerCase();

        if (state?.step === 'waitingForKeyword') {
            userStates.set(chatId, { keyword: userText, step: 'waitingForFreq' });
            await ctx.reply(`✅ Keyword: ${userText}\nTezliyi seçin:`, {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'Gündəlik', callback_data: `f_d_${userText}` },
                         { text: 'Həftəlik', callback_data: `f_w_${userText}` }]
                    ]
                }
            });
        } 
        
        else if (state?.step === 'waitingForUnsubscribe') {
            const { error, count } = await supabase
                .from('subscribe')
                .delete({ count: 'exact' })
                .eq('chat_id', chatId)
                .eq('keyword', userText);

            if (error) {
                ctx.reply('❌ Silinmə zamanı xəta oldu.');
            } else if (count === 0) {
                ctx.reply(`⚠️ '${userText}' adlı bir abunəliyiniz tapılmadı.`);
            } else {
                ctx.reply(`✅ '${userText}' abunəliyi uğurla silindi.`);
            }
            userStates.delete(chatId);
        }
    });

    bot.on('callback_query', async (ctx: any) => {
        const data = ctx.callbackQuery.data;
        const chatId = ctx.chat?.id;
        if (!data || !chatId) return;

        if (data.startsWith('f_')) {
            const parts = data.split('_');
            const freq = parts[1] === 'd' ? 'daily' : 'weekly';
            const keyword = parts[2];

            const { error } = await supabase.from('subscribe').upsert({
                chat_id: chatId,
                keyword: keyword,
                frequency: freq,
                last_job_id: 0
            }, { onConflict: 'chat_id,keyword' });

            if (error) {
                await ctx.reply('❌ Abunəlik zamanı xəta oldu.');
            } else {
                await ctx.reply(`🎉 **${keyword.toUpperCase()}** üçün uğurla abunə oldunuz!`, { parse_mode: 'Markdown' });
            }
            userStates.delete(chatId);
            await ctx.answerCbQuery();
        }
    });
}

if (require.main === module) {
    const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!);
    processBotCommands(bot);
    bot.launch().then(() => console.log("🤖 Bot (MyInfo & Unsubscribe daxil) aktivdir..."));
}