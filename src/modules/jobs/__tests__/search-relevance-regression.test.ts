import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { filterAndRankJobs } from '../domain/job.ranking';
import { JobSearchService } from '../services/job-search.service';
import { NormalizedJob } from '../domain/job.types';
import { JobProvider } from '../providers/provider.types';

function createFixtureJob(partial: Partial<NormalizedJob>): NormalizedJob {
  const jobId = partial.id || `fixture-${Math.random().toString(36).substring(2, 9)}`;
  return {
    id: jobId,
    sourceId: partial.sourceId || 'src-1',
    sourceName: partial.sourceName || 'VerifiedATS',
    title: partial.title || 'Software Engineer',
    company: partial.company || 'Enterprise Solutions',
    location: partial.location || 'Remote',
    isRemote: partial.isRemote ?? true,
    description: partial.description || 'Core engineering responsibilities',
    applicationUrl: partial.applicationUrl || `https://jobs.lever.co/enterprise/${jobId}`,
    publishedAt: partial.publishedAt || new Date().toISOString(),
    employmentType: partial.employmentType || 'Full Time',
    tags: partial.tags || ['Technology'],
    industry: partial.industry || 'technology',
    category: partial.category || 'Technology & IT',
    isIndiaEligible: partial.isIndiaEligible ?? true,
    seniority: partial.seniority || 'Mid',
    workplaceType: partial.workplaceType || (partial.isRemote ? 'remote' : 'onsite'),
  };
}

