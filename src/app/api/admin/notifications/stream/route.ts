import { NextRequest } from 'next/server';
import { authorizeAdminRequest } from '@/modules/auth/server/admin.auth';
import { getFirestoreDb } from '@/modules/storage/firestore/client';
import {
  ADMIN_NOTIFICATION_EMAIL,
  ADMIN_NOTIFICATIONS_COLLECTION,
  AdminNotificationDocument,
} from '@/modules/notifications/notification.types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest): Promise<Response> {
  const auth = await authorizeAdminRequest(request);
  if (!auth.authorized) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.statusCode,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (auth.adminEmail !== ADMIN_NOTIFICATION_EMAIL) {
    return new Response(
      JSON.stringify({ error: 'This real-time notification stream is reserved for the designated administrator.' }),
      {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let isClosed = false;

      const safeEnqueue = (chunk: string) => {
        if (isClosed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          isClosed = true;
        }
      };

      // Heartbeat every 20 seconds to keep connection alive across proxies
      const heartbeatInterval = setInterval(() => {
        safeEnqueue(': ping\n\n');
      }, 20_000);
      if (typeof heartbeatInterval.unref === 'function') {
        heartbeatInterval.unref();
      }

      // Real-time Firestore snapshot listener
      let isFirstSnapshot = true;
      const unsubscribe = getFirestoreDb()
        .collection(ADMIN_NOTIFICATIONS_COLLECTION)
        .where('recipientEmail', '==', ADMIN_NOTIFICATION_EMAIL)
        .orderBy('createdAt', 'desc')
        .limit(40)
        .onSnapshot(
          (snapshot) => {
            if (isClosed) return;

            const items: AdminNotificationDocument[] = snapshot.docs.map((doc) => {
              const data = doc.data();
              return {
                ...data,
                id: doc.id,
                status: data.status || (data.readAt ? (data.actionedAt ? 'resolved' : 'read') : 'unread'),
              } as AdminNotificationDocument;
            });

            if (isFirstSnapshot) {
              isFirstSnapshot = false;
              safeEnqueue(
                `event: init\ndata: ${JSON.stringify({
                  items,
                  timestamp: new Date().toISOString(),
                })}\n\n`
              );
            } else {
              // Extract modified and added docs
              const docChanges = snapshot.docChanges();
              const newItems = docChanges
                .filter((change) => change.type === 'added')
                .map((change) => {
                  const data = change.doc.data();
                  return {
                    ...data,
                    id: change.doc.id,
                    status: data.status || 'unread',
                  } as AdminNotificationDocument;
                });

              const updatedItems = docChanges
                .filter((change) => change.type === 'modified')
                .map((change) => {
                  const data = change.doc.data();
                  return {
                    ...data,
                    id: change.doc.id,
                  } as AdminNotificationDocument;
                });

              safeEnqueue(
                `event: sync\ndata: ${JSON.stringify({
                  items,
                  newItems,
                  updatedItems,
                  timestamp: new Date().toISOString(),
                })}\n\n`
              );
            }
          },
          (err) => {
            console.error('[Admin Notifications Stream Error]:', err);
            safeEnqueue(`event: error\ndata: ${JSON.stringify({ error: err.message })}\n\n`);
          }
        );

      const cleanup = () => {
        if (isClosed) return;
        isClosed = true;
        clearInterval(heartbeatInterval);
        try {
          unsubscribe();
        } catch {
          // ignore
        }
        try {
          controller.close();
        } catch {
          // ignore
        }
      };

      request.signal.addEventListener('abort', cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
