export interface JobPostOption {
  label: string;
  value: string;
}

export interface JobPostGroup {
  group: string;
  posts: JobPostOption[];
}

export const POPULAR_JOB_POSTS: string[] = [
  'Full Stack Developer',
  'Registered Nurse',
  'Accountant',
  'Teacher',
  'Frontend Engineer (React / Next.js)',
  'Financial Analyst',
  'Civil Engineer',
  'Human Resources Manager',
  'Backend Engineer (Node.js / Python / Go)',
  'Customer Support Representative',
  'Marketing Specialist',
  'AI / Machine Learning Engineer',
  'Project Manager',
  'Sales Representative',
  'Pharmacist',
  'Data Analyst',
  'Chef',
  'Logistics Coordinator',
  'Electrician',
  'Legal Counsel',
  'Retail Store Manager',
  'DevOps & Cloud Engineer (AWS / GCP)',
  'Data Scientist & ML Specialist',
  'Mobile Developer (React Native / Flutter)',
  'UI/UX Product Designer',
  'Product Manager',
  'Site Reliability Engineer (SRE)',
  'Data Engineer',
  'QA Automation Engineer',
  'Cybersecurity Analyst',
  'Solutions Architect',
  'Engineering Manager',
];

export interface WorkplaceCategory {
  id: string;
  label: string;
  icon: string;
  description: string;
  remoteParam: string;
}

export const WORKPLACE_CATEGORIES: WorkplaceCategory[] = [
  { id: 'all', label: 'All Jobs', icon: '🌐', description: 'All locations and workplace models', remoteParam: '' },
  { id: 'remote', label: 'Remote', icon: '🏠', description: '100% remote positions globally', remoteParam: 'remote' },
  { id: 'hybrid', label: 'Hybrid', icon: '🔄', description: 'Flexible hybrid office and remote balance', remoteParam: 'hybrid' },
  { id: 'onsite', label: 'On-site', icon: '🏢', description: 'Physical office locations', remoteParam: 'onsite' },
];

