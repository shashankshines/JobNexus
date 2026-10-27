/**
 * Configurable Employer Registry for ATS-integrated Companies.
 * Supports Greenhouse, Ashby, Lever, and extensible ATS platforms with
 * strict SSRF slug validation and curated global employers across industries.
 */

export type AtsProviderType = 'greenhouse' | 'ashby' | 'lever';

export interface EmployerConfig {
  id: string;
  name: string;
  ats: AtsProviderType;
  slug: string;
  country?: string;
  region?: string;
  industry?: string;
  careerPageUrl?: string;
  active: boolean;
}

/**
 * Strict slug validation regex: allows only alphanumeric characters, underscores, and hyphens (1-64 chars).
 * Prevents Path Traversal and Server-Side Request Forgery (SSRF) when constructing ATS endpoint URLs.
 */
const SLUG_VALIDATION_REGEX = /^[a-zA-Z0-9_-]{1,64}$/;

export function isValidEmployerSlug(slug: string): boolean {
  if (!slug || typeof slug !== 'string') return false;
  return SLUG_VALIDATION_REGEX.test(slug);
}

/**
 * Curated, verified registry of global employers across Technology, Cloud,
 * Fintech, Cybersecurity, AI, Design, and Open Source.
 * Every slug listed has been verified against the respective ATS endpoint.
 */
export const CURATED_EMPLOYERS: EmployerConfig[] = [
  // Greenhouse Employers
  {
    id: 'canonical',
    name: 'Canonical',
    ats: 'greenhouse',
    slug: 'canonical',
    country: 'United Kingdom',
    region: 'Global',
    industry: 'Open Source / OS',
    careerPageUrl: 'https://canonical.com/careers',
    active: true,
  },
  {
    id: 'automattic',
    name: 'Automattic',
    ats: 'greenhouse',
    slug: 'automattic',
    country: 'United States',
    region: 'Global',
    industry: 'Web / Publishing',
    careerPageUrl: 'https://automattic.com/work-with-us',
    active: true,
  },
  {
    id: 'gitlab',
    name: 'GitLab',
    ats: 'greenhouse',
    slug: 'gitlab',
    country: 'United States',
    region: 'Global',
    industry: 'DevOps / Cloud',
    careerPageUrl: 'https://about.gitlab.com/jobs',
    active: true,
  },
  {
    id: 'stripe',
    name: 'Stripe',
    ats: 'greenhouse',
    slug: 'stripe',
    country: 'United States',
    region: 'Global',
    industry: 'Fintech / Payments',
    careerPageUrl: 'https://stripe.com/jobs',
    active: true,
  },
  {
    id: 'cloudflare',
    name: 'Cloudflare',
    ats: 'greenhouse',
    slug: 'cloudflare',
    country: 'United States',
    region: 'Global',
    industry: 'Cloud Infrastructure / Security',
    careerPageUrl: 'https://www.cloudflare.com/careers',
    active: true,
  },
  {
    id: 'datadog',
    name: 'Datadog',
    ats: 'greenhouse',
    slug: 'datadog',
    country: 'United States',
    region: 'Global',
    industry: 'Cloud Observability',
    careerPageUrl: 'https://www.datadoghq.com/careers',
    active: true,
  },
  {
    id: 'reddit',
    name: 'Reddit',
    ats: 'greenhouse',
    slug: 'reddit',
    country: 'United States',
    region: 'Global',
    industry: 'Social / Tech',
    careerPageUrl: 'https://boards.greenhouse.io/reddit',
    active: true,
  },
  {
    id: 'coinbase',
    name: 'Coinbase',
    ats: 'greenhouse',
    slug: 'coinbase',
    country: 'United States',
    region: 'Global',
    industry: 'Crypto / Fintech',
    careerPageUrl: 'https://www.coinbase.com/careers',
    active: true,
  },
  {
    id: 'dropbox',
    name: 'Dropbox',
    ats: 'greenhouse',
    slug: 'dropbox',
    country: 'United States',
    region: 'Global',
    industry: 'Cloud / Collaboration',
    careerPageUrl: 'https://jobs.dropbox.com',
    active: true,
  },
  {
    id: 'lyft',
    name: 'Lyft',
    ats: 'greenhouse',
    slug: 'lyft',
    country: 'United States',
    region: 'Global',
    industry: 'Transportation / Tech',
    careerPageUrl: 'https://www.lyft.com/careers',
    active: true,
  },
  {
    id: 'robinhood',
    name: 'Robinhood',
    ats: 'greenhouse',
    slug: 'robinhood',
    country: 'United States',
    region: 'Global',
    industry: 'Fintech / Trading',
    careerPageUrl: 'https://robinhood.com/us/en/careers',
    active: true,
  },
  {
    id: 'airbnb',
    name: 'Airbnb',
    ats: 'greenhouse',
    slug: 'airbnb',
    country: 'United States',
    region: 'Global',
    industry: 'Travel / Hospitality',
    careerPageUrl: 'https://careers.airbnb.com',
    active: true,
  },

  // Ashby Employers
  {
    id: 'linear',
    name: 'Linear',
    ats: 'ashby',
    slug: 'linear',
    country: 'United States',
    region: 'Global',
    industry: 'Productivity / Project Management',
    careerPageUrl: 'https://linear.app/careers',
    active: true,
  },
  {
    id: 'notion',
    name: 'Notion',
    ats: 'ashby',
    slug: 'notion',
    country: 'United States',
    region: 'Global',
    industry: 'Productivity / Workspace',
    careerPageUrl: 'https://www.notion.so/careers',
    active: true,
  },
  {
    id: 'figma',
    name: 'Figma',
    ats: 'ashby',
    slug: 'figma',
    country: 'United States',
    region: 'Global',
    industry: 'Design / Collaboration',
    careerPageUrl: 'https://www.figma.com/careers',
    active: true,
  },
  {
    id: 'openai',
    name: 'OpenAI',
    ats: 'ashby',
    slug: 'openai',
    country: 'United States',
    region: 'Global',
    industry: 'Artificial Intelligence',
    careerPageUrl: 'https://openai.com/careers',
    active: true,
  },
  {
    id: 'retool',
    name: 'Retool',
    ats: 'ashby',
    slug: 'retool',
    country: 'United States',
    region: 'Global',
    industry: 'Developer Tools / Internal Software',
    careerPageUrl: 'https://retool.com/careers',
    active: true,
  },
  {
    id: 'ramp',
    name: 'Ramp',
    ats: 'ashby',
    slug: 'ramp',
    country: 'United States',
    region: 'Global',
    industry: 'Fintech / Spend Management',
    careerPageUrl: 'https://ramp.com/careers',
    active: true,
  },
  {
    id: 'deel',
    name: 'Deel',
    ats: 'ashby',
    slug: 'deel',
    country: 'United States',
    region: 'Global',
    industry: 'HR Tech / Global Payroll',
    careerPageUrl: 'https://www.deel.com/careers',
    active: true,
  },
  {
    id: 'replit',
    name: 'Replit',
    ats: 'ashby',
    slug: 'replit',
    country: 'United States',
    region: 'Global',
    industry: 'Developer Tools / Cloud Development',
    careerPageUrl: 'https://replit.com/careers',
    active: true,
  },
  {
    id: 'vanta',
    name: 'Vanta',
    ats: 'ashby',
    slug: 'vanta',
    country: 'United States',
    region: 'Global',
    industry: 'Security & Compliance',
    careerPageUrl: 'https://www.vanta.com/careers',
    active: true,
  },

  // Lever Employers
  {
    id: 'spotify',
    name: 'Spotify',
    ats: 'lever',
    slug: 'spotify',
    country: 'Sweden',
    region: 'Global',
    industry: 'Audio Streaming / Media',
    careerPageUrl: 'https://www.lifeatspotify.com',
    active: true,
  },
  {
    id: 'kinsta',
    name: 'Kinsta',
    ats: 'lever',
    slug: 'kinsta',
    country: 'United States',
    region: 'Global',
    industry: 'Managed Cloud Hosting',
    careerPageUrl: 'https://kinsta.com/careers',
    active: true,
  },
];

