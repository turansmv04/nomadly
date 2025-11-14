// my-scrape-project/pages/api/cron_scrape.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { runScrapeAndGetData } from '../../src/scrape'; 

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }
    try {
        await runScrapeAndGetData(); 
        return res.status(200).json({ message: '✅ Gündəlik Scrape prosesi uğurla tamamlandı.' });
    } catch (error: any) {
        console.error("Cron Scrape API-də kritik xəta baş verdi:", error);
        return res.status(500).json({ message: '❌ Daxili server xətası.', error: error.message });
    }
}