describe('JobNexus — Search Relevance Regression Suite (20 Representative Roles)', () => {
  beforeEach(() => {
    JobSearchService.clearCache();
  });

  // Representative dataset containing genuine examples of all 20 IT roles and 6 Non-IT cross-sector jobs
  const representativeDataset: NormalizedJob[] = [
    // 1. AI Engineer
    createFixtureJob({
      id: 'job-ai-1',
      title: 'Senior AI Engineer',
      company: 'Anthropic Systems',
      location: 'Bengaluru, India',
      isRemote: false,
      workplaceType: 'hybrid',
      tags: ['Python', 'PyTorch', 'TensorFlow', 'Deep Learning'],
      description: 'Design deep learning architectures and foundation model capabilities in Python.',
    }),
    createFixtureJob({
      id: 'job-ai-2',
      title: 'Artificial Intelligence Engineer',
      company: 'NeuralCorp',
      location: 'San Francisco, CA',
      isRemote: true,
      workplaceType: 'remote',
      tags: ['AI', 'Computer Vision', 'PyTorch'],
      description: 'Lead AI developer building perception and multimodal models.',
    }),

    // 2. Generative AI Engineer
    createFixtureJob({
      id: 'job-genai-1',
      title: 'Generative AI Engineer',
      company: 'Scale Vision',
      location: 'Remote',
      isRemote: true,
      workplaceType: 'remote',
      tags: ['GenAI', 'LLM', 'Diffusion', 'RAG'],
      description: 'Productionize generative AI pipelines, diffusion models, and prompt engineering.',
    }),
    createFixtureJob({
      id: 'job-genai-2',
      title: 'GenAI Developer',
      company: 'CreativeTech',
      location: 'Bengaluru, India',
      isRemote: false,
      workplaceType: 'onsite',
      tags: ['Generative AI', 'Transformers', 'OpenAI'],
      description: 'Build enterprise GenAI assistants and multi-modal workflows.',
    }),

    // 3. LLM Engineer
    createFixtureJob({
      id: 'job-llm-1',
      title: 'Senior LLM Engineer',
      company: 'FoundryAI',
      location: 'Remote',
      isRemote: true,
      workplaceType: 'remote',
      tags: ['LLM', 'LangChain', 'LlamaIndex', 'Fine-Tuning'],
      description: 'Fine-tune large language models and deploy low-latency RAG architectures.',
    }),
    createFixtureJob({
      id: 'job-llm-2',
      title: 'Large Language Model Engineer',
      company: 'ContextLabs',
      location: 'Hyderabad, India',
      isRemote: false,
      workplaceType: 'hybrid',
      tags: ['LLM', 'HuggingFace', 'Transformers', 'vLLM'],
      description: 'Optimize quantized open-source LLM inferences.',
    }),

    // 4. Agentic AI Engineer
    createFixtureJob({
      id: 'job-agentic-1',
      title: 'Agentic AI Engineer',
      company: 'Autonomous Systems',
      location: 'Remote',
      isRemote: true,
      workplaceType: 'remote',
      tags: ['Agents', 'AutoGen', 'CrewAI', 'LangGraph'],
      description: 'Develop autonomous multi-agent systems and function calling workflows.',
    }),
    createFixtureJob({
      id: 'job-agentic-2',
      title: 'AI Agent Engineer',
      company: 'OrchestrateAI',
      location: 'Bengaluru, India',
      isRemote: false,
      workplaceType: 'onsite',
      tags: ['Agentic', 'Multi-Agent', 'Tool Use'],
      description: 'Build reasoning and planning agents with verifiable state verification.',
    }),

    // 5. Forward Deployed Engineer
    createFixtureJob({
      id: 'job-fde-1',
      title: 'Forward Deployed Engineer',
      company: 'Palantir Systems',
      location: 'London, UK',
      isRemote: false,
      workplaceType: 'onsite',
      tags: ['FDE', 'Solutions Engineering', 'Enterprise Integration'],
      description: 'Embed with mission-critical customer teams to engineer distributed pipelines.',
    }),
    createFixtureJob({
      id: 'job-fde-2',
      title: 'FDE - Enterprise AI Solutions',
      company: 'Apex Data',
      location: 'Remote',
      isRemote: true,
      workplaceType: 'remote',
      tags: ['Solutions Engineer', 'Deployment', 'Forward Deployed'],
      description: 'Forward deployed software engineer solving large-scale client analytics challenges.',
    }),

    // 6. Applied AI Engineer
    createFixtureJob({
      id: 'job-applied-1',
      title: 'Applied AI Engineer',
      company: 'Applied Cognition',
      location: 'Bengaluru, India',
      isRemote: false,
      workplaceType: 'hybrid',
      tags: ['Applied Machine Learning', 'ONNX', 'TensorRT'],
      description: 'Bridge research models into low-latency production applications.',
    }),

    // 7. MLOps Engineer
    createFixtureJob({
      id: 'job-mlops-1',
      title: 'Lead MLOps Engineer',
      company: 'Pipelines.ai',
      location: 'Remote',
      isRemote: true,
      workplaceType: 'remote',
      tags: ['MLFlow', 'Kubeflow', 'Airflow', 'Model Registry'],
      description: 'Maintain high-throughput feature stores and automated CI/CD model retraining.',
    }),

    // 8. Data Engineer
    createFixtureJob({
      id: 'job-data-1',
      title: 'Staff Data Engineer',
      company: 'DataLake Works',
      location: 'Bengaluru, India',
      isRemote: false,
      workplaceType: 'hybrid',
      tags: ['Spark', 'Kafka', 'Snowflake', 'dbt'],
      description: 'Architect multi-terabyte real-time event streaming and data lake pipelines.',
    }),

    // 9. Python Developer
    createFixtureJob({
      id: 'job-python-1',
      title: 'Senior Python Developer',
      company: 'PyBackend Global',
      location: 'Remote',
      isRemote: true,
      workplaceType: 'remote',
      tags: ['Python', 'FastAPI', 'Django', 'PostgreSQL'],
      description: 'Build asynchronous microservices with FastAPI and SQLAlchemy.',
    }),

    // 10. Full Stack Developer
    createFixtureJob({
      id: 'job-fullstack-1',
      title: 'Full Stack Developer',
      company: 'OmniStack Labs',
      location: 'Bengaluru, India',
      isRemote: false,
      workplaceType: 'onsite',
      tags: ['React', 'Node.js', 'TypeScript', 'Next.js'],
      description: 'Develop responsive client interfaces and REST/GraphQL microservices.',
    }),

    // 11. Frontend Developer
    createFixtureJob({
      id: 'job-frontend-1',
      title: 'Senior Frontend Developer',
      company: 'Interface Craft',
      location: 'Remote',
      isRemote: true,
      workplaceType: 'remote',
      tags: ['React', 'TypeScript', 'Tailwind', 'Next.js'],
      description: 'Create high-fidelity design systems and accessible web interfaces.',
    }),

    // 12. Backend Developer
    createFixtureJob({
      id: 'job-backend-1',
      title: 'Principal Backend Developer',
      company: 'ServerCore Inc',
      location: 'Pune, India',
      isRemote: false,
      workplaceType: 'hybrid',
      tags: ['Go', 'Java', 'Spring Boot', 'Microservices'],
      description: 'Develop distributed transactional engines and low-latency APIs.',
    }),

    // 13. Cloud Engineer
    createFixtureJob({
      id: 'job-cloud-1',
      title: 'Cloud Engineer',
      company: 'SkyPlatform Infra',
      location: 'Remote',
      isRemote: true,
      workplaceType: 'remote',
      tags: ['AWS', 'Terraform', 'Kubernetes', 'CloudFormation'],
      description: 'Provision secure multi-region AWS and GCP cloud infrastructure as code.',
    }),

    // 14. DevOps Engineer
    createFixtureJob({
      id: 'job-devops-1',
      title: 'Senior DevOps Engineer',
      company: 'Continuous Delivery Co',
      location: 'Bengaluru, India',
      isRemote: false,
      workplaceType: 'hybrid',
      tags: ['Docker', 'Kubernetes', 'GitHub Actions', 'Terraform'],
      description: 'Automate build pipelines and maintain 99.99% service availability.',
    }),

    // 15. Cybersecurity Engineer
    createFixtureJob({
      id: 'job-security-1',
      title: 'Cybersecurity Engineer',
      company: 'Sentinel Defense',
      location: 'Remote',
      isRemote: true,
      workplaceType: 'remote',
      tags: ['SIEM', 'SOC', 'Penetration Testing', 'Firewall'],
      description: 'Lead vulnerability assessments, incident response, and zero-trust policy enforcement.',
    }),

    // 16. QA Automation Engineer
    createFixtureJob({
      id: 'job-qa-1',
      title: 'QA Automation Engineer',
      company: 'QualityFirst Labs',
      location: 'Chennai, India',
      isRemote: false,
      workplaceType: 'onsite',
      tags: ['Selenium', 'Cypress', 'Playwright', 'TestNG'],
      description: 'Build comprehensive automated end-to-end and regression test suites.',
    }),

    // 17. Technical Product Manager
    createFixtureJob({
      id: 'job-tpm-1',
      title: 'Technical Product Manager',
      company: 'CloudScale APIs',
      location: 'Remote',
      isRemote: true,
      workplaceType: 'remote',
      tags: ['Product Management', 'Agile', 'PRDs', 'API Specifications'],
      description: 'Define technical roadmaps and partner with engineering on high-throughput platform APIs.',
    }),

    // 18. SAP Consultant
    createFixtureJob({
      id: 'job-sap-1',
      title: 'Senior SAP Consultant',
      company: 'Enterprise ERP Corp',
      location: 'Mumbai, India',
      isRemote: false,
      workplaceType: 'onsite',
      tags: ['SAP', 'S/4HANA', 'ABAP', 'SAP FICO'],
      description: 'Deliver end-to-end SAP S/4HANA financial and supply-chain migration projects.',
    }),

    // 19. Mobile Developer
    createFixtureJob({
      id: 'job-mobile-1',
      title: 'Senior Mobile Developer',
      company: 'AppVenture Studio',
      location: 'Remote',
      isRemote: true,
      workplaceType: 'remote',
      tags: ['React Native', 'Flutter', 'iOS', 'Android'],
      description: 'Build high-performance cross-platform iOS and Android applications.',
    }),

    // 20. Embedded Systems Engineer
    createFixtureJob({
      id: 'job-embedded-1',
      title: 'Embedded Systems Engineer',
      company: 'MicroRobotics Hardware',
      location: 'Bengaluru, India',
      isRemote: false,
      workplaceType: 'onsite',
      tags: ['C', 'C++', 'RTOS', 'Firmware', 'ARM'],
      description: 'Develop bare-metal and RTOS firmware for ARM microcontroller devices.',
    }),

    // Non-IT Control Distractors (To test multi-sector isolation and precision)
    createFixtureJob({
      id: 'job-nonit-nurse',
      title: 'Cardiology Registered Nurse',
      company: 'Apex Metro Hospital',
      location: 'Bengaluru, India',
      isRemote: false,
      workplaceType: 'onsite',
      industry: 'healthcare',
      category: 'Healthcare & Medical',
      tags: ['Nursing', 'Cardiology', 'Clinical Care'],
      description: 'Patient telemetry monitoring and critical cardiovascular recovery care.',
    }),
    createFixtureJob({
      id: 'job-nonit-teacher',
      title: 'Primary School Mathematics Teacher',
      company: 'Greenwood Academy',
      location: 'Delhi, India',
      isRemote: false,
      workplaceType: 'onsite',
      industry: 'education',
      category: 'Education & Teaching',
      tags: ['Teaching', 'Mathematics', 'Curriculum'],
      description: 'Deliver middle-school mathematics instruction and curriculum assessments.',
    }),
    createFixtureJob({
      id: 'job-nonit-accountant',
      title: 'Senior Chartered Accountant',
      company: 'KPMG Advisory Services',
      location: 'Mumbai, India',
      isRemote: false,
      workplaceType: 'hybrid',
      industry: 'finance_accounting',
      category: 'Finance & Accounting',
      tags: ['Audit', 'Taxation', 'GST', 'CA'],
      description: 'Statutory audit preparation, corporate taxation filings, and balance sheet certification.',
    }),
    createFixtureJob({
      id: 'job-nonit-welder',
      title: 'Industrial Heavy Equipment Welder',
      company: 'Apex Heavy Fabrication',
      location: 'Pune, India',
      isRemote: false,
      workplaceType: 'onsite',
      industry: 'construction_trades',
      category: 'Construction & Trades',
      tags: ['Welding', 'Fabrication', 'MIG', 'TIG'],
      description: 'Structural arc welding and ASME boiler fabrication.',
    }),
    createFixtureJob({
      id: 'job-nonit-warehouse',
      title: 'Warehouse Logistics Supervisor',
      company: 'QuickShip Supply Chain',
      location: 'Bengaluru, India',
      isRemote: false,
      workplaceType: 'onsite',
      industry: 'logistics_transport',
      category: 'Logistics & Supply Chain',
      tags: ['Warehouse', 'Forklift', 'Inventory', 'Dispatch'],
      description: 'Manage 3PL warehouse inventory receipts and cross-dock dispatch schedules.',
    }),
  ];

  const targetRoles = [
    { query: 'AI Engineer', expectedId: 'job-ai-1' },
    { query: 'Generative AI Engineer', expectedId: 'job-genai-1' },
    { query: 'LLM Engineer', expectedId: 'job-llm-1' },
    { query: 'Agentic AI Engineer', expectedId: 'job-agentic-1' },
    { query: 'Forward Deployed Engineer', expectedId: 'job-fde-1' },
    { query: 'Applied AI Engineer', expectedId: 'job-applied-1' },
    { query: 'MLOps Engineer', expectedId: 'job-mlops-1' },
    { query: 'Data Engineer', expectedId: 'job-data-1' },
    { query: 'Python Developer', expectedId: 'job-python-1' },
    { query: 'Full Stack Developer', expectedId: 'job-fullstack-1' },
    { query: 'Frontend Developer', expectedId: 'job-frontend-1' },
    { query: 'Backend Developer', expectedId: 'job-backend-1' },
    { query: 'Cloud Engineer', expectedId: 'job-cloud-1' },
    { query: 'DevOps Engineer', expectedId: 'job-devops-1' },
    { query: 'Cybersecurity Engineer', expectedId: 'job-security-1' },
    { query: 'QA Automation Engineer', expectedId: 'job-qa-1' },
    { query: 'Technical Product Manager', expectedId: 'job-tpm-1' },
    { query: 'SAP Consultant', expectedId: 'job-sap-1' },
    { query: 'Mobile Developer', expectedId: 'job-mobile-1' },
    { query: 'Embedded Systems Engineer', expectedId: 'job-embedded-1' },
  ];

  describe('Section 3: Precision@10 & Relevance Across All 20 Queries', () => {
    for (const { query, expectedId } of targetRoles) {
      it(`returns relevant results and maintains 100% precision@10 for query "${query}"`, () => {
        const results = filterAndRankJobs(representativeDataset, { query });

        assert.ok(results.length > 0, `Query "${query}" should return at least one result`);
        assert.strictEqual(
          results[0].id,
          expectedId,
          `First result for query "${query}" must be ${expectedId}, received ${results[0]?.id} (${results[0]?.title})`
        );

        // Verify precision@10: None of the top 10 results may be an irrelevant Non-IT distracter
        const top10 = results.slice(0, 10);
        const nonItDistracters = ['job-nonit-nurse', 'job-nonit-teacher', 'job-nonit-accountant', 'job-nonit-welder', 'job-nonit-warehouse'];
        for (const item of top10) {
          assert.strictEqual(
            nonItDistracters.includes(item.id),
            false,
            `Irrelevant job ${item.id} (${item.title}) found in top 10 results for "${query}"`
          );
        }

        const precisionAt10 = top10.length > 0
          ? top10.filter((item) => !nonItDistracters.includes(item.id)).length / top10.length
          : 0;
        assert.strictEqual(precisionAt10, 1.0, `Precision@10 for "${query}" must be 1.0 (100%)`);
      });
    }
  });

  describe('Title Aliases and Acronym Matching Invariants', () => {
    it('matches "FDE" query to Forward Deployed Engineer jobs', () => {
      const results = filterAndRankJobs(representativeDataset, { query: 'FDE' });
      assert.ok(results.length > 0);
      assert.ok(results.some((j) => j.id === 'job-fde-1' || j.id === 'job-fde-2'));
    });

    it('matches "SDET" query to QA Automation Engineer jobs', () => {
      const results = filterAndRankJobs(representativeDataset, { query: 'SDET' });
      assert.ok(results.length > 0);
      assert.strictEqual(results[0].id, 'job-qa-1');
    });

    it('matches "SRE" query to DevOps / Site Reliability jobs', () => {
      const results = filterAndRankJobs(representativeDataset, { query: 'SRE' });
      assert.ok(results.length > 0);
      assert.strictEqual(results[0].id, 'job-devops-1');
    });

    it('matches "TPM" query to Technical Product Manager jobs', () => {
      const results = filterAndRankJobs(representativeDataset, { query: 'TPM' });
      assert.ok(results.length > 0);
      assert.strictEqual(results[0].id, 'job-tpm-1');
    });

    it('matches "GenAI" query to Generative AI jobs', () => {
      const results = filterAndRankJobs(representativeDataset, { query: 'GenAI' });
      assert.ok(results.length > 0);
      assert.ok(
        results[0].id === 'job-genai-1' || results[0].id === 'job-genai-2',
        `Expected job-genai-1 or job-genai-2, received ${results[0].id}`
      );
    });
  });

  describe('Skill-Based Role Matching Invariants', () => {
    it('ranks jobs matching key role skills even when title words vary', () => {
      const skillJob = createFixtureJob({
        id: 'job-skill-crewai',
        title: 'Distributed Systems Architect',
        tags: ['CrewAI', 'LangGraph', 'Autonomous Agents', 'Python'],
        description: 'Building multi-agent autonomous coordination frameworks.',
      });

      const pool = [skillJob, ...representativeDataset];
      const results = filterAndRankJobs(pool, { query: 'Agentic AI Engineer' });

      assert.ok(results.length >= 2);
      assert.ok(results.some((j) => j.id === 'job-skill-crewai'));
    });

    it('matches SAP skills (ABAP, HANA, S/4HANA) for SAP queries', () => {
      const sapJob = createFixtureJob({
        id: 'job-abap-dev',
        title: 'Senior Enterprise Systems Specialist',
        tags: ['ABAP', 'HANA', 'S/4HANA'],
        description: 'Lead technical developer for ERP modernization.',
      });

      const pool = [sapJob, ...representativeDataset];
      const results = filterAndRankJobs(pool, { query: 'SAP Consultant' });

      assert.ok(results.some((j) => j.id === 'job-abap-dev'));
    });
  });

  describe('Constraint Filtering and Pagination Boundary Invariants', () => {
    it('strictly respects remote workplace filter without leaking onsite positions', () => {
      const results = filterAndRankJobs(representativeDataset, {
        query: 'AI Engineer',
        remote: 'remote',
      });

      assert.ok(results.length > 0);
      assert.ok(results.every((j) => j.isRemote === true || j.workplaceType === 'remote'));
      assert.ok(results.some((j) => j.id === 'job-ai-2'));
    });

    it('strictly respects location constraint (Bengaluru) and ranks local positions first', () => {
      const results = filterAndRankJobs(representativeDataset, {
        query: 'AI Engineer',
        location: 'Bengaluru',
      });

      assert.ok(results.length > 0);
      assert.strictEqual(results[0].id, 'job-ai-1'); // Anthropic Systems in Bengaluru
    });

    it('guarantees deterministic pagination without duplicate or missing items across pages', async () => {
      const testProvider: JobProvider = {
        id: 'pagination-test-provider',
        name: 'PaginationProvider',
        async fetchJobs() {
          return representativeDataset;
        },
      };

      const service = new JobSearchService([testProvider]);

      // Page 1 with pageSize 5
      const page1 = await service.searchJobs({
        page: 1,
        pageSize: 5,
      });

      // Page 2 with pageSize 5
      const page2 = await service.searchJobs({
        page: 2,
        pageSize: 5,
      });

      assert.strictEqual(page1.jobs.length, 5);
      assert.strictEqual(page2.jobs.length, 5);

      const page1Ids = new Set(page1.jobs.map((j) => j.id));
      const page2Ids = new Set(page2.jobs.map((j) => j.id));

      // Overlap must be empty (no duplicate jobs across pages)
      for (const id of page2Ids) {
        assert.strictEqual(
          page1Ids.has(id),
          false,
          `Job ${id} appears on both Page 1 and Page 2!`
        );
      }
    });

    it('returns genuine empty results when query has no matching records', () => {
      const results = filterAndRankJobs(representativeDataset, {
        query: 'Astronaut Space Station Commander',
      });

      assert.deepStrictEqual(results, []);
    });

    it('maintains results from other providers when one provider fails', async () => {
      const healthyProvider: JobProvider = {
        id: 'healthy-provider',
        name: 'HealthyProvider',
        async fetchJobs() {
          return representativeDataset;
        },
      };

      const failingProvider: JobProvider = {
        id: 'failing-provider',
        name: 'FailingProvider',
        async fetchJobs() {
          throw new Error('Connection reset by peer: 504 Gateway Timeout');
        },
      };

      const service = new JobSearchService([healthyProvider, failingProvider]);
      const res = await service.searchJobs({ query: 'Full Stack Developer' });

      // Outage of failingProvider must not erase results from healthyProvider
      assert.ok(res.jobs.length > 0);
      assert.strictEqual(res.jobs[0].id, 'job-fullstack-1');
      assert.ok(res.diagnostics && res.diagnostics.some((d) => d.providerName === 'FailingProvider' && d.status !== 'fulfilled'));
    });
  });
});
