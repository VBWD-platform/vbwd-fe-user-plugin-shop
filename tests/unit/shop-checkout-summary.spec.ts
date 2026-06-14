/**
 * S85.4 — netto/brutto + tax-disclosure wiring in the shop checkout summary.
 *
 * ShopCheckoutSummary renders, per cart line, the shared <PriceDisplay> (which
 * picks the viewer side via the D9 overlay) and — for the cart's aggregate tax —
 * a <PriceBreakdown> built by summing the per-line ``taxes`` amounts the cart
 * items now carry (display sum only, NO tax math). A taxless cart shows
 * net == gross with no tax lines.
 *
 * These oracles mount the real component against the real shop cart store and a
 * stubbed auth store, asserting:
 *   - business viewer ⇒ netto side even when the item's effective mode is brutto,
 *   - the aggregate breakdown sums the per-line tax amounts,
 *   - a taxless cart renders no tax lines (net == gross),
 *   - no local tax arithmetic happens in the component (guarded by feeding a
 *     deliberately "wrong" gross the component must echo, never recompute).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { createI18n } from 'vue-i18n';

const authUser = { account_type: undefined as 'private' | 'business' | undefined };
vi.mock('vbwd-view-component', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('vbwd-view-component');
  return {
    ...actual,
    useAuthStore: () => ({ user: authUser }),
  };
});

import ShopCheckoutSummary from '../../shop/components/ShopCheckoutSummary.vue';
import { useCartStore } from '../../shop/stores/cart';

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

const storage: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: (key: string) => storage[key] ?? null,
  setItem: (key: string, value: string) => { storage[key] = value; },
  removeItem: (key: string) => { delete storage[key]; },
  clear: () => { Object.keys(storage).forEach((k) => delete storage[k]); },
});

function lineWith(extra: Record<string, unknown>) {
  return {
    productId: 'prod-1',
    productSlug: 'widget',
    productName: 'Widget',
    imageUrl: '',
    price: 119,
    currency: 'EUR',
    quantity: 1,
    maxQuantity: 50,
    isDigital: false,
    weight: 0,
    ...extra,
  };
}

function mountSummary() {
  return mount(ShopCheckoutSummary, {
    global: { plugins: [i18n] },
  });
}

describe('ShopCheckoutSummary (S85.4)', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
    authUser.account_type = undefined;
    vi.clearAllMocks();
  });

  it('shows the GROSS side for a brutto line for an anonymous viewer', () => {
    const cart = useCartStore();
    cart.addItem(lineWith({
      netAmount: 100,
      grossAmount: 119,
      effectiveDisplayMode: 'brutto',
      pricesDisplayMode: 'brutto',
      taxes: [{ code: 'VAT', rate: '19.00', amount: 19 }],
    }));

    const wrapper = mountSummary();
    const amount = wrapper.get('[data-testid="price-amount"]').text();
    expect(amount).toContain('119');
    expect(amount).not.toContain('100');
  });

  it('forces the NET side for a business viewer even when the item is brutto', () => {
    authUser.account_type = 'business';
    const cart = useCartStore();
    cart.addItem(lineWith({
      netAmount: 100,
      grossAmount: 119,
      effectiveDisplayMode: 'brutto',
      pricesDisplayMode: 'brutto',
      taxes: [{ code: 'VAT', rate: '19.00', amount: 19 }],
    }));

    const wrapper = mountSummary();
    const amount = wrapper.get('[data-testid="price-amount"]').text();
    expect(amount).toContain('100');
    expect(amount).not.toContain('119');
  });

  it('omits per-line breakdowns for a HOMOGENEOUS cart (one rate — order level covers it)', () => {
    const cart = useCartStore();
    cart.addItem(lineWith({
      productId: 'a',
      netAmount: 100,
      grossAmount: 119,
      taxes: [{ code: 'VAT', rate: '19.00', amount: 19 }],
    }));
    cart.addItem(lineWith({
      productId: 'b',
      netAmount: 200,
      grossAmount: 238,
      taxes: [{ code: 'VAT', rate: '19.00', amount: 38 }],
    }));

    const wrapper = mountSummary();
    // Both lines share VAT 19% → one distinct group → homogeneous → the
    // order-level <OrderTaxSummary> (rendered by the checkout view) covers the
    // breakdown, so the line summary shows no per-line breakdown.
    expect(wrapper.find('[data-testid="price-breakdown-net"]').exists()).toBe(false);
    expect(wrapper.findAll('[data-testid="price-breakdown-tax-line"]').length).toBe(0);
  });

  it('renders a per-line breakdown for each taxed line in a HETEROGENEOUS cart', () => {
    const cart = useCartStore();
    cart.addItem(lineWith({
      productId: 'a',
      netAmount: 100,
      grossAmount: 119,
      taxes: [{ code: 'VAT', rate: '19.00', amount: 19 }],
    }));
    cart.addItem(lineWith({
      productId: 'b',
      netAmount: 200,
      grossAmount: 214,
      taxes: [{ code: 'VAT', rate: '7.00', amount: 14 }],
    }));

    const wrapper = mountSummary();
    // Two distinct rates (19% + 7%) → heterogeneous → one breakdown per taxed
    // line. Each breakdown shows that line's own net + tax (display sum only).
    const breakdowns = wrapper.findAll('[data-testid="price-breakdown-net"]');
    expect(breakdowns.length).toBe(2);
    const taxLines = wrapper.findAll('[data-testid="price-breakdown-tax-line"]');
    expect(taxLines.length).toBe(2);
    expect(wrapper.text()).toContain('19');
    expect(wrapper.text()).toContain('14');
  });

  it('shows no per-line breakdown for a taxless cart', () => {
    const cart = useCartStore();
    cart.addItem(lineWith({
      netAmount: 50,
      grossAmount: 50,
      taxes: [],
    }));

    const wrapper = mountSummary();
    expect(wrapper.findAll('[data-testid="price-breakdown-tax-line"]').length).toBe(0);
  });

  it('does NOT compute tax locally — echoes the gross the cart carries (heterogeneous)', () => {
    const cart = useCartStore();
    // A deliberately inconsistent gross (net 100 + tax 19 != gross 999): a
    // component that recomputed would show 119; the cart's gross must win. A
    // second line with a different rate makes the order heterogeneous so the
    // per-line breakdown renders.
    cart.addItem(lineWith({
      productId: 'a',
      netAmount: 100,
      grossAmount: 999,
      effectiveDisplayMode: 'brutto',
      pricesDisplayMode: 'brutto',
      taxes: [{ code: 'VAT', rate: '19.00', amount: 19 }],
    }));
    cart.addItem(lineWith({
      productId: 'b',
      netAmount: 200,
      grossAmount: 214,
      taxes: [{ code: 'VAT', rate: '7.00', amount: 14 }],
    }));

    const wrapper = mountSummary();
    expect(wrapper.text()).toContain('999');
  });
});
