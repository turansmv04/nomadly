// src/scrape.ts

import { chromium } from 'playwright'; 

// 🚨 scrape.ts faylında export etdiyimiz interfeys
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
        console.log("🚀 Scraping prosesi BAŞLADI.");
        console.log("🔑 Supabase sirləri yükləndi."); // Sirlərin yükləndiyini təsdiq edir

        // 1. Playwright brauzerini işə sal
        // Brauzeri maksimum uyğunluq üçün sadə şəkildə işə salırıq.
        browser = await chromium.launch({
            headless: true,
            timeout: 30000 // 30 saniyə timeout əlavə edirik
        });
        
        const context = await browser.newContext();
        const page = await context.newPage();

        console.log("🌐 Brauzer və Səhifə (Page) uğurla yaradıldı. İNDİ SƏHİFƏYƏ KEÇİLİR.");

        // 2. Məlumatları çəkmə məntiqi (Sizin kodunuzun əsas hissəsi)
        
        const TARGET_URL = 'https://example.com'; 
        
        await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });
        
        const title = await page.textContent('h1');
        console.log(`✅ Saytın Başlığı UĞURLA ÇƏKİLDİ: ${title}`);
        
        // --- Kodunuz burada davam edir ---
        
        console.log("🏆 Scraping uğurla TAMAMLANDI.");
        console.log("-----------------------------------------");

    } catch (error) {
        // Hər hansı bir xətanı (Launch xətası və ya Page xətası) tuturuq
        console.error("❌ FATAL XƏTA BAŞ VERDİ:");
        console.error("Məlumat:", (error as Error).message || error); 
        
        if (browser) {
            await browser.close();
        }
        process.exit(1); 
        
    } finally {
        if (browser) {
            await browser.close();
            console.log("Browser bağlandı.");
        }
    }
}

runScrape();