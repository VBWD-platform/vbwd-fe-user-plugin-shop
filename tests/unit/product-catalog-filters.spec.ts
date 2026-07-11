/**
 * Catalogue-list wire contract — SHOP FRONTEND slice.
 *
 * ProductCatalog is the second consumer (after ghrm) of the shared fe-core
 * catalogue mechanism: the `<CatalogueFilterBar>` widget + the
 * `useCatalogueFilters()` URL-query composable, both exported from
 * `vbwd-view-component`. These oracle tests prove the seam end-to-end from the
 * shop's side:
 *   - on mount it fetches the shop facet descriptor (`GET /shop/filters`),
 *   - resolves each `options_endpoint` facet's options and hands them to the bar,
 *   - reads the CONTRACT envelope (`items`, NOT `products`) + `pages`,
 *   - drives all filter + pagination state through the URL query, refetching
 *     `GET /shop/products` from `queryParams` whenever the query changes.
 *
 * A REAL memory router is used (not a mock) so `router.push` from the composable
 * mutates `route.query` reactively and the component's refetch watcher fires —
 * exactly the runtime behaviour we want to lock down.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises, RouterLinkStub } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { createI18n } from 'vue-i18n';
import { createRouter, createMemoryHistory, type Router } from 'vue-router';
import { api } from '@/api';
import ProductCatalog from '../../shop/views/ProductCatalog.vue';

vi.mock('@/api', () => ({ api: { get: vi.fn(), post: vi.fn() } }));

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  missing: (_locale, key) => key,
  messages: { en: { price: { nettoTag: 'netto price' } } },
});

const FACETS_RESPONSE = {
  facets: [
    {
      key: 'category',
      label: 'Category',
      control: 'select',
      options_endpoint: '/api/v1/shop/categories',
    },
    {
      key: 'tags',
      label: 'Tags',
      control: 'chips',
      multi: true,
      and: true,
      options_endpoint: '/api/v1/shop/tags',
    },
  ],
};

const CATEGORIES_RESPONSE = {
  categories: [
    { slug: 'books', name: 'Books' },
    { slug: 'toys', name: 'Toys' },
  ],
};

const TAGS_RESPONSE = {
  tags: [
    { slug: 'sale', name: 'Sale' },
    { slug: 'new', name: 'New' },
  ],
};

function makeItem(slug: string, tags: string[] = []) {
  return {
    id: `prod-${slug}`,
    slug,
    name: `Product ${slug}`,
    price: '100.00',
    currency: 'EUR',
    primary_image_url: null,
    is_active: true,
    tags,
    pricing: {
      net_amount: '100.00',
      gross_amount: '119.00',
      effective_display_mode: 'brutto',
      prices_display_mode: 'brutto',
    },
  };
}

function envelope(items: Array<Record<string, unknown>>, pages = 1, total?: number) {
  return {
    items,
    total: total ?? items.length,
    page: 1,
    per_page: 12,
    pages,
  };
}

/**
 * Route `api.get(url)` to the right stub by path. The products call is a
 * spy-able default so tests can assert refetch params.
 */
function installApiRoutes(productsEnvelope: Record<string, unknown>) {
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url.startsWith('/shop/filters')) return Promise.resolve(FACETS_RESPONSE);
    if (url.startsWith('/shop/categories')) return Promise.resolve(CATEGORIES_RESPONSE);
    if (url.startsWith('/shop/tags')) return Promise.resolve(TAGS_RESPONSE);
    if (url.startsWith('/shop/products')) return Promise.resolve(productsEnvelope);
    return Promise.resolve({});
  });
}

function productUrls(): string[] {
  return vi.mocked(api.get).mock.calls
    .map((call) => call[0] as string)
    .filter((url) => url.startsWith('/shop/products'));
}

