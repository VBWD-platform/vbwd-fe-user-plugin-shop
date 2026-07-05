import { defineStore } from 'pinia';
import { getProductType, type ProductType } from '../api/productTypes';

/**
 * S116.3 — product-type descriptor cache.
 *
 * Product-type descriptors are immutable within a page session and shared by
 * every product of that type, so the storefront fetches each type at most once
 * and serves subsequent reads from the cache (keyed by slug).
 */
export const useProductTypeStore = defineStore('shopProductTypes', {
  state: () => ({
    cache: {} as Record<string, ProductType>,
  }),

  actions: {
    /** Return the cached descriptor for ``slug``, fetching + caching on a miss. */
    async loadProductType(slug: string): Promise<ProductType> {
      const cached = this.cache[slug];
      if (cached) {
        return cached;
      }
      const productType = await getProductType(slug);
      this.cache[slug] = productType;
      return productType;
    },
  },
});
