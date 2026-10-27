import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  isValidApplicationUrl,
  getFallbackApplicationUrl,
  ANONYMOUS_COMPANY_LABEL,
} from '../domain/job.masking';

describe('JobNexus — Application Link Resolution & Fallback Suite', () => {
  it('returns valid URLs directly without alteration', () => {
    const directUrl = 'https://boards.greenhouse.io/stripe/jobs/12345';
    assert.strictEqual(
      getFallbackApplicationUrl({ title: 'Software Engineer', url: directUrl }),
      directUrl
    );
  });

  it('rejects dangerous URL schemes safely', () => {
    assert.strictEqual(isValidApplicationUrl('javascript:alert(1)'), false);
    assert.strictEqual(isValidApplicationUrl('data:text/html,<script>'), false);
    assert.strictEqual(isValidApplicationUrl('vbscript:msgbox'), false);
    assert.strictEqual(isValidApplicationUrl(''), false);
    assert.strictEqual(isValidApplicationUrl('   '), false);
    assert.strictEqual(isValidApplicationUrl(null), false);
    assert.strictEqual(isValidApplicationUrl(undefined), false);
  });

  it('generates canonical fallback for We Work Remotely when URL is empty or masked', () => {
    const fallback = getFallbackApplicationUrl({
      title: 'Senior Product Designer',
      source: 'We Work Remotely',
      url: '',
    });
    assert.ok(fallback.startsWith('https://weworkremotely.com/remote-jobs?term='));
    assert.ok(fallback.includes('Senior%20Product%20Designer'));
  });

  it('generates canonical fallback for Ashby ATS when URL is empty or masked', () => {
    const fallback = getFallbackApplicationUrl({
      title: 'Full Stack Engineer',
      source: 'Ashby ATS',
      url: '',
    });
    assert.strictEqual(fallback, 'https://jobs.ashbyhq.com');
  });

  it('generates canonical fallback for Greenhouse ATS when URL is empty or masked', () => {
    const fallback = getFallbackApplicationUrl({
      title: 'Backend Developer',
      source: 'Greenhouse ATS',
      url: '',
    });
    assert.strictEqual(fallback, 'https://boards.greenhouse.io');
  });

  it('generates canonical fallback for RemoteOK when URL is empty or masked', () => {
    const fallback = getFallbackApplicationUrl({
      title: 'React Developer',
      source: 'RemoteOK',
      url: '',
    });
    assert.ok(fallback.startsWith('https://remoteok.com/remote-jobs?search='));
    assert.ok(fallback.includes('React%20Developer'));
  });

  it('generates canonical fallback for Himalayas when URL is empty or masked', () => {
    const fallback = getFallbackApplicationUrl({
      title: 'DevOps Lead',
      source: 'Himalayas',
      url: '',
    });
    assert.ok(fallback.startsWith('https://himalayas.app/jobs?q='));
    assert.ok(fallback.includes('DevOps%20Lead'));
  });

  it('generates canonical fallback for Arbeitnow when URL is empty or masked', () => {
    const fallback = getFallbackApplicationUrl({
      title: 'Golang Engineer',
      source: 'Arbeitnow',
      url: '',
    });
    assert.ok(fallback.startsWith('https://www.arbeitnow.com/jobs?q='));
    assert.ok(fallback.includes('Golang%20Engineer'));
  });

  it('never outputs anonymous company label in fallback search query', () => {
    const fallback = getFallbackApplicationUrl({
      title: 'Cloud Architect',
      company: ANONYMOUS_COMPANY_LABEL,
      source: 'Unknown Provider',
      url: '',
    });
    assert.ok(!fallback.includes('Company%20undisclosed'));
    assert.ok(fallback.startsWith('https://www.google.com/search?q='));
  });
});
