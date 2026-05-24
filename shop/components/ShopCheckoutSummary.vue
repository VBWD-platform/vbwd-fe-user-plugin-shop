<template>
  <div class="cart-items-summary">
    <div
      v-for="item in cart.items"
      :key="item.productId + (item.variantId || '')"
      class="plan-row"
      :data-testid="`cart-line-item-${item.productId}`"
    >
      <span>
        {{ item.productName }}
        <span
          v-if="item.quantity > 1"
          class="plan-description"
        >x{{ item.quantity }}</span>
      </span>
      <span>{{ formatPrice(item.price * item.quantity, item.currency) }}</span>
    </div>
    <div class="total">
      <strong>{{ $t('checkout.success.totalLabel') }} {{ formatPrice(cart.subtotal, 'EUR') }}</strong>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Order summary for a shop-cart checkout, contributed by the shop plugin's
 * CheckoutSource and rendered by the generic public checkout page.
 */
import { useCartStore } from '../stores/cart';

const cart = useCartStore();

function formatPrice(price: number | string, currency: string): string {
  const num = typeof price === 'string' ? parseFloat(price) : price;
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: currency || 'EUR',
  }).format(num);
}
</script>

<style scoped>
.cart-items-summary {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.plan-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}
.plan-description {
  color: #6b7280;
  font-size: 0.9rem;
}
.total {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #e5e7eb;
  text-align: right;
}
</style>
