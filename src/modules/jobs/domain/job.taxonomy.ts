export type JobIndustry =
  // Canonical 30 Sectors
  | 'it_software'
  | 'ai_data_science'
  | 'cybersecurity_cloud'
  | 'engineering_core'
  | 'banking_finance'
  | 'accounting_audit_insurance'
  | 'sales_bizdev'
  | 'marketing_digital'
  | 'hr_recruitment'
  | 'legal_compliance'
  | 'admin_operations'
  | 'consulting_management'
  | 'research_science'
  | 'media_design_creative'
  | 'healthcare_pharma'
  | 'education_teaching'
  | 'manufacturing_production'
  | 'logistics_supply_chain'
  | 'retail_ecommerce'
  | 'hospitality_tourism'
  | 'construction_real_estate'
  | 'customer_support_bpo'
  | 'skilled_trades_field'
  | 'agriculture_forestry'
  | 'energy_utilities'
  | 'automotive_aviation'
  | 'security_facilities_defense'
  | 'government_public'
  | 'social_services_ngo'
  | 'other'
  // Legacy Aliases (Strict Backward Compatibility)
  | 'technology'
  | 'healthcare'
  | 'construction_trades'
  | 'manufacturing'
  | 'logistics_transport'
  | 'retail_sales'
  | 'education'
  | 'finance_accounting'
  | 'administration_hr'
  | 'agriculture'
  | 'customer_service'
  | 'security_facilities';

export interface IndustryDefinition {
  id: JobIndustry;
  label: string;
  description: string;
  keywords: string[];
}

