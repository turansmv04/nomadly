// pages/api/scrape.ts (Final Versiya: 20:00, 04:00, 12:00)

import { runScrapeAndGetData } from '../../src/scrape'; 
import type { NextApiRequest, NextApiResponse } from 'next';

// 🛑 isRunning flagı hələ də serverless mühitdə 100% etibarlı deyil, lakin sığorta kimi saxlayırıq.
let isRunning = false; 

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
    
    // 1. MONITORING ZƏNGLƏRİNİ QƏBUL ET (405 XƏTASINI HƏLL EDİR)
    if (req.method === 'HEAD') {
        // Monitorinq/Uptime Robot yoxlaması üçün dərhal OK cavabı ver.
        return res.status(200).json({ message: 'Monitor Check OK (HEAD).' });
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    // 2. VAJİB: Vaxtı Yoxla (Baku Time Zone)
    const now = new Date();
    const bakuTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Baku' }));
    const hour = bakuTime.getHours();
    
    // İşləməli olan saatlar: 20:00, 04:00, 12:00
    const isScheduleTime = (hour === 20 || hour === 4 || hour === 12); 

    if (!isScheduleTime) {
        // Vaxt deyilsə (Uptime Robot hər 5 dəq-dən bir zəng etdiyi üçün), OK cavabını ver və heç nə etmə.
        return res.status(200).json({ message: `Scrape skipped. Current hour is ${hour}. Scheduled for 20, 4, or 12.` });
    }
    
    // 3. İşləmə Vaxtıdırsa, Statusu Yoxla
    if (isRunning) {
        return res.status(429).json({ 
            message: '⏳ Scraping artıq işləyir.'
        });
    }

    try {
        isRunning = true;
        
        // 🛑 ASİNXRON BAŞLANĞIC: await-i sil! Bu, 30 saniyə Timeout-u pozmamaq üçün vacibdir.
        runScrapeAndGetData() 
            .then(() => console.log('✅ Scraping işi uğurla tamamlandı.'))
            .catch((error) => console.error('❌ Scraping işində xəta:', error))
            .finally(() => {
                // İş 35 dəqiqə sonra bitdikdə statusu yenilə.
                isRunning = false;
            }); 
            
        // 4. DƏRHƏL cavab qaytar (Bu, Uptime Robot/Cron-Job.org üçün uğur deməkdir)
        return res.status(200).json({ 
            message: 'Scraping arxa fonda uğurla başladıldı. (Saat: ' + hour + ')',
        });

    } catch (error: any) {
        isRunning = false; 
        console.error("API-də başlanğıc xətası:", error);
        return res.status(500).json({ 
            message: 'Başlanğıc xətası.', 
            error: error.message 
        });
    }
}