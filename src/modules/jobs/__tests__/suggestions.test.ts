import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  getSuggestions,
  getLocationSuggestions,
  getLocationTier,
  POPULAR_JOB_POSTS,
  POPULAR_LOCATIONS,
  POPULAR_LOCATION_GROUPS,
  JOB_POST_CATEGORIES,
  JOB_POST_GROUPS,
  ALL_JOB_POSTS,
} from '../../../utils/suggestions';

describe('Job Post & Location Dropdowns Suggestions Tests', () => {
  it('returns popular job posts when query is empty', () => {
    const suggestions = getSuggestions('');
    assert.ok(suggestions.length > 0);
    assert.strictEqual(suggestions[0], POPULAR_JOB_POSTS[0]);
    assert.ok(suggestions.some((role) => role.includes('Nurse')));
    assert.ok(suggestions.some((role) => role.includes('Accountant')));
    assert.ok(suggestions.some((role) => role.includes('Teacher')));
  });

  it('includes discoverable roles across non-IT sectors', () => {
    const allRoles = JOB_POST_GROUPS.flatMap((group) => group.posts.map((post) => post.label));
    for (const role of [
      'Registered Nurse',
      'Corporate Lawyer',
      'Executive Chef',
      'Agricultural',
      'Public Administration',
      'Automotive Technician',
      'Journalist',
      'Research Scientist',
      'Security Guard',
      'Social Worker',
      'Insurance Claims Adjuster',
    ]) {
      assert.ok(allRoles.some((label) => label.includes(role)), `Missing non-IT role: ${role}`);
    }
  });

  it('matches relevant job posts when user queries for specific roles', () => {
    const reactMatches = getSuggestions('react');
    assert.ok(reactMatches.length > 0);
    assert.ok(reactMatches.some((s) => s.toLowerCase().includes('react')));

    const aiMatches = getSuggestions('ai');
    assert.ok(aiMatches.length > 0);
    assert.ok(aiMatches.some((s) => s.toLowerCase().includes('ai') || s.toLowerCase().includes('machine learning')));

    const devopsMatches = getSuggestions('devops');
    assert.ok(devopsMatches.length > 0);
    assert.ok(devopsMatches.some((s) => s.toLowerCase().includes('devops') || s.toLowerCase().includes('cloud')));
  });

  it('returns popular locations when input is empty and filters locations when input is provided', () => {
    const allLocs = getLocationSuggestions('');
    assert.strictEqual(allLocs.length, 6);
    assert.strictEqual(allLocs[0], POPULAR_LOCATIONS[0]);

    const indiaLocs = getLocationSuggestions('india');
    assert.ok(indiaLocs.length > 0);
    assert.ok(indiaLocs.some((l) => l.toLowerCase().includes('india')));
  });

  it('provides comprehensive Indian Tier 1 and Tier 2 cities in popular locations and groups', () => {
    // Verify 3 distinct groups are present
    assert.strictEqual(POPULAR_LOCATION_GROUPS.length, 3);
    const tier1Group = POPULAR_LOCATION_GROUPS.find((g) => g.group.includes('Tier 1'));
    const tier2Group = POPULAR_LOCATION_GROUPS.find((g) => g.group.includes('Tier 2'));
    const globalGroup = POPULAR_LOCATION_GROUPS.find((g) => g.group.includes('Global'));

    assert.ok(tier1Group, 'Tier 1 group must exist');
    assert.ok(tier2Group, 'Tier 2 group must exist');
    assert.ok(globalGroup, 'Global group must exist');

    // Tier 1 Metros: At least 8 major tech centers
    assert.ok(tier1Group.locations.length >= 8);
    const t1Labels = tier1Group.locations.map((l) => l.label);
    assert.ok(t1Labels.some((l) => l.includes('Bengaluru')));
    assert.ok(t1Labels.some((l) => l.includes('Delhi NCR')));
    assert.ok(t1Labels.some((l) => l.includes('Hyderabad')));
    assert.ok(t1Labels.some((l) => l.includes('Mumbai')));
    assert.ok(t1Labels.some((l) => l.includes('Pune')));
    assert.ok(t1Labels.some((l) => l.includes('Chennai')));
    assert.ok(t1Labels.some((l) => l.includes('Kolkata')));
    assert.ok(t1Labels.some((l) => l.includes('Ahmedabad')));

    // Tier 2 Hubs: At least 18 emerging tech centers
    assert.ok(tier2Group.locations.length >= 18);
    const t2Labels = tier2Group.locations.map((l) => l.label);
    assert.ok(t2Labels.some((l) => l.includes('Chandigarh')));
    assert.ok(t2Labels.some((l) => l.includes('Kochi')));
    assert.ok(t2Labels.some((l) => l.includes('Indore')));
    assert.ok(t2Labels.some((l) => l.includes('Jaipur')));
    assert.ok(t2Labels.some((l) => l.includes('Coimbatore')));
    assert.ok(t2Labels.some((l) => l.includes('Thiruvananthapuram')));
    assert.ok(t2Labels.some((l) => l.includes('Bhubaneswar')));
    assert.ok(t2Labels.some((l) => l.includes('Visakhapatnam')));
    assert.ok(t2Labels.some((l) => l.includes('Nagpur')));
    assert.ok(t2Labels.some((l) => l.includes('Lucknow')));
    assert.ok(t2Labels.some((l) => l.includes('Vadodara')));
    assert.ok(t2Labels.some((l) => l.includes('Surat')));
    assert.ok(t2Labels.some((l) => l.includes('Bhopal')));
    assert.ok(t2Labels.some((l) => l.includes('Patna')));
    assert.ok(t2Labels.some((l) => l.includes('Mysuru')));
    assert.ok(t2Labels.some((l) => l.includes('Mangaluru')));
    assert.ok(t2Labels.some((l) => l.includes('Dehradun')));
    assert.ok(t2Labels.some((l) => l.includes('Nashik')));

    // Tier identification helper
    assert.strictEqual(getLocationTier('Bengaluru, Karnataka'), 'tier1');
    assert.strictEqual(getLocationTier('Kochi (Cochin), Kerala'), 'tier2');
    assert.strictEqual(getLocationTier('Remote (Worldwide)'), 'remote');
    assert.strictEqual(getLocationTier('India'), 'global');
    assert.strictEqual(getLocationTier('Nonexistent City'), null);
  });

  it('resolves Tier 1 and Tier 2 cities by direct names and synonyms/aliases', () => {
    // Kochi by alias "cochin"
    const cochinMatches = getLocationSuggestions('cochin');
    assert.ok(cochinMatches.some((l) => l.includes('Kochi (Cochin)')));

    // Visakhapatnam by alias "vizag"
    const vizagMatches = getLocationSuggestions('vizag');
    assert.ok(vizagMatches.some((l) => l.includes('Visakhapatnam (Vizag)')));

    // Delhi NCR by alias "gurgaon" or "noida"
    const ggnMatches = getLocationSuggestions('gurgaon');
    assert.ok(ggnMatches.some((l) => l.includes('Delhi NCR')));

    // Vadodara by alias "baroda"
    const barodaMatches = getLocationSuggestions('baroda');
    assert.ok(barodaMatches.some((l) => l.includes('Vadodara (Baroda)')));

    // Mysuru by alias "mysore"
    const mysoreMatches = getLocationSuggestions('mysore');
    assert.ok(mysoreMatches.some((l) => l.includes('Mysuru (Mysore)')));

    // Thiruvananthapuram by alias "trivandrum"
    const tvmMatches = getLocationSuggestions('trivandrum');
    assert.ok(tvmMatches.some((l) => l.includes('Thiruvananthapuram (Trivandrum)')));

    // Chandigarh by alias "mohali"
    const mohaliMatches = getLocationSuggestions('mohali');
    assert.ok(mohaliMatches.some((l) => l.includes('Chandigarh / Mohali')));

    // Direct search for Tier 2 cities
    assert.ok(getLocationSuggestions('indore').some((l) => l.includes('Indore')));
    assert.ok(getLocationSuggestions('jaipur').some((l) => l.includes('Jaipur')));
    assert.ok(getLocationSuggestions('coimbatore').some((l) => l.includes('Coimbatore')));
    assert.ok(getLocationSuggestions('bhubaneswar').some((l) => l.includes('Bhubaneswar')));
    assert.ok(getLocationSuggestions('nagpur').some((l) => l.includes('Nagpur')));
    assert.ok(getLocationSuggestions('lucknow').some((l) => l.includes('Lucknow')));
    assert.ok(getLocationSuggestions('surat').some((l) => l.includes('Surat')));
    assert.ok(getLocationSuggestions('bhopal').some((l) => l.includes('Bhopal')));
    assert.ok(getLocationSuggestions('patna').some((l) => l.includes('Patna')));
    assert.ok(getLocationSuggestions('dehradun').some((l) => l.includes('Dehradun')));
    assert.ok(getLocationSuggestions('nashik').some((l) => l.includes('Nashik')));
  });

  it('provides an exhaustive catalog of job post groups for the role dropdown', () => {
    // Check that we have over 10 distinct industry domains
    assert.ok(JOB_POST_GROUPS.length >= 10);

    // Verify key domains are present
    const groups = JOB_POST_GROUPS.map((g) => g.group);
    assert.ok(groups.some((g) => g.includes('Full Stack')));
    assert.ok(groups.some((g) => g.includes('Frontend')));
    assert.ok(groups.some((g) => g.includes('Backend')));
    assert.ok(groups.some((g) => g.includes('Artificial Intelligence')));
    assert.ok(groups.some((g) => g.includes('Cloud')));
    assert.ok(groups.some((g) => g.includes('Mobile')));
    assert.ok(groups.some((g) => g.includes('Product, Design')));
    assert.ok(groups.some((g) => g.includes('Quality Assurance')));
    assert.ok(groups.some((g) => g.includes('Cybersecurity')));
    assert.ok(groups.some((g) => g.includes('Leadership')));
    assert.ok(groups.some((g) => g.includes('Blockchain')));

    // Check that the total number of selectable posts is exhaustive (75+ posts)
    assert.ok(JOB_POST_CATEGORIES.length >= 75);
    assert.ok(ALL_JOB_POSTS.length >= 75);
  });

  it('provides a separate and dedicated category for Fully Remote & Distributed roles', () => {
    // Verify first group is the dedicated Remote category
    const remoteGroup = JOB_POST_GROUPS.find((g) => g.group.includes('Fully Remote'));
    assert.ok(remoteGroup, 'Dedicated Remote group should exist');
    assert.ok(remoteGroup.posts.length >= 10, 'Should contain extensive remote roles');
    assert.ok(remoteGroup.posts.some((p) => p.label.includes('All Remote Roles')));
    assert.ok(remoteGroup.posts.some((p) => p.label.includes('Remote Software Engineer')));
    assert.ok(remoteGroup.posts.some((p) => p.label.includes('Remote Full Stack Developer')));
  });

  it('supports interactive search filtering across grouped roles and categories for custom dropdown', () => {
    const filterGroups = (searchQuery: string) => {
      if (!searchQuery.trim()) return JOB_POST_GROUPS;
      const q = searchQuery.toLowerCase().trim();
      return JOB_POST_GROUPS.map((group) => {
        const groupMatches = group.group.toLowerCase().includes(q);
        const filteredPosts = group.posts.filter(
          (post) =>
            groupMatches ||
            post.label.toLowerCase().includes(q) ||
            post.value.toLowerCase().includes(q)
        );
        return {
          ...group,
          posts: filteredPosts,
        };
      }).filter((group) => group.posts.length > 0);
    };

    // Test search for "React"
    const reactFiltered = filterGroups('React');
    assert.ok(reactFiltered.length > 0);
    const allReactPosts = reactFiltered.flatMap((g) => g.posts);
    assert.ok(allReactPosts.some((p) => p.label.toLowerCase().includes('react')));

    // Test search for "Cyber"
    const cyberFiltered = filterGroups('cyber');
    assert.ok(cyberFiltered.length > 0);
    assert.ok(cyberFiltered.some((g) => g.group.toLowerCase().includes('cybersecurity')));

    // Test non-matching query returns empty list
    const nonMatching = filterGroups('xyznonexistentrole123');
    assert.strictEqual(nonMatching.length, 0);
  });
});