export const INDUSTRY_TAXONOMY: Record<JobIndustry, IndustryDefinition> = {
  // Legacy Base Entries
  technology: {
    id: 'technology',
    label: 'Technology & Engineering',
    description: 'Software development, infrastructure, AI/ML, cybersecurity, and tech operations',
    keywords: [
      'software', 'engineer', 'developer', 'frontend', 'backend', 'fullstack', 'devops',
      'cloud', 'architect', 'data science', 'machine learning', 'artificial intelligence',
      'python', 'javascript', 'typescript', 'react', 'node', 'golang', 'rust', 'c++', 'java',
      'cybersecurity', 'infosec', 'qa engineer', 'sre', 'database administrator', 'sysadmin',
    ],
  },
  healthcare: {
    id: 'healthcare',
    label: 'Healthcare & Medical',
    description: 'Physicians, nursing, clinical practice, pharmacy, and medical technology',
    keywords: [
      'doctor', 'physician', 'nurse', 'nursing', 'clinical', 'hospital', 'medical', 'surgeon',
      'pharmacist', 'pharmacy', 'therapist', 'paramedic', 'dentist', 'radiologist', 'pathologist',
      'pediatrician', 'epidemiologist', 'biomedical', 'healthcare', 'caregiver', 'phlebotomist',
    ],
  },
  construction_trades: {
    id: 'construction_trades',
    label: 'Construction & Skilled Trades',
    description: 'Civil construction, plumbing, electrical, carpentry, HVAC, and site engineering',
    keywords: [
      'construction', 'civil engineer', 'site engineer', 'carpenter', 'electrician', 'plumber',
      'welder', 'mason', 'hvac', 'heavy equipment', 'surveyor', 'contractor', 'roofer',
      'pipefitter', 'scaffolder', 'structural engineer', 'building inspector',
    ],
  },
  manufacturing: {
    id: 'manufacturing',
    label: 'Manufacturing & Industrial',
    description: 'Plant management, mechanical engineering, production lines, and quality control',
    keywords: [
      'manufacturing', 'mechanical engineer', 'plant manager', 'production supervisor',
      'cnc operator', 'assembly line', 'machinist', 'industrial engineer', 'fabrication',
      'quality inspector', 'process engineer', 'toolmaker', 'packaging technician',
    ],
  },
  logistics_transport: {
    id: 'logistics_transport',
    label: 'Logistics & Transportation',
    description: 'Supply chain management, warehousing, freight, fleet driving, and dispatch',
    keywords: [
      'supply chain', 'logistics', 'warehouse', 'forklift', 'freight', 'dispatcher',
      'fleet manager', 'truck driver', 'delivery driver', 'courier', 'cargo', 'inventory manager',
      'shipping', 'customs broker', 'transportation coordinator',
    ],
  },
  retail_sales: {
    id: 'retail_sales',
    label: 'Retail & Sales',
    description: 'Store operations, business development, merchandising, and account management',
    keywords: [
      'retail', 'sales executive', 'sales representative', 'store manager', 'cashier',
      'merchandiser', 'account executive', 'business development', 'b2b sales', 'b2c sales',
      'visual merchandiser', 'sales associate', 'buyer', 'procurement',
    ],
  },
  hospitality_tourism: {
    id: 'hospitality_tourism',
    label: 'Hospitality & Tourism',
    description: 'Culinary arts, hotel management, bartending, front desk, and event planning',
    keywords: [
      'chef', 'cook', 'hotel manager', 'front desk', 'bartender', 'barista', 'waiter',
      'waitress', 'sommelier', 'concierge', 'housekeeper', 'event planner', 'tourism',
      'travel agent', 'restaurant manager', 'catering',
    ],
  },
  education: {
    id: 'education',
    label: 'Education & Training',
    description: 'Teaching, academic faculty, school leadership, tutoring, and curriculum design',
    keywords: [
      'teacher', 'teaching', 'professor', 'lecturer', 'instructor', 'principal', 'headteacher',
      'tutor', 'special education', 'curriculum', 'dean', 'school', 'academic counselor',
      'faculty', 'kindergarten', 'pedagogy',
    ],
  },
  finance_accounting: {
    id: 'finance_accounting',
    label: 'Finance & Accounting',
    description: 'Auditing, tax, accounting, financial analysis, investment, and banking',
    keywords: [
      'accountant', 'accounting', 'auditor', 'financial analyst', 'tax specialist',
      'controller', 'bookkeeper', 'cfo', 'investment banker', 'actuary', 'underwriter',
      'credit analyst', 'treasury', 'wealth management', 'chartered accountant',
    ],
  },
  administration_hr: {
    id: 'administration_hr',
    label: 'Administration & Human Resources',
    description: 'People operations, office management, administrative assistance, and talent acquisition',
    keywords: [
      'human resources', 'hr manager', 'talent acquisition', 'recruiter', 'recruiting',
      'office manager', 'executive assistant', 'administrative assistant', 'receptionist',
      'people partner', 'clerk', 'compliance officer', 'payroll coordinator',
    ],
  },
  agriculture: {
    id: 'agriculture',
    label: 'Agriculture & Forestry',
    description: 'Agronomy, farm management, livestock operations, horticulture, and forestry',
    keywords: [
      'agronomist', 'agriculture', 'farming', 'farm manager', 'horticulture', 'forestry',
      'livestock', 'crop specialist', 'soil scientist', 'veterinarian', 'dairy manager',
      'fishery', 'irrigation specialist',
    ],
  },
  government_public: {
    id: 'government_public',
    label: 'Government & Public Sector',
    description: 'Civil services, public administration, policy, humanitarian missions, and municipal work',
    keywords: [
      'civil service', 'government', 'public administration', 'policy analyst',
      'humanitarian', 'disaster relief', 'municipal', 'foreign affairs', 'defense officer',
      'court clerk', 'urban planner', 'social worker',
    ],
  },
  customer_service: {
    id: 'customer_service',
    label: 'Customer Support & Service',
    description: 'Call center, client support, technical helpdesk, and customer success',
    keywords: [
      'customer support', 'customer service', 'call center', 'helpdesk', 'client success',
      'support agent', 'customer care', 'contact center', 'support specialist',
    ],
  },
  security_facilities: {
    id: 'security_facilities',
    label: 'Security & Facilities',
    description: 'Facility maintenance, security guarding, occupational safety, and physical protection',
    keywords: [
      'security guard', 'security officer', 'facility manager', 'building maintenance',
      'safety officer', 'janitor', 'custodian', 'surveillance operator', 'fire safety',
    ],
  },
  other: {
    id: 'other',
    label: 'General & Other',
    description: 'Cross-functional, multi-sector, or emerging career categories',
    keywords: [],
  },

  // 30 Specific Expanded Sectors
  it_software: {
    id: 'it_software',
    label: 'IT & Software Development',
    description: 'Full-stack software engineering, web and mobile application development',
    keywords: ['software engineer', 'developer', 'frontend', 'backend', 'fullstack', 'react', 'node', 'python', 'java', 'typescript', 'mobile developer'],
  },
  ai_data_science: {
    id: 'ai_data_science',
    label: 'AI, Machine Learning & Data Science',
    description: 'Machine learning, generative AI, LLM engineering, data analytics, and statistics',
    keywords: ['data scientist', 'machine learning', 'ai engineer', 'nlp', 'computer vision', 'deep learning', 'data analyst', 'bi developer', 'prompt engineer'],
  },
  cybersecurity_cloud: {
    id: 'cybersecurity_cloud',
    label: 'Cybersecurity & Cloud',
    description: 'Cloud infrastructure, AWS/Azure/GCP, SRE, DevOps, SOC analysis, and penetration testing',
    keywords: ['cybersecurity', 'cloud engineer', 'devops', 'sre', 'infosec', 'penetration tester', 'security analyst', 'aws', 'kubernetes'],
  },
  engineering_core: {
    id: 'engineering_core',
    label: 'Engineering (Mech, Civil, Elec, Electronics)',
    description: 'Core engineering disciplines spanning mechanical, civil, electrical, and embedded hardware',
    keywords: ['mechanical engineer', 'civil engineer', 'electrical engineer', 'electronics', 'hardware engineer', 'embedded systems', 'pcb designer'],
  },
  banking_finance: {
    id: 'banking_finance',
    label: 'Banking & Financial Services',
    description: 'Commercial and investment banking, equity research, asset management, and fintech',
    keywords: ['banker', 'investment banking', 'credit analyst', 'loan officer', 'wealth management', 'financial consultant', 'fintech'],
  },
  accounting_audit_insurance: {
    id: 'accounting_audit_insurance',
    label: 'Accounting, Audit & Insurance',
    description: 'Statutory audit, chartered accountancy, taxation, corporate bookkeeping, and actuarial underwriting',
    keywords: ['chartered accountant', 'auditor', 'tax consultant', 'bookkeeper', 'underwriter', 'actuary', 'claims adjuster'],
  },
  sales_bizdev: {
    id: 'sales_bizdev',
    label: 'Sales & Business Development',
    description: 'Enterprise sales, B2B deal closing, client relationships, account executive roles, and territory growth',
    keywords: ['sales manager', 'account executive', 'business development', 'bdr', 'sdr', 'sales representative', 'client relationship'],
  },
  marketing_digital: {
    id: 'marketing_digital',
    label: 'Marketing & Digital Marketing',
    description: 'Growth marketing, SEO, paid performance media, brand strategy, content, and communications',
    keywords: ['marketing manager', 'seo specialist', 'growth marketer', 'content strategist', 'social media manager', 'copywriter', 'performance marketing'],
  },
  hr_recruitment: {
    id: 'hr_recruitment',
    label: 'Human Resources & Recruitment',
    description: 'Talent acquisition, employer branding, people operations, HR generalist, and total rewards',
    keywords: ['human resources', 'hr manager', 'talent acquisition', 'recruiter', 'people partner', 'compensation analyst'],
  },
  legal_compliance: {
    id: 'legal_compliance',
    label: 'Legal & Compliance',
    description: 'Corporate counsel, contract administration, regulatory compliance, data privacy, and intellectual property',
    keywords: ['legal counsel', 'attorney', 'lawyer', 'compliance officer', 'paralegal', 'contract manager', 'data privacy officer'],
  },
  admin_operations: {
    id: 'admin_operations',
    label: 'Administration & Operations',
    description: 'Executive assistance, workplace coordination, administrative support, and office management',
    keywords: ['executive assistant', 'office manager', 'administrative assistant', 'operations coordinator', 'facilities coordinator'],
  },
  consulting_management: {
    id: 'consulting_management',
    label: 'Consulting & Management',
    description: 'Strategy consulting, management advisory, transformation programs, and enterprise PMO',
    keywords: ['management consultant', 'strategy consultant', 'business analyst', 'program manager', 'scrum master', 'change manager'],
  },
  research_science: {
    id: 'research_science',
    label: 'Research & Science',
    description: 'Laboratory research, biotechnology, clinical trials, physics, chemistry, and scientific academia',
    keywords: ['research scientist', 'biologist', 'chemist', 'physicist', 'laboratory technician', 'clinical research associate'],
  },
  media_design_creative: {
    id: 'media_design_creative',
    label: 'Media, Design & Creative',
    description: 'UI/UX design, graphic design, video editing, 3D animation, journalism, and creative production',
    keywords: ['ui designer', 'ux designer', 'product designer', 'graphic designer', 'animator', 'video editor', 'art director'],
  },
  healthcare_pharma: {
    id: 'healthcare_pharma',
    label: 'Healthcare & Pharmaceuticals',
    description: 'Medical care, clinical practice, nursing, pharmacology, and drug discovery',
    keywords: ['physician', 'doctor', 'nurse', 'pharmacist', 'surgeon', 'clinical specialist', 'medical officer'],
  },
  education_teaching: {
    id: 'education_teaching',
    label: 'Education & Teaching',
    description: 'School teaching, collegiate professorship, tutoring, instructional design, and educational leadership',
    keywords: ['teacher', 'professor', 'lecturer', 'tutor', 'principal', 'instructional designer', 'faculty'],
  },
  manufacturing_production: {
    id: 'manufacturing_production',
    label: 'Manufacturing & Production',
    description: 'Industrial manufacturing, plant operations, fabrication, CNC machining, and quality control',
    keywords: ['plant manager', 'production supervisor', 'cnc operator', 'machinist', 'industrial technician', 'quality inspector'],
  },
  logistics_supply_chain: {
    id: 'logistics_supply_chain',
    label: 'Logistics & Supply Chain',
    description: 'Supply chain logistics, warehousing, transportation, freight forwarding, and inventory distribution',
    keywords: ['supply chain manager', 'logistics coordinator', 'warehouse supervisor', 'forklift operator', 'fleet manager', 'dispatch'],
  },
  retail_ecommerce: {
    id: 'retail_ecommerce',
    label: 'Retail & E-commerce',
    description: 'Store operations, merchandising, e-commerce catalog operations, category management, and visual display',
    keywords: ['store manager', 'retail associate', 'e-commerce specialist', 'category manager', 'merchandiser'],
  },
  construction_real_estate: {
    id: 'construction_real_estate',
    label: 'Construction & Real Estate',
    description: 'Site civil construction, real estate brokerage, project management, surveying, and quantity estimation',
    keywords: ['construction manager', 'site engineer', 'real estate agent', 'property manager', 'quantity surveyor'],
  },
  customer_support_bpo: {
    id: 'customer_support_bpo',
    label: 'Customer Support & BPO',
    description: 'Customer experience, omnichannel contact centers, voice/chat helpdesks, and technical support',
    keywords: ['customer service representative', 'support agent', 'call center agent', 'bpo executive', 'helpdesk technician'],
  },
  skilled_trades_field: {
    id: 'skilled_trades_field',
    label: 'Skilled Trades & Field Services',
    description: 'Electricians, plumbers, HVAC technicians, welders, carpenters, mechanics, and field technicians',
    keywords: ['electrician', 'plumber', 'hvac technician', 'welder', 'carpenter', 'mechanic', 'field service engineer'],
  },
  agriculture_forestry: {
    id: 'agriculture_forestry',
    label: 'Agriculture, Dairy & Forestry',
    description: 'Agronomy, farm management, horticulture, dairy husbandry, and forestry conservation',
    keywords: ['agronomist', 'farm manager', 'horticulturist', 'veterinarian', 'dairy specialist', 'forester'],
  },
  energy_utilities: {
    id: 'energy_utilities',
    label: 'Energy, Oil & Utilities',
    description: 'Solar energy, wind power, oil & gas exploration, power plant operations, and municipal utilities',
    keywords: ['energy engineer', 'solar technician', 'petroleum engineer', 'utilities operator', 'power plant operator', 'wind turbine technician'],
  },
  automotive_aviation: {
    id: 'automotive_aviation',
    label: 'Automotive & Aviation',
    description: 'Automobile design, EV powertrain, aircraft maintenance, aviation operations, and avionics',
    keywords: ['automotive engineer', 'ev engineer', 'aircraft maintenance', 'pilot', 'flight dispatcher', 'avionics technician'],
  },
  security_facilities_defense: {
    id: 'security_facilities_defense',
    label: 'Security, Facilities & Defense',
    description: 'Physical security, surveillance, facility engineering, occupational health, and defense services',
    keywords: ['security guard', 'facility manager', 'safety officer', 'surveillance technician', 'building superintendent'],
  },
  social_services_ngo: {
    id: 'social_services_ngo',
    label: 'Social Services & NGOs',
    description: 'Non-profit management, community development, social work, humanitarian aid, and philanthropy',
    keywords: ['social worker', 'ngo coordinator', 'community organizer', 'fundraising officer', 'humanitarian worker'],
  },
};

