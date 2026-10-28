export type JobIndustry =
  | 'technology'
  | 'healthcare'
  | 'construction_trades'
  | 'manufacturing'
  | 'logistics_transport'
  | 'retail_sales'
  | 'hospitality_tourism'
  | 'education'
  | 'finance_accounting'
  | 'administration_hr'
  | 'agriculture'
  | 'government_public'
  | 'customer_service'
  | 'security_facilities'
  | 'other';

export interface IndustryDefinition {
  id: JobIndustry;
  label: string;
  description: string;
  keywords: string[];
}

export const INDUSTRY_TAXONOMY: Record<JobIndustry, IndustryDefinition> = {
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
};

/**
 * Compiled regex map for high-performance deterministic industry classification.
 */
interface TaxonomyRule {
  industry: JobIndustry;
  titleRegex: RegExp;
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
    titleRegex: /\b(software|developer|frontend|backend|fullstack|devops|cloud|data engineer|data scientist|machine learning|artificial intelligence|cybersecurity|infosec|qa|automation engineer|sre|sysadmin|systems engineer|programmer|coder|react|node|python|golang|rust|ios engineer|android engineer|web developer)\b/i,
    tagRegex: /\b(technology|software|engineering|devops|data science|programming|web development)\b/i,
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
    const metaInd = sourceMetadata.industry.toLowerCase().trim() as JobIndustry;
    if (INDUSTRY_TAXONOMY[metaInd]) {
      return {
        industry: metaInd,
        category: (sourceMetadata.category as string) || INDUSTRY_TAXONOMY[metaInd].label,
      };
    }
  }

  // 2. High-priority title regex matching (Title is most explicit indicator)
  for (const rule of TAXONOMY_RULES) {
    if (rule.titleRegex.test(title)) {
      return {
        industry: rule.industry,
        category: INDUSTRY_TAXONOMY[rule.industry].label,
      };
    }
  }

  // 3. Tags matching
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

  // 4. Description cues (first 500 chars) for strong sector indicators
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
  const found = INDUSTRY_TAXONOMY[industry as JobIndustry];
  return found ? found.label : industry;
}
