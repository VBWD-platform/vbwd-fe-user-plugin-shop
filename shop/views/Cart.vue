<template>
  <div
    class="shopping-cart"
    data-testid="shopping-cart"
  >
    <h1 class="shopping-cart__heading">
      Shopping Cart
    </h1>

    <div
      v-if="cartStore.loading"
      class="shopping-cart__loading"
      data-testid="shopping-cart-loading"
    >
      Loading cart...
    </div>

    <div
      v-else-if="cartStore.error"
      class="shopping-cart__error"
      data-testid="shopping-cart-error"
    >
      {{ cartStore.error }}
    </div>

    <div
      v-else-if="cartStore.isEmpty"
      class="shopping-cart__empty"
      data-testid="shopping-cart-empty"
    >
      <p>Your cart is empty.</p>
      <router-link
        :to="{ name: 'shop-catalog' }"
        class="shopping-cart__browse-link"
        data-testid="shopping-cart-browse"
      >
        Browse Products
      </router-link>
    </div>

    <template v-else>
      <ul
        class="shopping-cart__items"
        data-testid="shopping-cart-items"
      >
        <li
          v-for="item in cartStore.items"
          :key="itemKey(item)"
          class="cart-item"
          data-testid="cart-item"
        >
          <img
            :src="item.imageUrl"
            :alt="item.productName"
            class="cart-item__image"
          >

          <div class="cart-item__info">
            <span
              class="cart-item__name"
              data-testid="cart-item-name"
            >
              {{ item.productName }}
            </span>
            <span
              v-if="item.variantName"
              class="cart-item__variant"
            >
              {{ item.variantName }}
            </span>
            <span class="cart-item__price">
              <PriceDisplay
                convert-to-display
                :net-amount="lineNet(item)"
                :gross-amount="lineGross(item)"
                :effective-display-mode="item.effectiveDisplayMode"
                :global-mode="item.pricesDisplayMode"
                :currency="item.currency || defaultCurrency"
                :account-type="authStore.user?.account_type"
              />
            </span>
            <!-- Per-line tax disclosure: net + one line per tax rate + gross,
                 from the split the cart item already carries (display sum only,
                 no fe-side tax math). Hidden for an untaxed/split-less line. -->
            <PriceBreakdown
              v-if="lineBreakdown(item).taxes.length > 0"
              convert-to-display
              :price="lineBreakdown(item)"
              class="cart-item__breakdown"
              data-testid="cart-item-breakdown"
            />
          </div>

          <div
            class="cart-item__quantity"
            data-testid="cart-item-quantity"
          >
            <button
              class="cart-item__qty-btn"
              data-testid="cart-item-decrease"
              :disabled="item.quantity <= 1"
              @click="cartStore.updateQuantity(item.productId, item.quantity - 1, item.variantId)"
            >
              &minus;
            </button>
            <span class="cart-item__qty-value">{{ item.quantity }}</span>
            <button
              class="cart-item__qty-btn"
              data-testid="cart-item-increase"
              :disabled="item.quantity >= item.maxQuantity"
              @click="cartStore.updateQuantity(item.productId, item.quantity + 1, item.variantId)"
            >
              +
            </button>
          </div>

          <span
            class="cart-item__subtotal"
            data-testid="cart-item-subtotal"
          >
            <PriceDisplay
              convert-to-display
              :net-amount="lineNet(item) * item.quantity"
              :gross-amount="lineGross(item) * item.quantity"
              :effective-display-mode="item.effectiveDisplayMode"
              :global-mode="item.pricesDisplayMode"
              :currency="item.currency || defaultCurrency"
              :account-type="authStore.user?.account_type"
            />
          </span>

          <button
            class="cart-item__remove"
            data-testid="cart-item-remove"
            @click="cartStore.removeItem(item.productId, item.variantId)"
          >
            Remove
          </button>
        </li>
      </ul>

      <div
        class="shopping-cart__footer"
        data-testid="shopping-cart-footer"
      >
        <span
          class="shopping-cart__subtotal"
          data-testid="shopping-cart-subtotal"
        >
          Subtotal ({{ cartStore.itemCount }} items):
          <PriceDisplay
            convert-to-display
            :net-amount="orderPrice.netto"
            :gross-amount="orderPrice.brutto"
            :currency="orderPrice.currency || defaultCurrency"
            :account-type="authStore.user?.account_type"
          />
        </span>
        <button
          class="shopping-cart__checkout-btn"
          data-testid="shopping-cart-checkout"
          @click="handleCheckout"
        >
          Proceed to Checkout
        </button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from 'vbwd-view-component';
import { useCartStore, type CartItem } from '../stores/cart';
import { useAppConfigStore } from '@/stores/appConfig';
import PriceDisplay from '@/components/PriceDisplay.vue';
import PriceBreakdown from '@/components/PriceBreakdown.vue';
import { aggregatePrice } from '@/utils/aggregatePrice';
import type { PriceVO } from '@/utils/priceDisplay';

const cartStore = useCartStore();
const authStore = useAuthStore();
const router = useRouter();
const appConfig = useAppConfigStore();

// Each cart item carries the product's computed net/gross/taxes split (S85.4);
// when absent (older carts) a line's net == gross == its bare ``price``. The
// last-resort currency is the billing default (S99) — never a literal.
const defaultCurrency = computed(() => appConfig.defaultCurrency);

