import type { Browser, Page, Locator } from 'playwright'; 
import { chromium } from 'playwright';
import { insertOrUpdateSupabase } from './supabase'; 

export interface ScrapedJobData {
    title: string;
    companyName: string; 
    url: string;
    salary: string;
    siteUrl: string; 
}

const BASE_URL: string = 'https://www.workingnomads.com'; 
const TARGET_URL: string = `${BASE_URL}/jobs?postedDate=1`; 

const SELECTORS = {
    JOB_CONTAINER: '.job-wrapper',
    TITLE_URL: 'h4.hidden-xs a',
    COMPANY_CONTAINER: '.job-company', 
    LIST_SALARY: 'div[ng-show*="model.salary_range"] span.about-job-line-text.ng-binding',
    LIST_PARENT: 'div.jobs-list',
    DETAIL_SALARY_A: '.job-details-inner div:has(i.fa-money)', 
    DETAIL_SALARY_B: 'div.job-detail-sidebar:has(i.fa-money)',
};

// 🔥 ULTRA FAST DETAIL SALARY (Render üçün)
async function scrapeDetailPageForSalary(browser: Browser, url: string): Promise<string> {
    const detailPage = await browser.newContext({
        viewport: { width: 400, height: 600 }, // Kiçik ekran = sürət
        userAgent: 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
    }).then(ctx => ctx.newPage());
    
    let salary = 'N/A';

    try {
        // 🔥 8s timeout + networkidle
        await detailPage.goto(url, { 
            timeout: 8000, 
            waitUntil: 'networkidle' 
        });
        
        // 🔥 Resource blocking
        await detailPage.route('**/*', route => {
            const type = route.request().resourceType();
            if (['image', 'stylesheet', 'font', 'media'].includes(type)) {
                route.abort();
            } else {
                route.continue();
            }
        });

        // 🔥 Salary A və ya B
        const locatorA = detailPage.locator(SELECTORS.DETAIL_SALARY_A).filter({ hasText: '$' }).first();
        const locatorB = detailPage.locator(SELECTORS.DETAIL_SALARY_B).filter({ hasText: '$' }).first();
        
        let salaryText: string | null = null;
        
        try { 
            salaryText = await locatorA.innerText({ timeout: 2000 }); 
        } catch (e) {
            try { 
                salaryText = await locatorB.innerText({ timeout: 2000 }); 
            } catch (e) { }
        }
        
        if (salaryText && salaryText.includes('$')) {
            const lines = salaryText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
            const salaryLine = lines.find(line => line.includes('$'));
            salary = salaryLine ? salaryLine : salaryText.trim();
        }
        
    } catch (e) {
        // Səssiz
    } finally {
        await detailPage.close().catch(() => {});
    }
    
    return salary;
}

async function extractInitialJobData(wrapper: Locator): Promise<ScrapedJobData> {
    const titleLocator = wrapper.locator(SELECTORS.TITLE_URL).first();
    let title = '', relativeUrl = null, url = 'N/A', companyName = 'N/A', salary = 'N/A';
    
    try {
        title = (await titleLocator.innerText({ timeout: 1500 })).trim();
        relativeUrl = await titleLocator.getAttribute('href');
        url = relativeUrl ? `${BASE_URL}${relativeUrl}` : 'N/A';
    } catch (e) {
        return { title: '', companyName: 'N/A', url: 'N/A', salary: 'N/A', siteUrl: BASE_URL }; 
    }

    // Company
    try {
        const companyContainerLocator = wrapper.locator(SELECTORS.COMPANY_CONTAINER).first(); 
        let rawText = (await companyContainerLocator.innerText({ timeout: 1000 })).trim(); 
        let cleanedText = rawText.replace(/\s+/g, ' ').trim();
        
        const lowerCaseName = cleanedText.toLowerCase();
        if (cleanedText.length > 2 && 
            !lowerCaseName.includes('full-time') && 
            !lowerCaseName.includes('remote') &&
            !lowerCaseName.includes('jobs')) {
            companyName = cleanedText;
        }
    } catch (e) { companyName = 'N/A'; }
    
    // URL-dən company
    if (companyName === 'N/A' || companyName.length < 3) {
        const urlParts = url.split('-');
        const companyIndex = urlParts.findIndex(part => /^\d{7}$/.test(part)); 
        if (companyIndex > 0) {
            let guess = urlParts[companyIndex - 1];
            companyName = guess.charAt(0).toUpperCase() + guess.slice(1);
        }
    }
    
    // List salary (backup)
    try {
        const salaryLocator = wrapper.locator(SELECTORS.LIST_SALARY).filter({ hasText: '$' }).first();
        const salaryText = await salaryLocator.innerText({ timeout: 500 });
        if (salaryText.includes('$') && salaryText.length > 5) {
            salary = salaryText.trim();
        }
    } catch (e) { }

    return { title, companyName, url, salary, siteUrl: BASE_URL };
}

