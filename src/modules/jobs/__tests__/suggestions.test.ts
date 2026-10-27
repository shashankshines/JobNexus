import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  getSuggestions,
  getLocationSuggestions,
  POPULAR_JOB_POSTS,
  POPULAR_LOCATIONS,
  JOB_POST_CATEGORIES,
  JOB_POST_GROUPS,
  ALL_JOB_POSTS,
} from '../../../utils/suggestions';

describe('Job Post & Location Dropdowns Suggestions Tests', () => {
  it('returns popular job posts when query is empty', () => {
    const suggestions = getSuggestions('');
    assert.ok(suggestions.length > 0);
    assert.strictEqual(suggestions[0], POPULAR_JOB_POSTS[0]);
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
    assert.ok(remoteGroup.posts.some((p) => p.label.includes('All Remote Tech Roles')));
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

