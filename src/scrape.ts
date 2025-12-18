import axios from 'axios';
import { insertOrUpdateSupabase } from './supabase';
import type { Database } from '../database.types'; 
import * as dotenv from 'dotenv'; 
dotenv.config(); 

type JobInsert = Database['public']['Tables']['jobs']['Insert'];

const TARGET_PAGE_URL = 'https://www.workingnomads.com/jobs?postedDate=1';
const SEARCH_API = 'https://www.workingnomads.com/jobsapi/_search'; 

export async function runScrapeAndGetData() {
    console.log(`\n🔎 Scrape hədəfi: ${TARGET_PAGE_URL}`);
    
    try {
        const payload = {
            "track_total_hits": true,
            "from": 0,
            "size": 250, // Bir az daha çox çəkək ki, hamısını görək
            "_source": ["company", "id", "slug", "title", "salary_range_short", "annual_salary_usd", "url", "apply_url"],
            "sort": [{ "pub_date": { "order": "desc" } }],
            "query": {
                "bool": {
                    "filter": [{ "range": { "pub_date": { "gte": "now-1d/d" } } }]
                }
            }
        };

        const response = await axios.post(SEARCH_API, payload);
        const hits = response.data.hits?.hits || [];
        
        if (hits.length === 0) {
            console.log(`⚠️ Yeni elan tapılmadı.`);
            return;
        }

        const rawJobs: JobInsert[] = hits.map((hit: any) => {
            const s = hit._source;
            let jobUrl = s.url || s.apply_url || `https://www.workingnomads.com/jobs/${s.slug}-${s.id}`;
            if (jobUrl.startsWith('/')) jobUrl = `https://www.workingnomads.com${jobUrl}`;

            return {
                title: s.title || 'N/A',
                company: s.company || 'N/A', 
                url: jobUrl,
                salary: s.salary_range_short || (s.annual_salary_usd ? `$${s.annual_salary_usd}` : 'N/A'),
                siteUrl: 'www.workingnomads.com'
            };
        });

        // 🔥 KRİTİK HİSSƏ: Dublikatları təmizləyirik (URL-ə görə)
        // Bu hissə "ON CONFLICT" xətasını 100% həll edir
        const uniqueJobsMap = new Map();
        rawJobs.forEach(job => {
            if (job.url) {
                uniqueJobsMap.set(job.url, job);
            }
        });

        const finalUniqueJobs = Array.from(uniqueJobsMap.values());

        console.log(`✅ Cəmi ${rawJobs.length} elan tapıldı.`);
        console.log(`🎯 ${rawJobs.length - finalUniqueJobs.length} dublikat silindi.`);
        console.log(`🚀 ${finalUniqueJobs.length} unikal elan Supabase-ə yazılır...`);

        await insertOrUpdateSupabase(finalUniqueJobs);
        console.log(`✨ Uğurla tamamlandı!`);

    } catch (e: any) {
        console.error(`❌ Scrape xətası: ${e.message}`);
    }
}

if (require.main === module) {
    runScrapeAndGetData().catch(console.error);
}