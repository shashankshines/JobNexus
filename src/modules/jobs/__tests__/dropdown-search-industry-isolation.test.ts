import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { filterAndRankJobs } from '../domain/job.ranking';
import { NormalizedJob } from '../domain/job.types';

describe('Dropdown Search & Industry Isolation Fix', () => {
  const mockJobs: NormalizedJob[] = [
    {
      id: 'job-design-1',
      sourceId: 'gh-1',
      sourceName: 'Greenhouse',
      title: 'Senior UI/UX Product Designer',
      company: 'Figma Systems',
      location: 'Remote, Global',
      description: 'Designing futuristic design systems, prototyping user experiences and interfaces.',
      applicationUrl: 'https://example.com/apply/1',
      publishedAt: new Date().toISOString(),
      isRemote: true,
      tags: ['figma', 'ui', 'ux', 'product design'],
      employmentType: 'full-time',
      seniority: 'senior',
      industry: 'technology',
      category: 'Design & Creative',
    },
    {
      id: 'job-design-2',
      sourceId: 'ashby-2',
      sourceName: 'Ashby',
      title: 'UI/UX Designer',
      company: 'Creative Studio',
      location: 'Bangalore, India',
      description: 'Wireframing and user research for mobile applications.',
      applicationUrl: 'https://example.com/apply/2',
      publishedAt: new Date().toISOString(),
      isRemote: false,
      isIndiaEligible: true,
      tags: ['ui/ux', 'design', 'user experience'],
      employmentType: 'full-time',
      seniority: 'mid',
      industry: 'technology',
      category: 'Design & Creative',
    },
    {
      id: 'job-logistics-1',
      sourceId: 'jobicy-3',
      sourceName: 'Jobicy',
      title: 'Oracle Fusion Cloud Lead — Logistics & Supply Chain Management',
      company: 'Freight Logistics Global',
      location: 'Remote',
      description: 'Managing supply chain pipelines and ERP transport schedules.',
      applicationUrl: 'https://example.com/apply/3',
      publishedAt: new Date().toISOString(),
      isRemote: true,
      tags: ['logistics', 'supply chain', 'oracle', 'design'],
      employmentType: 'full-time',
      seniority: 'lead',
      industry: 'logistics_transport',
      category: 'Logistics & Supply Chain',
    },
    {
      id: 'job-logistics-2',
      sourceId: 'him-4',
      sourceName: 'Himalayas',
      title: 'Senior Product Manager - Fleet and Lifecycle Management',
      company: 'FleetOps Tech',
      location: 'New York, USA',
      description: 'Overseeing fleet maintenance tracking systems and transport telemetry.',
      applicationUrl: 'https://example.com/apply/4',
      publishedAt: new Date().toISOString(),
      isRemote: false,
      tags: ['fleet', 'logistics', 'product management'],
      employmentType: 'full-time',
      seniority: 'senior',
      industry: 'logistics_transport',
      category: 'Logistics & Supply Chain',
    },
  ];

  it('correctly matches UI/UX design jobs across tech when industry is unconstrained', () => {
    const results = filterAndRankJobs(mockJobs, {
      query: 'UI/UX Product Designer',
      industry: '',
    });

    assert.ok(results.length >= 2, 'Should match UI/UX design positions');
    const titles = results.map((j) => j.title);
    assert.ok(titles.includes('Senior UI/UX Product Designer'));
    assert.ok(titles.includes('UI/UX Designer'));
    // The top result should be the genuine UI/UX designer, not the logistics lead
    assert.strictEqual(results[0].id, 'job-design-1');
  });

  it('demonstrates the bug when stale logistics_transport industry is retained', () => {
    // If industry remains logistics_transport, genuine UI/UX design jobs get excluded
    const staleResults = filterAndRankJobs(mockJobs, {
      query: 'UI/UX Product Designer',
      industry: 'logistics_transport',
    });

    // Only jobs tagged or matching partially in logistics would survive
    assert.ok(staleResults.every((j) => j.industry === 'logistics_transport'));
    assert.ok(!staleResults.some((j) => j.id === 'job-design-1'), 'Genuine design job was blocked by stale industry');
  });

  it('updates role suggestions without searching until the form is submitted', () => {
    const pagePath = path.resolve(process.cwd(), 'src/app/page.tsx');
    const content = fs.readFileSync(pagePath, 'utf8');

    // handleJobSuggestionClick must clear industry and selectedRole
    const suggestionHandlerMatch = content.match(/const handleJobSuggestionClick = \(suggestion: string\) => \{([\s\S]*?)\};/);
    assert.ok(suggestionHandlerMatch, 'handleJobSuggestionClick must be defined in page.tsx');
    const handlerBody = suggestionHandlerMatch[1];

    assert.ok(handlerBody.includes("setIndustry('')"), 'handleJobSuggestionClick must setIndustry to empty string');
    assert.ok(handlerBody.includes("setSelectedRole('')"), 'handleJobSuggestionClick must setSelectedRole to empty string');
    assert.ok(!handlerBody.includes('executeSearch('), 'Selecting a suggestion must not execute a search');
    const submitHandlerMatch = content.match(/const handleSearchSubmit = \(e\?: React\.FormEvent\) => \{([\s\S]*?)\n  \};/);
    assert.ok(submitHandlerMatch, 'handleSearchSubmit must be defined in page.tsx');
    assert.ok(submitHandlerMatch[1].includes('executeSearch('), 'Form submission must execute the search');
    assert.ok(content.includes('onSubmit={handleSearchSubmit}'), 'The search form must submit through handleSearchSubmit');
    assert.ok(content.includes('Your selected criteria apply only after you click Search Jobs.'), 'The UI must explain that edits are applied on submit');
  });

  it('verifies that page.tsx clears industry in handleRoleSelect', () => {
    const pagePath = path.resolve(process.cwd(), 'src/app/page.tsx');
    const content = fs.readFileSync(pagePath, 'utf8');

    const roleSelectMatch = content.match(/const handleRoleSelect = \(roleVal: string\) => \{([\s\S]*?)\};/);
    assert.ok(roleSelectMatch, 'handleRoleSelect must be defined in page.tsx');
    const handlerBody = roleSelectMatch[1];

    assert.ok(handlerBody.includes("setIndustry('')"), 'handleRoleSelect must setIndustry to empty string');
    assert.ok(!handlerBody.includes('executeSearch('), 'Selecting a role must not execute a search');
  });

  it('verifies that page.tsx resets industry when clicking a role quick pill', () => {
    const pagePath = path.resolve(process.cwd(), 'src/app/page.tsx');
    const content = fs.readFileSync(pagePath, 'utf8');

    const quickPillMatch = content.match(/const handleQuickPillClick = \(pill: QuickPill\) => \{([\s\S]*?)\};/);
    assert.ok(quickPillMatch, 'handleQuickPillClick must be defined in page.tsx');
    const handlerBody = quickPillMatch[1];

    assert.ok(handlerBody.includes("setIndustry('')"), 'handleQuickPillClick must reset a stale industry filter');
    assert.ok(handlerBody.includes('setQuery(pill.query ?? \'\')'), 'handleQuickPillClick must set the role query');
    assert.ok(!handlerBody.includes('executeSearch('), 'Clicking a role pill must not execute a search');
  });

  it('verifies results header toolbar styling and responsive structure in globals.css', () => {
    const cssPath = path.resolve(process.cwd(), 'src/app/globals.css');
    const cssContent = fs.readFileSync(cssPath, 'utf8');

    assert.ok(cssContent.includes('.results-header-toolbar'), 'globals.css must define .results-header-toolbar');
    assert.ok(cssContent.includes('.results-bar-header'), 'globals.css must define .results-bar-header');
    assert.ok(cssContent.includes('.results-bar-controls'), 'globals.css must define .results-bar-controls');
    assert.ok(cssContent.includes('.results-mode-switcher'), 'globals.css must define .results-mode-switcher');
    assert.ok(cssContent.includes('@media (max-width: 990px)'), 'globals.css must provide tablet adaptation rules');
    assert.ok(cssContent.includes('@media (max-width: 640px)'), 'globals.css must provide mobile adaptation rules');
  });
});
