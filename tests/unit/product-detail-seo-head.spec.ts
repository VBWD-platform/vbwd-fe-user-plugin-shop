/**
 * S154 P5 — ProductDetail.vue sets its own SEO head over the `shop-product-detail`
 * template CMS page (the vue counterpart of theme_shop's `SeoOverrides`).
 *
 * Title "<name> — <site>", plain-text description, self canonical
 * (`/shop/product/<slug>`), robots from `seo_indexable` (S154 D7), og:title /
 * og:description / og:url / og:image / og:type=product. Injected through the
 * cms `injectSeoMeta` seam — a SOFT dependency: no crash when cms is absent.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises, RouterLinkStub } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { createI18n } from 'vue-i18n';
import { api } from '@/api';
import ProductDetail from '../../shop/views/ProductDetail.vue';

vi.mock('@/api', () => ({ api: { get: vi.fn(), post: vi.fn() } }));
vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { slug: 'mug' } }),
  useRouter: () => ({ push: vi.fn() }),
}));

const { injectSeoMeta } = vi.hoisted(() => ({ injectSeoMeta: vi.fn() }));
vi.mock('../../../cms/src/composables/useSeoHandoff', () => ({ injectSeoMeta }));

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  missing: (_locale, key) => key,
  messages: { en: { shop: { specifications: 'Specifications', specYes: 'Yes', specNo: 'No' } } },
});

function makeProduct(overrides: Record<string, unknown> = {}) {
  return {
    id: 'prod-1',
    slug: 'mug',
    name: 'Mug',
    description: '<p>A sturdy ceramic mug</p>',
    price: 9.5,
    currency: 'EUR',
    primary_image_url: 'https://cdn.example.test/mug.png',
    images: [],
    variants: [],
    has_variants: false,
    stock_available: 5,
    weight: null,
    product_type_slug: null,
    type_field_values: {},
    seo_indexable: true,
    ...overrides,
  };
}

function mockApi(product: Record<string, unknown>) {
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url === '/config') return Promise.resolve({ site_name: 'Acme', default_currency: 'EUR' });
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

function lastHead() {
  return injectSeoMeta.mock.calls[injectSeoMeta.mock.calls.length - 1][0];
}

describe('ProductDetail own SEO head (S154 P5)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    injectSeoMeta.mockClear();
  });

  it('sets title, description, canonical, robots and og tags', async () => {
    mockApi(makeProduct());
    await mountDetail();

    expect(lastHead()).toEqual({
      meta_title: 'Mug — Acme',
      meta_description: 'A sturdy ceramic mug',
      robots: 'index,follow',
      canonical_url: `${window.location.origin}/shop/product/mug`,
      og_title: 'Mug — Acme',
      og_description: 'A sturdy ceramic mug',
      og_url: `${window.location.origin}/shop/product/mug`,
      og_type: 'product',
      og_image_url: 'https://cdn.example.test/mug.png',
    });
  });

  it('emits noindex,follow when seo_indexable is false', async () => {
    mockApi(makeProduct({ seo_indexable: false }));
    await mountDetail();

    expect(lastHead().robots).toBe('noindex,follow');
  });

  it('defaults to indexable when seo_indexable is absent (older backend)', async () => {
    const product = makeProduct();
    delete (product as Record<string, unknown>).seo_indexable;
    mockApi(product);
    await mountDetail();

    expect(lastHead().robots).toBe('index,follow');
  });
});
