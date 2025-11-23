// pages/api/scrape.ts

import { runScrapeAndGetData } from '../../src/scrape'; 
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    res.status(200).json({ 
        message: 'Scraping started in background...'
    });

    try {
        await runScrapeAndGetData();
        console.log('✅ Scraping completed successfully');
    } catch (error: any) {
        console.error("❌ Scraping error:", error.message);
    }
}