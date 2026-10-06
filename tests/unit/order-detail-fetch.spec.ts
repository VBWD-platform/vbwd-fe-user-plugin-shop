/**
 * S152 16b — OrderDetail.vue loads the order it is routed to.
 *
 * Before: the view never fetched, so every order showed "Order not found.".
 * It now calls ``GET /api/v1/shop/orders/<id>`` (the endpoint theme_shop's
 * OrderDetailPage uses); the API's owner scoping (403), an unknown id (404) and
 * a malformed id all read "Order not found." — another user's order never shows.
 *
 * The fake sits at the transport (axios adapter on the host api singleton), so
 * the real ApiClient builds the real ApiError from the HTTP status.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import { createPinia, setActivePinia } from 'pinia';
import { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import { api } from '@/api';

const { routeParams } = vi.hoisted(() => ({
  routeParams: { id: '11111111-2222-3333-4444-555555555555' },
}));

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: routeParams }),
}));

vi.mock('vbwd-view-component', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('vbwd-view-component');
  return { ...actual, useAuthStore: () => ({ user: { account_type: undefined } }) };
});

import OrderDetail from '../../shop/views/OrderDetail.vue';

const ORDER_ID = '11111111-2222-3333-4444-555555555555';
const PRODUCTION_BASE_URL = '/api/v1';
const HTTP_OK = 200;
const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;
const HTTP_SERVER_ERROR = 500;

const requestedPaths: string[] = [];

interface FakeResponse {
  status: number;
  data: unknown;
}

function installFakeTransport(respond: (path: string) => FakeResponse): void {
  const transport = (api as unknown as { axiosInstance: AxiosInstance }).axiosInstance;
  transport.defaults.baseURL = PRODUCTION_BASE_URL;
  transport.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
    const path = `${config.baseURL ?? ''}${config.url ?? ''}`;
    requestedPaths.push(path);
    const { status, data } = respond(path);
    const response = { data, status, statusText: String(status), headers: {}, config };
    if (status >= 400) {
      throw new AxiosError(`Request failed with status code ${status}`, 'ERR_BAD_RESPONSE', config, {}, response);
    }
    return response;
  };
}

const API_ORDER = {
  id: ORDER_ID,
  order_number: 'SO-2001',
  status: 'processing',
  shipping_method: 'DHL',
  tracking_number: 'TRK-9',
  subtotal: '100.00',
  tax_amount: '19.00',
  total_amount: '119.00',
  created_at: '2026-10-04T10:00:00',
  items: [
    {
      id: 'line-1',
      quantity: 1,
      unit_price: '119.00',
      total_price: '119.00',
      product_snapshot: { name: 'Blue Widget', sku: 'BW-1', slug: 'blue-widget' },
    },
  ],
};

const i18n = createI18n({ legacy: false, locale: 'en', missing: (_locale, key) => key, messages: { en: {} } });

function mountDetail() {
  return mount(OrderDetail, { global: { plugins: [i18n], stubs: { 'router-link': true } } });
}

describe('OrderDetail.vue fetch (S152 16b)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    requestedPaths.length = 0;
    routeParams.id = ORDER_ID;
  });

  it('fetches the routed order from the shop orders endpoint and renders it', async () => {
    installFakeTransport(() => ({ status: HTTP_OK, data: { order: API_ORDER } }));
    const wrapper = mountDetail();
    await flushPromises();

    expect(requestedPaths).toEqual([`/api/v1/shop/orders/${ORDER_ID}`]);
    expect(wrapper.find('[data-testid="order-detail-empty"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="order-detail-number"]').text()).toContain('SO-2001');
    expect(wrapper.find('[data-testid="order-detail-status"]').text()).toBe('processing');
    expect(wrapper.find('[data-testid="order-detail-item-name"]').text()).toBe('Blue Widget');
    expect(wrapper.find('[data-testid="order-detail-tracking"]').text()).toContain('TRK-9');
    expect(wrapper.find('[data-testid="order-detail-tracking"]').text()).toContain('DHL');
    expect(wrapper.text()).toContain('119');
  });

  it.each([HTTP_FORBIDDEN, HTTP_NOT_FOUND])('shows "Order not found." when the API answers %s', async (status) => {
    installFakeTransport(() => ({ status, data: { error: 'Forbidden' } }));
    const wrapper = mountDetail();
    await flushPromises();

    expect(wrapper.find('[data-testid="order-detail-empty"]').text()).toBe('Order not found.');
    expect(wrapper.find('[data-testid="order-detail-error"]').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('Forbidden');
  });

  it('shows "Order not found." for a malformed id without calling the API', async () => {
    routeParams.id = 'not-a-uuid';
    installFakeTransport(() => ({ status: HTTP_OK, data: { order: API_ORDER } }));
    const wrapper = mountDetail();
    await flushPromises();

    expect(requestedPaths).toEqual([]);
    expect(wrapper.find('[data-testid="order-detail-empty"]').text()).toBe('Order not found.');
  });

  it('shows the error state for any other failure', async () => {
    installFakeTransport(() => ({ status: HTTP_SERVER_ERROR, data: { error: 'Database unavailable' } }));
    const wrapper = mountDetail();
    await flushPromises();

    expect(wrapper.find('[data-testid="order-detail-error"]').text()).toBe('Database unavailable');
  });
});