async function mountCatalog(
  productsEnvelope: Record<string, unknown>,
  initialPath = '/shop',
): Promise<{ wrapper: ReturnType<typeof mount>; router: Router }> {
  installApiRoutes(productsEnvelope);
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/shop', name: 'shop-catalog', component: { template: '<div/>' } },
      { path: '/shop/category/:slug', name: 'shop-category', component: { template: '<div/>' } },
      { path: '/shop/product/:slug', name: 'shop-product', component: { template: '<div/>' } },
    ],
  });
  router.push(initialPath);
  await router.isReady();
  const wrapper = mount(ProductCatalog, {
    global: {
      plugins: [i18n, router],
      stubs: { RouterLink: RouterLinkStub },
    },
  });
  await flushPromises();
  return { wrapper, router };
}

describe('ProductCatalog — catalogue-list wire contract (shop consumer)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('fetches the shop facet descriptor on mount', async () => {
    await mountCatalog(envelope([makeItem('a')]));
    const urls = vi.mocked(api.get).mock.calls.map((call) => call[0] as string);
    expect(urls.some((url) => url.startsWith('/shop/filters'))).toBe(true);
  });

  it('renders the shared CatalogueFilterBar from the descriptor', async () => {
    const { wrapper } = await mountCatalog(envelope([makeItem('a')]));
    expect(wrapper.find('[data-testid="catalogue-filter-bar"]').exists()).toBe(true);
    // category select + tag chips rendered from the descriptor + resolved options
    expect(wrapper.find('[data-testid="catalogue-facet-select-category"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="catalogue-facet-chip-tags-sale"]').exists()).toBe(true);
  });

  it('reads the CONTRACT envelope (items, not products)', async () => {
    const { wrapper } = await mountCatalog(envelope([makeItem('alpha'), makeItem('beta')]));
    expect(wrapper.find('[data-testid="product-card-alpha"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="product-card-beta"]').exists()).toBe(true);
  });

  it('requests /shop/products with page + per_page params', async () => {
    await mountCatalog(envelope([makeItem('a')]));
    const url = productUrls()[0];
    expect(url).toContain('page=1');
    expect(url).toContain('per_page=');
  });

  it('renders a pager from `pages` and navigates via setPage', async () => {
    const { wrapper, router } = await mountCatalog(envelope([makeItem('a')], 3, 30));
    const pager = wrapper.find('[data-testid="product-catalog-pager"]');
    expect(pager.exists()).toBe(true);
    await wrapper.find('[data-testid="product-catalog-next"]').trigger('click');
    await flushPromises();
    expect(Number(router.currentRoute.value.query.page)).toBe(2);
    expect(productUrls().some((url) => url.includes('page=2'))).toBe(true);
  });

  it('a facet change writes the URL query and refetches products', async () => {
    const { wrapper, router } = await mountCatalog(envelope([makeItem('a')]));
    const before = productUrls().length;
    wrapper
      .findComponent({ name: 'CatalogueFilterBar' })
      .vm.$emit('facet-change', 'category', 'books');
    await flushPromises();
    expect(router.currentRoute.value.query.category).toBe('books');
    const after = productUrls();
    expect(after.length).toBeGreaterThan(before);
    expect(after.some((url) => url.includes('category=books'))).toBe(true);
  });

  it('a tag toggle writes the tags CSV to the query and refetches', async () => {
    const { wrapper, router } = await mountCatalog(envelope([makeItem('a')]));
    wrapper
      .findComponent({ name: 'CatalogueFilterBar' })
      .vm.$emit('tag-toggle', 'sale');
    await flushPromises();
    expect(router.currentRoute.value.query.tags).toBe('sale');
    expect(productUrls().some((url) => url.includes('tags=sale'))).toBe(true);
  });

  it('seeds the category facet from a category-page route param', async () => {
    const { router } = await mountCatalog(envelope([makeItem('a')]), '/shop/category/toys');
    expect(router.currentRoute.value.query.category).toBe('toys');
    expect(productUrls().some((url) => url.includes('category=toys'))).toBe(true);
  });

  it('toggles the filter when a product card tag is clicked (ghrm parity)', async () => {
    const { wrapper, router } = await mountCatalog(envelope([makeItem('alpha', ['sale'])]));
    const cardTag = wrapper.find('[data-testid="product-card-tag-alpha-sale"]');
    expect(cardTag.exists()).toBe(true);
    await cardTag.trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.query.tags).toBe('sale');
  });
});
