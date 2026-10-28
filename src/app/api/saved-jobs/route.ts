import { NextResponse } from 'next/server';
import {
  validateSession,
  getSavedJobs,
  saveJobForUser,
  removeSavedJobForUser,
  extractSessionId,
} from '@/modules/auth/server/session.store';

export async function GET(request: Request) {
  const sessionId = extractSessionId(request);
  const auth = validateSession(sessionId);

  if (!auth.valid || !auth.user) {
    return NextResponse.json(
      { error: 'Unauthorized. Please sign in to view your saved jobs.' },
      { status: 401 }
    );
  }

  const savedJobs = getSavedJobs(auth.user.id);
  return NextResponse.json({ savedJobs });
}

export async function POST(request: Request) {
  const sessionId = extractSessionId(request);
  const auth = validateSession(sessionId);

  if (!auth.valid || !auth.user) {
    return NextResponse.json(
      { error: 'Unauthorized. Please sign in to save jobs.' },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { job } = body;

    if (!job || !job.id || !job.title || !job.company) {
      return NextResponse.json(
        { error: 'Invalid job data provided for saving.' },
        { status: 400 }
      );
    }

    const result = saveJobForUser(auth.user.id, job);
    return NextResponse.json({
      success: true,
      saved: result.saved,
      savedJobs: result.jobs,
    });
  } catch (error) {
    console.error('[Saved Jobs POST Error]:', error);
    return NextResponse.json(
      { error: 'Failed to save job.' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const sessionId = extractSessionId(request);
  const auth = validateSession(sessionId);

  if (!auth.valid || !auth.user) {
    return NextResponse.json(
      { error: 'Unauthorized. Please sign in to manage saved jobs.' },
      { status: 401 }
    );
  }

  try {
    const url = new URL(request.url);
    let jobId = url.searchParams.get('id');

    if (!jobId) {
      try {
        const body = await request.json();
        jobId = body.jobId || body.id;
      } catch {
        // Body may be empty if passing via query param
      }
    }

    if (!jobId) {
      return NextResponse.json(
        { error: 'Missing job ID to remove from saved list.' },
        { status: 400 }
      );
    }

    const result = removeSavedJobForUser(auth.user.id, jobId);
    return NextResponse.json({
      success: true,
      removed: result.removed,
      savedJobs: result.jobs,
    });
  } catch (error) {
    console.error('[Saved Jobs DELETE Error]:', error);
    return NextResponse.json(
      { error: 'Failed to remove saved job.' },
      { status: 500 }
    );
  }
}