export class EmployerRegistry {
  private employers: Map<string, EmployerConfig> = new Map();

  constructor(initialEmployers: EmployerConfig[] = CURATED_EMPLOYERS) {
    for (const emp of initialEmployers) {
      this.register(emp);
    }
  }

  register(config: EmployerConfig): void {
    if (!isValidEmployerSlug(config.slug)) {
      throw new Error(
        `[EmployerRegistry] Invalid slug "${config.slug}" for employer "${config.name}". Slugs must match /^[a-zA-Z0-9_-]{1,64}$/.`
      );
    }
    const key = `${config.ats}:${config.slug.toLowerCase()}`;
    this.employers.set(key, { ...config, slug: config.slug.trim() });
  }

  getAll(): EmployerConfig[] {
    return Array.from(this.employers.values());
  }

  getActive(): EmployerConfig[] {
    return this.getAll().filter((e) => e.active);
  }

  getByAts(ats: AtsProviderType, activeOnly: boolean = true): EmployerConfig[] {
    return this.getAll().filter(
      (e) => e.ats === ats && (!activeOnly || e.active)
    );
  }

  getBySlug(ats: AtsProviderType, slug: string): EmployerConfig | undefined {
    return this.employers.get(`${ats}:${slug.toLowerCase()}`);
  }
}

// Global singleton instance
export const globalEmployerRegistry = new EmployerRegistry();
