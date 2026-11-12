/**
 * S154 P5 — the product and category pages' own SEO head in vue mode.
 *
 * `/shop/product/:slug` and `/shop/category/:slug` render inside the fixed CMS
 * pages `shop-product-detail` / `shop`; left alone every product/category URL
 * would carry that template page's title, description, robots and canonical
 * (the theme-mode twin of this bug: theme_shop `ShopPageSeo` / `SeoOverrides`).
 * Reuses the cms plugin's `injectSeoMeta` (updates the `data-seo="ssr"` tags in
 * place) — the same tags theme mode renders server-side. cms is a SOFT
 * dependency (like the ProductGrid/ProductDetail widget registration):
 * without it the pages still render, only the head is left as is.
 */
const TITLE_SEPARATOR = ' — ';
export const PRODUCT_PATH_PREFIX = '/shop/product/';
export const CATEGORY_PATH_PREFIX = '/shop/category/';
const PRODUCT_OG_TYPE = 'product';

/** The subset of a public product/category payload the head needs. */
export interface IndexableEntity {
  seo_indexable?: boolean;
}

export interface ProductSeoEntity extends IndexableEntity {
  name: string;
  slug: string;
  description?: string | null;
  primary_image_url?: string | null;
}

export interface CategorySeoEntity extends IndexableEntity {
  name: string;
  slug: string;
  description?: string | null;
  image_url?: string | null;
}

/** `noindex,follow` only when the entity's indexing switch (S154 D7) is off. */
export function indexableRobots(entity: IndexableEntity): string {
  return entity.seo_indexable === false ? 'noindex,follow' : 'index,follow';
}

function pageTitle(subject: string, siteName: string): string {
  return siteName ? `${subject}${TITLE_SEPARATOR}${siteName}` : subject;
}

/** The `injectSeoMeta` source for one product's own SEO head. */
export function productSeoSource(product: ProductSeoEntity, siteName: string): Record<string, string> {
  const title = pageTitle(product.name, siteName);
  const description = plainText(product.description);
  const canonicalUrl = `${window.location.origin}${PRODUCT_PATH_PREFIX}${product.slug}`;
  const source: Record<string, string> = {
    meta_title: title,
    meta_description: description,
    robots: indexableRobots(product),
    canonical_url: canonicalUrl,
    og_title: title,
    og_description: description,
    og_url: canonicalUrl,
    og_type: PRODUCT_OG_TYPE,
  };
  if (product.primary_image_url) {
    source.og_image_url = product.primary_image_url;
  }
  return source;
}

/** The `injectSeoMeta` source for one category's own SEO head. */
export function categorySeoSource(category: CategorySeoEntity, siteName: string): Record<string, string> {
  const title = pageTitle(category.name, siteName);
  const description = plainText(category.description);
  const canonicalUrl = `${window.location.origin}${CATEGORY_PATH_PREFIX}${category.slug}`;
  const source: Record<string, string> = {
    meta_title: title,
    meta_description: description,
    robots: indexableRobots(category),
    canonical_url: canonicalUrl,
    og_title: title,
    og_description: description,
    og_url: canonicalUrl,
  };
  if (category.image_url) {
    source.og_image_url = category.image_url;
  }
  return source;
}

/** Apply a head source through the cms seam; a no-op when cms is not installed. */
export async function applySeoHead(source: Record<string, string>): Promise<void> {
  try {
    const { injectSeoMeta } = await import('../../cms/src/composables/useSeoHandoff');
    injectSeoMeta(source);
  } catch {
    // cms plugin not installed — keep the document head as is.
  }
}

/** Plain text of an HTML/plain description (tags dropped, entities decoded). */
export function plainText(html: string | null | undefined): string {
  if (!html) return '';
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  return (parsed.body.textContent ?? '').replace(/\s+/g, ' ').trim();
}
