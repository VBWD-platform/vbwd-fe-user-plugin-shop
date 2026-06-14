/**
 * S72.4 follow-up — netto/brutto wiring in the shop product-catalog LIST cards.
 *
 * ProductCatalog renders the shared <PriceDisplay> on each product card, fed by
 * the per-item ``pricing`` block (net_amount/gross_amount + effective/global
 * display modes) embedded by the list endpoint. These oracle tests assert the
 * net-vs-gross choice and the "netto price" tag for the three modes, plus a
 * graceful fallback when an (older-cached) item has no ``pricing`` block — using
 * the real catalog component + a mocked products fetch.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises, RouterLinkStub } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { createI18n } from 'vue-i18n';
import { api } from '@/api';
import ProductCatalog from '../../shop/views/ProductCatalog.vue';

vi.mock('@/api', () => ({ api: { get: vi.fn(), post: vi.fn() } }));
vi.mock('vue-router', () => ({
  useRoute: () => ({ params: {} }),
  useRouter: () => ({ push: vi.fn() }),
}));

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  missing: (_locale, key) => key,
  messages: { en: { price: { nettoTag: 'netto price' } } },
});

function makeProduct(slug: string, pricing?: Record<string, unknown>) {
  return {
    id: `prod-${slug}`,
    slug,
    name: `Product ${slug}`,
    price: '100.00',
    currency: 'EUR',
    primary_image_url: null,
    is_active: true,
    ...(pricing ? { pricing } : {}),
  };
}

async function mountWithProducts(products: Array<Record<string, unknown>>) {
  vi.mocked(api.get).mockResolvedValue({ products });
  const wrapper = mount(ProductCatalog, {
    global: {
      plugins: [i18n],
      stubs: { RouterLink: RouterLinkStub },
    },
  });
  await flushPromises();
  return wrapper;
}

describe('ProductCatalog card price display (S72.4 follow-up)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('shows the NET amount + netto tag for a netto card under a brutto global', async () => {
    const wrapper = await mountWithProducts([
      makeProduct('netto-one', {
        net_amount: '100.00',
        gross_amount: '119.00',
        effective_display_mode: 'netto',
        prices_display_mode: 'brutto',
      }),
    ]);
    const amount = wrapper.get('[data-testid="price-amount"]').text();
    expect(amount).toContain('100');
    expect(amount).not.toContain('119');
    expect(wrapper.find('[data-testid="price-netto-tag"]').exists()).toBe(true);
  });

  it('shows the GROSS amount and no tag for a brutto card', async () => {
    const wrapper = await mountWithProducts([
      makeProduct('brutto-one', {
        net_amount: '100.00',
        gross_amount: '119.00',
        effective_display_mode: 'brutto',
        prices_display_mode: 'brutto',
      }),
    ]);
    const amount = wrapper.get('[data-testid="price-amount"]').text();
    expect(amount).toContain('119');
    expect(amount).not.toContain('100');
    expect(wrapper.find('[data-testid="price-netto-tag"]').exists()).toBe(false);
  });

  it('renders a price gracefully when a card has no pricing block', async () => {
    const wrapper = await mountWithProducts([makeProduct('no-pricing')]);
    const amount = wrapper.get('[data-testid="price-amount"]').text();
    expect(amount).toContain('100');
    expect(wrapper.find('[data-testid="price-netto-tag"]').exists()).toBe(false);
  });
});
