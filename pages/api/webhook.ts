import { NextApiRequest, NextApiResponse } from 'next';
import { Telegraf } from 'telegraf';
import { processBotCommands } from '../../bot'; 

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!);
processBotCommands(bot);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    try {
      await bot.handleUpdate(req.body);
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Webhook Error' });
    }
  }
  return res.status(200).send('Bot is running...');
}