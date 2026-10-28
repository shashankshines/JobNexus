import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  classifyJobIndustry,
  getIndustryLabel,
  INDUSTRY_TAXONOMY,
  JobIndustry,
} from '../domain/job.taxonomy';

describe('JobNexus — Canonical Industry & Category Taxonomy Suite', () => {
  it('defines all 15 required canonical industry sectors', () => {
    const requiredSectors: JobIndustry[] = [
      'technology',
      'healthcare',
      'construction_trades',
      'manufacturing',
      'logistics_transport',
      'retail_sales',
      'hospitality_tourism',
      'education',
      'finance_accounting',
      'administration_hr',
      'agriculture',
      'government_public',
      'customer_service',
      'security_facilities',
      'other',
    ];

    for (const sector of requiredSectors) {
      assert.ok(INDUSTRY_TAXONOMY[sector], `Taxonomy must define ${sector}`);
      assert.ok(INDUSTRY_TAXONOMY[sector].label, `Sector ${sector} must have a label`);
    }
  });

  describe('Deterministic Classification by Job Title', () => {
    it('classifies Healthcare roles accurately', () => {
      const roles = [
        'Registered Staff Nurse (ICU)',
        'Consultant Pediatrician',
        'Senior Clinical Pharmacist',
        'Physical Therapist - Rehabilitation',
        'Orthopedic Surgeon',
      ];
      for (const title of roles) {
        const result = classifyJobIndustry(title);
        assert.strictEqual(result.industry, 'healthcare', `Failed for title: ${title}`);
      }
    });

    it('classifies Education & Teaching roles accurately', () => {
      const roles = [
        'Secondary School Mathematics Teacher',
        'Assistant Professor of Economics',
        'Elementary School Principal',
        'Special Education Needs Instructor',
        'Learning Support Assistant - Speech & Language',
      ];
      for (const title of roles) {
        const result = classifyJobIndustry(title);
        assert.strictEqual(result.industry, 'education', `Failed for title: ${title}`);
      }
    });

    it('classifies Construction & Skilled Trades roles accurately', () => {
      const roles = [
        'Commercial Electrician',
        'Certified Site Civil Engineer',
        'Journeyman Plumber',
        'Structural Welder',
        'Building Construction Inspector',
      ];
      for (const title of roles) {
        const result = classifyJobIndustry(title);
        assert.strictEqual(result.industry, 'construction_trades', `Failed for title: ${title}`);
      }
    });

    it('classifies Manufacturing & Industrial roles accurately', () => {
      const roles = [
        'CNC Mill Operator',
        'Industrial Plant Production Supervisor',
        'Mechanical Engineer - Assembly Line',
        'Quality Control Inspector (Automotive)',
      ];
      for (const title of roles) {
        const result = classifyJobIndustry(title);
        assert.strictEqual(result.industry, 'manufacturing', `Failed for title: ${title}`);
      }
    });

    it('classifies Logistics & Supply Chain roles accurately', () => {
      const roles = [
        'Supply Chain Logistics Coordinator',
        'Warehouse Forklift Operator',
        'Heavy Freight Dispatcher',
        'Fleet Transportation Manager',
        'Delivery Courier Driver',
      ];
      for (const title of roles) {
        const result = classifyJobIndustry(title);
        assert.strictEqual(result.industry, 'logistics_transport', `Failed for title: ${title}`);
      }
    });

    it('classifies Retail & Sales roles accurately', () => {
      const roles = [
        'B2B Enterprise Sales Executive',
        'Retail Store Manager',
        'Account Executive - Mid Market',
        'Visual Merchandiser',
        'Supermarket Cashier',
      ];
      for (const title of roles) {
        const result = classifyJobIndustry(title);
        assert.strictEqual(result.industry, 'retail_sales', `Failed for title: ${title}`);
      }
    });

    it('classifies Hospitality & Tourism roles accurately', () => {
      const roles = [
        'Executive Sous Chef',
        'Hotel Front Desk Receptionist',
        'Restaurant General Manager',
        'Head Barista',
        'Catering Event Coordinator',
      ];
      for (const title of roles) {
        const result = classifyJobIndustry(title);
        assert.strictEqual(result.industry, 'hospitality_tourism', `Failed for title: ${title}`);
      }
    });

    it('classifies Finance & Accounting roles accurately', () => {
      const roles = [
        'Chartered Accountant (CA)',
        'Senior Financial Auditor',
        'Corporate Tax Specialist',
        'Treasury Controller',
        'Investment Risk Analyst',
      ];
      for (const title of roles) {
        const result = classifyJobIndustry(title);
        assert.strictEqual(result.industry, 'finance_accounting', `Failed for title: ${title}`);
      }
    });

    it('classifies Administration & Human Resources roles accurately', () => {
      const roles = [
        'Human Resources Business Partner',
        'Technical Talent Acquisition Specialist',
        'Executive Administrative Assistant',
        'Office Operations Manager',
        'Senior Payroll Coordinator',
      ];
      for (const title of roles) {
        const result = classifyJobIndustry(title);
        assert.strictEqual(result.industry, 'administration_hr', `Failed for title: ${title}`);
      }
    });

    it('classifies Agriculture & Forestry roles accurately', () => {
      const roles = [
        'Senior Agronomist',
        'Horticulture Farm Manager',
        'Forestry Conservation Officer',
        'Livestock Operations Specialist',
      ];
      for (const title of roles) {
        const result = classifyJobIndustry(title);
        assert.strictEqual(result.industry, 'agriculture', `Failed for title: ${title}`);
      }
    });

    it('classifies Government & Public Sector roles accurately', () => {
      const roles = [
        'Civil Service Administrative Officer',
        'Public Administration Policy Analyst',
        'Humanitarian Disaster Relief Coordinator',
        'Municipal Urban Planner',
      ];
      for (const title of roles) {
        const result = classifyJobIndustry(title);
        assert.strictEqual(result.industry, 'government_public', `Failed for title: ${title}`);
      }
    });

    it('classifies Customer Support & Service roles accurately', () => {
      const roles = [
        'Customer Support Representative',
        'Call Center Team Lead',
        'Client Success Support Specialist',
        'Helpdesk Support Agent',
      ];
      for (const title of roles) {
        const result = classifyJobIndustry(title);
        assert.strictEqual(result.industry, 'customer_service', `Failed for title: ${title}`);
      }
    });

    it('classifies Security & Facilities roles accurately', () => {
      const roles = [
        'Night Security Guard',
        'Facility Maintenance Manager',
        'Occupational Fire Safety Officer',
        'Commercial Building Custodian',
      ];
      for (const title of roles) {
        const result = classifyJobIndustry(title);
        assert.strictEqual(result.industry, 'security_facilities', `Failed for title: ${title}`);
      }
    });

    it('classifies Technology & Engineering roles accurately', () => {
      const roles = [
        'Senior Full-Stack TypeScript Developer',
        'Cloud Infrastructure DevOps Engineer',
        'AI Machine Learning Scientist',
        'Cybersecurity Penetration Tester',
        'Lead QA Automation Engineer',
      ];
      for (const title of roles) {
        const result = classifyJobIndustry(title);
        assert.strictEqual(result.industry, 'technology', `Failed for title: ${title}`);
      }
    });
  });

  describe('Safety Invariant: Never Default to Technology', () => {
    it('strictly falls back to "other" when title is ambiguous and no tech keywords exist', () => {
      const ambiguousTitles = [
        'Night Shift Supervisor',
        'Project Coordinator',
        'Senior Partner',
        'Operations Associate',
        'General Assistant',
      ];

      for (const title of ambiguousTitles) {
        const result = classifyJobIndustry(title, []);
        assert.strictEqual(
          result.industry,
          'other',
          `Ambiguous title "${title}" must strictly fall back to "other", not IT/technology`
        );
      }
    });

    it('respects explicit source metadata over title classification', () => {
      const result = classifyJobIndustry('Project Lead', [], '', {
        industry: 'healthcare',
        category: 'Clinical Operations',
      });
      assert.strictEqual(result.industry, 'healthcare');
      assert.strictEqual(result.category, 'Clinical Operations');
    });

    it('resolves industry labels correctly via getIndustryLabel', () => {
      assert.strictEqual(getIndustryLabel('education'), 'Education & Training');
      assert.strictEqual(getIndustryLabel('healthcare'), 'Healthcare & Medical');
      assert.strictEqual(getIndustryLabel('technology'), 'Technology & Engineering');
      assert.strictEqual(getIndustryLabel('all'), 'All Industries');
      assert.strictEqual(getIndustryLabel(''), 'All Industries');
    });
  });
});

