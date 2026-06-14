/**
 * S72.4 — netto/brutto wiring in the shop product-detail price surface.
 *
 * ProductDetail renders the shared <PriceDisplay> fed by the product ``pricing``
 * block (net_amount/gross_amount + effective/global display modes). These oracle
 * tests assert the net-vs-gross choice and the "netto price" tag for the three
 * modes, using the real detail component + a mocked product fetch.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises, RouterLinkStub } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { createI18n } from 'vue-i18n';
import { api } from '@/api';
import ProductDetail from '../../shop/views/ProductDetail.vue';
import { useCartStore } from '../../shop/stores/cart';

vi.mock('@/api', () => ({ api: { get: vi.fn(), post: vi.fn() } }));
vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { slug: 'widget' } }),
  useRouter: () => ({ push: vi.fn() }),
}));

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  missing: (_locale, key) => key,
  messages: { en: { price: { nettoTag: 'netto price' } } },
});

function makeProduct(pricing: Record<string, unknown>) {
  return {
    id: 'prod-1',
    slug: 'widget',
    name: 'Widget',
    description: 'A widget',
    price: 100,
    currency: 'EUR',
    primary_image_url: null,
    images: [],
    variants: [],
    has_variants: false,
    stock_available: 5,
    is_digital: false,
    weight: null,
    pricing,
  };
}

async function mountWithPricing(pricing: Record<string, unknown>) {
  vi.mocked(api.get).mockResolvedValue({ product: makeProduct(pricing) });
  const wrapper = mount(ProductDetail, {
    global: {
      plugins: [i18n],
      stubs: { RouterLink: RouterLinkStub },
    },
  });
  await flushPromises();
  return wrapper;
}

describe('ProductDetail price display (S72.4)', () => {
  beforeEach(() => {
    // Reset the localStorage-backed cart between tests so add-to-cart assertions
    // don't see lines persisted by a prior test (the store loads from storage).
    localStorage.clear();
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('shows the NET amount + netto tag for a netto product under a brutto global', async () => {
    const wrapper = await mountWithPricing({
      net_amount: '100.00',
      gross_amount: '119.00',
      effective_display_mode: 'netto',
      prices_display_mode: 'brutto',
    });
    const amount = wrapper.get('[data-testid="price-amount"]').text();
    expect(amount).toContain('100');
    expect(amount).not.toContain('119');
    expect(wrapper.find('[data-testid="price-netto-tag"]').exists()).toBe(true);
  });

  it('shows the GROSS amount and no tag for a brutto product', async () => {
    const wrapper = await mountWithPricing({
      net_amount: '100.00',
      gross_amount: '119.00',
      effective_display_mode: 'brutto',
      prices_display_mode: 'brutto',
    });
    const amount = wrapper.get('[data-testid="price-amount"]').text();
    expect(amount).toContain('119');
    expect(amount).not.toContain('100');
    expect(wrapper.find('[data-testid="price-netto-tag"]').exists()).toBe(false);
  });

  it('shows net everywhere and no tag under a global netto', async () => {
    const wrapper = await mountWithPricing({
      net_amount: '100.00',
      gross_amount: '119.00',
      effective_display_mode: 'netto',
      prices_display_mode: 'netto',
    });
    const amount = wrapper.get('[data-testid="price-amount"]').text();
    expect(amount).toContain('100');
    expect(wrapper.find('[data-testid="price-netto-tag"]').exists()).toBe(false);
  });

  // S85.4 — add-to-cart threads the product's net/gross/taxes/display-mode split
  // into the cart item so the checkout summary can disclose tax + viewer side.
  it('threads the pricing split into the cart item on add-to-cart', async () => {
    const wrapper = await mountWithPricing({
      net_amount: '100.00',
      gross_amount: '119.00',
      effective_display_mode: 'netto',
      prices_display_mode: 'brutto',
      taxes: [{ code: 'VAT', rate: '19.00', amount: '19.00' }],
    });

    await wrapper.get('[data-testid="product-detail-add-to-cart"]').trigger('click');

    const cart = useCartStore();
    expect(cart.items).toHaveLength(1);
    const line = cart.items[0];
    expect(line.netAmount).toBeCloseTo(100);
    expect(line.grossAmount).toBeCloseTo(119);
    expect(line.effectiveDisplayMode).toBe('netto');
    expect(line.pricesDisplayMode).toBe('brutto');
    expect(line.taxes).toEqual([{ code: 'VAT', rate: '19.00', amount: 19 }]);
  });

  // S85.1 regression — the product payload no longer carries ``price_float``.
  // The cart line ``price`` must be the GROSS charge basis (D8) from the pricing
  // block, not ``undefined`` (which rendered €0.00 lines + a €0.00 subtotal).
  it('sets the cart line price to gross when the payload has no price_float', async () => {
    vi.mocked(api.get).mockResolvedValue({
      product: {
        id: 'prod-1', slug: 'widget', name: 'Widget', description: '',
        // No ``price_float`` — exactly the post-S85.1 payload shape.
        price: 18.99, currency: 'EUR',
        primary_image_url: null, images: [], variants: [],
        has_variants: false, stock_available: 5, is_digital: false, weight: null,
        pricing: {
          net_amount: '18.99',
          gross_amount: '22.60',
          effective_display_mode: 'brutto',
          prices_display_mode: 'brutto',
          taxes: [{ code: 'VAT', rate: '19.00', amount: '3.61' }],
        },
      },
    });
    const wrapper = mount(ProductDetail, {
      global: { plugins: [i18n], stubs: { RouterLink: RouterLinkStub } },
    });
    await flushPromises();

    await wrapper.get('[data-testid="product-detail-add-to-cart"]').trigger('click');

    const cart = useCartStore();
    const line = cart.items[0];
    expect(line.price).toBeCloseTo(22.6);
    expect(line.price).not.toBe(0);
    // The net/gross/taxes split stays threaded unchanged.
    expect(line.netAmount).toBeCloseTo(18.99);
    expect(line.grossAmount).toBeCloseTo(22.6);
    expect(line.taxes).toEqual([{ code: 'VAT', rate: '19.00', amount: 3.61 }]);
    // The whole point: the subtotal is the real money, not €0.00.
    expect(cart.subtotal).toBeCloseTo(22.6);
  });

  // Falls back to the raw ``price`` when no pricing block is present.
  it('falls back to the raw product price when there is no pricing block', async () => {
    vi.mocked(api.get).mockResolvedValue({
      product: {
        id: 'prod-2', slug: 'widget', name: 'Widget', description: '',
        price: 9.5, currency: 'EUR',
        primary_image_url: null, images: [], variants: [],
        has_variants: false, stock_available: 5, is_digital: false, weight: null,
      },
    });
    const wrapper = mount(ProductDetail, {
      global: { plugins: [i18n], stubs: { RouterLink: RouterLinkStub } },
    });
    await flushPromises();

    await wrapper.get('[data-testid="product-detail-add-to-cart"]').trigger('click');

    const cart = useCartStore();
    expect(cart.items[0].price).toBeCloseTo(9.5);
    expect(cart.subtotal).toBeCloseTo(9.5);
  });

  // A selected variant still carries its own ``price_float`` after S85.1; use it.
  it('uses the selected variant price when the product has variants', async () => {
    vi.mocked(api.get).mockResolvedValue({
      product: {
        id: 'prod-3', slug: 'widget', name: 'Widget', description: '',
        price: 18.99, currency: 'EUR',
        primary_image_url: null, images: [],
        variants: [{
          id: 'var-1', name: 'Large', sku: 'W-L',
          price: '25.00', price_float: 25, attributes: {}, stock_available: 3,
        }],
        has_variants: true, is_digital: false, weight: null,
        pricing: { net_amount: '18.99', gross_amount: '22.60' },
      },
    });
    const wrapper = mount(ProductDetail, {
      global: { plugins: [i18n], stubs: { RouterLink: RouterLinkStub } },
    });
    await flushPromises();

    await wrapper.get('[data-testid="product-detail-add-to-cart"]').trigger('click');

    const cart = useCartStore();
    expect(cart.items[0].price).toBeCloseTo(25);
    expect(cart.subtotal).toBeCloseTo(25);
  });

  it('omits the split for a product with no pricing block', async () => {
    vi.mocked(api.get).mockResolvedValue({
      product: {
        id: 'prod-1', slug: 'widget', name: 'Widget', description: '',
        price: 100, currency: 'EUR',
        primary_image_url: null, images: [], variants: [],
        has_variants: false, stock_available: 5, is_digital: false, weight: null,
      },
    });
    const wrapper = mount(ProductDetail, {
      global: { plugins: [i18n], stubs: { RouterLink: RouterLinkStub } },
    });
    await flushPromises();

    await wrapper.get('[data-testid="product-detail-add-to-cart"]').trigger('click');

    const cart = useCartStore();
    const line = cart.items[0];
    expect(line.netAmount).toBeUndefined();
    expect(line.grossAmount).toBeUndefined();
    expect(line.taxes).toBeUndefined();
  });
});
