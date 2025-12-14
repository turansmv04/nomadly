// bot.ts (Final Versiya: Bütün Məsələlər Həll Olunub)

import { Telegraf, Context } from 'telegraf';
import { message } from 'telegraf/filters';
import { createSupabaseClient } from './src/supabase'; 
import type { Database } from './database.types.js'; 

// Cədvəl adını 'subscribe' olaraq təyin edirik
const SUBSCRIPTIONS_TABLE = 'subscribe' as 'subscribe'; 

// Tip Uyğunluğu (database.types.js-dən gələn tiplər)
type SubscriptionInsert = Database['public']['Tables']['subscribe']['Insert'];
type SubscriptionRow = Database['public']['Tables']['subscribe']['Row'];

// Təyin olunmuş tiplər
type InlineKeyboardMarkupFinal = {
    inline_keyboard: { text: string; callback_data: string }[][];
};
interface SubscriptionState {
    keyword: string | null;
    frequency: 'daily' | 'weekly' | null;
    step: 'waitingForKeyword' | 'waitingForUnsubscribeKeyword' | 'initial';
}

const userStates: Map<number, SubscriptionState> = new Map();
const supabase = createSupabaseClient(); 

export function processBotCommands(bot: Telegraf<Context>) {
    
    // START ƏMRİ
    bot.command('start', (ctx) => {
        ctx.reply('👋 Salam! Mən Abunəlik Botuyam. Abunə olmaq üçün /subscribe yazın.');
    });

    // SUBSCRIBE ƏMRİ
    bot.command('subscribe', (ctx) => {
        if (!ctx.chat) return;
        userStates.set(ctx.chat.id, { keyword: null, frequency: null, step: 'waitingForKeyword' });
        ctx.reply(
            '👋 Salam! Zəhmət olmasa, axtarış etmək istədiyiniz *Keyword*-ü (məsələn: CyberSecurity) daxil edin.',
            { parse_mode: 'Markdown' }
        );
    });

    // UNSUBSCRIBE ƏMRİ
    bot.command('unsubscribe', (ctx) => {
        if (!ctx.chat) return;
        userStates.set(ctx.chat.id, { 
            keyword: null, 
            frequency: null, 
            step: 'waitingForUnsubscribeKeyword' 
        });
        ctx.reply(
            '❌ Ləğv etmək istədiyiniz abunəliyin **Keyword**-ünü (məsələn: CyberSecurity) daxil edin.',
            { parse_mode: 'Markdown' }
        );
    });

    // --- /myinfo ƏMRİ --- (SELECT)
    bot.command('myinfo', async (ctx) => {
        if (!ctx.chat) return;
        const chatId = ctx.chat.id; 
        await ctx.reply('ℹ️ Abunəlik məlumatlarınız yoxlanılır...');

        try {
            const { data: subscriptions, error } = await supabase
                .from(SUBSCRIPTIONS_TABLE)
                .select('keyword, frequency')
                .eq('chat_id', chatId) // chat_id Number kimi ötürülür
                .returns<SubscriptionRow[]>(); 

            if (error) {
                 console.error("❌❌ XƏTA: /myinfo Supabase çağırışı uğursuz oldu:", error);
                 throw error;
            }
            
            if (subscriptions && subscriptions.length > 0) {
                let message = '⭐ **Sizin Aktiv Abunəlikləriniz** ⭐\n\n';
                subscriptions.forEach((sub, index) => {
                    const formattedKeyword = sub.keyword ? sub.keyword.charAt(0).toUpperCase() + sub.keyword.slice(1) : 'Yoxdur';
                    const formattedFrequency = sub.frequency === 'daily' ? 'Gündəlik ☀️' : 'Həftəlik 📅';
                    message += `${index + 1}. **${formattedKeyword}**\n`;
                    message += `    Tezlik: *${formattedFrequency}*\n`;
                });
                await ctx.reply(message, { parse_mode: 'Markdown' });
            } else {
                await ctx.reply('❌ Sizin hazırda heç bir aktiv abunəliyiniz yoxdur.\nAbunə olmaq üçün: /subscribe');
            }

        } catch (error: any) {
            await ctx.reply('❌ Məlumatları çəkərkən xəta baş verdi. Zəhmət olmasa, sonra yenidən cəhd edin.');
        }
    });

    // --- Keyword-ü tutan handler ---
    bot.on(message('text'), async (ctx) => {
        if (!ctx.chat) return;
        const chatId = ctx.chat.id;
        const userText = ctx.message.text.trim();
        const state = userStates.get(chatId);
        
        // 1. Abunəlik üçün Keyword gözlənilir (INSERT üçün hazırlıq)
        if (state?.step === 'waitingForKeyword' && state.keyword === null) {
            state.keyword = userText;
            
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
        } 
        
        // 2. Ləğvetmə üçün Keyword gözlənilir (DELETE)
        else if (state?.step === 'waitingForUnsubscribeKeyword') {
            const keywordToDelete = userText;
            
            try {
                // DELETE sorğusu - count: 'exact' select() içindən delete() içərisinə köçürüldü
                const { error, count } = await supabase
                    .from(SUBSCRIPTIONS_TABLE) 
                    .delete({ count: 'exact' }) // 🔥 Düzəliş: Count buraya keçirildi
                    .eq('chat_id', chatId) 
                    .eq('keyword', keywordToDelete.toLowerCase())
                    .select('*'); // Select tək arqumentlə çağırılır
                
                if (error) {
                    console.error("❌❌ UNSUBSCRIBE SUPABASE ERROR:", error);
                    throw error; 
                }
                
                // count > 0 olarsa, abunəlik silinib.
                if (count && count > 0) {
                    await ctx.reply(`✅ '${keywordToDelete}' abunəliyi uğurla ləğv edildi.`);
                } else {
                    // count 0 olarsa, belə bir abunəlik tapılmayıb.
                    await ctx.reply(`❌ Abunəlik tapılmadı. '${keywordToDelete}' açar sözünə abunə deyilsiniz.`);
                }
                
            } catch (error: any) {
                console.error("❌❌ KRİTİK XƏTA: Unsubscribe prosesi xətası:", error.message);
                await ctx.reply(`❌ Ləğvetmə zamanı xəta baş verdi. Zəhmət olmasa, sonra cəhd edin.`);
            }
            
            userStates.delete(chatId); 
        } 
    });

    // --- Callback (Düymə) handler ---
    bot.on('callback_query', async (ctx) => {
        if (!('data' in ctx.callbackQuery) || !ctx.chat) return;
        const callbackData = ctx.callbackQuery.data;
        const chatId = ctx.chat.id;
        const state = userStates.get(chatId);

        if (state && state.keyword && callbackData.startsWith('freq_')) {
            const frequency = callbackData.replace('freq_', '') as 'daily' | 'weekly';
            
            try {
                // INSERT/UPSERT sorğusu
                const postData: SubscriptionInsert = {
                    chat_id: chatId, 
                    keyword: state.keyword.toLowerCase(),
                    frequency: frequency,
                    last_job_id: 0, // NULL xətasını həll edir
                };
                
                const { error } = await supabase
                    .from(SUBSCRIPTIONS_TABLE)
                    .upsert(postData as any, { onConflict: 'chat_id,keyword' }); 

                if (error) {
                    console.error("❌❌ KRİTİK INSERT SUPABASE XƏTASI:", error); 
                    throw error;
                }
                
                if (!error) {
                    await ctx.reply(
                        `🎉 *Təbrik edirik!* Siz **${state.keyword}** sözünə *${frequency.toUpperCase()}* abunə oldunuz.`,
                        { parse_mode: 'Markdown' }
                    );
                }
            } catch (error: any) {
                await ctx.reply(
                    `❌ Xəta baş verdi. Zəhmət olmasa, sonra yenidən cəhd edin. (Baxın terminal)`
                );
            }
            userStates.delete(chatId);
        }
        await ctx.answerCbQuery('Seçim qeydə alındı.');
    });
}