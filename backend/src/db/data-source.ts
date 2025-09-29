import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { User, UserSettings, Session, CacheEntry } from './entities';
import path from 'path';
import fs from 'fs';

// Ensure config directory exists
const configDir = process.env.CONFIG_DIRECTORY || './config';
const dbDir = path.join(configDir, 'db');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const databasePath = process.env.DATABASE_PATH || path.join(configDir, 'db', 'app.sqlite');

export const AppDataSource = new DataSource({
  type: 'sqlite',
  database: databasePath,
  synchronize: process.env.NODE_ENV === 'development',
  logging: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
  entities: [User, UserSettings, Session, CacheEntry],
  migrations: [path.join(__dirname, 'migrations', '*.{ts,js}')],
  subscribers: [],
  // Enable WAL mode for better concurrency
  extra: {
    // SQLite specific options
    busyTimeout: 5000,
    journal_mode: 'WAL'
  }
});

// Initialize database connection
export async function initializeDatabase(): Promise<DataSource> {
  try {
    await AppDataSource.initialize();

    // Enable WAL mode
    await AppDataSource.query('PRAGMA journal_mode = WAL');
    await AppDataSource.query('PRAGMA foreign_keys = ON');

    console.log(`✅ Database initialized at: ${databasePath}`);

    // Run migrations in non-test environments (dev + prod)
    try {
      const env = process.env.NODE_ENV || 'development';
      if (env !== 'test') {
        await AppDataSource.runMigrations();
        console.log(`✅ Migrations completed (env=${env})`);
      }
    } catch (e) {
      console.warn('⚠️  Migration run skipped or failed:', e);
    }

    // Bootstrap fallback: if no core tables exist and there are no migrations,
    // perform a one-time synchronize to create the schema.
    try {
      const tables: Array<{ name: string }> = await AppDataSource.query(
        "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('users','user_settings','sessions','cache_entries')"
      );
      const hasCoreTables = Array.isArray(tables) && tables.length > 0;

      const migrationsDir = path.join(__dirname, 'migrations');
      const hasMigrationsOnDisk = fs.existsSync(migrationsDir) && fs.readdirSync(migrationsDir).length > 0;

      if (!hasCoreTables && !hasMigrationsOnDisk) {
        console.log('ℹ️  No DB tables and no migrations found; running one-time synchronize to bootstrap schema');
        await AppDataSource.synchronize();
        console.log('✅ Schema synchronized (bootstrap)');
      }
    } catch (e) {
      console.warn('⚠️  Bootstrap schema check/sync failed:', e);
    }

    return AppDataSource;
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    throw error;
  }
}
