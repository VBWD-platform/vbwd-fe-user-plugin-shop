/**
 * S154 P5 — the shop seoHead module: `productSeoSource` / `categorySeoSource`
 * build the `injectSeoMeta` source (title, description, self canonical, robots
 * from `seo_indexable`, og tags); `applySeoHead` is a no-op when the cms
 * plugin (a SOFT dependency) is not installed.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  applySeoHead,
  categorySeoSource,
  indexableRobots,
  plainText,
  productSeoSource,
} from '../../shop/seoHead';

const { injectSeoMeta } = vi.hoisted(() => ({ injectSeoMeta: vi.fn() }));
vi.mock('../../../cms/src/composables/useSeoHandoff', () => ({ injectSeoMeta }));

describe('indexableRobots (S154 D7)', () => {
  it('is index,follow by default (older backend, flag absent)', () => {
    expect(indexableRobots({})).toBe('index,follow');
  });

  it('is noindex,follow when seo_indexable is explicitly false', () => {
    expect(indexableRobots({ seo_indexable: false })).toBe('noindex,follow');
  });

  it('is index,follow when seo_indexable is true', () => {
    expect(indexableRobots({ seo_indexable: true })).toBe('index,follow');
  });
});

describe('plainText', () => {
  it('strips tags and collapses whitespace', () => {
    expect(plainText('<p>A  sturdy\n ceramic</p> <b>mug</b>')).toBe('A sturdy ceramic mug');
  });

  it('is empty for null/undefined', () => {
    expect(plainText(null)).toBe('');
    expect(plainText(undefined)).toBe('');
  });
});

describe('productSeoSource', () => {
  it('builds title, description, canonical, robots and og:type=product', () => {
    const source = productSeoSource(
      { name: 'Mug', slug: 'mug', description: '<p>A sturdy mug</p>', primary_image_url: 'https://x/mug.png', seo_indexable: true },
      'Acme',
    );

    expect(source).toEqual({
      meta_title: 'Mug — Acme',
      meta_description: 'A sturdy mug',
      robots: 'index,follow',
      canonical_url: `${window.location.origin}/shop/product/mug`,
      og_title: 'Mug — Acme',
      og_description: 'A sturdy mug',
      og_url: `${window.location.origin}/shop/product/mug`,
      og_type: 'product',
      og_image_url: 'https://x/mug.png',
    });
  });

  it('omits og_image_url when the product has no image', () => {
    const source = productSeoSource({ name: 'Mug', slug: 'mug' }, 'Acme');
    expect(source.og_image_url).toBeUndefined();
  });

  it('uses the bare subject when there is no site name', () => {
    const source = productSeoSource({ name: 'Mug', slug: 'mug' }, '');
    expect(source.meta_title).toBe('Mug');
  });
});

describe('categorySeoSource', () => {
  it('builds title, description, canonical and robots (no og:type)', () => {
    const source = categorySeoSource(
      { name: 'Mugs', slug: 'mugs', description: 'Drinkware', seo_indexable: false },
      'Acme',
    );

    expect(source).toEqual({
      meta_title: 'Mugs — Acme',
      meta_description: 'Drinkware',
      robots: 'noindex,follow',
      canonical_url: `${window.location.origin}/shop/category/mugs`,
      og_title: 'Mugs — Acme',
      og_description: 'Drinkware',
      og_url: `${window.location.origin}/shop/category/mugs`,
    });
    expect(source.og_type).toBeUndefined();
  });
});

describe('applySeoHead — cms is a SOFT dependency', () => {
  beforeEach(() => {
    injectSeoMeta.mockClear();
  });

  it('forwards the source to the cms injectSeoMeta seam', async () => {
    await applySeoHead({ meta_title: 'Mug' });
    expect(injectSeoMeta).toHaveBeenCalledWith({ meta_title: 'Mug' });
  });

  it('does not throw when the cms plugin is not installed (dynamic import rejects)', async () => {
    vi.doMock('../../../cms/src/composables/useSeoHandoff', () => {
      throw new Error('cms plugin not installed');
    });
    vi.resetModules();
    const { applySeoHead: applySeoHeadFresh } = await import('../../shop/seoHead');

    await expect(applySeoHeadFresh({ meta_title: 'Mug' })).resolves.toBeUndefined();

    vi.doUnmock('../../../cms/src/composables/useSeoHandoff');
    vi.resetModules();
  });
});