const INDUSTRY_ALIASES: Record<string, JobIndustry> = {
  // Legacy Aliases
  'finance and banking': 'finance_accounting',
  'healthcare and medical': 'healthcare',
  'education and training': 'education',
  'technology and it': 'technology',
  'fintech payments': 'finance_accounting',
  'fintech trading': 'finance_accounting',
  'fintech spend management': 'finance_accounting',
  'crypto fintech': 'finance_accounting',
  'travel hospitality': 'hospitality_tourism',

  // Sector Canonical Synonyms
  'it software': 'it_software',
  'it and software development': 'it_software',
  'software development': 'it_software',
  'software': 'it_software',
  'ai and data science': 'ai_data_science',
  'ai data science': 'ai_data_science',
  'machine learning': 'ai_data_science',
  'data science': 'ai_data_science',
  'cybersecurity and cloud': 'cybersecurity_cloud',
  'cyber security': 'cybersecurity_cloud',
  'cloud computing': 'cybersecurity_cloud',
  'engineering core': 'engineering_core',
  'mechanical engineering': 'engineering_core',
  'civil engineering': 'engineering_core',
  'electrical engineering': 'engineering_core',
  'banking and financial services': 'banking_finance',
  'banking finance': 'banking_finance',
  'accounting audit and insurance': 'accounting_audit_insurance',
  'sales and business development': 'sales_bizdev',
  'sales bizdev': 'sales_bizdev',
  'marketing and digital marketing': 'marketing_digital',
  'digital marketing': 'marketing_digital',
  'human resources and recruitment': 'hr_recruitment',
  'hr recruitment': 'hr_recruitment',
  'legal and compliance': 'legal_compliance',
  'administration and operations': 'admin_operations',
  'consulting and management': 'consulting_management',
  'management consulting': 'consulting_management',
  'research and science': 'research_science',
  'media design and creative': 'media_design_creative',
  'design creative': 'media_design_creative',
  'healthcare and pharmaceuticals': 'healthcare_pharma',
  'pharma': 'healthcare_pharma',
  'education and teaching': 'education_teaching',
  'manufacturing and production': 'manufacturing_production',
  'logistics and supply chain': 'logistics_supply_chain',
  'retail and e commerce': 'retail_ecommerce',
  'retail ecommerce': 'retail_ecommerce',
  'hospitality tourism and restaurants': 'hospitality_tourism',
  'construction and real estate': 'construction_real_estate',
  'customer support and bpo': 'customer_support_bpo',
  'bpo': 'customer_support_bpo',
  'skilled trades and field services': 'skilled_trades_field',
  'skilled trades': 'skilled_trades_field',
  'agriculture dairy and forestry': 'agriculture_forestry',
  'energy oil and utilities': 'energy_utilities',
  'clean energy': 'energy_utilities',
  'automotive and aviation': 'automotive_aviation',
  'automotive': 'automotive_aviation',
  'security facilities and defense': 'security_facilities_defense',
  'government and public administration': 'government_public',
  'social services and ngos': 'social_services_ngo',
  'non profit': 'social_services_ngo',
};

