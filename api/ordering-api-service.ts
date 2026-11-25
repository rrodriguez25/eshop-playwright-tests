import type { APIRequestContext } from '@playwright/test';

/**
 * Stub service for the Ordering API.
 *
 * All endpoints on this service require a JWT Bearer token. Identity.API has no
 * headless grant type registered (no ROPC, no Client Credentials), and the eShop
 * source is read-only. The service documents the 401 contract and defers data tests
 * to a future iteration.
 *
 * Future path: register a Client Credentials client in Identity.API, update the
 * Ordering API auth policy to accept service tokens, then expand this service with
 * full CRUD methods.
 */
export class OrderingApiService {
  constructor(
    private readonly request: APIRequestContext,
    private readonly baseUrl: string,
  ) {}

  async getOrdersStatus(): Promise<number> {
    const response = await this.request.get(`${this.baseUrl}/api/orders`, {
      params: { 'api-version': '1.0' },
    });
    return response.status();
  }

  async getCardTypesStatus(): Promise<number> {
    const response = await this.request.get(`${this.baseUrl}/api/orders/cardtypes`, {
      params: { 'api-version': '1.0' },
    });
    return response.status();
  }
}
