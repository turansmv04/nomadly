import { runScrapeAndGetData } from '../src/scrape';
import { processSubscriptions } from '../src/notifier';

export default async function handler(req: any, res: any) {
  // Təhlükəsizlik üçün: Vercel Cron-dan gəldiyini yoxlaya bilərik
  try {
    console.log("🚀 Cron Job başladı...");
    
    // 1. Yeni işləri çək
    await runScrapeAndGetData();
    
    // 2. Abunəçilərə mesaj göndər (Gündəlik olanlar)
    await processSubscriptions('daily');
    
    return res.status(200).json({ success: true, message: "Scrape and Notify done!" });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
}