import type {
  Firestore,
  CollectionReference,
  DocumentReference,
  DocumentSnapshot,
  QuerySnapshot,
  Transaction,
  DocumentData,
} from 'firebase-admin/firestore';

/**
 * High-Fidelity In-Memory Cloud Firestore Mock
 *
 * Implements the Cloud Firestore collection, document, query, and transaction APIs
 * needed by JobNexus billing, entitlement, and UTR reservation modules for hermetic unit testing.
 */
export class InMemoryFirestoreStore {
  public collections = new Map<string, Map<string, DocumentData>>();

  public getCollectionData(collectionName: string): Map<string, DocumentData> {
    if (!this.collections.has(collectionName)) {
      this.collections.set(collectionName, new Map<string, DocumentData>());
    }
    return this.collections.get(collectionName)!;
  }

  public clear(): void {
    this.collections.clear();
  }
}

export function createMockFirestoreDb(store = new InMemoryFirestoreStore()): Firestore {
  const mockDb = {
    settings: () => {},

    collection: (collectionName: string) => {
      const colData = store.getCollectionData(collectionName);

      const makeQuery = (
        predicate?: (doc: DocumentData) => boolean,
        limitCount?: number,
        offsetCount?: number,
        orderField?: string,
        orderDir: 'asc' | 'desc' = 'asc'
      ) => ({
        limit: (n: number) => makeQuery(predicate, n, offsetCount, orderField, orderDir),
        offset: (n: number) => makeQuery(predicate, limitCount, n, orderField, orderDir),
        orderBy: (f: string, d: 'asc' | 'desc' = 'asc') => makeQuery(predicate, limitCount, offsetCount, f, d),
        where: (field: string, opStr: string, value: unknown) => {
          const nextPredicate = (doc: DocumentData) => {
            const prev = predicate ? predicate(doc) : true;
            if (!prev) return false;
            if (opStr === '==') return doc[field] === value;
            return true;
          };
          return makeQuery(nextPredicate, limitCount, offsetCount, orderField, orderDir);
        },
        count: () => ({
          get: async () => {
            let count = 0;
            for (const [, doc] of colData.entries()) {
              if (!predicate || predicate(doc)) {
                count++;
              }
            }
            return {
              data: () => ({ count }),
            };
          },
        }),
        get: async (): Promise<QuerySnapshot> => {
          const matches: DocumentData[] = [];
          for (const [id, doc] of colData.entries()) {
            if (!predicate || predicate(doc)) {
              matches.push({ id, ...doc });
            }
          }
          if (orderField) {
            matches.sort((a, b) => {
              const valA = a[orderField];
              const valB = b[orderField];
              if (valA < valB) return orderDir === 'asc' ? -1 : 1;
              if (valA > valB) return orderDir === 'asc' ? 1 : -1;
              return 0;
            });
          }
          const offset = offsetCount || 0;
          const sliced = matches.slice(offset, limitCount ? offset + limitCount : undefined);
          return {
            empty: sliced.length === 0,
            size: sliced.length,
            docs: sliced.map(
              (d) =>
                ({
                  id: d.id,
                  data: () => ({ ...d }),
                } as unknown as DocumentSnapshot)
            ),
          } as unknown as QuerySnapshot;
        },
      });

      const rootQuery = makeQuery();

      const colRef = {
        id: collectionName,

        doc: (docId?: string) => {
          const id = docId || `doc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

          const docRef = {
            id,
            path: `${collectionName}/${id}`,

            get: async (): Promise<DocumentSnapshot> => {
              const data = colData.get(id);
              return {
                exists: data !== undefined,
                id,
                ref: docRef as unknown as DocumentReference,
                data: () => (data ? { ...data } : undefined),
              } as unknown as DocumentSnapshot;
            },

            set: async (data: DocumentData, options?: { merge?: boolean }): Promise<unknown> => {
              if (options?.merge) {
                const existing = colData.get(id) || {};
                colData.set(id, { ...existing, ...data });
              } else {
                colData.set(id, { ...data });
              }
              return { writeTime: new Date() };
            },

            update: async (data: DocumentData): Promise<unknown> => {
              const existing = colData.get(id);
              if (!existing) {
                throw new Error(`NOT_FOUND: Document ${collectionName}/${id} does not exist.`);
              }
              colData.set(id, { ...existing, ...data });
              return { writeTime: new Date() };
            },

            delete: async (): Promise<unknown> => {
              colData.delete(id);
              return { writeTime: new Date() };
            },
          };

          return docRef as unknown as DocumentReference;
        },

        where: rootQuery.where,
        orderBy: rootQuery.orderBy,
        limit: rootQuery.limit,
        offset: rootQuery.offset,
        count: rootQuery.count,
        get: rootQuery.get,
      };

      return colRef as unknown as CollectionReference;
    },

    runTransaction: async <T>(
      updateFunction: (transaction: Transaction) => Promise<T>
    ): Promise<T> => {
      const pendingSets: Array<{ col: string; id: string; data: DocumentData; merge?: boolean }> = [];
      const pendingUpdates: Array<{ col: string; id: string; data: DocumentData }> = [];
      const pendingDeletes: Array<{ col: string; id: string }> = [];
      let hasWritten = false;

      const tx = {
        get: async (ref: DocumentReference): Promise<DocumentSnapshot> => {
          if (hasWritten) {
            throw new Error(
              'FirebaseError: Firestore transactions require all reads to be executed before all writes.'
            );
          }
          const colName = ref.path.split('/')[0];
          const colData = store.getCollectionData(colName);
          const data = colData.get(ref.id);
          return {
            exists: data !== undefined,
            id: ref.id,
            ref,
            data: () => (data ? { ...data } : undefined),
          } as unknown as DocumentSnapshot;
        },

        set: (ref: DocumentReference, data: DocumentData, options?: { merge?: boolean }) => {
          hasWritten = true;
          const colName = ref.path.split('/')[0];
          pendingSets.push({ col: colName, id: ref.id, data, merge: options?.merge });
          return tx as unknown as Transaction;
        },

        update: (ref: DocumentReference, data: DocumentData) => {
          hasWritten = true;
          const colName = ref.path.split('/')[0];
          pendingUpdates.push({ col: colName, id: ref.id, data });
          return tx as unknown as Transaction;
        },

        delete: (ref: DocumentReference) => {
          hasWritten = true;
          const colName = ref.path.split('/')[0];
          pendingDeletes.push({ col: colName, id: ref.id });
          return tx as unknown as Transaction;
        },
      };

      const result = await updateFunction(tx as unknown as Transaction);

      // Commit transaction atomically
      for (const item of pendingSets) {
        const colData = store.getCollectionData(item.col);
        if (item.merge) {
          const existing = colData.get(item.id) || {};
          colData.set(item.id, { ...existing, ...item.data });
        } else {
          colData.set(item.id, { ...item.data });
        }
      }
      for (const item of pendingUpdates) {
        const colData = store.getCollectionData(item.col);
        const existing = colData.get(item.id) || {};
        colData.set(item.id, { ...existing, ...item.data });
      }
      for (const item of pendingDeletes) {
        const colData = store.getCollectionData(item.col);
        colData.delete(item.id);
      }

      return result;
    },
  };

  return mockDb as unknown as Firestore;
}