export const JOB_POST_GROUPS: JobPostGroup[] = [
  {
    group: '🏠 Fully Remote & Distributed Roles',
    posts: [
      { label: 'All Remote Roles (Worldwide & India)', value: 'Remote' },
      { label: 'Remote Software Engineer', value: 'Remote Software Engineer' },
      { label: 'Remote Full Stack Developer', value: 'Remote Full Stack Developer' },
      { label: 'Remote Frontend Developer (React/Next.js)', value: 'Remote Frontend Developer' },
      { label: 'Remote Backend Engineer (Python/Node/Go)', value: 'Remote Backend Engineer' },
      { label: 'Remote AI / Machine Learning Specialist', value: 'Remote AI Engineer' },
      { label: 'Remote DevOps & Cloud Architect', value: 'Remote DevOps Engineer' },
      { label: 'Remote Product Designer (UI/UX)', value: 'Remote Product Designer' },
      { label: 'Remote Product Manager', value: 'Remote Product Manager' },
      { label: 'Remote QA / SDET Automation Engineer', value: 'Remote QA Engineer' },
      { label: 'Remote Data Scientist & Analyst', value: 'Remote Data Scientist' },
      { label: 'Remote Site Reliability Engineer (SRE)', value: 'Remote SRE' },
      { label: 'Remote Technical Writer & DevRel', value: 'Remote Technical Writer' },
      { label: 'Remote Customer Success & Support', value: 'Remote Customer Support' },
      { label: 'Remote Registered Nurse', value: 'Remote Registered Nurse' },
      { label: 'Remote Teacher / Online Instructor', value: 'Remote Teacher' },
      { label: 'Remote Accountant / Bookkeeper', value: 'Remote Accountant' },
      { label: 'Remote Recruiter / HR Specialist', value: 'Remote Recruiter' },
      { label: 'Remote Marketing Specialist', value: 'Remote Marketing Specialist' },
      { label: 'Remote Customer Support Representative', value: 'Remote Customer Support Representative' },
    ],
  },
  {
    group: '⚡ Full Stack Engineering',
    posts: [
      { label: 'Full Stack Developer', value: 'Full Stack Developer' },
      { label: 'Senior Full Stack Engineer', value: 'Senior Full Stack Engineer' },
      { label: 'MERN Stack Developer (MongoDB/Express/React/Node)', value: 'MERN Stack Developer' },
      { label: 'PERN Stack Developer (Postgres/Express/React/Node)', value: 'PERN Stack Developer' },
      { label: 'React + Node.js Developer', value: 'React Node Developer' },
      { label: 'Python + React Full Stack Engineer', value: 'Python React Full Stack' },
      { label: 'Java Full Stack Developer', value: 'Java Full Stack Developer' },
      { label: 'TypeScript Full Stack Engineer', value: 'TypeScript Full Stack' },
      { label: 'Web3 / Blockchain Full Stack Developer', value: 'Web3 Full Stack Developer' },
    ],
  },
  {
    group: '🌐 Frontend & Web Development',
    posts: [
      { label: 'Frontend Developer', value: 'Frontend Developer' },
      { label: 'Senior Frontend Engineer', value: 'Senior Frontend Engineer' },
      { label: 'React.js Developer', value: 'React Developer' },
      { label: 'Next.js Fullstack / Frontend Developer', value: 'Next.js Developer' },
      { label: 'Vue.js / Nuxt Developer', value: 'Vue Developer' },
      { label: 'Angular Developer', value: 'Angular Developer' },
      { label: 'UI / Design Systems Engineer', value: 'Design Systems Engineer' },
      { label: 'Web Accessibility (a11y) Specialist', value: 'Web Accessibility' },
      { label: 'JavaScript / TypeScript Developer', value: 'TypeScript Developer' },
      { label: 'HTML/CSS / Webflow Developer', value: 'Webflow Developer' },
    ],
  },
  {
    group: '⚙️ Backend & Systems Engineering',
    posts: [
      { label: 'Backend Engineer', value: 'Backend Engineer' },
      { label: 'Senior Backend Developer', value: 'Senior Backend Developer' },
      { label: 'Node.js Developer', value: 'Node.js Developer' },
      { label: 'Python / Django / FastAPI Developer', value: 'Python Developer' },
      { label: 'Java / Spring Boot Microservices Engineer', value: 'Java Spring Boot' },
      { label: 'Go / Golang Backend Specialist', value: 'Golang Engineer' },
      { label: 'Rust Systems Engineer', value: 'Rust Engineer' },
      { label: 'C++ Systems & Performance Engineer', value: 'C++ Engineer' },
      { label: 'C# / .NET Developer', value: '.NET Developer' },
      { label: 'PHP / Laravel Developer', value: 'Laravel Developer' },
      { label: 'Ruby on Rails Developer', value: 'Ruby on Rails' },
      { label: 'Microservices & Distributed Systems Architect', value: 'Distributed Systems' },
      { label: 'API & Platform Engineer', value: 'Platform Engineer' },
    ],
  },
  {
    group: '🤖 Artificial Intelligence, ML & Data Science',
    posts: [
      { label: 'AI / Machine Learning Engineer', value: 'AI Machine Learning' },
      { label: 'Generative AI Specialist', value: 'Generative AI' },
      { label: 'LLM Application Developer', value: 'LLM Developer' },
      { label: 'AI Prompt & Systems Engineer', value: 'Prompt Engineer' },
      { label: 'Deep Learning Research Scientist', value: 'Deep Learning' },
      { label: 'Computer Vision Engineer', value: 'Computer Vision' },
      { label: 'NLP (Natural Language Processing) Engineer', value: 'NLP Engineer' },
      { label: 'MLOps (Machine Learning Operations) Engineer', value: 'MLOps Engineer' },
      { label: 'Data Scientist', value: 'Data Scientist' },
      { label: 'Senior Data Scientist', value: 'Senior Data Scientist' },
      { label: 'Data Engineer (Spark / Airflow / dbt)', value: 'Data Engineer' },
      { label: 'Big Data Architect', value: 'Big Data Architect' },
      { label: 'Analytics Engineer (dbt / SQL)', value: 'Analytics Engineer' },
      { label: 'Business Intelligence (BI) Analyst', value: 'BI Analyst' },
    ],
  },
  {
    group: '☁️ Cloud, DevOps & Site Reliability',
    posts: [
      { label: 'DevOps Engineer', value: 'DevOps Engineer' },
      { label: 'Senior DevOps Architect', value: 'Senior DevOps' },
      { label: 'Site Reliability Engineer (SRE)', value: 'SRE' },
      { label: 'Cloud Solutions Architect (AWS)', value: 'AWS Cloud Architect' },
      { label: 'Cloud Solutions Architect (GCP)', value: 'GCP Cloud Architect' },
      { label: 'Cloud Solutions Architect (Azure)', value: 'Azure Cloud Architect' },
      { label: 'Kubernetes & Container Infrastructure Specialist', value: 'Kubernetes Specialist' },
      { label: 'Build & Release / CI/CD Engineer', value: 'CI/CD Engineer' },
      { label: 'Platform & Infrastructure Engineer', value: 'Platform Engineer' },
      { label: 'Database Administrator (DBA - PostgreSQL/MySQL)', value: 'Database Administrator' },
      { label: 'Linux Systems Administrator', value: 'Linux Administrator' },
    ],
  },
  {
    group: '📱 Mobile Application Development',
    posts: [
      { label: 'Mobile App Developer', value: 'Mobile Developer' },
      { label: 'React Native Developer', value: 'React Native' },
      { label: 'Flutter App Developer', value: 'Flutter Developer' },
      { label: 'iOS Engineer (Swift / SwiftUI)', value: 'iOS Developer' },
      { label: 'Android Engineer (Kotlin / Jetpack)', value: 'Android Developer' },
      { label: 'Cross-Platform Mobile Lead', value: 'Mobile Lead' },
    ],
  },
  {
    group: '🎨 Product, Design & UX',
    posts: [
      { label: 'Product Designer', value: 'Product Designer' },
      { label: 'UI/UX Designer', value: 'UI/UX Designer' },
      { label: 'Lead Product Designer', value: 'Lead Product Designer' },
      { label: 'UX Researcher', value: 'UX Researcher' },
      { label: 'Design Systems Lead', value: 'Design Systems Lead' },
      { label: 'Interaction & Visual Designer', value: 'Visual Designer' },
      { label: 'Product Manager', value: 'Product Manager' },
      { label: 'Technical Product Manager (TPM)', value: 'Technical Product Manager' },
      { label: 'Associate Product Manager (APM)', value: 'Associate Product Manager' },
      { label: 'Group Product Manager / VP Product', value: 'VP Product' },
    ],
  },
  {
    group: '🧪 Quality Assurance & Testing',
    posts: [
      { label: 'QA Automation Engineer', value: 'QA Automation' },
      { label: 'SDET (Software Development Engineer in Test)', value: 'SDET' },
      { label: 'Manual QA Tester', value: 'QA Tester' },
      { label: 'Performance & Load Testing Engineer', value: 'Performance Testing' },
      { label: 'QA Lead / Test Manager', value: 'QA Lead' },
    ],
  },
  {
    group: '🔒 Cybersecurity & Security Operations',
    posts: [
      { label: 'Cybersecurity Analyst', value: 'Cybersecurity Analyst' },
      { label: 'Application Security Engineer (AppSec)', value: 'Application Security' },
      { label: 'Cloud Security Engineer', value: 'Cloud Security' },
      { label: 'Penetration Tester / Ethical Hacker', value: 'Penetration Tester' },
      { label: 'Information Security Specialist (InfoSec)', value: 'Information Security' },
      { label: 'SOC (Security Operations Center) Analyst', value: 'SOC Analyst' },
      { label: 'DevSecOps Engineer', value: 'DevSecOps' },
    ],
  },
  {
    group: '👑 Leadership, Architecture & Management',
    posts: [
      { label: 'Engineering Manager', value: 'Engineering Manager' },
      { label: 'Technical Lead (Tech Lead)', value: 'Tech Lead' },
      { label: 'Director of Engineering', value: 'Director of Engineering' },
      { label: 'VP of Engineering', value: 'VP Engineering' },
      { label: 'Chief Technology Officer (CTO)', value: 'CTO' },
      { label: 'Solutions Architect', value: 'Solutions Architect' },
      { label: 'Enterprise Enterprise Architect', value: 'Enterprise Architect' },
      { label: 'Scrum Master / Agile Project Manager', value: 'Scrum Master' },
      { label: 'Technical Program Manager (TPM)', value: 'Technical Program Manager' },
    ],
  },
  {
    group: '🚀 Blockchain, Web3 & Emerging Tech',
    posts: [
      { label: 'Blockchain Developer / Engineer', value: 'Blockchain Developer' },
      { label: 'Smart Contract Developer (Solidity)', value: 'Solidity Developer' },
      { label: 'Rust / Solana Core Engineer', value: 'Solana Developer' },
      { label: 'IoT & Embedded Systems Engineer', value: 'Embedded Systems' },
      { label: 'Firmware Engineer', value: 'Firmware Engineer' },
      { label: 'AR / VR / Unity Game Developer', value: 'AR VR Developer' },
    ],
  },
  {
    group: '📣 Developer Relations & Operations',
    posts: [
      { label: 'Developer Relations (DevRel) / Advocate', value: 'Developer Relations' },
      { label: 'Technical Writer / Documentation Lead', value: 'Technical Writer' },
      { label: 'Customer Success Engineer', value: 'Customer Success Engineer' },
      { label: 'Solutions Engineer (Pre-Sales)', value: 'Solutions Engineer' },
      { label: 'Growth Engineer / Growth Marketer', value: 'Growth Engineer' },
    ],
  },
  {
    group: '🏥 Healthcare, Medical & Clinical',
    posts: [
      { label: 'Physician / Resident Doctor', value: 'Doctor' },
      { label: 'Registered Nurse (Staff Nurse / ICU)', value: 'Nurse' },
      { label: 'Pharmacist / Clinical Pharmacist', value: 'Pharmacist' },
      { label: 'Medical Lab Technician', value: 'Lab Technician' },
      { label: 'Radiologist / Medical Imaging', value: 'Radiologist' },
      { label: 'Clinical Research Associate (CRA)', value: 'Clinical Research' },
      { label: 'Healthcare Administrator / Hospital Ops', value: 'Healthcare Operations' },
    ],
  },
  {
    group: '📚 Education, Teaching & Academics',
    posts: [
      { label: 'School Teacher (Primary / Secondary)', value: 'Teacher' },
      { label: 'College Faculty / Assistant Professor', value: 'Professor' },
      { label: 'Online Instructor / EdTech Educator', value: 'Instructor' },
      { label: 'Curriculum Developer / Instructional Designer', value: 'Instructional Designer' },
      { label: 'Academic Counselor & Advisor', value: 'Academic Counselor' },
      { label: 'Corporate Trainer & Coach', value: 'Corporate Trainer' },
    ],
  },
  {
    group: '💰 Finance, Banking & Accounting',
    posts: [
      { label: 'Chartered Accountant (CA)', value: 'Chartered Accountant' },
      { label: 'Financial Analyst / Equity Research', value: 'Financial Analyst' },
      { label: 'Accountant / Senior Accountant', value: 'Accountant' },
      { label: 'Statutory & Tax Auditor', value: 'Auditor' },
      { label: 'Investment Banker / Wealth Manager', value: 'Investment Banking' },
      { label: 'Credit Risk Analyst / Underwriter', value: 'Credit Analyst' },
      { label: 'Payroll & Compliance Specialist', value: 'Payroll Specialist' },
    ],
  },
  {
    group: '🏗️ Construction, Architecture & Civil',
    posts: [
      { label: 'Civil Site Engineer', value: 'Civil Engineer' },
      { label: 'Structural Design Engineer', value: 'Structural Engineer' },
      { label: 'Architect / Architectural Designer', value: 'Architect' },
      { label: 'Project Construction Manager', value: 'Construction Manager' },
      { label: 'AutoCAD / BIM Modeler', value: 'BIM Modeler' },
      { label: 'Quantity Surveyor & Cost Estimator', value: 'Quantity Surveyor' },
    ],
  },
  {
    group: '🏭 Manufacturing, Industrial & Mechanical',
    posts: [
      { label: 'Mechanical Design Engineer', value: 'Mechanical Engineer' },
      { label: 'Production / Plant Engineer', value: 'Production Engineer' },
      { label: 'Quality Control (QC / QA) Engineer', value: 'Quality Control Engineer' },
      { label: 'Electrical Maintenance Engineer', value: 'Electrical Engineer' },
      { label: 'Industrial Automation & PLC Programmer', value: 'Automation Engineer' },
      { label: 'EHS (Environment, Health & Safety) Officer', value: 'EHS Officer' },
    ],
  },
  {
    group: '📦 Supply Chain, Logistics & Operations',
    posts: [
      { label: 'Supply Chain Manager', value: 'Supply Chain Manager' },
      { label: 'Warehouse & Inventory Supervisor', value: 'Warehouse Manager' },
      { label: 'Procurement & Sourcing Specialist', value: 'Procurement Specialist' },
      { label: 'Logistics & Dispatch Coordinator', value: 'Logistics Coordinator' },
      { label: 'Import / Export Compliance Executive', value: 'Export Import' },
    ],
  },
  {
    group: '👥 Human Resources & Talent Acquisition',
    posts: [
      { label: 'Human Resources (HR) Manager', value: 'HR Manager' },
      { label: 'Talent Acquisition / Technical Recruiter', value: 'Recruiter' },
      { label: 'HR Generalist / Executive', value: 'HR Generalist' },
      { label: 'HR Business Partner (HRBP)', value: 'HRBP' },
      { label: 'Compensation & Benefits Specialist', value: 'Comp and Benefits' },
    ],
  },
  {
    group: '📈 Sales, Marketing & Business Development',
    posts: [
      { label: 'Business Development Executive (BDE)', value: 'Business Development' },
      { label: 'Enterprise Account Executive (AE)', value: 'Account Executive' },
      { label: 'Digital Marketing Specialist / SEO', value: 'Digital Marketing' },
      { label: 'Content Marketer & Copywriter', value: 'Content Marketer' },
      { label: 'Retail Store Manager / Sales Lead', value: 'Retail Sales' },
    ],
  },
  {
    group: '🎧 Customer Support, BPO & Client Success',
    posts: [
      { label: 'Customer Support Representative', value: 'Customer Support' },
      { label: 'Technical Helpdesk Specialist', value: 'Helpdesk Specialist' },
      { label: 'Customer Success Manager (CSM)', value: 'Customer Success Manager' },
      { label: 'Voice / International Process Associate', value: 'BPO Associate' },
    ],
  },
  {
    group: '⚖️ Legal, Compliance & Policy',
    posts: [
      { label: 'Corporate Lawyer / Legal Counsel', value: 'Legal Counsel' },
      { label: 'Litigation Advocate', value: 'Litigation Lawyer' },
      { label: 'Legal Associate / Paralegal', value: 'Legal Associate' },
      { label: 'Company Secretary', value: 'Company Secretary' },
      { label: 'Compliance Officer', value: 'Compliance Officer' },
      { label: 'Contract Manager', value: 'Contract Manager' },
      { label: 'Intellectual Property Specialist', value: 'Intellectual Property Specialist' },
    ],
  },
  {
    group: '🏨 Hospitality, Tourism & Food Services',
    posts: [
      { label: 'Executive Chef / Head Chef', value: 'Chef' },
      { label: 'Hotel General Manager', value: 'Hotel Manager' },
      { label: 'Front Office / Guest Relations Manager', value: 'Guest Relations Manager' },
      { label: 'Restaurant Manager', value: 'Restaurant Manager' },
      { label: 'Event Planner / Event Manager', value: 'Event Manager' },
      { label: 'Travel Consultant / Tour Coordinator', value: 'Travel Consultant' },
      { label: 'Housekeeping Supervisor', value: 'Housekeeping Supervisor' },
    ],
  },
  {
    group: '🛍️ Retail, E-commerce & Merchandising',
    posts: [
      { label: 'Retail Store Manager', value: 'Retail Store Manager' },
      { label: 'Retail Sales Associate', value: 'Retail Sales Associate' },
      { label: 'Visual Merchandiser', value: 'Visual Merchandiser' },
      { label: 'E-commerce Operations Manager', value: 'Ecommerce Operations Manager' },
      { label: 'Category Manager', value: 'Category Manager' },
      { label: 'Store Operations Supervisor', value: 'Store Operations Supervisor' },
    ],
  },
  {
    group: '🌿 Agriculture, Environment & Sustainability',
    posts: [
      { label: 'Agricultural / Agronomy Specialist', value: 'Agronomist' },
      { label: 'Farm Operations Manager', value: 'Farm Manager' },
      { label: 'Veterinarian / Veterinary Doctor', value: 'Veterinarian' },
      { label: 'Environmental Scientist', value: 'Environmental Scientist' },
      { label: 'Sustainability / ESG Specialist', value: 'Sustainability Specialist' },
      { label: 'Food Quality & Safety Inspector', value: 'Food Safety Inspector' },
      { label: 'Forestry / Wildlife Officer', value: 'Wildlife Officer' },
    ],
  },
  {
    group: '🏛️ Government, Public Service & Nonprofit',
    posts: [
      { label: 'Civil Services / Public Administration Officer', value: 'Public Administration Officer' },
      { label: 'Policy Analyst', value: 'Policy Analyst' },
      { label: 'Government Program Manager', value: 'Government Program Manager' },
      { label: 'Municipal / Urban Planning Officer', value: 'Urban Planner' },
      { label: 'Nonprofit Program Coordinator', value: 'Nonprofit Program Coordinator' },
      { label: 'Grant Writer / Fundraising Manager', value: 'Fundraising Manager' },
    ],
  },
  {
    group: '🚘 Transportation, Aviation & Automotive',
    posts: [
      { label: 'Professional Driver / Chauffeur', value: 'Professional Driver' },
      { label: 'Fleet Manager', value: 'Fleet Manager' },
      { label: 'Automotive Technician / Mechanic', value: 'Automotive Mechanic' },
      { label: 'Aircraft Maintenance Technician', value: 'Aircraft Maintenance Technician' },
      { label: 'Pilot / Flight Operations Officer', value: 'Pilot' },
      { label: 'Transport / Dispatch Coordinator', value: 'Transport Coordinator' },
    ],
  },
  {
    group: '🎬 Media, Communications & Creative Arts',
    posts: [
      { label: 'Content Writer / Copywriter', value: 'Content Writer' },
      { label: 'Journalist / News Reporter', value: 'Journalist' },
      { label: 'Public Relations (PR) Specialist', value: 'Public Relations Specialist' },
      { label: 'Graphic Designer / Illustrator', value: 'Graphic Designer' },
      { label: 'Video Editor / Motion Graphics Artist', value: 'Video Editor' },
      { label: 'Photographer / Visual Producer', value: 'Photographer' },
      { label: 'Social Media Manager', value: 'Social Media Manager' },
    ],
  },
  {
    group: '🔬 Science, Research & Laboratory',
    posts: [
      { label: 'Research Scientist', value: 'Research Scientist' },
      { label: 'Laboratory Technician', value: 'Laboratory Technician' },
      { label: 'Chemist / Analytical Chemist', value: 'Chemist' },
      { label: 'Biologist / Microbiologist', value: 'Biologist' },
      { label: 'Clinical Research Coordinator', value: 'Clinical Research Coordinator' },
      { label: 'Quality Assurance Lab Analyst', value: 'Laboratory Quality Analyst' },
    ],
  },
  {
    group: '🛡️ Security, Facilities & Workplace Safety',
    posts: [
      { label: 'Security Guard / Security Officer', value: 'Security Officer' },
      { label: 'Security Operations Manager', value: 'Security Operations Manager' },
      { label: 'Facilities Manager', value: 'Facilities Manager' },
      { label: 'Health & Safety Officer', value: 'Health and Safety Officer' },
      { label: 'Fire Safety / Emergency Response Officer', value: 'Fire Safety Officer' },
      { label: 'Building / Property Manager', value: 'Property Manager' },
    ],
  },
  {
    group: '🤝 Social Services & Community Care',
    posts: [
      { label: 'Social Worker / Case Manager', value: 'Social Worker' },
      { label: 'Mental Health Counselor / Therapist', value: 'Mental Health Counselor' },
      { label: 'Community Outreach Coordinator', value: 'Community Outreach Coordinator' },
      { label: 'Disability Support Specialist', value: 'Disability Support Specialist' },
      { label: 'Childcare / Early Years Educator', value: 'Childcare Educator' },
      { label: 'Caregiver / Home Health Aide', value: 'Caregiver' },
    ],
  },
  {
    group: '🛡️ Insurance, Banking Operations & Risk',
    posts: [
      { label: 'Insurance Claims Adjuster', value: 'Insurance Claims Adjuster' },
      { label: 'Insurance Underwriter', value: 'Insurance Underwriter' },
      { label: 'Actuary / Actuarial Analyst', value: 'Actuary' },
      { label: 'Loan Officer / Mortgage Advisor', value: 'Loan Officer' },
      { label: 'Bank Branch Manager', value: 'Bank Branch Manager' },
      { label: 'Fraud / Risk Investigator', value: 'Fraud Investigator' },
    ],
  },
];

