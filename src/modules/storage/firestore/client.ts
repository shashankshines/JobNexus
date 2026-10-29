import { getApps, initializeApp, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

/**
 * JobNexus Firestore Server-Side Client
 * Singleton management of Firebase Admin SDK for Next.js App Router.
 *
 * Invariant: Never silently fall back to ephemeral JSON or /tmp for payment state.
 * Fails closed with descriptive errors when credentials are not configured.
 */

interface GlobalFirestoreRegistry {
  app?: App;
  firestore?: Firestore;
}

const globalForFirestore = globalThis as unknown as {
  __jobnexus_firestore_registry?: GlobalFirestoreRegistry;
};

if (!globalForFirestore.__jobnexus_firestore_registry) {
  globalForFirestore.__jobnexus_firestore_registry = {};
}

/**
 * Checks if Firestore credentials or emulator environment are configured.
 */
export function isFirestoreConfigured(): boolean {
  if (globalForFirestore.__jobnexus_firestore_registry?.firestore) {
    return true;
  }
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    return true;
  }
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS && projectId) {
    return true;
  }

  return Boolean(projectId && clientEmail && privateKey);
}

/**
 * Initializes and returns the server-side Firebase Admin App singleton.
 */
export function getFirebaseAdminApp(): App {
  const registry = globalForFirestore.__jobnexus_firestore_registry!;
  if (registry.app) {
    return registry.app;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY;
  const isEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);

  if (isEmulator) {
    const existingApps = getApps();
    const emuApp = existingApps.find(a => a.name === 'jobnexus-emulator');
    if (emuApp) {
      registry.app = emuApp;
      return registry.app;
    }
    const resolvedProjectId = projectId || 'jobnexus-98b60';
    process.env.GCLOUD_PROJECT = resolvedProjectId;
    process.env.GOOGLE_CLOUD_PROJECT = resolvedProjectId;

    if (clientEmail && rawPrivateKey) {
      const formattedPrivateKey = rawPrivateKey.replace(/\\n/g, '\n');
      registry.app = initializeApp({
        credential: cert({
          projectId: resolvedProjectId,
          clientEmail,
          privateKey: formattedPrivateKey,
        }),
      }, 'jobnexus-emulator');
    } else {
      registry.app = initializeApp({ projectId: resolvedProjectId }, 'jobnexus-emulator');
    }
    return registry.app;
  }

  if (clientEmail && rawPrivateKey && projectId) {
    const formattedPrivateKey = rawPrivateKey.replace(/\\n/g, '\n');
    const existingApps = getApps();
    if (existingApps.length > 0 && existingApps[0].name === '[DEFAULT]') {
      registry.app = existingApps[0];
      return registry.app;
    }
    registry.app = initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey: formattedPrivateKey,
      }),
    });
    return registry.app;
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS && projectId) {
    const existingApps = getApps();
    if (existingApps.length > 0 && existingApps[0].name === '[DEFAULT]') {
      registry.app = existingApps[0];
      return registry.app;
    }
    registry.app = initializeApp({ projectId });
    return registry.app;
  }

  throw new Error(
    '[Firestore] Missing server credentials. Required: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY ' +
    '(or FIRESTORE_EMULATOR_HOST for offline testing). Silent fallback to ephemeral files or memory is strictly prohibited.'
  );
}

/**
 * Returns the authoritative Firestore database instance.
 * Throws a fatal error if Firestore is unconfigured.
 */
export function getFirestoreDb(): Firestore {
  const registry = globalForFirestore.__jobnexus_firestore_registry!;
  if (registry.firestore) {
    return registry.firestore;
  }

  if (!isFirestoreConfigured()) {
    throw new Error(
      '[Firestore] Missing server credentials. Required: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY ' +
      '(or FIRESTORE_EMULATOR_HOST for offline testing). Silent fallback to ephemeral files or memory is strictly prohibited.'
    );
  }

  const app = getFirebaseAdminApp();
  const db = getFirestore(app);

  // Configure settings: ignore undefined properties in document models
  try {
    db.settings({ ignoreUndefinedProperties: true });
  } catch {
    // Settings can only be called before any other calls on Firestore
  }

  registry.firestore = db;
  return db;
}

/**
 * Injects a mock Firestore database instance into the global registry.
 * Used exclusively for hermetic unit testing without network or credential dependencies.
 */
export function setMockFirestoreDb(mockDb: Firestore | undefined): void {
  if (!globalForFirestore.__jobnexus_firestore_registry) {
    globalForFirestore.__jobnexus_firestore_registry = {};
  }
  globalForFirestore.__jobnexus_firestore_registry.firestore = mockDb;
}

/**
 * Resets the Firestore registry cache. Used exclusively in unit test suites.
 */
export function resetFirestoreRegistry(): void {
  const registry = globalForFirestore.__jobnexus_firestore_registry;
  if (registry) {
    registry.app = undefined;
    registry.firestore = undefined;
  }
}

