import type { NextApiRequest, NextApiResponse } from 'next';
import { processSubscriptions } from '../../src/notifier';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method Not Allowed.' });
    }
    
    try {
        // Həftəlik abunəçiləri emal edirik
        await processSubscriptions('weekly');
        
        return res.status(200).json({ status: 'success', message: '✅ Həftəlik bildirişlər emal edildi.' });
    } catch (error: any) {
        console.error("Cron Weekly API-də gözlənilməyən xəta:", error);
        return res.status(500).json({ status: 'error', message: '❌ Daxili server xətası.' });
    }
}