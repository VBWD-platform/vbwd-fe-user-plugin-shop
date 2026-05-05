<template>
  <div
    class="order-detail"
    data-testid="order-detail"
  >
    <div
      v-if="loading"
      class="order-detail__loading"
      data-testid="order-detail-loading"
    >
      Loading order...
    </div>

    <div
      v-else-if="error"
      class="order-detail__error"
      data-testid="order-detail-error"
    >
      {{ error }}
    </div>

    <div
      v-else-if="!order"
      class="order-detail__empty"
      data-testid="order-detail-empty"
    >
      Order not found.
    </div>

    <template v-else>
      <div class="order-detail__header">
        <h1
          class="order-detail__heading"
          data-testid="order-detail-number"
        >
          Order {{ order.orderNumber }}
        </h1>
        <span
          class="order-detail__status"
          :class="`order-detail__status--${order.status}`"
          data-testid="order-detail-status"
        >
          {{ order.status }}
        </span>
      </div>

      <div
        v-if="order.tracking"
        class="order-detail__tracking"
        data-testid="order-detail-tracking"
      >
        <h2 class="order-detail__section-title">
          Tracking
        </h2>
        <p class="order-detail__tracking-carrier">
          Carrier: <strong>{{ order.tracking.carrier }}</strong>
        </p>
        <p class="order-detail__tracking-number">
          Tracking Number: <strong>{{ order.tracking.trackingNumber }}</strong>
        </p>
      </div>

      <div class="order-detail__items">
        <h2 class="order-detail__section-title">
          Items
        </h2>
        <ul
          class="order-detail__item-list"
          data-testid="order-detail-items"
        >
          <li
            v-for="item in order.items"
            :key="item.id"
            class="order-item"
            data-testid="order-detail-item"
          >
            <span
              class="order-item__name"
              data-testid="order-detail-item-name"
            >
              {{ item.productName }}
            </span>
            <span class="order-item__quantity">x{{ item.quantity }}</span>
            <span
              class="order-item__price"
              data-testid="order-detail-item-price"
            >
              {{ formatPrice(item.price * item.quantity, order.currency) }}
            </span>
          </li>
        </ul>
      </div>

      <div class="order-detail__summary">
        <span
          class="order-detail__total"
          data-testid="order-detail-total"
        >
          Total: {{ formatPrice(order.total, order.currency) }}
        </span>
        <span
          class="order-detail__date"
          data-testid="order-detail-date"
        >
          Placed on {{ formatDate(order.createdAt) }}
        </span>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRoute } from 'vue-router';

interface OrderItem {
  id: string;
  productName: string;
  quantity: number;
  price: number;
}

interface TrackingInfo {
  carrier: string;
  trackingNumber: string;
}

interface OrderInfo {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  currency: string;
  createdAt: string;
  items: OrderItem[];
  tracking: TrackingInfo | null;
}

const route = useRoute();
const orderId = route.params.id as string;

const loading = ref(false);
const error = ref<string | null>(null);
const order = ref<OrderInfo | null>(null);

function formatPrice(price: number, currency: string): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(price);
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// orderId is available for fetching logic
void orderId;
</script>

<style scoped>
.order-detail {
  max-width: 800px;
  margin: 0 auto;
  padding: 1.5rem;
}

.order-detail__loading,
.order-detail__error,
.order-detail__empty {
  padding: 2rem;
  text-align: center;
  color: var(--vbwd-text-secondary, #666);
}

.order-detail__error {
  color: var(--vbwd-color-danger, #dc3545);
}

.order-detail__header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.order-detail__heading {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0;
}

.order-detail__status {
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.8125rem;
  font-weight: 600;
  text-transform: capitalize;
  background: var(--vbwd-bg-muted, #eee);
}

.order-detail__status--pending {
  background: #fff3cd;
  color: #856404;
}

.order-detail__status--processing {
  background: #cce5ff;
  color: #004085;
}

.order-detail__status--shipped {
  background: #d4edda;
  color: #155724;
}

.order-detail__status--delivered {
  background: #d4edda;
  color: #155724;
}

.order-detail__status--cancelled {
  background: #f8d7da;
  color: #721c24;
}

.order-detail__section-title {
  font-size: 1.125rem;
  font-weight: 600;
  margin-bottom: 0.75rem;
}

.order-detail__tracking {
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: var(--vbwd-bg-muted, #f9f9f9);
  border-radius: 8px;
}

.order-detail__tracking p {
  margin: 0.25rem 0;
  font-size: 0.875rem;
}

.order-detail__items {
  margin-bottom: 1.5rem;
}

.order-detail__item-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.order-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 1rem;
  border: 1px solid var(--vbwd-border-color, #ddd);
  border-radius: 4px;
}

.order-item__name {
  flex: 1;
  font-weight: 600;
  font-size: 0.9375rem;
}

.order-item__quantity {
  font-size: 0.875rem;
  color: var(--vbwd-text-secondary, #666);
}

.order-item__price {
  font-weight: 700;
  min-width: 5rem;
  text-align: right;
}

.order-detail__summary {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 1rem;
  border-top: 1px solid var(--vbwd-border-color, #ddd);
}

.order-detail__total {
  font-size: 1.125rem;
  font-weight: 700;
}

.order-detail__date {
  font-size: 0.8125rem;
  color: var(--vbwd-text-secondary, #666);
}
</style>
