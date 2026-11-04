import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  classifyWorkplace,
  PrimaryWorkplaceType,
  RemoteEligibilityType,
} from '../domain/workplace.classification';

describe('JobNexus — Centralized Workplace & Remote Eligibility Classification Suite', () => {
  describe('Rule 1: Never classify as remote merely because location is missing', () => {
    it('classifies empty or undefined location as UNSPECIFIED with isRemote=false', () => {
      const res1 = classifyWorkplace('');
      assert.strictEqual(res1.primaryType, 'UNSPECIFIED');
      assert.strictEqual(res1.isRemote, false);
      assert.strictEqual(res1.remoteEligibility, 'unspecified');
      assert.strictEqual(res1.workplaceType, 'unknown');
      assert.strictEqual(res1.normalizedLocation, 'Location not provided');

      const res2 = classifyWorkplace(undefined);
      assert.strictEqual(res2.primaryType, 'UNSPECIFIED');
      assert.strictEqual(res2.isRemote, false);
      assert.strictEqual(res2.remoteEligibility, 'unspecified');
      assert.strictEqual(res2.workplaceType, 'unknown');
    });

    it('honors explicitIsRemote=true even if location text is missing', () => {
      const res = classifyWorkplace('', undefined, true);
      assert.strictEqual(res.primaryType, 'REMOTE');
      assert.strictEqual(res.isRemote, true);
    });
  });

  describe('Rule 2 & 3: Deterministic Hybrid & Remote Classification', () => {
    it('classifies explicit hybrid locations with Indian hubs correctly', () => {
      const res = classifyWorkplace('Bengaluru, Karnataka (Hybrid)');
      assert.strictEqual(res.primaryType, 'HYBRID');
      assert.strictEqual(res.isRemote, false);
      assert.strictEqual(res.isIndiaEligible, true);
      assert.strictEqual(res.workplaceType, 'hybrid');
      assert.strictEqual(res.rawLocationPreserved, 'Bengaluru, Karnataka (Hybrid)');
    });

    it('classifies worldwide remote eligibility accurately', () => {
      const variants = [
        'Remote - Worldwide',
        'Anywhere in the world',
        'Remote (Global)',
        'Remote Worldwide',
      ];
      for (const loc of variants) {
        const res = classifyWorkplace(loc);
        assert.strictEqual(res.primaryType, 'REMOTE', `Failed primaryType for: ${loc}`);
        assert.strictEqual(res.isRemote, true, `Failed isRemote for: ${loc}`);
        assert.strictEqual(res.remoteEligibility, 'worldwide', `Failed remoteEligibility for: ${loc}`);
        assert.strictEqual(res.isIndiaEligible, true, `Worldwide remote must be India-eligible: ${loc}`);
      }
    });

    it('classifies India-specific remote accurately', () => {
      const res1 = classifyWorkplace('Remote - India');
      assert.strictEqual(res1.primaryType, 'REMOTE');
      assert.strictEqual(res1.remoteEligibility, 'india_remote');
      assert.strictEqual(res1.isIndiaEligible, true);

      const res2 = classifyWorkplace('Remote (Hyderabad, Telangana)');
      assert.strictEqual(res2.primaryType, 'REMOTE');
      assert.strictEqual(res2.remoteEligibility, 'india_remote');
      assert.strictEqual(res2.isIndiaEligible, true);
    });

    it('classifies country-specific and region-specific remote without false worldwide inference', () => {
      const resUs = classifyWorkplace('Remote, United States');
      assert.strictEqual(resUs.primaryType, 'REMOTE');
      assert.strictEqual(resUs.remoteEligibility, 'country_specific');
      assert.strictEqual(resUs.isIndiaEligible, false);

      const resEu = classifyWorkplace('Remote - EMEA');
      assert.strictEqual(resEu.primaryType, 'REMOTE');
      assert.strictEqual(resEu.remoteEligibility, 'region_specific');
      assert.strictEqual(resEu.isIndiaEligible, false);
    });

    it('classifies timezone-restricted remote jobs accurately', () => {
      const res = classifyWorkplace('Remote (UTC-5 to UTC-8 only)');
      assert.strictEqual(res.primaryType, 'REMOTE');
      assert.strictEqual(res.remoteEligibility, 'timezone_restricted');
      assert.strictEqual(res.isIndiaEligible, false);
    });
  });

  describe('Rule 4 & 5: On-site Preservation and Unverifiable Fallback', () => {
    it('classifies standard physical locations as ONSITE and preserves raw text', () => {
      const res = classifyWorkplace('Level 4, 100 Queen St, Melbourne VIC 3000, Australia');
      assert.strictEqual(res.primaryType, 'ONSITE');
      assert.strictEqual(res.isRemote, false);
      assert.strictEqual(res.workplaceType, 'onsite');
      assert.strictEqual(res.rawLocationPreserved, 'Level 4, 100 Queen St, Melbourne VIC 3000, Australia');
    });

    it('does not assume remote or hybrid on vague corporate text without location', () => {
      const res = classifyWorkplace('Headquarters', 'We offer great benefits and modern offices');
      assert.strictEqual(res.primaryType, 'ONSITE');
      assert.strictEqual(res.isRemote, false);
      assert.strictEqual(res.workplaceType, 'onsite');
    });
  });
});

