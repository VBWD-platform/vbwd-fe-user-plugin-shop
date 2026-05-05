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
              {{ formatPrice(item.price, item.currency) }}
            </span>
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
            {{ formatPrice(item.price * item.quantity, item.currency) }}
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
          Subtotal ({{ cartStore.itemCount }} items): {{ formatPrice(cartStore.subtotal, defaultCurrency) }}
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
import { useRouter } from 'vue-router';
import { useCartStore, type CartItem } from '../stores/cart';

const cartStore = useCartStore();
const router = useRouter();

const defaultCurrency = 'EUR';

function itemKey(item: CartItem): string {
  return `${item.productId}-${item.variantId ?? 'default'}`;
}

function formatPrice(price: number, currency: string): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(price);
}

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
