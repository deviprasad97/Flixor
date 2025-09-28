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

    // Run migrations in production
    if (process.env.NODE_ENV === 'production') {
      await AppDataSource.runMigrations();
      console.log('✅ Migrations completed');
    }

    return AppDataSource;
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    throw error;
  }
}