function itemKey(item: CartItem): string {
  return `${item.productId}-${item.variantId ?? 'default'}`;
}

function lineNet(item: CartItem): number {
  return item.netAmount ?? item.price;
}

function lineGross(item: CartItem): number {
  return item.grossAmount ?? item.price;
}

// A single cart line's per-unit Price VO for its own <PriceBreakdown> — a
// display sum of the per-line ``taxes`` the cart carries, never a tax computation.
function lineBreakdown(item: CartItem): PriceVO {
  return aggregatePrice(
    [
      {
        priceVO: {
          netto: lineNet(item),
          taxes: (item.taxes ?? []).map((tax) => ({
            code: tax.code,
            rate: Number(tax.rate),
            amount: tax.amount,
          })),
          brutto: lineGross(item),
          currency: item.currency || defaultCurrency.value,
        },
        grossFallback: item.price,
        quantity: item.quantity,
        currency: item.currency || defaultCurrency.value,
      },
    ],
    item.currency || defaultCurrency.value,
  );
}

// The order-level net/gross aggregate (display sum of the per-line splits) so
// the footer subtotal picks the correct viewer side. Falls back to bare gross
// per line when a split is absent — same shared aggregator as the checkout.
const orderPrice = computed<PriceVO>(() =>
  aggregatePrice(
    cartStore.items.map((item) => ({
      priceVO: {
        netto: lineNet(item),
        taxes: (item.taxes ?? []).map((tax) => ({
          code: tax.code,
          rate: Number(tax.rate),
          amount: tax.amount,
        })),
        brutto: lineGross(item),
        currency: item.currency || defaultCurrency.value,
      },
      grossFallback: item.price,
      quantity: item.quantity,
      currency: item.currency || defaultCurrency.value,
    })),
    cartStore.items[0]?.currency || defaultCurrency.value,
  ),
);

function handleCheckout() {
  // Navigate to the checkout page — it handles auth (EmailBlock) + payment
  router.push({ name: 'checkout-public', query: { source: 'shop' } });
}
</script>

<style scoped>
.shopping-cart {
  max-width: 900px;
  margin: 0 auto;
  padding: 1.5rem;
}

.shopping-cart__heading {
  font-size: 1.75rem;
  font-weight: 700;
  margin-bottom: 1.5rem;
}

.shopping-cart__loading,
.shopping-cart__error,
.shopping-cart__empty {
  padding: 2rem;
  text-align: center;
  color: var(--vbwd-text-secondary, #666);
}

.shopping-cart__error {
  color: var(--vbwd-color-danger, #dc3545);
}

.shopping-cart__browse-link {
  display: inline-block;
  margin-top: 1rem;
  padding: 0.5rem 1.25rem;
  border: 1px solid var(--vbwd-color-primary, #333);
  border-radius: 4px;
  text-decoration: none;
  color: var(--vbwd-color-primary, #333);
  font-weight: 600;
}

.shopping-cart__items {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.cart-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  border: 1px solid var(--vbwd-border-color, #ddd);
  border-radius: 8px;
}

.cart-item__image {
  width: 64px;
  height: 64px;
  object-fit: cover;
  border-radius: 4px;
  flex-shrink: 0;
}

.cart-item__info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.cart-item__name {
  font-weight: 600;
  font-size: 0.9375rem;
}

.cart-item__variant {
  font-size: 0.8125rem;
  color: var(--vbwd-text-secondary, #666);
}

.cart-item__price {
  font-size: 0.8125rem;
  color: var(--vbwd-text-secondary, #666);
}

.cart-item__breakdown {
  margin-top: 0.25rem;
  font-size: 0.75rem;
}

.cart-item__quantity {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.cart-item__qty-btn {
  width: 28px;
  height: 28px;
  border: 1px solid var(--vbwd-border-color, #ddd);
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
  font-size: 1rem;
  line-height: 1;
}

.cart-item__qty-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.cart-item__qty-value {
  min-width: 1.5rem;
  text-align: center;
  font-weight: 600;
}

.cart-item__subtotal {
  font-weight: 700;
  font-size: 0.9375rem;
  min-width: 5rem;
  text-align: right;
}

.cart-item__remove {
  background: none;
  border: none;
  color: var(--vbwd-color-danger, #dc3545);
  cursor: pointer;
  font-size: 0.8125rem;
  white-space: nowrap;
}

.shopping-cart__footer {
  margin-top: 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 1rem;
  border-top: 1px solid var(--vbwd-border-color, #ddd);
}

.shopping-cart__subtotal {
  font-size: 1.125rem;
  font-weight: 700;
}

.shopping-cart__checkout-error {
  margin-top: 1rem;
  padding: 0.75rem 1rem;
  background: #fef2f2;
  color: #dc2626;
  border-radius: 4px;
  font-size: 0.875rem;
}

.shopping-cart__checkout-btn {
  display: inline-block;
  padding: 0.75rem 1.5rem;
  background: var(--vbwd-color-primary, #333);
  color: #fff;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
}

.shopping-cart__checkout-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 640px) {
  .cart-item {
    flex-wrap: wrap;
  }

  .cart-item__subtotal {
    text-align: left;
  }
}
</style>