// Flat list of all job post categories for single dropdown consumption
export const JOB_POST_CATEGORIES: JobPostOption[] = [
  { label: 'All Roles (All Categories)', value: '' },
  ...JOB_POST_GROUPS.flatMap((g) => g.posts),
];

export type LocationTier = 'tier1' | 'tier2' | 'global' | 'remote';

export interface PopularLocationItem {
  label: string;
  tier: LocationTier;
  badge: string;
  aliases: string[];
}

export interface PopularLocationGroup {
  group: string;
  badge: string;
  locations: PopularLocationItem[];
}

export const POPULAR_LOCATION_GROUPS: PopularLocationGroup[] = [
  {
    group: '⚡ Tier 1 Metros & Tech Hubs',
    badge: 'Tier 1',
    locations: [
      { label: 'Bengaluru, Karnataka', tier: 'tier1', badge: 'Tier 1', aliases: ['bangalore', 'bengaluru', 'karnataka', 'blr'] },
      { label: 'Delhi NCR / Gurgaon / Noida', tier: 'tier1', badge: 'Tier 1', aliases: ['delhi', 'new delhi', 'ncr', 'gurgaon', 'gurugram', 'noida', 'greater noida', 'faridabad', 'ghaziabad'] },
      { label: 'Hyderabad, Telangana', tier: 'tier1', badge: 'Tier 1', aliases: ['hyderabad', 'secunderabad', 'telangana', 'cyberabad', 'hyd'] },
      { label: 'Mumbai, Maharashtra', tier: 'tier1', badge: 'Tier 1', aliases: ['mumbai', 'bombay', 'navi mumbai', 'thane', 'maharashtra'] },
      { label: 'Pune, Maharashtra', tier: 'tier1', badge: 'Tier 1', aliases: ['pune', 'poona', 'hinjewadi', 'magarpatta', 'maharashtra'] },
      { label: 'Chennai, Tamil Nadu', tier: 'tier1', badge: 'Tier 1', aliases: ['chennai', 'madras', 'tamil nadu', 'omr'] },
      { label: 'Kolkata, West Bengal', tier: 'tier1', badge: 'Tier 1', aliases: ['kolkata', 'calcutta', 'salt lake', 'new town', 'west bengal'] },
      { label: 'Ahmedabad, Gujarat', tier: 'tier1', badge: 'Tier 1', aliases: ['ahmedabad', 'amdavad', 'gandhinagar', 'gift city', 'gujarat'] },
    ],
  },
  {
    group: '🚀 Tier 2 Emerging Tech Hubs',
    badge: 'Tier 2',
    locations: [
      { label: 'Chandigarh / Mohali', tier: 'tier2', badge: 'Tier 2', aliases: ['chandigarh', 'mohali', 'panchkula', 'tricity', 'punjab', 'haryana'] },
      { label: 'Kochi (Cochin), Kerala', tier: 'tier2', badge: 'Tier 2', aliases: ['kochi', 'cochin', 'infopark', 'kakkanad', 'kerala'] },
      { label: 'Indore, Madhya Pradesh', tier: 'tier2', badge: 'Tier 2', aliases: ['indore', 'crystal it park', 'super corridor', 'madhya pradesh', 'mp'] },
      { label: 'Jaipur, Rajasthan', tier: 'tier2', badge: 'Tier 2', aliases: ['jaipur', 'pink city', 'sitapura', 'rajasthan'] },
      { label: 'Coimbatore, Tamil Nadu', tier: 'tier2', badge: 'Tier 2', aliases: ['coimbatore', 'kovai', 'saravanampatti', 'tamil nadu'] },
      { label: 'Thiruvananthapuram (Trivandrum), Kerala', tier: 'tier2', badge: 'Tier 2', aliases: ['thiruvananthapuram', 'trivandrum', 'technopark', 'kerala'] },
      { label: 'Bhubaneswar, Odisha', tier: 'tier2', badge: 'Tier 2', aliases: ['bhubaneswar', 'bhubaneshwar', 'infocity', 'odisha', 'orissa'] },
      { label: 'Visakhapatnam (Vizag), Andhra Pradesh', tier: 'tier2', badge: 'Tier 2', aliases: ['visakhapatnam', 'vizag', 'rushikonda', 'andhra pradesh'] },
      { label: 'Nagpur, Maharashtra', tier: 'tier2', badge: 'Tier 2', aliases: ['nagpur', 'mihan', 'butibori', 'maharashtra'] },
      { label: 'Lucknow, Uttar Pradesh', tier: 'tier2', badge: 'Tier 2', aliases: ['lucknow', 'uttar pradesh', 'up'] },
      { label: 'Vadodara (Baroda), Gujarat', tier: 'tier2', badge: 'Tier 2', aliases: ['vadodara', 'baroda', 'alkapuri', 'gujarat'] },
      { label: 'Surat, Gujarat', tier: 'tier2', badge: 'Tier 2', aliases: ['surat', 'gujarat'] },
      { label: 'Bhopal, Madhya Pradesh', tier: 'tier2', badge: 'Tier 2', aliases: ['bhopal', 'madhya pradesh', 'mp'] },
      { label: 'Patna, Bihar', tier: 'tier2', badge: 'Tier 2', aliases: ['patna', 'bihar'] },
      { label: 'Mysuru (Mysore), Karnataka', tier: 'tier2', badge: 'Tier 2', aliases: ['mysuru', 'mysore', 'hebbal', 'karnataka'] },
      { label: 'Mangaluru (Mangalore), Karnataka', tier: 'tier2', badge: 'Tier 2', aliases: ['mangaluru', 'mangalore', 'derebail', 'karnataka'] },
      { label: 'Dehradun, Uttarakhand', tier: 'tier2', badge: 'Tier 2', aliases: ['dehradun', 'uttarakhand'] },
      { label: 'Nashik, Maharashtra', tier: 'tier2', badge: 'Tier 2', aliases: ['nashik', 'nasik', 'ambad', 'maharashtra'] },
    ],
  },
  {
    group: '🌐 Global & Distributed Hubs',
    badge: 'Global / Remote',
    locations: [
      { label: 'Remote (Worldwide)', tier: 'remote', badge: 'Remote', aliases: ['remote', 'worldwide', 'anywhere', 'work from home', 'wfh'] },
      { label: 'India', tier: 'global', badge: 'India', aliases: ['india', 'bharat', 'pan india', 'any city'] },
      { label: 'United States', tier: 'global', badge: 'US', aliases: ['united states', 'usa', 'us', 'san francisco', 'new york', 'seattle', 'austin'] },
      { label: 'Europe', tier: 'global', badge: 'EU', aliases: ['europe', 'eu', 'london', 'berlin', 'amsterdam', 'dublin', 'paris'] },
    ],
  },
];

