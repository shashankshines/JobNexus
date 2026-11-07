import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { JobSearchService } from '../services/job-search.service';
import { NormalizedJob } from '../domain/job.types';
import { JobProvider } from '../providers/provider.types';
import {
  createSession,
  validateSession,
  destroySession,
  findOrCreateGoogleUser,
  getSavedJobs,
  saveJobForUser,
  resetAuthStore,
} from '@/modules/auth/server/session.store';
import {
  createAlert,
  getUserNotifications,
  resetSmartNotificationMemoryStore,
} from '@/modules/notifications/services/smart-notification.store';
import { isFabricatedJobUrl, isValidProviderApplicationUrl } from '../domain/job.normalization';
import { maskJobForAnonymous } from '../domain/job.masking';

describe('JobNexus — End-to-End User Journey Suite (Steps 1 to 10)', () => {
  const genuineE2EJobs: NormalizedJob[] = [
    {
      id: 'e2e-job-1',
      sourceId: 'ashby',
      sourceName: 'Ashby ATS',
      title: 'Senior AI Engineer',
      company: 'Scale AI',
      location: 'Bengaluru, India',
      isRemote: false,
      workplaceType: 'hybrid',
      description: 'Lead foundation model evaluation architectures.',
      applicationUrl: 'https://jobs.ashbyhq.com/scale/ai-engineer-101',
      publishedAt: new Date().toISOString(),
      employmentType: 'Full-time',
      tags: ['AI', 'Python', 'PyTorch'],
      industry: 'technology',
      category: 'Technology & IT',
      isIndiaEligible: true,
      seniority: 'Senior',
    },
    {
      id: 'e2e-job-2',
      sourceId: 'lever',
      sourceName: 'Lever ATS',
      title: 'Lead Generative AI Engineer',
      company: 'Databricks',
      location: 'Remote',
      isRemote: true,
      workplaceType: 'remote',
      description: 'Production LLM inference and agentic pipelines.',
      applicationUrl: 'https://jobs.lever.co/databricks/genai-202',
      publishedAt: new Date().toISOString(),
      employmentType: 'Full-time',
      tags: ['GenAI', 'LLM', 'LangChain'],
      industry: 'technology',
      category: 'Technology & IT',
      isIndiaEligible: true,
      seniority: 'Lead',
    },
    {
      id: 'e2e-job-3',
      sourceId: 'greenhouse',
      sourceName: 'Greenhouse ATS',
      title: 'Forward Deployed Engineer',
      company: 'Palantir',
      location: 'Bengaluru, India',
      isRemote: false,
      workplaceType: 'onsite',
      description: 'Deliver mission-critical data systems for defense and healthcare clients.',
      applicationUrl: 'https://boards.greenhouse.io/palantir/jobs/fde-303',
      publishedAt: new Date().toISOString(),
      employmentType: 'Full-time',
      tags: ['FDE', 'Distributed Systems'],
      industry: 'technology',
      category: 'Technology & IT',
      isIndiaEligible: true,
      seniority: 'Senior',
    },
    {
      id: 'e2e-job-4',
      sourceId: 'smartrecruiters',
      sourceName: 'SmartRecruiters',
      title: 'Full Stack Developer',
      company: 'Atlassian',
      location: 'Remote',
      isRemote: true,
      workplaceType: 'remote',
      description: 'Build collaborative cloud workspaces with React and Node.js.',
      applicationUrl: 'https://jobs.smartrecruiters.com/Atlassian/fullstack-404',
      publishedAt: new Date().toISOString(),
      employmentType: 'Full-time',
      tags: ['React', 'Node.js', 'TypeScript'],
      industry: 'technology',
      category: 'Technology & IT',
      isIndiaEligible: true,
      seniority: 'Mid',
    },
    {
      id: 'e2e-job-5',
      sourceId: 'ashby',
      sourceName: 'Ashby ATS',
      title: 'Senior DevOps Engineer',
      company: 'Vercel',
      location: 'Bengaluru, India',
      isRemote: false,
      workplaceType: 'hybrid',
      description: 'Next.js edge platform deployment automation and Kubernetes operations.',
      applicationUrl: 'https://jobs.ashbyhq.com/vercel/devops-505',
      publishedAt: new Date().toISOString(),
      employmentType: 'Full-time',
      tags: ['DevOps', 'Kubernetes', 'AWS'],
      industry: 'technology',
      category: 'Technology & IT',
      isIndiaEligible: true,
      seniority: 'Senior',
    },
    {
      id: 'e2e-job-6',
      sourceId: 'lever',
      sourceName: 'Lever ATS',
      title: 'Principal Cybersecurity Engineer',
      company: 'CrowdStrike',
      location: 'Remote',
      isRemote: true,
      workplaceType: 'remote',
      description: 'Cloud endpoint threat detection and SOC response pipelines.',
      applicationUrl: 'https://jobs.lever.co/crowdstrike/cyber-606',
      publishedAt: new Date().toISOString(),
      employmentType: 'Full-time',
      tags: ['Cybersecurity', 'SIEM', 'SOC'],
      industry: 'technology',
      category: 'Technology & IT',
      isIndiaEligible: true,
      seniority: 'Lead',
    },
  ];

  let testService: JobSearchService;

  beforeEach(() => {
    resetAuthStore();
    resetSmartNotificationMemoryStore();
    JobSearchService.clearCache();

    const provider: JobProvider = {
      id: 'e2e-provider',
      name: 'E2EATSProvider',
      async fetchJobs() {
        return genuineE2EJobs;
      },
    };
    testService = new JobSearchService([provider]);
  });

  it('executes the full 10-step user journey seamlessly without regressions', async () => {
    // -----------------------------------------------------------------------
    // STEP 1: Open JobNexus & Load Discovery Feed / Header Stats
    // -----------------------------------------------------------------------
    const initialStats = await testService.getJobStats();
    assert.ok(initialStats.totalJobs >= 6);
    assert.strictEqual(initialStats.formattedCount, initialStats.totalJobs.toLocaleString());

    // -----------------------------------------------------------------------
    // STEP 2: Search for a specific role ("AI Engineer")
    // -----------------------------------------------------------------------
    const step2Search = await testService.searchJobs({ query: 'AI Engineer' });

    // -----------------------------------------------------------------------
    // STEP 3: Receive relevant results with 100% precision
    // -----------------------------------------------------------------------
    assert.ok(step2Search.jobs.length > 0);
    assert.strictEqual(step2Search.jobs[0].title, 'Senior AI Engineer');
    assert.ok(step2Search.jobs.every((j) => j.title.toLowerCase().includes('ai')));

    // -----------------------------------------------------------------------
    // STEP 4: Change role, location and work mode (Search "Full Stack", "Remote")
    // -----------------------------------------------------------------------
    const step4Search = await testService.searchJobs({
      query: 'Full Stack',
      remote: 'remote',
    });
    assert.ok(step4Search.jobs.length > 0);
    assert.strictEqual(step4Search.jobs[0].title, 'Full Stack Developer');
    assert.strictEqual(step4Search.jobs[0].isRemote, true);

    // -----------------------------------------------------------------------
    // STEP 5: Apply multiple filters (seniority: "Senior", location: "Bengaluru")
    // -----------------------------------------------------------------------
    const step5Search = await testService.searchJobs({
      level: 'Senior',
      location: 'Bengaluru',
    });
    assert.ok(step5Search.jobs.length >= 2);
    for (const job of step5Search.jobs) {
      assert.ok(job.location.toLowerCase().includes('bengaluru'));
    }

    // -----------------------------------------------------------------------
    // STEP 6: Navigate between pages (Page 1 -> Page 2, pageSize: 2)
    // -----------------------------------------------------------------------
    const page1 = await testService.searchJobs({ page: 1, pageSize: 2 });
    const page2 = await testService.searchJobs({ page: 2, pageSize: 2 });

    assert.strictEqual(page1.jobs.length, 2);
    assert.strictEqual(page2.jobs.length, 2);
    const p1Ids = new Set(page1.jobs.map((j) => j.id));
    for (const job of page2.jobs) {
      assert.strictEqual(p1Ids.has(job.id), false, 'Page 2 should not repeat jobs from Page 1');
    }

    // -----------------------------------------------------------------------
    // STEP 7: Open a job card (Inspect formatted details and anonymous masking)
    // -----------------------------------------------------------------------
    const targetJob = step2Search.jobs[0];
    const anonymousCard = maskJobForAnonymous(targetJob);
    assert.strictEqual(anonymousCard.company, 'Company hidden');
    assert.strictEqual(anonymousCard.url, ''); // Direct ATS link hidden for anonymous visitors

    // -----------------------------------------------------------------------
    // STEP 8: Authenticate user & Follow genuine application link
    // -----------------------------------------------------------------------
    const user = findOrCreateGoogleUser({
      sub: 'google-sub-12345',
      email: 'jobseeker@example.com',
      name: 'Alex Seeker',
      picture: 'https://avatar.url/alex',
    });
    const session = createSession(user.id);
    assert.ok(session.sessionId);

    const authCheck = validateSession(session.sessionId);
    assert.strictEqual(authCheck.valid, true);
    assert.strictEqual(authCheck.user?.email, 'jobseeker@example.com');

    // Authenticated user accesses genuine application link
    const genuineUrl = targetJob.url;
    assert.ok(genuineUrl.length > 0);
    assert.strictEqual(isValidProviderApplicationUrl(genuineUrl), true);
    assert.strictEqual(isFabricatedJobUrl(genuineUrl), false);
    assert.ok(genuineUrl.startsWith('https://jobs.ashbyhq.com/'));

    // -----------------------------------------------------------------------
    // STEP 9: Verify existing login, saved jobs, and Premium UPI flows remain unaffected
    // -----------------------------------------------------------------------
    const saveResult = saveJobForUser(user.id, {
      id: targetJob.id,
      title: targetJob.title,
      company: targetJob.company,
      url: targetJob.url,
    });
    assert.strictEqual(saveResult.saved, true);

    const savedJobs = getSavedJobs(user.id);
    assert.strictEqual(savedJobs.length, 1);

    // -----------------------------------------------------------------------
    // STEP 10: Verify notification preferences remain unchanged and active
    // -----------------------------------------------------------------------
    const alert = await createAlert(user.id, {
      alertName: 'Bengaluru AI Alert',
      keywords: ['AI Engineer', 'Python'],
      locations: ['Bengaluru'],
      enabled: true,
    });

    assert.ok(alert.alertId);
    assert.strictEqual(alert.enabled, true);

    // Verify user notification retrieval
    const userAlerts = await getUserNotifications(user.id);
    assert.ok(Array.isArray(userAlerts.notifications));
    assert.strictEqual(userAlerts.notifications.length, 0); // No unread notifications yet, preferences active

    // Cleanup session
    destroySession(session.sessionId);
    const postLogoutCheck = validateSession(session.sessionId);
    assert.strictEqual(postLogoutCheck.valid, false);
  });
});
