<template>
  <div
    class="product-detail"
    data-testid="product-detail"
  >
    <div
      v-if="loading"
      class="product-detail__loading"
      data-testid="product-detail-loading"
    >
      Loading product...
    </div>

    <div
      v-else-if="error"
      class="product-detail__error"
      data-testid="product-detail-error"
    >
      {{ error }}
    </div>

    <div
      v-else-if="!product"
      class="product-detail__empty"
      data-testid="product-detail-empty"
    >
      Product not found.
    </div>

    <template v-else>
      <div class="product-detail__gallery">
        <img
          :src="selectedImage || product.primary_image_url || undefined"
          :alt="product.name"
          class="product-detail__image"
          data-testid="product-detail-image"
        >
        <div
          v-if="product.images && product.images.length > 1"
          class="product-detail__thumbnails"
          data-testid="product-detail-thumbnails"
        >
          <button
            v-for="image in product.images"
            :key="image.id"
            class="product-detail__thumb"
            :class="{ 'product-detail__thumb--active': selectedImage === image.url }"
            @click="selectedImage = image.url"
          >
            <img
              :src="image.url"
              :alt="image.alt || product.name"
            >
          </button>
        </div>
      </div>

      <div class="product-detail__info">
        <h1
          class="product-detail__name"
          data-testid="product-detail-name"
        >
          {{ product.name }}
        </h1>

        <p
          class="product-detail__price"
          data-testid="product-detail-price"
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

        <p
          class="product-detail__description"
          data-testid="product-detail-description"
        >
          {{ product.description }}
        </p>

        <!-- S77 — tags + custom fields from the serialized payload (no extra fetch) -->
        <TagChips
          v-if="product.tags && product.tags.length"
          :tags="product.tags"
          class="product-detail__tags"
        />
        <CustomFieldsDisplay
          v-if="product.custom_fields"
          :custom-fields="product.custom_fields"
          :field-defs="product.custom_field_defs"
          class="product-detail__custom-fields"
        />

        <span
          class="product-detail__stock"
          :class="{ 'product-detail__stock--out': !inStock }"
          data-testid="product-detail-stock"
        >
          {{ inStock ? 'In Stock' : 'Out of Stock' }}
        </span>

        <div class="product-detail__cart-row">
          <button
            class="product-detail__add-to-cart"
            :disabled="!inStock || addedFeedback"
            data-testid="product-detail-add-to-cart"
            @click="handleAddToCart"
          >
            {{ addedFeedback ? 'Added!' : 'Add to Cart' }}
          </button>
          <router-link
            v-if="cartStore.itemCount > 0"
            :to="{ name: 'shop-cart' }"
            class="product-detail__view-cart"
            data-testid="product-detail-view-cart"
          >
            View Cart ({{ cartStore.itemCount }})
          </router-link>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '@/api';
import { useCartStore } from '../stores/cart';
import PriceDisplay from '@/components/PriceDisplay.vue';
import { TagChips, CustomFieldsDisplay, type CustomFieldDef } from 'vbwd-view-component';

interface ProductVariant {
  id: string;
  name: string;
  sku: string | null;
  price: string | null;
  price_float: number | null;
  attributes: Record<string, string>;
  stock_available?: number;
}

interface ProductInfo {
  id: string;
  slug: string;
  name: string;
  description: string;
  // S85.1 — raw double (e.g. 18.99); product-level ``price_float`` was dropped.
  price: number;
  currency: string;
  primary_image_url: string | null;
  images: Array<{ id: string; url: string; alt: string }>;
  variants: ProductVariant[];
  has_variants: boolean;
  stock_available?: number;
  is_digital: boolean;
  weight: string | null;
  // S72.4 netto/brutto display + S85.4 per-rate tax split
  pricing?: {
    net_amount: string;
    gross_amount: string;
    effective_display_mode?: 'netto' | 'brutto';
    prices_display_mode?: 'netto' | 'brutto';
    taxes?: Array<{ code: string; rate: string; amount: string }>;
  };
  // S77 — appended by the backend serializer via append_tags_and_custom_fields
  tags?: string[];
  custom_fields?: Record<string, unknown>;
  custom_field_defs?: CustomFieldDef[];
}

const route = useRoute();
const cartStore = useCartStore();
const productSlug = route.params.slug as string;

const loading = ref(true);
const error = ref<string | null>(null);
const product = ref<ProductInfo | null>(null);
const quantity = ref(1);
const selectedVariantId = ref<string | null>(null);
const selectedImage = ref<string | null>(null);

const inStock = ref(true);
const stockCount = ref(0);
const addedFeedback = ref(false);

