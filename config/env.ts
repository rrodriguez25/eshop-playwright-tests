import { existsSync } from 'node:fs';

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
};
