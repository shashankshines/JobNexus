import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  getRoleCategory,
  getContextualTagStyle,
  getWorkplaceBadge,
  getSeniorityBadge,
  getEmploymentTypeBadge,
  getSourceBadge,
} from '../presentation/job-contextual-styles';

describe('JobNexus Contextual Styles & Icons Engine', () => {
  describe('getRoleCategory', () => {
    it('accurately categorizes design and creative roles with rose palette', () => {
      const role1 = getRoleCategory('Product Designer', ['Design', 'Remote']);
      assert.strictEqual(role1.category, 'design');
      assert.strictEqual(role1.palette, 'rose');
      assert.strictEqual(role1.label, 'Design & UX');

      const role2 = getRoleCategory('Interior Designer', ['Architecture']);
      assert.strictEqual(role2.category, 'architecture');
      assert.strictEqual(role2.palette, 'rose');
      assert.strictEqual(role2.label, 'Interior & Space');

      const role3 = getRoleCategory('Graphic Designer', ['Creative']);
      assert.strictEqual(role3.category, 'graphics');
      assert.strictEqual(role3.palette, 'rose');
      assert.strictEqual(role3.label, 'Graphic Design');
    });

    it('accurately categorizes product management roles with purple palette', () => {
      const role = getRoleCategory('Lead Product Management (Security)', ['Product', 'Remote']);
      assert.strictEqual(role.category, 'product');
      assert.strictEqual(role.palette, 'purple');
      assert.strictEqual(role.label, 'Product Strategy');
    });

    it('accurately categorizes security and compliance roles with crimson palette', () => {
      const role = getRoleCategory('Senior Security Engineer (Infosec)', ['Security']);
      assert.strictEqual(role.category, 'security');
      assert.strictEqual(role.palette, 'crimson');
      assert.strictEqual(role.label, 'Security & Trust');
    });

    it('accurately categorizes AI, Machine Learning, and Data Science roles with emerald palette', () => {
      const role = getRoleCategory('Lead AI & Machine Learning Scientist', ['PyTorch', 'LLMs']);
      assert.strictEqual(role.category, 'ai_data');
      assert.strictEqual(role.palette, 'emerald');
      assert.strictEqual(role.label, 'AI & Data Science');
    });

    it('accurately categorizes Cloud, Infrastructure, and DevOps roles with sky palette', () => {
      const role = getRoleCategory('Cloud Infrastructure & SRE Architect', ['Kubernetes', 'AWS']);
      assert.strictEqual(role.category, 'cloud_infra');
      assert.strictEqual(role.palette, 'sky');
      assert.strictEqual(role.label, 'Cloud & Infrastructure');
    });

    it('accurately categorizes Frontend and Fullstack roles with distinct vibrant palettes', () => {
      const frontend = getRoleCategory('Senior Frontend Engineer (React/Next.js)', ['TypeScript']);
      assert.strictEqual(frontend.category, 'frontend');
      assert.strictEqual(frontend.palette, 'cyan');

      const fullstack = getRoleCategory('Full-Stack Software Engineer', ['Node.js', 'React']);
      assert.strictEqual(fullstack.category, 'fullstack');
      assert.strictEqual(fullstack.palette, 'indigo');
    });

    it('accurately categorizes Support & Customer Success roles with lime palette', () => {
      const support = getRoleCategory('Customer Support Specialist', ['Customer Success']);
      assert.strictEqual(support.category, 'support');
      assert.strictEqual(support.palette, 'lime');
      assert.strictEqual(support.label, 'Support & Success');
    });
  });

  describe('getContextualTagStyle', () => {
    it('maps known domains to their respective icons and palettes', () => {
      const tagDesign = getContextualTagStyle('Design');
      assert.strictEqual(tagDesign.palette, 'rose');

      const tagRemote = getContextualTagStyle('Remote');
      assert.strictEqual(tagRemote.palette, 'teal');

      const tagProduct = getContextualTagStyle('Product');
      assert.strictEqual(tagProduct.palette, 'purple');

      const tagProgramming = getContextualTagStyle('Full-Stack Programming');
      assert.strictEqual(tagProgramming.palette, 'cyan');

      const tagSupport = getContextualTagStyle('Customer Support');
      assert.strictEqual(tagSupport.palette, 'lime');

      const tagSecurity = getContextualTagStyle('Security');
      assert.strictEqual(tagSecurity.palette, 'crimson');

      const tagAI = getContextualTagStyle('AI / LLMs');
      assert.strictEqual(tagAI.palette, 'emerald');
    });

    it('consistently hashes custom or niche tags into vibrant non-grey palettes', () => {
      const tagA = getContextualTagStyle('GraphQL');
      const tagB = getContextualTagStyle('EdTech');
      const tagC = getContextualTagStyle('Fintech');

      assert.ok(['cyan', 'purple', 'rose', 'emerald', 'amber', 'indigo', 'teal', 'sky'].includes(tagA.palette));
      assert.ok(['cyan', 'purple', 'rose', 'emerald', 'amber', 'indigo', 'teal', 'sky'].includes(tagB.palette));
      assert.ok(['cyan', 'purple', 'rose', 'emerald', 'amber', 'indigo', 'teal', 'sky'].includes(tagC.palette));
      // Re-querying should produce deterministic results
      assert.strictEqual(getContextualTagStyle('GraphQL').palette, tagA.palette);
    });
  });

  describe('getWorkplaceBadge', () => {
    it('returns contextual workplace badge information', () => {
      const remote = getWorkplaceBadge('remote', true);
      assert.strictEqual(remote.label, 'Remote');
      assert.strictEqual(remote.palette, 'teal');

      const hybrid = getWorkplaceBadge('hybrid', false);
      assert.strictEqual(hybrid.label, 'Hybrid');
      assert.strictEqual(hybrid.palette, 'purple');

      const onsite = getWorkplaceBadge('onsite', false);
      assert.strictEqual(onsite.label, 'On-site');
      assert.strictEqual(onsite.palette, 'sky');
    });
  });

  describe('getSeniorityBadge', () => {
    it('extracts seniority level from title or tags accurately', () => {
      const lead = getSeniorityBadge('Lead Product Management');
      assert.ok(lead);
      assert.strictEqual(lead.label, 'Lead');
      assert.strictEqual(lead.palette, 'gold');

      const principal = getSeniorityBadge('Principal Experience Designer - Visual Design');
      assert.ok(principal);
      assert.strictEqual(principal.label, 'Principal');
      assert.strictEqual(principal.palette, 'gold');

      const senior = getSeniorityBadge('Senior Product Design Manager, Payroll');
      assert.ok(senior);
      assert.strictEqual(senior.label, 'Senior');
      assert.strictEqual(senior.palette, 'indigo');

      const junior = getSeniorityBadge('Junior UI Engineer');
      assert.ok(junior);
      assert.strictEqual(junior.label, 'Junior');
      assert.strictEqual(junior.palette, 'emerald');

      const nonSenior = getSeniorityBadge('Interior Designer');
      assert.strictEqual(nonSenior, null);
    });
  });

  describe('getEmploymentTypeBadge', () => {
    it('maps employment types to contextual icons and palettes', () => {
      const fullTime = getEmploymentTypeBadge('Full Time');
      assert.strictEqual(fullTime.label, 'Full Time');
      assert.strictEqual(fullTime.palette, 'indigo');

      const contract = getEmploymentTypeBadge('Contract');
      assert.strictEqual(contract.label, 'Contract');
      assert.strictEqual(contract.palette, 'amber');

      const partTime = getEmploymentTypeBadge('Part-time');
      assert.strictEqual(partTime.label, 'Part Time');
      assert.strictEqual(partTime.palette, 'purple');

      const intern = getEmploymentTypeBadge('Internship');
      assert.strictEqual(intern.label, 'Internship');
      assert.strictEqual(intern.palette, 'cyan');
    });
  });

  describe('getSourceBadge', () => {
    it('applies tailored branding to supported ATS and job board feeds', () => {
      const ashby = getSourceBadge('Ashby ATS');
      assert.strictEqual(ashby.label, 'Ashby ATS');
      assert.strictEqual(ashby.palette, 'purple');

      const greenhouse = getSourceBadge('Greenhouse ATS');
      assert.strictEqual(greenhouse.label, 'Greenhouse ATS');
      assert.strictEqual(greenhouse.palette, 'emerald');

      const wwr = getSourceBadge('We Work Remotely');
      assert.strictEqual(wwr.label, 'We Work Remotely');
      assert.strictEqual(wwr.palette, 'teal');

      const remoteok = getSourceBadge('RemoteOK');
      assert.strictEqual(remoteok.label, 'RemoteOK');
      assert.strictEqual(remoteok.palette, 'indigo');

      const himalayas = getSourceBadge('Himalayas');
      assert.strictEqual(himalayas.label, 'Himalayas');
      assert.strictEqual(himalayas.palette, 'amber');

      const arbeitnow = getSourceBadge('Arbeitnow');
      assert.strictEqual(arbeitnow.label, 'Arbeitnow');
      assert.strictEqual(arbeitnow.palette, 'rose');
    });
  });
});