// 🔥 BATCH SALARY (3 parallel, Render-safe)
async function batchScrapeDetailSalaries(
    browser: Browser, 
    jobs: ScrapedJobData[], 
    maxJobs: number = 30 // Render limit
): Promise<void> {
    const jobsToCheck = jobs
        .filter(job => job.salary === 'N/A' && job.url.startsWith(BASE_URL))
        .slice(0, maxJobs);
    
    console.log(`💰 ${jobsToCheck.length}/${jobs.length} detail salary yoxlanılır...`);
    
    for (let i = 0; i < jobsToCheck.length; i += 3) { // 3 parallel
        const batch = jobsToCheck.slice(i, i + 3);
        
        await Promise.all(
            batch.map(async (job) => {
                job.salary = await scrapeDetailPageForSalary(browser, job.url);
            })
        );
        
        console.log(`💰 ${Math.min(i + 3, jobsToCheck.length)}/${jobsToCheck.length} tamamlandı`);
        await new Promise(r => setTimeout(r, 500)); // Rate limit
    }
}

export async function runScrapeAndGetData() {
    console.log(`🚀 WorkingNomads Scraper START (DETAIL SALARY)`);
    console.log(`🌐 ${TARGET_URL}`);
    
    const browser: Browser = await chromium.launch({ 
        headless: true,
        timeout: 45000,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-extensions',
            '--disable-plugins',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
        ]
    });     
    
    const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        userAgent: 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36',
        bypassCSP: true,
        ignoreHTTPSErrors: true,
    });
    
    const page: Page = await context.newPage();
    
    await page.route('**/*', route => {
        const resourceType = route.request().resourceType();
        if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
            route.abort();
        } else {
            route.continue();
        }
    });

    try {
        console.log('⏳ Naviqasiya...');
        await page.goto(TARGET_URL, { 
            timeout: 20000, 
            waitUntil: 'networkidle' 
        });
        
        console.log('✅ Səhifə yükləndi');
        await page.waitForTimeout(2000);
        await page.waitForSelector(SELECTORS.LIST_PARENT, { timeout: 10000 });
        console.log('✅ List tapıldı');

        // Scroll (15 max)
        let scrollCount = 0, previousCount = 0;
        while (scrollCount < 15) {
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            await page.waitForTimeout(1500);
            
            const currentCount = await page.locator(SELECTORS.JOB_CONTAINER).count();
            if (currentCount === previousCount) break;
            
            console.log(`📊 ${currentCount} elan`);
            previousCount = currentCount;
            scrollCount++;
        }
        
        const jobWrappers = await page.locator(SELECTORS.JOB_CONTAINER).all();
        const initialResults: ScrapedJobData[] = await Promise.all(
            jobWrappers.slice(0, 50).map(extractInitialJobData)
        );
        
        const validJobs = initialResults.filter(job => job.title.length > 0 && job.url !== 'N/A');
        console.log(`✅ ${validJobs.length} valid iş`);

        // 🔥 DETAIL SALARY BATCH
        await batchScrapeDetailSalaries(browser, validJobs, 30);

        console.log('💾 Supabase-ə yazılır...');
        await insertOrUpdateSupabase(validJobs);

        console.log(`✅ TAMAMLANDI! ${validJobs.filter(j => j.salary !== 'N/A').length} salary tapıldı`);
        return validJobs;

    } catch (e: any) {
        console.error(`❌ XƏTA: ${e.message}`);
        throw new Error(`Scrape failed: ${e.message}`);
    } finally {
        await browser.close();
        console.log('🔚 Browser bağlandı');
    }
}