async function fetchProduct() {
  loading.value = true;
  error.value = null;
  try {
    const response = await api.get(`/shop/products/${productSlug}`) as { product: ProductInfo };
    product.value = response.product;

    if (response.product.has_variants && response.product.variants.length > 0) {
      selectedVariantId.value = response.product.variants[0].id;
      stockCount.value = response.product.variants[0].stock_available || 0;
    } else {
      stockCount.value = response.product.stock_available || 0;
    }
    inStock.value = stockCount.value > 0 || response.product.is_digital;
  } catch (fetchError) {
    error.value = (fetchError as Error).message || 'Product not found';
  } finally {
    loading.value = false;
  }
}

function handleAddToCart(): void {
  if (!product.value || addedFeedback.value) return;
  const variant = product.value.variants.find(v => v.id === selectedVariantId.value);

  // S85.4 — thread the product's computed net/gross/taxes split + display-mode
  // pair (already on the payload) into the cart line so the checkout summary can
  // disclose tax and pick the viewer side. No tax math — just parse the amounts.
  const pricing = product.value.pricing;
  const pricingFields = pricing
    ? {
        netAmount: Number(pricing.net_amount),
        grossAmount: Number(pricing.gross_amount),
        effectiveDisplayMode: pricing.effective_display_mode,
        pricesDisplayMode: pricing.prices_display_mode,
        taxes: (pricing.taxes ?? []).map((tax) => ({
          code: tax.code,
          rate: tax.rate,
          amount: Number(tax.amount),
        })),
      }
    : {};

  cartStore.addItem({
    productId: product.value.id,
    productSlug: product.value.slug,
    productName: variant ? `${product.value.name} — ${variant.name}` : product.value.name,
    imageUrl: product.value.primary_image_url || '',
    // S85.1 dropped product-level ``price_float``; the charge basis is now the
    // GROSS amount from the pricing block (D8), falling back to the raw price.
    // A selected variant still carries its own price after S85.1, so prefer it.
    price: variant
      ? Number(variant.price_float ?? variant.price ?? 0)
      : Number(product.value.pricing?.gross_amount ?? product.value.price ?? 0),
    currency: product.value.currency,
    quantity: quantity.value,
    maxQuantity: stockCount.value || 999,
    isDigital: product.value.is_digital,
    weight: parseFloat(product.value.weight || '0'),
    variantId: selectedVariantId.value || undefined,
    variantName: variant?.name,
    ...pricingFields,
  });

  addedFeedback.value = true;
  setTimeout(() => { addedFeedback.value = false; }, 2000);
}

onMounted(fetchProduct);
</script>

<style scoped>
.product-detail {
  max-width: 1000px;
  margin: 0 auto;
  padding: 1.5rem;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
}

.product-detail__loading,
.product-detail__error,
.product-detail__empty {
  grid-column: 1 / -1;
  padding: 2rem;
  text-align: center;
  color: var(--vbwd-text-secondary, #666);
}

.product-detail__error {
  color: var(--vbwd-color-danger, #dc3545);
}

.product-detail__image {
  width: 100%;
  border-radius: 8px;
  object-fit: cover;
  aspect-ratio: 1;
}

.product-detail__thumbnails {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.75rem;
  overflow-x: auto;
}

.product-detail__thumb {
  width: 64px;
  height: 64px;
  border: 2px solid transparent;
  border-radius: 6px;
  overflow: hidden;
  cursor: pointer;
  padding: 0;
  background: none;
  flex-shrink: 0;
  transition: border-color 0.15s;
}

.product-detail__thumb:hover {
  border-color: var(--vbwd-color-primary, #999);
}

.product-detail__thumb--active {
  border-color: var(--vbwd-color-primary, #333);
}

.product-detail__thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.product-detail__info {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.product-detail__name {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0;
}

.product-detail__price {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--vbwd-color-primary, #333);
  margin: 0;
}

.product-detail__description {
  font-size: 0.9375rem;
  line-height: 1.6;
  color: var(--vbwd-text-secondary, #555);
  margin: 0;
}

.product-detail__stock {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--vbwd-color-success, #28a745);
}

.product-detail__stock--out {
  color: var(--vbwd-color-danger, #dc3545);
}

.product-detail__cart-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.product-detail__add-to-cart {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  background: var(--vbwd-color-primary, #333);
  color: #fff;
  transition: background-color 0.2s;
}

.product-detail__add-to-cart:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.product-detail__view-cart {
  padding: 0.75rem 1.5rem;
  border: 1px solid var(--vbwd-color-primary, #333);
  border-radius: 4px;
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--vbwd-color-primary, #333);
  text-decoration: none;
  transition: background-color 0.15s;
}

.product-detail__view-cart:hover {
  background: var(--vbwd-bg-hover, #f5f5f5);
}

@media (max-width: 640px) {
  .product-detail {
    grid-template-columns: 1fr;
  }
}
</style>
|