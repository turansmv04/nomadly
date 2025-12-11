import type { NextApiRequest, NextApiResponse } from 'next';
import { createSupabaseClient } from '../../src/supabase'; 

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
    // Yalnız DELETE metodu ilə işləyirik
    if (req.method !== 'DELETE') {
        return res.status(405).json({ status: 'error', message: 'Method Not Allowed. Yalnız DELETE icazəlidir.' });
    }

    try {
        // DELETE sorğusunda məlumat req.body-də gəlir
        const { ch_id, keyword } = req.body; 

        if (!ch_id || !keyword) {
            return res.status(400).json({ status: 'error', message: 'Chat ID və Keyword tələb olunur.' });
        }

        const chatIdNumber = parseInt(ch_id, 10);
        if (isNaN(chatIdNumber)) {
            return res.status(400).json({ status: 'error', message: 'ch_id düzgün rəqəm formatında deyil.' });
        }

        const supabase = createSupabaseClient();
        
        // Supabase-də 'subscribe' cədvəlindən silmə əməliyyatı
        const { error, count } = await supabase
            .from('subscribe') // Sizin subscribe cədvəlinizin adı
            .delete({ count: 'exact' }) // Silinən sətirlərin sayını qaytarmaq
            .eq('chat_id', chatIdNumber) 
            .eq('keyword', keyword.toLowerCase().trim()); // Kiçik hərflərlə müqayisə

        if (error) {
            console.error('❌ Supabase silmə xətası:', error.message);
            return res.status(500).json({ status: 'error', message: `Bazadan silinərkən xəta: ${error.message}` });
        }

        if (count && count > 0) {
            // Uğurla silindi
            return res.status(200).json({ status: 'success', message: 'Subscription successfully deleted' });
        } else {
            // Abunəlik tapılmadı
            return res.status(404).json({ status: 'error', message: 'Subscription not found' });
        }

    } catch (error: any) {
        console.error('API Unsubscribe Gözlənilməyən Xəta:', error);
        return res.status(500).json({ status: 'error', message: 'Daxili server xətası.' });
    }
}