export const POPULAR_LOCATIONS: string[] = [
  'Remote (Worldwide)',
  'India',
  'Bengaluru, Karnataka',
  'Hyderabad, Telangana',
  'Pune, Maharashtra',
  'Mumbai, Maharashtra',
  'Delhi NCR / Gurgaon / Noida',
  'Chennai, Tamil Nadu',
  'Kolkata, West Bengal',
  'Ahmedabad, Gujarat',
  'Chandigarh / Mohali',
  'Kochi (Cochin), Kerala',
  'Indore, Madhya Pradesh',
  'Jaipur, Rajasthan',
  'Coimbatore, Tamil Nadu',
  'Thiruvananthapuram (Trivandrum), Kerala',
  'Bhubaneswar, Odisha',
  'Visakhapatnam (Vizag), Andhra Pradesh',
  'Nagpur, Maharashtra',
  'Lucknow, Uttar Pradesh',
  'Vadodara (Baroda), Gujarat',
  'Surat, Gujarat',
  'Bhopal, Madhya Pradesh',
  'Patna, Bihar',
  'Mysuru (Mysore), Karnataka',
  'Mangaluru (Mangalore), Karnataka',
  'Dehradun, Uttarakhand',
  'Nashik, Maharashtra',
  'United States',
  'Europe',
];

