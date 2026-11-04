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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let colRef: any;

      interface OrderSpec {
        field: string;
        dir: 'asc' | 'desc';
      }

      const makeQuery = (
        predicate?: (doc: DocumentData) => boolean,
        limitCount?: number,
        offsetCount?: number,
        orderings: OrderSpec[] = [],
        startAfterValues?: unknown[]
      ) => ({
        limit: (n: number) => makeQuery(predicate, n, offsetCount, orderings, startAfterValues),
        offset: (n: number) => makeQuery(predicate, limitCount, n, orderings, startAfterValues),
        orderBy: (f: string, d: 'asc' | 'desc' = 'asc') =>
          makeQuery(predicate, limitCount, offsetCount, [...orderings, { field: f, dir: d }], startAfterValues),
        startAfter: (...args: unknown[]) =>
          makeQuery(predicate, limitCount, offsetCount, orderings, args),
        where: (field: string, opStr: string, value: unknown) => {
          const nextPredicate = (doc: DocumentData) => {
            const prev = predicate ? predicate(doc) : true;
            if (!prev) return false;
            if (opStr === '==') return doc[field] === value;
            if (opStr === '!=') return doc[field] !== value;
            if (opStr === '>') return (doc[field] as string | number) > (value as string | number);
            if (opStr === '>=') return (doc[field] as string | number) >= (value as string | number);
            if (opStr === '<') return (doc[field] as string | number) < (value as string | number);
            if (opStr === '<=') return (doc[field] as string | number) <= (value as string | number);
            if (opStr === 'in') return Array.isArray(value) && value.includes(doc[field]);
            return true;
          };
          return makeQuery(nextPredicate, limitCount, offsetCount, orderings, startAfterValues);
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

          if (orderings.length > 0) {
            matches.sort((a, b) => {
              for (const ord of orderings) {
                const valA = a[ord.field];
                const valB = b[ord.field];
                if (valA === undefined && valB === undefined) continue;
                if (valA === undefined) return 1;
                if (valB === undefined) return -1;
                if (valA < valB) return ord.dir === 'asc' ? -1 : 1;
                if (valA > valB) return ord.dir === 'asc' ? 1 : -1;
              }
              return 0;
            });
          }

          let startIndex = offsetCount || 0;
          if (startAfterValues && startAfterValues.length > 0) {
            let cursorFieldValues: unknown[] = [];
            const firstArg = startAfterValues[0] as { id?: string; data?: () => DocumentData } | undefined;
            if (firstArg && typeof firstArg === 'object' && typeof firstArg.data === 'function') {
              const docData: DocumentData = { id: firstArg.id, ...firstArg.data() };
              cursorFieldValues = orderings.map((o) => docData[o.field] ?? docData.id);
            } else {
              cursorFieldValues = startAfterValues;
            }

            const foundIdx = matches.findIndex((m) => {
              for (let i = 0; i < cursorFieldValues.length; i++) {
                const ord = orderings[i];
                const fieldName = ord ? ord.field : 'id';
                if (m[fieldName] !== cursorFieldValues[i] && m.id !== cursorFieldValues[i]) {
                  return false;
                }
              }
              return true;
            });

            if (foundIdx !== -1) {
              startIndex = foundIdx + 1;
            }
          }

          const sliced = matches.slice(startIndex, limitCount ? startIndex + limitCount : undefined);
          return {
            empty: sliced.length === 0,
            size: sliced.length,
            docs: sliced.map(
              (d) =>
                ({
                  id: d.id,
                  ref: colRef.doc(d.id),
                  data: () => ({ ...d }),
                } as unknown as DocumentSnapshot)
            ),
          } as unknown as QuerySnapshot;
        },
        onSnapshot: (onNext: (snapshot: unknown) => void, onError?: (err: Error) => void) => {
          void Promise.resolve().then(async () => {
            try {
              const queryObj = makeQuery(predicate, limitCount, offsetCount, orderings, startAfterValues);
              const snap = await queryObj.get();
              onNext({
                ...snap,
                docChanges: () =>
                  snap.docs.map((d: DocumentSnapshot) => ({
                    type: 'added',
                    doc: d,
                  })),
              });
            } catch (e) {
              if (onError) onError(e as Error);
            }
          });
          return () => {};
        },
      });

      const rootQuery = makeQuery();

      colRef = {
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

            create: async (data: DocumentData): Promise<unknown> => {
              const existing = colData.get(id);
              if (existing !== undefined) {
                const err = new Error(`ALREADY_EXISTS: Document ${collectionName}/${id} already exists.`);
                (err as { code?: number }).code = 6;
                throw err;
              }
              colData.set(id, { ...data });
              return { writeTime: new Date() };
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
        startAfter: rootQuery.startAfter,
        limit: rootQuery.limit,
        offset: rootQuery.offset,
        count: rootQuery.count,
        get: rootQuery.get,
        onSnapshot: rootQuery.onSnapshot,
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

    batch: () => {
      const operations: Array<() => void> = [];
      const batchObj = {
        set: (ref: DocumentReference, data: DocumentData, options?: { merge?: boolean }) => {
          operations.push(() => {
            const colName = ref.path.split('/')[0];
            const colData = store.getCollectionData(colName);
            if (options?.merge) {
              const existing = colData.get(ref.id) || {};
              colData.set(ref.id, { ...existing, ...data });
            } else {
              colData.set(ref.id, { ...data });
            }
          });
          return batchObj;
        },
        update: (ref: DocumentReference, data: DocumentData) => {
          operations.push(() => {
            const colName = ref.path.split('/')[0];
            const colData = store.getCollectionData(colName);
            const existing = colData.get(ref.id) || {};
            colData.set(ref.id, { ...existing, ...data });
          });
          return batchObj;
        },
        delete: (ref: DocumentReference) => {
          operations.push(() => {
            const colName = ref.path.split('/')[0];
            const colData = store.getCollectionData(colName);
            colData.delete(ref.id);
          });
          return batchObj;
        },
        commit: async () => {
          for (const op of operations) op();
          return [];
        },
      };
      return batchObj;
    },
  };

  return mockDb as unknown as Firestore;
}
