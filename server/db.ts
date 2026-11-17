import fs from 'fs';
import path from 'path';
import { createSeedDatabase, DatabaseSchema } from './seed';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'blockverse.json');
export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

let dbCache: DatabaseSchema | null = null;
let writePromise: Promise<void> = Promise.resolve();

function ensureDirs() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

export function getDb(): DatabaseSchema {
  if (dbCache) return dbCache;
  ensureDirs();
  if (fs.existsSync(DB_FILE)) {
    try {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      dbCache = JSON.parse(raw) as DatabaseSchema;
      return dbCache;
    } catch (err) {
      console.error('Gagal membaca pangkalan data, membina semula daripada benih:', err);
    }
  }
  dbCache = createSeedDatabase();
  fs.writeFileSync(DB_FILE, JSON.stringify(dbCache, null, 2), 'utf-8');
  return dbCache;
}

export function saveDb(mutator?: (db: DatabaseSchema) => void): Promise<DatabaseSchema> {
  const db = getDb();
  if (mutator) {
    mutator(db);
  }
  const snapshot = JSON.stringify(db, null, 2);
  writePromise = writePromise.then(async () => {
    ensureDirs();
    const tmpFile = `${DB_FILE}.tmp`;
    await fs.promises.writeFile(tmpFile, snapshot, 'utf-8');
    await fs.promises.rename(tmpFile, DB_FILE);
  });
  return writePromise.then(() => db);
}
