// my-scrape-project/pages/api/subscribe.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import { createSupabaseClient } from '../../src/supabase'; 

type SubscriberInsertFixed = {
    chat_id: number;
    keyword: string;
    frequency: 'daily' | 'weekly';
    last_job_id?: number | null; 
};

interface InitialSubscriberData {
    ch_id: string; 
    keyword: string;
    frequency: 'daily' | 'weekly';
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed. Yalnız POST icazəlidir.' });
    }

    const { ch_id, keyword, frequency }: InitialSubscriberData = req.body;

    if (!ch_id || !keyword || !frequency) {
        return res.status(400).json({ status: 'error', message: 'Göstərilən məlumatlar (ch_id, keyword, frequency) tam deyil.' });
    }
    
    const chatIdNumber = parseInt(ch_id, 10);
    if (isNaN(chatIdNumber)) {
        return res.status(400).json({ status: 'error', message: 'ch_id düzgün rəqəm formatında deyil.' });
    }

    try {
        const supabase = createSupabaseClient();
        
        const subscriptionData: SubscriberInsertFixed = {
            chat_id: chatIdNumber, 
            keyword: keyword.toLowerCase().trim(),
            frequency: frequency,
            last_job_id: 0, // 🛑 DÜZƏLİŞ 2: İlkin dəyəri 0 təyin edirik
        };

        const { error } = await supabase
            .from('subscribe') 
            // @ts-ignore
            .upsert([subscriptionData], { 
                // 🛑 DÜZƏLİŞ 1: Konflikti chat_id və keyword kombinasiyası üzərində həll edirik
                onConflict: 'chat_id, keyword', 
                ignoreDuplicates: false 
            })
            .select();

        if (error) {
            console.error("❌ Supabase yazılma xətası:", error.message);
            return res.status(500).json({ status: 'error', message: `Bazaya yazılarkən xəta: ${error.message}` });
        }

        return res.status(201).json({ 
            status: 'success', 
            message: `Abunəlik uğurla yaradıldı/yeniləndi: ${keyword}`, 
        });

    } catch (error: any) {
        console.error("API-də gözlənilməyən xəta:", error);
        return res.status(500).json({ status: 'error', message: 'Daxili server xətası.' });
    }
}