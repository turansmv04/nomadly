import { Telegraf } from 'telegraf';
import { processBotCommands } from '../bot';

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!);
processBotCommands(bot);

export default async function handler(req: any, res: any) {
  if (req.method === 'POST') {
    try {
      await bot.handleUpdate(req.body);
      return res.status(200).send('OK');
    } catch (err) {
      console.error(err);
      return res.status(500).send('Internal Error');
    }
  }
  return res.status(200).send('Bot is online!');
}