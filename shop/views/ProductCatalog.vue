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
        v-model="searchMirror"
        type="text"
        placeholder="Search products..."
        class="product-catalog__search"
        data-testid="product-catalog-search"
        @input="onSearchInput"
      >

      <select
        v-model="selectedSort"
        class="product-catalog__sort"
        data-testid="product-catalog-sort"
        @change="loadProducts"
      >
        <option value="newest">
          Newest
        </option>
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
      </select>
    </div>

    <CatalogueFilterBar
      v-if="facets.length"
      :facets="facets"
      :values="filters.values.value"
      :tags="filters.activeTags.value"
      :resolved-options="resolvedOptions"
      @facet-change="onFacetChange"
      @tag-toggle="onTagToggle"
    />

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
      v-else-if="items.length === 0"
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
        v-for="product in items"
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
            <PriceDisplay
              convert-to-display
              :effective-display-mode="product.pricing?.effective_display_mode"
              :global-mode="product.pricing?.prices_display_mode"
              :net-amount="product.pricing?.net_amount ?? product.price"
              :gross-amount="product.pricing?.gross_amount ?? product.price"
              :currency="product.currency"
            />
          </p>
          <div
            v-if="product.tags && product.tags.length"
            class="product-card__tags"
          >
            <button
              v-for="tag in product.tags"
              :key="tag"
              type="button"
              class="product-card__tag"
              :class="{ 'product-card__tag--active': filters.activeTags.value.includes(tag) }"
              :data-testid="`product-card-tag-${product.slug}-${tag}`"
              @click.stop.prevent="onTagToggle(tag)"
            >
              {{ tagLabel(tag) }}
            </button>
          </div>
        </div>
      </router-link>
    </div>

    <div
      v-if="pages > 1"
      class="product-catalog__pager"
      data-testid="product-catalog-pager"
    >
      <button
        type="button"
        data-testid="product-catalog-prev"
        :disabled="filters.page.value <= 1"
        @click="filters.setPage(filters.page.value - 1)"
      >
        ←
      </button>
      <span>{{ filters.page.value }} / {{ pages }}</span>
      <button
        type="button"
        data-testid="product-catalog-next"
        :disabled="filters.page.value >= pages"
        @click="filters.setPage(filters.page.value + 1)"
      >
        →
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useCatalogueFilters, CatalogueFilterBar } from 'vbwd-view-component';
import type { FacetDescriptor, FacetOption } from 'vbwd-view-component';
import { api } from '@/api';
import PriceDisplay from '@/components/PriceDisplay.vue';

interface ProductListItem {
  id: string;
  slug: string;
  name: string;
  price: string;
  currency: string;
  primary_image_url: string | null;
  is_active: boolean;
  tags?: string[];
  // S72.4 netto/brutto display (embedded by the list endpoint)
  pricing?: {
    net_amount: string;
    gross_amount: string;
    effective_display_mode?: 'netto' | 'brutto';
    prices_display_mode?: 'netto' | 'brutto';
  };
}

