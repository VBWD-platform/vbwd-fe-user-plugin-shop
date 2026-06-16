/**
 * S96.4 (S2) — the shop order detail discloses the netto/tax/brutto split.
 *
 * The order detail must show the per-rate tax breakdown for a taxed order from
 * the persisted order data (order-level net/tax/gross or item-level VO split),
 * reusing the shared <PriceBreakdown> + ``aggregatePrice`` — no fe-side tax math.
 * An untaxed order falls back to the single total figure (net == gross).
 *
 * The view is fed via an optional ``order`` prop (a display-only seam; the live
 * view will receive the same shape from its fetch). These oracles assert:
 *   - a taxed order renders the order-level breakdown (net + a real tax rate line
 *     + gross) aggregated from item ``taxes`` (display sum only),
 *   - per-rate tax labels carry the real rate (not a collapsed rate-0 "TAX"),
 *   - an untaxed order shows the single total, no breakdown,
 *   - the gross the order carries is echoed, never recomputed.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';

const authUser = { account_type: undefined as 'private' | 'business' | undefined };
vi.mock('vbwd-view-component', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('vbwd-view-component');
  return {
    ...actual,
    useAuthStore: () => ({ user: authUser }),
  };
});

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { id: 'order-1' } }),
}));

import OrderDetail from '../../shop/views/OrderDetail.vue';

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  missing: (_locale, key) => key,
  messages: {
    en: {
      price: {
        nettoTag: 'netto price',
        net: 'Net',
        gross: 'Gross',
        taxLine: 'VAT {rate}%',
      },
    },
  },
});

interface OrderItemFixture {
  id: string;
  productName: string;
  quantity: number;
  price: number;
  netAmount?: number;
  grossAmount?: number;
  taxes?: { code: string; name?: string; rate: string | number; amount: number }[];
}

interface OrderFixture {
  id: string;
  orderNumber: string;
  status: string;
  currency: string;
  createdAt: string;
  total: number;
  subtotal?: number;
  taxAmount?: number;
  items: OrderItemFixture[];
  tracking: { carrier: string; trackingNumber: string } | null;
}

function mountOrder(order: OrderFixture) {
  return mount(OrderDetail, {
    props: { order } as unknown as Record<string, never>,
    global: {
      plugins: [i18n],
      stubs: { 'router-link': true },
    },
  });
}

function taxedOrder(): OrderFixture {
  return {
    id: 'order-1',
    orderNumber: 'SO-1001',
    status: 'processing',
    currency: 'EUR',
    createdAt: '2026-06-13T10:00:00Z',
    total: 119,
    items: [
      {
        id: 'line-1',
        productName: 'Widget',
        quantity: 1,
        price: 119,
        netAmount: 100,
        grossAmount: 119,
        taxes: [{ code: 'VAT', rate: '19.00', amount: 19 }],
      },
    ],
    tracking: null,
  };
}

describe('OrderDetail.vue tax display (S96.4)', () => {
  beforeEach(() => {
    authUser.account_type = undefined;
    vi.clearAllMocks();
  });

  it('renders the order-level breakdown (net + tax rate line + gross) for a taxed order', () => {
    const wrapper = mountOrder(taxedOrder());
    expect(wrapper.find('[data-testid="order-detail-breakdown"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="price-breakdown-net"]').exists()).toBe(true);
    const taxLines = wrapper.findAll('[data-testid="price-breakdown-tax-line"]');
    expect(taxLines.length).toBe(1);
    // The tax line carries the real rate, not a collapsed rate-0 "TAX".
    expect(taxLines[0].text()).toContain('19');
  });

  it('aggregates net / tax / gross from the item VO split (display sum only)', () => {
    const order = taxedOrder();
    order.items.push({
      id: 'line-2',
      productName: 'Gadget',
      quantity: 2,
      price: 119,
      netAmount: 100,
      grossAmount: 119,
      taxes: [{ code: 'VAT', rate: '19.00', amount: 19 }],
    });
    order.total = 357; // 119 * (1 + 2)
    const wrapper = mountOrder(order);
    const netRow = wrapper.find('[data-testid="price-breakdown-net"]');
    const grossRow = wrapper.find('[data-testid="price-breakdown-gross"]');
    // net 100 * 3 = 300, tax 19 * 3 = 57, gross 357.
    expect(netRow.text()).toContain('300');
    expect(grossRow.text()).toContain('357');
  });

  it('shows the single total and no breakdown for an untaxed order', () => {
    const wrapper = mountOrder({
      id: 'order-2',
      orderNumber: 'SO-1002',
      status: 'delivered',
      currency: 'EUR',
      createdAt: '2026-06-13T10:00:00Z',
      total: 50,
      items: [
        { id: 'line-1', productName: 'Sticker', quantity: 1, price: 50, taxes: [] },
      ],
      tracking: null,
    });
    expect(wrapper.find('[data-testid="order-detail-breakdown"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="order-detail-total"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('50');
  });

  it('echoes the order gross — does not recompute it from net + tax', () => {
    const order = taxedOrder();
    // Deliberately inconsistent gross: net 100 + tax 19 != gross 999.
    order.items[0].grossAmount = 999;
    order.total = 999;
    const wrapper = mountOrder(order);
    expect(wrapper.find('[data-testid="price-breakdown-gross"]').text()).toContain('999');
  });
});