export function getLocationTier(label: string): LocationTier | null {
  for (const group of POPULAR_LOCATION_GROUPS) {
    const found = group.locations.find((l) => l.label === label);
    if (found) return found.tier;
  }
  return null;
}

// Flattened list of all distinct job post titles for search and suggestion autocompletion
export const ALL_JOB_POSTS: string[] = Array.from(
  new Set([
    ...POPULAR_JOB_POSTS,
    ...JOB_POST_GROUPS.flatMap((g) => g.posts.map((p) => p.label)),
  ])
);

export function getSuggestions(input: string): string[] {
  if (!input || !input.trim()) {
    return POPULAR_JOB_POSTS.slice(0, 8);
  }

  const query = input.trim().toLowerCase();
  const tokens = query.split(/\s+/).filter(Boolean);

  const directMatches: string[] = [];
  const tokenMatches: string[] = [];

  for (const post of ALL_JOB_POSTS) {
    const postLower = post.toLowerCase();
    if (postLower.includes(query)) {
      directMatches.push(post);
    } else if (tokens.some((token) => postLower.includes(token))) {
      tokenMatches.push(post);
    }
  }

  const combined = Array.from(new Set([...directMatches, ...tokenMatches]));
  return combined.slice(0, 8);
}

export function getLocationSuggestions(input: string, limit = 8): string[] {
  if (!input || !input.trim()) {
    return POPULAR_LOCATIONS.slice(0, 6);
  }
  const clean = input.trim().toLowerCase();
  const directMatches: string[] = [];
  const aliasMatches: string[] = [];

  for (const group of POPULAR_LOCATION_GROUPS) {
    for (const loc of group.locations) {
      const labelLower = loc.label.toLowerCase();
      if (labelLower.includes(clean)) {
        directMatches.push(loc.label);
      } else if (loc.aliases.some((a) => a.includes(clean))) {
        aliasMatches.push(loc.label);
      }
    }
  }

  for (const loc of POPULAR_LOCATIONS) {
    if (loc.toLowerCase().includes(clean) && !directMatches.includes(loc)) {
      directMatches.push(loc);
    }
  }

  const combined = Array.from(new Set([...directMatches, ...aliasMatches]));
  return combined.slice(0, limit);
}

export function isRemoteRole(value: string): boolean {
  if (!value) return false;
  const val = value.trim().toLowerCase();
  return (
    val === 'remote' ||
    val.startsWith('remote ') ||
    JOB_POST_GROUPS[0].posts.some((p) => p.value.toLowerCase() === val)
  );
}
