/**
 * S116.3 — Storefront rendering of a product's type field values.
 *
 * When a product carries a non-null ``product_type_slug`` the detail view fetches
 * that type's descriptor (GET /shop/product-types/<slug>) and renders its
 * ``type_field_values`` as a labelled Specifications section, using the type's
 * ``product_type_fields`` for labels, ordering (sort_order) and per-type
 * formatting (url → link, boolean → yes/no, multiselect → list). A base product
 * (null slug / empty values) renders no such section — today's exact behaviour.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises, RouterLinkStub } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { createI18n } from 'vue-i18n';
import { api } from '@/api';
import ProductDetail from '../../shop/views/ProductDetail.vue';

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
  messages: {
    en: {
      price: { nettoTag: 'netto price' },
      shop: { specifications: 'Specifications', specYes: 'Yes', specNo: 'No' },
    },
  },
});

const PHARMA_TYPE = {
  id: 'type-1',
  slug: 'pharma',
  name: 'Pharma',
  description: null,
  source: 'plugin',
  is_active: true,
  product_type_fields: [
    { slug: 'strength', type: 'string', label: 'Strength', required: false, sort_order: 20 },
    { slug: 'product_class', type: 'select', label: 'Product class', required: true, sort_order: 10 },
    { slug: 'active_substances', type: 'multiselect', label: 'Active substances', required: false, sort_order: 30 },
    { slug: 'leaflet_url', type: 'url', label: 'Leaflet URL', required: false, sort_order: 40 },
    { slug: 'rx_only', type: 'boolean', label: 'Prescription only', required: false, sort_order: 50 },
    { slug: 'atc_code', type: 'string', label: 'ATC code', required: false, sort_order: 60 },
  ],
};

function makeTypedProduct(typeFieldValues: Record<string, unknown>) {
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
    product_type_slug: 'pharma',
    type_field_values: typeFieldValues,
  };
}

function mockApi(product: Record<string, unknown>, productType: Record<string, unknown> | null = PHARMA_TYPE) {
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url.startsWith('/shop/product-types/')) {
      return Promise.resolve({ product_type: productType });
    }
    return Promise.resolve({ product });
  });
}

async function mountDetail() {
  const wrapper = mount(ProductDetail, {
    global: { plugins: [i18n], stubs: { RouterLink: RouterLinkStub } },
  });
  await flushPromises();
  return wrapper;
}

describe('ProductDetail type field rendering (S116.3)', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('renders a Specifications section for a typed product', async () => {
    mockApi(makeTypedProduct({ product_class: 'RX', strength: '500mg' }));
    const wrapper = await mountDetail();
    expect(wrapper.find('[data-testid="product-detail-specs"]').exists()).toBe(true);
    const text = wrapper.get('[data-testid="product-detail-specs"]').text();
    expect(text).toContain('Product class');
    expect(text).toContain('RX');
    expect(text).toContain('Strength');
    expect(text).toContain('500mg');
  });

  it('orders spec fields by sort_order', async () => {
    mockApi(makeTypedProduct({ strength: '500mg', product_class: 'RX', atc_code: 'N02BE01' }));
    const wrapper = await mountDetail();
    const text = wrapper.get('[data-testid="product-detail-specs"]').text();
    // product_class (10) before strength (20) before atc_code (60)
    expect(text.indexOf('Product class')).toBeLessThan(text.indexOf('Strength'));
    expect(text.indexOf('Strength')).toBeLessThan(text.indexOf('ATC code'));
  });

  it('skips fields with no value', async () => {
    mockApi(makeTypedProduct({ product_class: 'RX', strength: '', atc_code: null }));
    const wrapper = await mountDetail();
    const text = wrapper.get('[data-testid="product-detail-specs"]').text();
    expect(text).toContain('Product class');
    expect(text).not.toContain('Strength');
    expect(text).not.toContain('ATC code');
  });

  it('renders a url field as an anchor', async () => {
    mockApi(makeTypedProduct({ product_class: 'RX', leaflet_url: 'https://example.test/leaflet.pdf' }));
    const wrapper = await mountDetail();
    const anchor = wrapper.get('[data-testid="product-detail-spec-leaflet_url"] a');
    expect(anchor.attributes('href')).toBe('https://example.test/leaflet.pdf');
  });

  it('renders a boolean field as yes/no', async () => {
    mockApi(makeTypedProduct({ product_class: 'RX', rx_only: true }));
    const wrapper = await mountDetail();
    expect(wrapper.get('[data-testid="product-detail-spec-rx_only"]').text()).toContain('Yes');

    vi.clearAllMocks();
    mockApi(makeTypedProduct({ product_class: 'OTC', rx_only: false }));
    const wrapper2 = await mountDetail();
    expect(wrapper2.get('[data-testid="product-detail-spec-rx_only"]').text()).toContain('No');
  });

  it('renders a multiselect field as a comma-separated list', async () => {
    mockApi(makeTypedProduct({ product_class: 'RX', active_substances: ['Ibuprofen', 'Codeine'] }));
    const wrapper = await mountDetail();
    expect(wrapper.get('[data-testid="product-detail-spec-active_substances"]').text())
      .toContain('Ibuprofen, Codeine');
  });

  it('renders no Specifications section for a base product (null slug)', async () => {
    mockApi({
      id: 'prod-2', slug: 'widget', name: 'Widget', description: '',
      price: 9.5, currency: 'EUR', primary_image_url: null, images: [], variants: [],
      has_variants: false, stock_available: 5, is_digital: false, weight: null,
      product_type_slug: null, type_field_values: {},
    });
    const wrapper = await mountDetail();
    expect(wrapper.find('[data-testid="product-detail-specs"]').exists()).toBe(false);
    // The type descriptor endpoint is never called for a base product.
    const calledTypeEndpoint = vi.mocked(api.get).mock.calls
      .some(([url]) => String(url).startsWith('/shop/product-types/'));
    expect(calledTypeEndpoint).toBe(false);
  });

  it('renders no section (and does not crash) when the type descriptor is unavailable', async () => {
    // LSP: a disabled plugin's type is simply absent — the product keeps its slug
    // and renders no extra cluster rather than crashing.
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.startsWith('/shop/product-types/')) {
        return Promise.reject(new Error('404'));
      }
      return Promise.resolve({ product: makeTypedProduct({ product_class: 'RX' }) });
    });
    const wrapper = await mountDetail();
    expect(wrapper.find('[data-testid="product-detail-error"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="product-detail-specs"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="product-detail-name"]').text()).toContain('Widget');
  });

  it('caches the type descriptor across products of the same type', async () => {
    mockApi(makeTypedProduct({ product_class: 'RX' }));
    await mountDetail();
    await mountDetail();
    const typeCalls = vi.mocked(api.get).mock.calls
      .filter(([url]) => String(url).startsWith('/shop/product-types/'));
    expect(typeCalls).toHaveLength(1);
  });
});
