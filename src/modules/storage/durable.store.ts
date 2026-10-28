import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

/**
 * Robust, lightweight durable store with memory caching and atomic disk persistence.
 * Compatible with Node.js, Next.js serverless functions (/tmp fallback), and local environments.
 */
function resolveDataDir(): string {
  if (process.env.JOBNEXUS_DATA_DIR) {
    return process.env.JOBNEXUS_DATA_DIR;
  }
  // If running in Vercel or read-only container, use /tmp
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return path.join('/tmp', '.jobnexus-data');
  }
  return path.join(process.cwd(), '.jobnexus-data');
}

export class DurableStore<T extends { id?: string }> {
  private cache = new Map<string, T>();
  private filePath: string;
  private isLoaded = false;
  private collectionName: string;

  constructor(collectionName: string) {
    this.collectionName = collectionName;
    const dataDir = resolveDataDir();
    this.filePath = path.join(dataDir, `${collectionName}.json`);
    this.ensureDir(dataDir);
    this.loadFromDisk();
  }

  private ensureDir(dir: string): void {
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    } catch (err) {
      console.warn(`[DurableStore] Unable to create data dir ${dir}:`, err);
    }
  }

  private loadFromDisk(): void {
    if (this.isLoaded) return;
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        if (raw.trim()) {
          const data = JSON.parse(raw) as Record<string, T>;
          for (const [key, val] of Object.entries(data)) {
            this.cache.set(key, val);
          }
        }
      }
    } catch (err) {
      console.warn(`[DurableStore] Error reading collection ${this.collectionName} from disk:`, err);
    } finally {
      this.isLoaded = true;
    }
  }

  private saveToDisk(): void {
    try {
      const data: Record<string, T> = {};
      for (const [k, v] of this.cache.entries()) {
        data[k] = v;
      }
      const dir = path.dirname(this.filePath);
      this.ensureDir(dir);

      const tmpPath = `${this.filePath}.${crypto.randomBytes(6).toString('hex')}.tmp`;
      fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
      fs.renameSync(tmpPath, this.filePath);
    } catch (err) {
      console.warn(`[DurableStore] Error persisting collection ${this.collectionName} to disk:`, err);
    }
  }

  get(key: string): T | undefined {
    return this.cache.get(key);
  }

  set(key: string, value: T): void {
    this.cache.set(key, value);
    this.saveToDisk();
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  delete(key: string): boolean {
    const existed = this.cache.delete(key);
    if (existed) {
      this.saveToDisk();
    }
    return existed;
  }

  values(): T[] {
    return Array.from(this.cache.values());
  }

  entries(): [string, T][] {
    return Array.from(this.cache.entries());
  }

  find(predicate: (item: T) => boolean): T | undefined {
    for (const val of this.cache.values()) {
      if (predicate(val)) return val;
    }
    return undefined;
  }

  filter(predicate: (item: T) => boolean): T[] {
    const res: T[] = [];
    for (const val of this.cache.values()) {
      if (predicate(val)) res.push(val);
    }
    return res;
  }

  size(): number {
    return this.cache.size;
  }

  clear(): void {
    this.cache.clear();
    try {
      if (fs.existsSync(this.filePath)) {
        fs.unlinkSync(this.filePath);
      }
    } catch {
      // Ignore deletion errors in clean environments
    }
  }
}