interface CatalogueEnvelope {
  items: ProductListItem[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

// The CMS vue-component widget renderer spreads the seeded content_json.props
// onto this component, so an operator-configured page size arrives as a prop.
const props = defineProps<{ items_per_page?: number }>();

const DEFAULT_PER_PAGE = 12;
// The base URL the api client already prepends; descriptor endpoints are
// absolute (contract §4) so we strip it before calling api.get.
const API_PREFIX = '/api/v1';

const route = useRoute();
const perPage = computed(() => props.items_per_page ?? DEFAULT_PER_PAGE);
const filters = useCatalogueFilters({ perPage });

const loading = ref(true);
const error = ref<string | null>(null);
const items = ref<ProductListItem[]>([]);
const pages = ref(1);
const facets = ref<FacetDescriptor[]>([]);
const resolvedOptions = ref<Record<string, FacetOption[]>>({});
// Sort has no descriptor facet (the backend does not sort yet); it stays a
// local control merged into the request params so the UI never regresses.
const selectedSort = ref('newest');
// Local mirror of the URL `q` — the input debounces before pushing to the URL.
const searchMirror = ref(filters.query.value);

function tagLabel(slug: string): string {
  return resolvedOptions.value.tags?.find((option) => option.value === slug)?.label ?? slug;
}

// Map a dynamic options response ({ "<key>s": [...] }) to the fe-core
// { value, label } shape. The response carries a single array under a
// vocabulary key we do not hard-code, so we take the first array value.
function mapOptions(response: Record<string, unknown>): FacetOption[] {
  const list = Object.values(response).find((value) => Array.isArray(value)) as
    | Array<Record<string, unknown>>
    | undefined;
  if (!list) return [];
  return list.map((option) => ({
    value: String(option.value ?? option.slug ?? ''),
    label: String(option.label ?? option.name ?? option.value ?? option.slug ?? ''),
  }));
}

async function loadFacets(): Promise<void> {
  const response = (await api.get('/shop/filters')) as { facets?: FacetDescriptor[] };
  facets.value = response.facets ?? [];
  await Promise.all(
    facets.value
      .filter((facet) => facet.options_endpoint)
      .map(async (facet) => {
        const endpoint = (facet.options_endpoint as string).replace(API_PREFIX, '');
        const optionsResponse = (await api.get(endpoint)) as Record<string, unknown>;
        resolvedOptions.value[facet.key] = mapOptions(optionsResponse);
      }),
  );
}

function buildProductsUrl(): string {
  const params = filters.queryParams.value;
  const search = new URLSearchParams();
  search.set('page', String(params.page));
  search.set('per_page', String(params.per_page));
  if (params.q) search.set('q', params.q);
  if (params.tags && params.tags.length) search.set('tags', params.tags.join(','));
  for (const [key, value] of Object.entries(params)) {
    if (['page', 'per_page', 'q', 'tags'].includes(key)) continue;
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  if (selectedSort.value) search.set('sort', selectedSort.value);
  return `/shop/products?${search.toString()}`;
}

async function loadProducts(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    const response = (await api.get(buildProductsUrl())) as CatalogueEnvelope;
    items.value = response.items;
    pages.value = response.pages || 1;
  } catch (fetchError) {
    error.value = (fetchError as Error).message || 'Failed to load products';
  } finally {
    loading.value = false;
  }
}

function onSearchInput(): void {
  filters.setQuery(searchMirror.value);
}

function onFacetChange(key: string, value: string): void {
  filters.setFacet(key, value);
}

function onTagToggle(slug: string): void {
  filters.toggleTag(slug);
}

onMounted(async () => {
  await loadFacets();
  // Category-page entry: seed the category facet from the route param so it
  // lives in the URL query like every other filter (single source of truth).
  const categorySlug = route.params.slug as string | undefined;
  if (categorySlug && !filters.facet('category')) {
    // Pushes the URL query; the watcher below performs the initial product load.
    filters.setFacet('category', categorySlug);
    return;
  }
  await loadProducts();
});

// The URL query is the single source of truth: any filter/pagination change
// (including back/forward) refetches products and re-syncs the search mirror.
watch(
  () => route.query,
  () => {
    searchMirror.value = filters.query.value;
    loadProducts();
  },
  { deep: true },
);
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
  margin-top: 1.5rem;
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

.product-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  margin-top: 0.5rem;
}

.product-card__tag {
  padding: 2px 8px;
  border: 1px solid var(--vbwd-border-color, #e9ecef);
  border-radius: 999px;
  background: var(--vbwd-bg-muted, #f8f9fa);
  color: var(--vbwd-text-secondary, #6b7280);
  cursor: pointer;
  font-size: 0.6875rem;
}

.product-card__tag--active {
  background: var(--vbwd-color-primary, #3498db);
  color: var(--vbwd-color-on-primary, #fff);
  border-color: var(--vbwd-color-primary, #3498db);
}

.product-catalog__pager {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.75rem;
  margin-top: 1.5rem;
}

.product-catalog__pager button {
  padding: 0.375rem 0.875rem;
  border: 1px solid var(--vbwd-border-color, #d1d5db);
  border-radius: 4px;
  background: var(--vbwd-color-surface, #fff);
  color: var(--vbwd-color-text, #333);
  cursor: pointer;
}

.product-catalog__pager button:disabled {
  opacity: 0.4;
  cursor: default;
}

@media (max-width: 640px) {
  .product-catalog__grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 0.75rem;
  }
}
</style>
