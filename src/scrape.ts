import { chromium } from 'playwright'; 
// Əgər '@sparticuz/chromium' istifadə edirsinizsə, onu bura import edin

// Supabase ilə əlaqə qurmaq üçün lazım olan sirlər (secrets)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

// Playwright skriptini asinxron funksiya daxilində icra edirik
async function runScrape() {
    let browser = null; 
    
    // Sirlərin yükləndiyini yoxlayın
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        console.error("XƏTA: SUPABASE_URL və ya SUPABASE_ANON_KEY mühit dəyişənləri tapılmadı.");
        process.exit(1);
    }
    
    try {
        console.log("-----------------------------------------");
        console.log("🚀 Scraping prosesi başladı.");
        console.log("Supabase URL:", SUPABASE_URL);

        // 1. Playwright brauzerini işə sal
        // Əgər siz '@sparticuz/chromium' istifadə edirsinizsə, launch əmri fərqli ola bilər.
        // Standart Playwright launch əmri:
        browser = await chromium.launch({
            headless: true // GitHub Actions mühitində headless olmalıdır
        });
        
        const context = await browser.newContext();
        const page = await context.newPage();

        console.log("🌐 Brauzer və Səhifə (Page) uğurla yaradıldı.");

        // 2. Məlumatları çəkmə məntiqi (Sizin kodunuzun əsas hissəsi)
        
        const TARGET_URL = 'https://example.com'; // Sizin scraping etdiyiniz URL
        
        console.log(`📡 Hədəf URL-a keçid: ${TARGET_URL}`);
        
        await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });

        // --- Sizin Məlumat Çəkmə (Scraping) Kodunuz Buradan Başlayır ---
        
        // Məsələn: Saytdan bir başlığı çəkmək
        const title = await page.textContent('h1');
        console.log(`✅ Saytın Başlığı: ${title}`);
        
        // --- Sizin Məlumatları Supabase-a Yazma Kodunuz ---
        
        // Məsələn: Supabase klientini başlatmaq və məlumatı daxil etmək
        // const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        // await supabase.from('your_table').insert([{ title: title, scraped_at: new Date() }]);
        
        // --- Sizin Məlumat Çəkmə Kodunuz Burada BİTİR ---
        
        console.log("🏆 Scraping uğurla tamamlandı. Məlumatlar Supabase-a yazıldı (fərz edilir).");
        console.log("-----------------------------------------");

    } catch (error) {
        // 🔥 KRİTİK ƏLAVƏ: Ən kiçik xətanı belə görmək üçün 🔥
        console.error("❌ XƏTA BAŞ VERDİ:", (error as Error).message || error); 
        console.error("❌ Xətanın Tam Stack Trace-i:", error);
        
        // Skriptin xəta kodu (1) ilə çıxması üçün
        process.exit(1); 
        
    } finally {
        // Brauzeri həmişə bağla
        if (browser) {
            await browser.close();
            console.log("Browser bağlandı.");
        }
    }
}

// Skripti işə sal
runScrape();