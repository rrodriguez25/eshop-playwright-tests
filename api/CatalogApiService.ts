import type { APIRequestContext } from '@playwright/test';
import type { components } from './generated/catalog';

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

    const response = await this.request.get(`${this.baseUrl}/api/catalog/items?${qs.toString()}`);
    if (!response.ok()) throw new Error(`GET /api/catalog/items → ${response.status()}`);
    return response.json() as Promise<PaginatedCatalogItems>;
  }

  async getItem(id: number): Promise<CatalogItem> {
    const response = await this.request.get(`${this.baseUrl}/api/catalog/items/${id}`, {
      params: { 'api-version': '1.0' },
    });
    if (!response.ok()) throw new Error(`GET /api/catalog/items/${id} → ${response.status()}`);
    return response.json() as Promise<CatalogItem>;
  }

  async getItemsByIds(ids: number[]): Promise<CatalogItem[]> {
    const qs = new URLSearchParams();
    qs.set('api-version', '1.0');
    ids.forEach(id => qs.append('ids', String(id)));
    const response = await this.request.get(`${this.baseUrl}/api/catalog/items/by?${qs.toString()}`);
    if (!response.ok()) throw new Error(`GET /api/catalog/items/by → ${response.status()}`);
    return response.json() as Promise<CatalogItem[]>;
  }

  async getTypes(): Promise<CatalogType[]> {
    const response = await this.request.get(`${this.baseUrl}/api/catalog/catalogtypes`, {
      params: { 'api-version': '1.0' },
    });
    if (!response.ok()) throw new Error(`GET /api/catalog/catalogtypes → ${response.status()}`);
    return response.json() as Promise<CatalogType[]>;
  }

  async getBrands(): Promise<CatalogBrand[]> {
    const response = await this.request.get(`${this.baseUrl}/api/catalog/catalogbrands`, {
      params: { 'api-version': '1.0' },
    });
    if (!response.ok()) throw new Error(`GET /api/catalog/catalogbrands → ${response.status()}`);
    return response.json() as Promise<CatalogBrand[]>;
  }

  async createItem(item: NewCatalogItem): Promise<number> {
    // The catalog DB sequence hasn't been advanced past the seeded items (1–101).
    // Sending an explicit id in the range [10000,99999] bypasses the sequence entirely.
    // The API's CreateItem sets Id = product.Id from the JSON body.
    const id = Math.floor(Math.random() * 90000) + 10000;
    const response = await this.request.post(`${this.baseUrl}/api/catalog/items`, {
      params: { 'api-version': '1.0' },
      data: { ...item, id },
    });
    if (response.status() !== 201) throw new Error(`POST /api/catalog/items → ${response.status()}`);
    const location = response.headers()['location'] ?? '';
    const parsedId = parseInt(location.split('/').at(-1) ?? '', 10);
    if (isNaN(parsedId)) throw new Error(`createItem: could not parse id from Location header: ${location}`);
    return parsedId;
  }

  async updateItem(id: number, patch: Partial<NewCatalogItem>): Promise<void> {
    const current = await this.getItem(id);
    const merged: CatalogItem = { ...current, ...patch, id };
    const response = await this.request.put(`${this.baseUrl}/api/catalog/items`, {
      params: { 'api-version': '1.0' },
      data: merged,
    });
    if (response.status() !== 201) throw new Error(`PUT /api/catalog/items → ${response.status()}`);
  }

  async deleteItem(id: number): Promise<void> {
    const response = await this.request.delete(`${this.baseUrl}/api/catalog/items/${id}`, {
      params: { 'api-version': '1.0' },
    });
    if (!response.ok()) throw new Error(`DELETE /api/catalog/items/${id} → ${response.status()}`);
  }
}
