/**
 * S154 P5 — ProductCatalog.vue sets its own SEO head on a category page
 * (`/shop/category/:slug`, same widget as `shop`'s template CMS page), over
 * the template's own head (the vue counterpart of theme_shop's `SeoOverrides`
 * category_context). The bare `/shop` listing (no route slug) is left alone —
 * its head belongs to the `shop` CMS page itself.
 *
 * A REAL memory router is used (as `product-catalog-filters.spec.ts`) so
 * `route.params.slug` reflects the actual navigated path.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises, RouterLinkStub } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import { api } from '@/api';
import ProductCatalog from '../../shop/views/ProductCatalog.vue';

vi.mock('@/api', () => ({ api: { get: vi.fn(), post: vi.fn() } }));

const { injectSeoMeta } = vi.hoisted(() => ({ injectSeoMeta: vi.fn() }));
vi.mock('../../../cms/src/composables/useSeoHandoff', () => ({ injectSeoMeta }));

const CATEGORY = {
  id: 'cat-1', name: 'Mugs', slug: 'mugs', description: 'Drinkware', image_url: null,
  seo_indexable: true,
};

function installApiRoutes(category: Record<string, unknown> | null) {
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url === '/config') return Promise.resolve({ site_name: 'Acme', default_currency: 'EUR' });
    if (url.startsWith('/shop/filters')) return Promise.resolve({ facets: [] });
    if (url.startsWith('/shop/categories/')) {
      return category ? Promise.resolve({ category }) : Promise.reject(new Error('404'));
    }
    if (url.startsWith('/shop/products')) return Promise.resolve({ items: [], total: 0, page: 1, per_page: 12, pages: 1 });
    return Promise.reject(new Error(`unexpected ${url}`));
  });
}

async function mountCatalog(category: Record<string, unknown> | null, initialPath = '/shop/category/mugs') {
  installApiRoutes(category);
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/shop', name: 'shop-catalog', component: { template: '<div/>' } },
      { path: '/shop/category/:slug', name: 'shop-category', component: { template: '<div/>' } },
    ],
  });
  router.push(initialPath);
  await router.isReady();
  const wrapper = mount(ProductCatalog, {
    global: { plugins: [router], stubs: { RouterLink: RouterLinkStub } },
  });
  await flushPromises();
  return wrapper;
}

function lastHead() {
  return injectSeoMeta.mock.calls[injectSeoMeta.mock.calls.length - 1][0];
}

describe('ProductCatalog category SEO head (S154 P5)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    injectSeoMeta.mockClear();
  });

  it('sets the category head over the template page head', async () => {
    await mountCatalog(CATEGORY);

    expect(lastHead()).toEqual({
      meta_title: 'Mugs — Acme',
      meta_description: 'Drinkware',
      robots: 'index,follow',
      canonical_url: `${window.location.origin}/shop/category/mugs`,
      og_title: 'Mugs — Acme',
      og_description: 'Drinkware',
      og_url: `${window.location.origin}/shop/category/mugs`,
    });
  });

  it('emits noindex,follow when the category switch is off', async () => {
    await mountCatalog({ ...CATEGORY, seo_indexable: false });

    expect(lastHead().robots).toBe('noindex,follow');
  });

  it('forces noindex,follow for an unknown category (keeps the existing listing UI)', async () => {
    const wrapper = await mountCatalog(null);

    expect(lastHead()).toEqual({ robots: 'noindex,follow' });
    // The listing UI is unchanged — still renders its own empty state, not a crash.
    expect(wrapper.find('[data-testid="product-catalog-empty"]').exists()).toBe(true);
  });

  it('does not set a category head on the bare /shop listing (no route slug)', async () => {
    await mountCatalog(CATEGORY, '/shop');

    expect(injectSeoMeta).not.toHaveBeenCalled();
  });
});
