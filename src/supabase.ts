// src/scrape.ts

import { chromium } from 'playwright'; 

// 🚨 Diqqət: Bu interfeys 'supabase.ts' faylı tərəfindən istifadə olunur, ona görə EXPORT edilməlidir.
export interface ScrapedJobData {
    title: string;
    company: string;
    link: string;
    // ... digər sahələr (lazım gələrsə əlavə edin)
}

// Supabase ilə əlaqə qurmaq üçün lazım olan sirlər (secrets)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;


async function runScrape() {
    let browser = null; 
    
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        console.error("XƏTA: SUPABASE_URL və ya SUPABASE_ANON_KEY mühit dəyişənləri tapılmadı.");
        process.exit(1);
    }
    
    try {
        console.log("-----------------------------------------");
        console.log("🚀 Scraping prosesi başladı.");

        browser = await chromium.launch({
            headless: true
        });
        
        const context = await browser.newContext();
        const page = await context.newPage();

        console.log("🌐 Brauzer və Səhifə (Page) uğurla yaradıldı.");

        const TARGET_URL = 'https://example.com'; 
        console.log(`📡 Hədəf URL-a keçid: ${TARGET_URL}`);
        
        await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });

        // --- Sizin Məlumat Çəkmə (Scraping) Kodunuz Buradan Başlayır ---
        
        const title = await page.textContent('h1');
        console.log(`✅ Saytın Başlığı: ${title}`);
        
        // Məsələn, yığılmış datanı bu interfeysə uyğunlaşdırmaq:
        // const jobData: ScrapedJobData = { title: title, company: 'X', link: page.url() };
        
        // --- Sizin Məlumat Çəkmə Kodunuz Burada BİTİR ---
        
        console.log("🏆 Scraping uğurla tamamlandı.");
        console.log("-----------------------------------------");

    } catch (error) {
        // 🔥 DÜZƏLİŞ: 'unknown' tip xətası burada həll edilir. 🔥
        console.error("❌ XƏTA BAŞ VERDİ:", (error as Error).message || error); 
        console.error("❌ Xətanın Tam Stack Trace-i:", error);
        
        process.exit(1); 
        
    } finally {
        if (browser) {
            await browser.close();
            console.log("Browser bağlandı.");
        }
    }
}

// Skripti işə sal
runScrape();