function normalizeIndustryText(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function normalizeIndustryId(value?: string): JobIndustry | null {
  if (!value?.trim()) return null;

  const normalized = normalizeIndustryText(value);
  for (const [id, definition] of Object.entries(INDUSTRY_TAXONOMY) as [JobIndustry, IndustryDefinition][]) {
    if (normalized === normalizeIndustryText(id) || normalized === normalizeIndustryText(definition.label)) {
      return id;
    }
  }

  return INDUSTRY_ALIASES[normalized] || null;
}

export function normalizeIndustryFilter(value?: string): JobIndustry | '' | null {
  if (!value?.trim() || normalizeIndustryText(value) === 'all' || normalizeIndustryText(value) === 'all industries') {
    return '';
  }
  return normalizeIndustryId(value);
}

export function resolveJobIndustry(
  industry: string | undefined,
  category: string | undefined,
  title: string,
  tags: string[] = [],
  description?: string
): JobIndustry {
  const explicitIndustry = normalizeIndustryId(industry);
  if (explicitIndustry && explicitIndustry !== 'other') return explicitIndustry;

  const explicitCategory = normalizeIndustryId(category);
  if (explicitCategory && explicitCategory !== 'other') return explicitCategory;

  return classifyJobIndustry(title, tags, description).industry;
}

/**
 * Compiled regex map for high-performance deterministic industry classification.
 */
interface TaxonomyRule {
  industry: JobIndustry;
  titleRegex?: RegExp;
  tagRegex: RegExp;
}

const TAXONOMY_RULES: TaxonomyRule[] = [
  {
    industry: 'healthcare',
    titleRegex: /\b(doctor|physician|nurse|nursing|clinical|hospital|medical|surgeon|pharmacist|pharmacy|therapist|paramedic|dentist|radiologist|pathologist|pediatrician|epidemiologist|biomedical|caregiver|phlebotomist|optometrist|dietitian|cardiologist|oncologist)\b/i,
    tagRegex: /\b(healthcare|medical|nursing|pharmacy|clinical|biotech)\b/i,
  },
  {
    industry: 'education',
    titleRegex: /\b(teacher|teaching|professor|lecturer|instructor|principal|headteacher|tutor|curriculum|dean|academic|kindergarten|faculty|pedagogy|educator|learning support|special education|teaching assistant|math teacher|science teacher|english teacher)\b/i,
    tagRegex: /\b(education|teaching|academic|school|university|higher ed)\b/i,
  },
  {
    industry: 'construction_trades',
    titleRegex: /\b(construction|civil engineer|site engineer|carpenter|electrician|plumber|welder|mason|hvac|heavy equipment|surveyor|pipefitter|scaffolder|structural engineer|building inspector)\b/i,
    tagRegex: /\b(construction|trades|electrical|plumbing|civil engineering)\b/i,
  },
  {
    industry: 'manufacturing',
    titleRegex: /\b(manufacturing|mechanical engineer|plant manager|production supervisor|cnc|assembly line|machinist|industrial engineer|fabrication|toolmaker|packaging technician|quality control|quality inspector|automotive)\b/i,
    tagRegex: /\b(manufacturing|industrial|production|machining)\b/i,
  },
  {
    industry: 'logistics_transport',
    titleRegex: /\b(supply chain|logistics|warehouse|forklift|freight|dispatcher|fleet|truck driver|delivery driver|courier|cargo|transportation|customs broker)\b/i,
    tagRegex: /\b(logistics|transportation|warehouse|supply chain|shipping)\b/i,
  },
  {
    industry: 'hospitality_tourism',
    titleRegex: /\b(chef|cook|hotel|front desk|bartender|barista|waiter|waitress|sommelier|concierge|housekeeper|event planner|tourism|travel agent|restaurant|catering)\b/i,
    tagRegex: /\b(hospitality|restaurant|hotel|culinary|tourism|travel)\b/i,
  },
  {
    industry: 'finance_accounting',
    titleRegex: /\b(accountant|accounting|auditor|financial|tax specialist|tax analyst|controller|bookkeeper|cfo|investment|actuary|underwriter|credit analyst|treasury|wealth management|chartered accountant)\b/i,
    tagRegex: /\b(finance|accounting|audit|banking|tax|investing)\b/i,
  },
  {
    industry: 'agriculture',
    titleRegex: /\b(agronomist|agriculture|farming|farm manager|horticulture|forestry|livestock|crop specialist|soil scientist|veterinarian|dairy manager|fishery|irrigation)\b/i,
    tagRegex: /\b(agriculture|farming|forestry|agronomy|horticulture)\b/i,
  },
  {
    industry: 'government_public',
    titleRegex: /\b(civil service|government|public administration|humanitarian|disaster relief|municipal|foreign affairs|defense officer|court clerk|urban planner|social worker)\b/i,
    tagRegex: /\b(government|public sector|humanitarian|civil service|un|ocha)\b/i,
  },
  {
    industry: 'retail_sales',
    titleRegex: /\b(retail|sales executive|sales representative|store manager|cashier|merchandiser|account executive|business development|b2b sales|b2c sales|visual merchandiser|sales associate)\b/i,
    tagRegex: /\b(sales|retail|store|merchandising|business development)\b/i,
  },
  {
    industry: 'customer_service',
    titleRegex: /\b(customer support|customer service|call center|helpdesk|client success|support agent|customer care|contact center|support specialist)\b/i,
    tagRegex: /\b(customer support|customer service|call center|helpdesk|client success)\b/i,
  },
  {
    industry: 'administration_hr',
    titleRegex: /\b(human resources|hr manager|talent acquisition|recruiter|recruiting|office manager|operations manager|office coordinator|office operations|executive assistant|administrative|receptionist|people partner|clerk|payroll)\b/i,
    tagRegex: /\b(human resources|hr|recruiting|administration|office)\b/i,
  },
  {
    industry: 'security_facilities',
    titleRegex: /\b(security guard|security officer|facility|facilities|maintenance manager|building maintenance|safety officer|janitor|custodian|surveillance operator|fire safety)\b/i,
    tagRegex: /\b(security|facilities|safety|maintenance|guard)\b/i,
  },
  {
    industry: 'technology',
    tagRegex: /\b(technology|technology industry|information technology|tech industry)\b/i,
  },
];

/**
 * Classify a job into a canonical industry sector.
 *
 * Invariant: Never defaults to 'technology'. If insufficient evidence, strictly falls back to 'other'.
 */
export function classifyJobIndustry(
  rawTitle: string,
  rawTags: string[] = [],
  rawDescription?: string,
  sourceMetadata?: Record<string, unknown>
): { industry: JobIndustry; category: string } {
  const title = (rawTitle || '').trim();
  const tagsStr = (rawTags || []).join(' ').trim();
  const desc = (rawDescription || '').slice(0, 500);

  // 1. Explicit source metadata priority
  if (sourceMetadata?.industry && typeof sourceMetadata.industry === 'string') {
    const metaInd = normalizeIndustryId(sourceMetadata.industry);
    if (metaInd) {
      return {
        industry: metaInd,
        category: INDUSTRY_TAXONOMY[metaInd].label,
      };
    }
  }

  // 2. Classify distinctive sector-specific occupations; generic software roles are cross-industry.
  for (const rule of TAXONOMY_RULES) {
    if (rule.titleRegex?.test(title)) {
      return {
        industry: rule.industry,
        category: INDUSTRY_TAXONOMY[rule.industry].label,
      };
    }
  }

  // 3. Prefer sector evidence in the description or tags for cross-industry occupations.
  if (desc) {
    for (const rule of TAXONOMY_RULES) {
      if (rule.industry !== 'technology' && rule.tagRegex.test(desc)) {
        return {
          industry: rule.industry,
          category: INDUSTRY_TAXONOMY[rule.industry].label,
        };
      }
    }
  }

  // 4. Technology requires an explicit industry tag, not merely a software skill or job title.
  if (tagsStr) {
    for (const rule of TAXONOMY_RULES) {
      if (rule.tagRegex.test(tagsStr)) {
        return {
          industry: rule.industry,
          category: INDUSTRY_TAXONOMY[rule.industry].label,
        };
      }
    }
  }

  // 5. Strict fallback: Never default to technology
  return {
    industry: 'other',
    category: INDUSTRY_TAXONOMY.other.label,
  };
}

/**
 * Returns formatted label for an industry identifier.
 */
export function getIndustryLabel(industry?: string): string {
  if (!industry || industry === 'all') return 'All Industries';
  const canonical = normalizeIndustryId(industry);
  return canonical ? INDUSTRY_TAXONOMY[canonical].label : industry;
}
