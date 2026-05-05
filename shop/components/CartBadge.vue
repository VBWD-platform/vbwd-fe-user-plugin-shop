<template>
  <router-link
    v-if="cartStore.itemCount > 0"
    :to="{ name: 'shop-cart' }"
    class="cart-badge"
    data-testid="cart-badge"
  >
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <circle
        cx="9"
        cy="21"
        r="1"
      />
      <circle
        cx="20"
        cy="21"
        r="1"
      />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
    <span class="cart-badge__count">{{ cartStore.itemCount }}</span>
  </router-link>
</template>

<script setup lang="ts">
import { useCartStore } from '../stores/cart';
const cartStore = useCartStore();
</script>

<style scoped>
.cart-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.4rem 0.75rem;
  color: inherit;
  text-decoration: none;
  border-radius: 4px;
  font-weight: 600;
  font-size: 0.875rem;
  transition: opacity 0.15s;
}

.cart-badge:hover {
  opacity: 0.7;
}

.cart-badge__count {
  background: var(--vbwd-color-primary, #333);
  color: #fff;
  min-width: 20px;
  height: 20px;
  border-radius: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 700;
  line-height: 1;
}
</style>
