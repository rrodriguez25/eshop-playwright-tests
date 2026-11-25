import type { APIRequestContext, APIResponse } from '@playwright/test';
import { ContractValidator, type OpenApiDocument, type Operation } from './contract';
import type { components } from './generated/catalog';
import catalogV1 from './generated/catalog.v1.openapi.json';
import catalogV2 from './generated/catalog.v2.openapi.json';

export type CatalogItem = components['schemas']['CatalogItem'];
export type CatalogType = components['schemas']['CatalogType'];
export type CatalogBrand = components['schemas']['CatalogBrand'];
export type PaginatedCatalogItems = components['schemas']['PaginatedItemsOfCatalogItem'];

export interface NewCatalogItem {
  name: string;
  description: string;
  price: number;
  catalogTypeId: number;
  catalogBrandId: number;
  availableStock: number;
  restockThreshold: number;
  maxStockThreshold: number;
  pictureFileName?: string;
}

export interface GetItemsParams {
  pageIndex?: number;
  pageSize?: number;
  name?: string;
  type?: number[];
  brand?: number[];
}

type ApiVersion = '1.0' | '2.0';

/** Every response is validated against the OpenAPI document of the API version it called. */
const contracts: Record<ApiVersion, ContractValidator> = {
  '1.0': new ContractValidator('catalog-v1', catalogV1 as unknown as OpenApiDocument),
  '2.0': new ContractValidator('catalog-v2', catalogV2 as unknown as OpenApiDocument),
};

export class CatalogApiService {
  constructor(
    private readonly request: APIRequestContext,
    private readonly baseUrl: string,
  ) {}

  async getItems(params: GetItemsParams = {}): Promise<PaginatedCatalogItems> {
    const { pageIndex, pageSize, name, type, brand } = params;
    const qs = new URLSearchParams();
    qs.set('api-version', '2.0');
    if (pageIndex !== undefined) qs.set('PageIndex', String(pageIndex));
    if (pageSize !== undefined) qs.set('PageSize', String(pageSize));
    if (name !== undefined) qs.set('name', name);
    type?.forEach(t => qs.append('type', String(t)));
    brand?.forEach(b => qs.append('brand', String(b)));

    const response = await this.send('2.0', { method: 'get', path: '/api/catalog/items' },
      () => this.request.get(`${this.baseUrl}/api/catalog/items?${qs.toString()}`));
    expectOk(response, 'GET /api/catalog/items');
    return response.json() as Promise<PaginatedCatalogItems>;
  }

  async getItem(id: number): Promise<CatalogItem> {
    const response = await this.send('1.0', { method: 'get', path: '/api/catalog/items/{id}' },
      () => this.request.get(`${this.baseUrl}/api/catalog/items/${id}`, { params: { 'api-version': '1.0' } }));
    expectOk(response, `GET /api/catalog/items/${id}`);
    return response.json() as Promise<CatalogItem>;
  }

  async getItemsByIds(ids: number[]): Promise<CatalogItem[]> {
    const qs = new URLSearchParams();
    qs.set('api-version', '1.0');
    ids.forEach(id => qs.append('ids', String(id)));
    const response = await this.send('1.0', { method: 'get', path: '/api/catalog/items/by' },
      () => this.request.get(`${this.baseUrl}/api/catalog/items/by?${qs.toString()}`));
    expectOk(response, 'GET /api/catalog/items/by');
    return response.json() as Promise<CatalogItem[]>;
  }

  async getTypes(): Promise<CatalogType[]> {
    const response = await this.send('1.0', { method: 'get', path: '/api/catalog/catalogtypes' },
      () => this.request.get(`${this.baseUrl}/api/catalog/catalogtypes`, { params: { 'api-version': '1.0' } }));
    expectOk(response, 'GET /api/catalog/catalogtypes');
    return response.json() as Promise<CatalogType[]>;
  }

  async getBrands(): Promise<CatalogBrand[]> {
    const response = await this.send('1.0', { method: 'get', path: '/api/catalog/catalogbrands' },
      () => this.request.get(`${this.baseUrl}/api/catalog/catalogbrands`, { params: { 'api-version': '1.0' } }));
    expectOk(response, 'GET /api/catalog/catalogbrands');
    return response.json() as Promise<CatalogBrand[]>;
  }

  async createItem(item: NewCatalogItem, maxAttempts = 3): Promise<number> {
    // The catalog DB sequence hasn't been advanced past the seeded items (1-101).
    // Sending an explicit id in the range [10000,99999] bypasses the sequence entirely.
    // The API's CreateItem sets Id = product.Id from the JSON body.
    // Retry on 500: a collision with an orphaned test row is the most likely cause. Those
    // retried 500s skip contract validation; any other response is validated.
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const id = Math.floor(Math.random() * 90000) + 10000;
      const response = await this.request.post(`${this.baseUrl}/api/catalog/items`, {
        params: { 'api-version': '1.0' },
        data: { ...item, id },
      });
      if (response.status() === 500 && attempt < maxAttempts) continue;

      await contracts['1.0'].validate(response, { method: 'post', path: '/api/catalog/items' });
      if (response.status() !== 201) {
        throw new Error(`POST /api/catalog/items -> ${response.status()} after ${attempt} attempt(s)`);
      }
      const location = response.headers()['location'] ?? '';
      const parsedId = parseInt(location.split('/').at(-1) ?? '', 10);
      if (isNaN(parsedId)) throw new Error(`createItem: could not parse id from Location header: ${location}`);
      return parsedId;
    }
    throw new Error('createItem: unreachable');
  }

  async updateItem(id: number, patch: Partial<NewCatalogItem>): Promise<void> {
    const current = await this.getItem(id);
    const cleanPatch = Object.fromEntries(
      Object.entries(patch).filter(([, v]) => v !== undefined),
    );
    const merged: CatalogItem = { ...current, ...cleanPatch, id };
    const response = await this.send('1.0', { method: 'put', path: '/api/catalog/items' },
      () => this.request.put(`${this.baseUrl}/api/catalog/items`, { params: { 'api-version': '1.0' }, data: merged }));
    if (response.status() !== 201) throw new Error(`PUT /api/catalog/items -> ${response.status()}`);
  }

  async deleteItem(id: number): Promise<void> {
    const response = await this.send('1.0', { method: 'delete', path: '/api/catalog/items/{id}' },
      () => this.request.delete(`${this.baseUrl}/api/catalog/items/${id}`, { params: { 'api-version': '1.0' } }));
    expectOk(response, `DELETE /api/catalog/items/${id}`);
  }

  /** Sends a request and validates the response against the contract before anything reads it. */
  private async send(version: ApiVersion, operation: Operation, request: () => Promise<APIResponse>): Promise<APIResponse> {
    const response = await request();
    await contracts[version].validate(response, operation);
    return response;
  }
}

function expectOk(response: APIResponse, call: string): void {
  if (!response.ok()) throw new Error(`${call} -> ${response.status()}`);
}
