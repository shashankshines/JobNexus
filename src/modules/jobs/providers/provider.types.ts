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
  const timer = setTimeout(
    () => controller.abort(new Error(`Timeout of ${timeoutMs}ms exceeded`)),
    timeoutMs
  );

  const onCallerAbort = () => {
    controller.abort(options.signal?.reason || new Error('Request aborted by caller'));
  };

  if (options.signal) {
    if (options.signal.aborted) {
      clearTimeout(timer);
      controller.abort(options.signal.reason);
    } else {
      options.signal.addEventListener('abort', onCallerAbort, { once: true });
    }
  }

  const fetchOptions: RequestInit & { next?: { revalidate?: number | false } } = { ...options };
  // In production / non-test environments, allow Next.js Data Cache to cache upstream job feeds for 15 minutes (900s).
  // This bypasses redundant network latency and cold-start waits for upstream boards.
  if (process.env.NODE_ENV !== 'test') {
    delete fetchOptions.cache;
    fetchOptions.next = { revalidate: 900 };
  } else if (!fetchOptions.next) {
    fetchOptions.next = { revalidate: 1800 };
  }

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
      headers: {
        'User-Agent': 'JobNexus/1.0 (Job Aggregation Engine; +https://github.com/shashankshines/JobNexus)',
        Accept: 'application/json, text/xml, application/xml, */*',
        ...(options.headers || {}),
      },
    });
    clearTimeout(timer);
    return response;
  } catch (error) {
    clearTimeout(timer);
    throw error;
  } finally {
    if (options.signal) {
      options.signal.removeEventListener('abort', onCallerAbort);
    }
  }
}
