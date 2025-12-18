import { NextApiRequest, NextApiResponse } from 'next';
import { runScrapeAndGetData } from '../../src/scrape';
import { processSubscriptions } from '../../src/notifier';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  
  try {
    console.log("🚀 Cron Job başladı (Bakı vaxtı 11:00)...");

    await runScrapeAndGetData();
    console.log("✅ Scrape prosesi bitdi.");

    console.log("📅 Gündəlik abunəçilər üçün bildirişlər göndərilir...");
    await processSubscriptions('daily');

    const today = new Date();
    if (today.getDay() === 0) {
      console.log("📅 Bugün Bazar günüdür, həftəlik abunəçilər emal olunur...");
      await processSubscriptions('weekly');
    }

    return res.status(200).json({ 
      success: true, 
      message: "Proses uğurla tamamlandı." 
    });

  } catch (error: any) {
    console.error("❌ Cron Xətası:", error.message);
    return res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}