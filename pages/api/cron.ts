// pages/api/cron.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const now = new Date();
    const bakuTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Baku' }));
    
    const hour = bakuTime.getHours();
    const dayOfWeek = bakuTime.getDay(); // 0=Sunday, 1=Monday
    
    console.log(`🕐 Bakı vaxtı: ${bakuTime.toLocaleString('az-AZ')} | Saat: ${hour} | Gün: ${dayOfWeek}`);
    
    const results: string[] = [];

    try {
        // Hər gün saat 10:00 - Scraping
        if (hour === 10) {
            console.log('🔄 Scraping başlayır...');
            await axios.get(`${BASE_URL}/api/cron_scrape`, { timeout: 300000 }); // 5 min timeout
            results.push('✅ Scraping tamamlandı');
        }
        
        // Hər gün saat 11:00 - Gündəlik bildirişlər
        if (hour === 11) {
            console.log('📨 Gündəlik bildirişlər göndərilir...');
            await axios.get(`${BASE_URL}/api/cron_daily`, { timeout: 60000 });
            results.push('✅ Gündəlik bildirişlər göndərildi');
            
            // Bazar ertəsi isə həftəlik də göndər
            if (dayOfWeek === 1) {
                console.log('📨 Həftəlik bildirişlər göndərilir...');
                await axios.get(`${BASE_URL}/api/cron_weekly`, { timeout: 60000 });
                results.push('✅ Həftəlik bildirişlər göndərildi');
            }
        }
        
        if (results.length === 0) {
            results.push(`⏰ Hazırda icra ediləcək iş yoxdur (Saat: ${hour})`);
        }

        return res.status(200).json({ 
            message: '✅ Cron yoxlandı',
            time: bakuTime.toLocaleString('az-AZ'),
            hour,
            dayOfWeek,
            results
        });

    } catch (error: any) {
        console.error('❌ Cron xətası:', error.message);
        return res.status(500).json({ 
            message: '❌ Cron xətası',
            error: error.message 
        });
    }
}