<template>
  <div
    class="product-catalog"
    data-testid="product-catalog"
  >
    <h1 class="product-catalog__heading">
      Shop
    </h1>

    <div class="product-catalog__toolbar">
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Search products..."
        class="product-catalog__search"
        data-testid="product-catalog-search"
        @input="debouncedSearch"
      >

      <select
        v-model="selectedSort"
        class="product-catalog__sort"
        data-testid="product-catalog-sort"
        @change="fetchProducts"
      >
        <option value="name_asc">
          Name A–Z
        </option>
        <option value="name_desc">
          Name Z–A
        </option>
        <option value="price_asc">
          Price: Low → High
        </option>
        <option value="price_desc">
          Price: High → Low
        </option>
        <option value="newest">
          Newest
        </option>
      </select>
    </div>

    <div
      v-if="loading"
      class="product-catalog__loading"
      data-testid="product-catalog-loading"
    >
      Loading products...
    </div>

    <div
      v-else-if="error"
      class="product-catalog__error"
      data-testid="product-catalog-error"
    >
      {{ error }}
    </div>

    <div
      v-else-if="products.length === 0"
      class="product-catalog__empty"
      data-testid="product-catalog-empty"
    >
      No products found.
    </div>

    <div
      v-else
      class="product-catalog__grid"
      data-testid="product-catalog-grid"
    >
      <router-link
        v-for="product in products"
        :key="product.id"
        :to="{ name: 'shop-product', params: { slug: product.slug } }"
        class="product-card"
        :data-testid="`product-card-${product.slug}`"
      >
        <img
          v-if="product.primary_image_url"
          :src="product.primary_image_url"
          :alt="product.name"
          class="product-card__image"
        >
        <div
          v-else
          class="product-card__image product-card__image--placeholder"
        />

        <div class="product-card__body">
          <h3
            class="product-card__name"
            data-testid="product-card-name"
          >
            {{ product.name }}
          </h3>
          <p
            class="product-card__price"
            data-testid="product-card-price"
          >
            {{ formatPrice(product.price, product.currency) }}
          </p>
        </div>
      </router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '@/api';

interface ProductListItem {
  id: string;
  slug: string;
  name: string;
  price: string;
  currency: string;
  primary_image_url: string | null;
  is_active: boolean;
}

const route = useRoute();

const loading = ref(true);
const error = ref<string | null>(null);
const products = ref<ProductListItem[]>([]);
const searchQuery = ref('');
const selectedSort = ref('newest');

let searchTimeout: ReturnType<typeof setTimeout> | null = null;

function debouncedSearch() {
  if (searchTimeout) clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    fetchProducts();
  }, 300);
}

async function fetchProducts() {
  loading.value = true;
  error.value = null;
  try {
    const params = new URLSearchParams();
    if (searchQuery.value) params.set('search', searchQuery.value);
    if (selectedSort.value) params.set('sort', selectedSort.value);

    const categorySlug = route.params.slug as string | undefined;
    if (categorySlug) params.set('category', categorySlug);

    const queryString = params.toString();
    const url = `/shop/products${queryString ? `?${queryString}` : ''}`;
    const response = await api.get(url) as { products: ProductListItem[] };
    products.value = response.products;
  } catch (fetchError) {
    error.value = (fetchError as Error).message || 'Failed to load products';
  } finally {
    loading.value = false;
  }
}

function formatPrice(price: string | number, currency: string): string {
  const num = typeof price === 'string' ? parseFloat(price) : price;
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'EUR' }).format(num);
}

onMounted(fetchProducts);
</script>

<style scoped>
.product-catalog {
  max-width: 1200px;
  margin: 0 auto;
  padding: 1.5rem;
}

.product-catalog__heading {
  font-size: 1.75rem;
  font-weight: 700;
  margin-bottom: 1.5rem;
}

.product-catalog__toolbar {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}

.product-catalog__search {
  flex: 1;
  min-width: 200px;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--vbwd-border-color, #ddd);
  border-radius: 4px;
  font-size: 0.9375rem;
}

.product-catalog__sort {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--vbwd-border-color, #ddd);
  border-radius: 4px;
  font-size: 0.9375rem;
  background: white;
}

.product-catalog__loading,
.product-catalog__error,
.product-catalog__empty {
  padding: 2rem;
  text-align: center;
  color: var(--vbwd-text-secondary, #666);
}

.product-catalog__error {
  color: var(--vbwd-color-danger, #dc3545);
}

.product-catalog__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 1.5rem;
}

.product-card {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--vbwd-border-color, #ddd);
  border-radius: 8px;
  overflow: hidden;
  text-decoration: none;
  color: inherit;
  transition: box-shadow 0.15s;
}

.product-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.product-card__image {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
}

.product-card__image--placeholder {
  background: var(--vbwd-bg-muted, #f0f0f0);
}

.product-card__body {
  padding: 0.75rem 1rem 1rem;
}

.product-card__name {
  font-size: 0.9375rem;
  font-weight: 600;
  margin: 0 0 0.5rem;
  line-height: 1.3;
}

.product-card__price {
  font-size: 1rem;
  font-weight: 700;
  color: var(--vbwd-color-primary, #333);
  margin: 0;
}

@media (max-width: 640px) {
  .product-catalog__grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 0.75rem;
  }
}
</style>
