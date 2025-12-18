import { NextResponse } from 'next/server';

export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  type: string;
  url: string;
  date: string;
  source: string;
  tags: string[];
  description: string;
  score?: number;
}

const ARBEITNOW_API = 'https://arbeitnow.com/api/job-board-api'; // limit 100
const REMOTIVE_API = 'https://remotive.com/api/remote-jobs'; // limit might be high
const JOBICY_API = 'https://jobicy.com/api/v2/remote-jobs';

const fetchWithTimeout = async (url: string, timeout = 8000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      next: { revalidate: 3600 }
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get('query') || '';
  const locationFilter = searchParams.get('location') || '';

  try {
    // Build Upstream URLs dynamically
    const remotiveUrl = keyword
      ? `${REMOTIVE_API}?search=${encodeURIComponent(keyword)}`
      : REMOTIVE_API;

    // Use broad fetch for Jobicy and RemoteOK to ensure we don't miss jobs
    // that might match the keyword in description but not in API tags.
    // We will filter heavily client-side.
    const jobicyUrl = `${JOBICY_API}?count=100`;
    const remoteOkUrl = 'https://remoteok.com/api';

    const [arbeitRes, remotiveRes, jobicyRes, remoteOkRes] = await Promise.allSettled([
      fetchWithTimeout(ARBEITNOW_API),
      fetchWithTimeout(remotiveUrl),
      fetchWithTimeout(jobicyUrl),
      fetch(remoteOkUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
        next: { revalidate: 3600 }
      })
    ]);

    let allJobs: Job[] = [];

    // Process Arbeitnow
    if (arbeitRes.status === 'fulfilled' && arbeitRes.value.ok) {
      try {
        const data = await arbeitRes.value.json();
        const jobs = data.data.map((job: any) => ({
          id: `arb-${job.slug}`,
          title: job.title || 'Untitled',
          company: job.company_name || 'Unknown',
          location: job.location || 'Remote',
          type: job.job_types?.join(', ') || 'Full Time',
          url: job.url,
          date: new Date(job.created_at * 1000).toISOString(),
          source: 'Arbeitnow',
          tags: job.tags || [],
          description: job.description || ''
        }));
        allJobs = [...allJobs, ...jobs];
      } catch (e) { console.error('Arbeitnow parse error', e); }
    }

    // Process Remotive
    if (remotiveRes.status === 'fulfilled' && remotiveRes.value.ok) {
      try {
        const data = await remotiveRes.value.json();
        // Increase limit to capturing tail-end matches
        const limit = keyword ? 200 : 50;
        const jobs = (data.jobs || []).slice(0, limit).map((job: any) => ({
          id: `rem-${job.id}`,
          title: job.title || 'Untitled',
          company: job.company_name || 'Unknown',
          location: job.candidate_required_location || 'Remote',
          type: job.job_type || 'Full Time',
          url: job.url,
          date: job.publication_date,
          source: 'Remotive',
          tags: job.tags || [],
          description: job.description || ''
        }));
        allJobs = [...allJobs, ...jobs];
      } catch (e) { console.error('Remotive parse error', e); }
    }

    // Process Jobicy
    if (jobicyRes.status === 'fulfilled' && jobicyRes.value.ok) {
      try {
        const data = await jobicyRes.value.json();
        if (data.jobs && Array.isArray(data.jobs)) {
          const jobs = data.jobs.map((job: any) => ({
            id: `jobicy-${job.id}`,
            title: job.jobTitle || 'Untitled',
            company: job.companyName || 'Unknown',
            location: job.jobGeo || 'Remote',
            type: job.jobType || 'Full Time',
            url: job.url,
            date: job.pubDate,
            source: 'Jobicy',
            tags: job.jobLevel ? [job.jobLevel] : [],
            description: job.jobDescription || ''
          }));
          allJobs = [...allJobs, ...jobs];
        }
      } catch (e) { console.error('Jobicy parse error', e); }
    }

    // Process RemoteOK
    if (remoteOkRes.status === 'fulfilled' && remoteOkRes.value.ok) {
      try {
        const data = await remoteOkRes.value.json();
        if (Array.isArray(data)) {
          // First element is disclaimer
          // Fetch more candidates (300) to find specific country/keyword matches
          const validJobs = data.slice(1).map((job: any) => ({
            id: `rok-${job.id}`,
            title: job.position || 'Untitled',
            company: job.company || 'Unknown',
            location: job.location || 'Remote',
            type: 'Full Time',
            url: job.url,
            date: job.date,
            source: 'RemoteOK',
            tags: job.tags || [],
            description: job.description || ''
          }));
          allJobs = [...allJobs, ...validJobs.slice(0, 300)];
        }
      } catch (e) { console.error('RemoteOK parse error', e); }
    }

    // Client-side filtering with Regex for exact word matching options
    const filteredJobs = allJobs.filter(job => {
      const { type, level } = Object.fromEntries(searchParams);

      const matchKeyword = keyword ? (() => {
        const cleanKeyword = keyword.trim();
        const escaped = cleanKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Use word boundaries
        const regex = new RegExp(`\\b${escaped}\\b`, 'i');

        const inTitle = regex.test(job.title || '');
        const inCompany = regex.test(job.company || '');
        const inTags = (job.tags || []).some(tag => regex.test(tag || ''));
        const inDesc = regex.test(job.description || '');

        if (inTitle || inCompany || inTags || inDesc) {
          console.log(`[MATCH] Keyword: "${keyword}" matched Job: "${job.title}" (Src: ${job.source})`);
          // Logging details omitted for brevity
        }

        return inTitle || inCompany || inTags || inDesc;
      })() : true;

      const matchLocation = locationFilter ? (() => {
        const locString = (job.location || '').toLowerCase();
        const filterString = locationFilter.toLowerCase();

        // Direct match
        if (locString.includes(filterString)) return true;

        // Smart fallback for "India"
        if (filterString === 'india') {
          const indianCities = ['bangalore', 'bengaluru', 'delhi', 'mumbai', 'pune', 'hyderabad', 'chennai', 'noida', 'gurgaon', 'gurugram', 'kolkata', 'ahmedabad'];
          return indianCities.some(city => locString.includes(city));
        }

        // Synonyms for major Indian cities (e.g. Bangalore <-> Bengaluru)
        const synonyms: Record<string, string> = {
          'bangalore': 'bengaluru',
          'bengaluru': 'bangalore',
          'gurgaon': 'gurugram',
          'gurugram': 'gurgaon',
          'bombay': 'mumbai',
          'mumbai': 'bombay',
          'madras': 'chennai',
          'chennai': 'madras',
          'calcutta': 'kolkata',
          'kolkata': 'calcutta'
        };

        if (synonyms[filterString] && locString.includes(synonyms[filterString])) return true;

        return false;
      })() : true;

      const matchType = type ? (
        (job.type || '').toLowerCase().includes(type.toLowerCase())
      ) : true;

      const matchLevel = level ? (
        (job.title || '').toLowerCase().includes(level.toLowerCase()) ||
        (job.tags || []).some(tag => (tag || '').toLowerCase().includes(level.toLowerCase()))
      ) : true;

      return matchKeyword && matchLocation && matchType && matchLevel;
    }).map(job => {
      // Calculate relevance score
      let score = 0;
      if (keyword) {
        const cleanKeyword = keyword.trim();
        const escaped = cleanKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b${escaped}\\b`, 'i');

        if (regex.test(job.title || '')) score += 10;
        if ((job.tags || []).some(tag => regex.test(tag || ''))) score += 5;
        if (regex.test(job.company || '')) score += 2;
        if (regex.test(job.description || '')) score += 1;
      } else {
        score = 1; // Default score if no keyword
      }

      // Boost Indian jobs significantly
      const lowerLoc = (job.location || '').toLowerCase();
      const indianLocs = ['india', 'bangalore', 'bengaluru', 'delhi', 'mumbai', 'pune', 'hyderabad', 'chennai', 'noida', 'gurgaon', 'gurugram', 'kolkata', 'ahmedabad', 'thiruvananthapuram', 'kochi', 'chandigarh', 'jaipur', 'indore', 'lucknow'];

      if (indianLocs.some(loc => lowerLoc.includes(loc))) {
        score += 50; // High priority boost so local/relevant jobs appear first
      }

      return { ...job, score };
    });

    // Deduplication
    const seen = new Set();
    const uniqueJobs = filteredJobs.filter(job => {
      const key = `${job.title}-${job.company}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Sorting (Relevance then Date)
    uniqueJobs.sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    return NextResponse.json({
      jobs: uniqueJobs,
      count: uniqueJobs.length,
      sources: ['Arbeitnow', 'Remotive', 'Jobicy', 'RemoteOK']
    });

  } catch (error) {
    console.error("Job Fetch Error:", error);
    return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 });
  }
}
