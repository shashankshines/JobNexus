export const KEYWORD_SUGGESTIONS: Record<string, string[]> = {
    'frontend': ['React', 'Vue', 'Angular', 'TypeScript', 'JavaScript', 'Web Developer'],
    'backend': ['Node.js', 'Python', 'Java', 'Go', 'API', 'Database', 'SQL'],
    'fullstack': ['MERN', 'MEAN', 'Next.js', 'React + Node', 'Web Developer'],
    'devops': ['AWS', 'Kubernetes', 'Docker', 'CI/CD', 'Terraform', 'Azure', 'SRE'],
    'data': ['Data Scientist', 'Data Analyst', 'Python', 'SQL', 'Machine Learning', 'Big Data'],
    'design': ['UI/UX', 'Figma', 'Product Designer', 'Graphic Design', 'Adobe'],
    'mobile': ['iOS', 'Android', 'React Native', 'Flutter', 'Swift', 'Kotlin'],
    'cloud': ['AWS', 'Azure', 'GCP', 'Cloud Architect', 'Serverless'],
    'manager': ['Product Manager', 'Project Manager', 'Engineering Manager', 'Team Lead'],
    'marketing': ['SEO', 'Content Writer', 'Social Media', 'Growth Hacker', 'Digital Marketing'],
};

export function getSuggestions(input: string): string[] {
    if (!input || input.length < 2) return [];
    const lowerInput = input.toLowerCase();

    // Direct matches in keys
    const directMatches = Object.keys(KEYWORD_SUGGESTIONS).filter(key => key.includes(lowerInput));

    let suggestions: string[] = [];

    directMatches.forEach(key => {
        suggestions = [...suggestions, ...KEYWORD_SUGGESTIONS[key]];
    });

    // Also check values
    Object.values(KEYWORD_SUGGESTIONS).forEach(list => {
        list.forEach(item => {
            if (item.toLowerCase().includes(lowerInput) && !suggestions.includes(item)) {
                suggestions.push(item);
            }
        });
    });

    return Array.from(new Set(suggestions)).slice(0, 5);
}
