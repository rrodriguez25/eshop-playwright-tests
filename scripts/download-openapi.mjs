// Saves eShop's OpenAPI documents to api/generated/, where the contract validator reads them.
// Usage: node scripts/download-openapi.mjs (eShop must be running).
import { mkdirSync, writeFileSync } from 'node:fs';

const documents = [
  ['http://localhost:5222/openapi/v1.json', 'api/generated/catalog.v1.openapi.json'],
  ['http://localhost:5222/openapi/v2.json', 'api/generated/catalog.v2.openapi.json'],
  ['http://localhost:5224/openapi/v1.json', 'api/generated/ordering.v1.openapi.json'],
];

mkdirSync('api/generated', { recursive: true });
for (const [url, file] of documents) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`GET ${url} -> ${response.status}`);
  const document = await response.json();
  writeFileSync(file, `${JSON.stringify(document, null, 2)}\n`);
  console.log(`${url} -> ${file}`);
}
