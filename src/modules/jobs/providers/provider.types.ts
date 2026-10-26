import { NormalizedJob, JobSearchParams } from '../domain/job.types';

export interface JobProvider {
  readonly id: string;
  readonly name: string;
  readonly timeoutMs?: number;
  fetchJobs(params?: JobSearchParams): Promise<NormalizedJob[]>;
}

export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 6000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent': 'JobNexus/1.0 (Job Aggregation Engine; +https://github.com/shashankshines/JobNexus)',
        Accept: 'application/json, text/xml, application/xml, */*',
        ...(options.headers || {}),
      },
      next: { revalidate: 1800 },
    });
    clearTimeout(timer);
    return response;
  } catch (error) {
    clearTimeout(timer);
    throw error;
  }
}
