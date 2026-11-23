import { existsSync } from 'node:fs';
import type { DbConfig } from '../db/DbClient';

if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable ${name}. Copy .env.example to .env and set it.`);
  }
  return value;
}

export const env = {
  baseUrl: required('BASE_URL'),
  apiUrl: process.env.API_URL ?? required('BASE_URL'),
  catalogApiUrl: process.env.API_CATALOG_URL ?? 'http://localhost:5222',
  orderingApiUrl: process.env.API_ORDERING_URL ?? 'http://localhost:5224',
  /** Read on first use, so UI and API runs don't need database settings. */
  get db(): DbConfig {
    return {
      host: process.env.DB_HOST ?? '127.0.0.1',
      port: Number(required('DB_PORT')),
      user: process.env.DB_USER ?? 'postgres',
      password: required('DB_PASSWORD'),
    };
  },
};
