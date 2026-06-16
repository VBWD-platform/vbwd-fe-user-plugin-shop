/**
 * S96.4 (S1) — the shop cart line discloses the netto/tax/brutto split.
 *
 * Before S96.4 the cart line passed ``item.price`` for BOTH net and gross to
 * <PriceDisplay> (collapsing net == gross) and rendered no per-line breakdown,
 * even though each cart item already carries the product's computed
 * ``netAmount``/``grossAmount``/``taxes`` split (threaded at add-to-cart, S85.4).
 *
 * These oracles mount the real Cart view against the real shop cart store and a
 * stubbed auth store, asserting that the cart line:
 *   - feeds the real net/gross to <PriceDisplay> (anonymous viewer ⇒ gross side),
 *   - forces the net side for a business viewer (D9 overlay),
 *   - renders a per-line <PriceBreakdown> for a taxed item (net + tax rate),
 *   - renders NO breakdown for an untaxed item (net == gross),
 *   - never recomputes tax — it echoes the cart's (deliberately inconsistent)
 *     gross rather than net + tax.
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

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import Cart from '../../shop/views/Cart.vue';
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

function mountCart() {
  return mount(Cart, {
    global: {
      plugins: [i18n],
      stubs: { 'router-link': true },
    },
  });
}

describe('Cart.vue per-line tax display (S96.4)', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
    authUser.account_type = undefined;
    vi.clearAllMocks();
  });

  it('shows the GROSS side for a brutto line to an anonymous viewer', () => {
    const cart = useCartStore();
    cart.addItem(lineWith({
      netAmount: 100,
      grossAmount: 119,
      effectiveDisplayMode: 'brutto',
      pricesDisplayMode: 'brutto',
      taxes: [{ code: 'VAT', rate: '19.00', amount: 19 }],
    }));

    const wrapper = mountCart();
    // The unit-price <PriceDisplay> must show 119 (gross), not 100.
    const amounts = wrapper.findAll('[data-testid="price-amount"]').map((node) => node.text());
    expect(amounts.some((text) => text.includes('119'))).toBe(true);
    expect(amounts.some((text) => text.includes('100'))).toBe(false);
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

    const wrapper = mountCart();
    const amounts = wrapper.findAll('[data-testid="price-amount"]').map((node) => node.text());
    expect(amounts.some((text) => text.includes('100'))).toBe(true);
    expect(amounts.some((text) => text.includes('119'))).toBe(false);
  });

  it('renders a per-line breakdown (net + tax rate) for a taxed cart line', () => {
    const cart = useCartStore();
    cart.addItem(lineWith({
      netAmount: 100,
      grossAmount: 119,
      taxes: [{ code: 'VAT', rate: '19.00', amount: 19 }],
    }));

    const wrapper = mountCart();
    expect(wrapper.find('[data-testid="price-breakdown-net"]').exists()).toBe(true);
    const taxLines = wrapper.findAll('[data-testid="price-breakdown-tax-line"]');
    expect(taxLines.length).toBe(1);
    expect(wrapper.text()).toContain('19');
  });

  it('renders NO breakdown for an untaxed cart line (net == gross)', () => {
    const cart = useCartStore();
    cart.addItem(lineWith({
      price: 50,
      netAmount: 50,
      grossAmount: 50,
      taxes: [],
    }));

    const wrapper = mountCart();
    expect(wrapper.find('[data-testid="price-breakdown-net"]').exists()).toBe(false);
    expect(wrapper.findAll('[data-testid="price-breakdown-tax-line"]').length).toBe(0);
  });

  it('falls back to the bare price (net == gross, no breakdown) when the item carries no split', () => {
    const cart = useCartStore();
    cart.addItem(lineWith({ price: 79.99 }));

    const wrapper = mountCart();
    expect(wrapper.find('[data-testid="price-breakdown-net"]').exists()).toBe(false);
    const amounts = wrapper.findAll('[data-testid="price-amount"]').map((node) => node.text());
    expect(amounts.some((text) => text.includes('79.99'))).toBe(true);
  });

  it('does NOT compute tax locally — echoes the cart gross even when inconsistent', () => {
    const cart = useCartStore();
    // net 100 + tax 19 != gross 999: a component that recomputed gross would show
    // 119; the cart's gross (999) must win for an anonymous brutto viewer.
    cart.addItem(lineWith({
      netAmount: 100,
      grossAmount: 999,
      effectiveDisplayMode: 'brutto',
      pricesDisplayMode: 'brutto',
      taxes: [{ code: 'VAT', rate: '19.00', amount: 19 }],
    }));

    const wrapper = mountCart();
    expect(wrapper.text()).toContain('999');
  });
});
