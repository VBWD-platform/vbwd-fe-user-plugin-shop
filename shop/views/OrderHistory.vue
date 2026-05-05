<template>
  <div
    class="order-history"
    data-testid="order-history"
  >
    <h1 class="order-history__heading">
      Order History
    </h1>

    <div
      v-if="loading"
      class="order-history__loading"
      data-testid="order-history-loading"
    >
      Loading orders...
    </div>

    <div
      v-else-if="error"
      class="order-history__error"
      data-testid="order-history-error"
    >
      {{ error }}
    </div>

    <div
      v-else-if="orders.length === 0"
      class="order-history__empty"
      data-testid="order-history-empty"
    >
      You have no orders yet.
    </div>

    <ul
      v-else
      class="order-history__list"
      data-testid="order-history-list"
    >
      <li
        v-for="order in orders"
        :key="order.id"
        class="order-row"
        data-testid="order-row"
      >
        <router-link
          :to="{ name: 'shop-order-detail', params: { id: order.id } }"
          class="order-row__link"
        >
          <span
            class="order-row__number"
            data-testid="order-row-number"
          >
            {{ order.order_number }}
          </span>
          <span
            class="order-row__status"
            :class="`order-row__status--${order.status}`"
            data-testid="order-row-status"
          >
            {{ order.status }}
          </span>
          <span
            class="order-row__total"
            data-testid="order-row-total"
          >
            {{ formatPrice(order.total_amount, order.currency) }}
          </span>
          <span
            class="order-row__date"
            data-testid="order-row-date"
          >
            {{ formatDate(order.created_at) }}
          </span>
        </router-link>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api } from '@/api';

interface OrderSummary {
  id: string;
  order_number: string;
  status: string;
  total_amount: string;
  currency: string;
  created_at: string;
}

const loading = ref(true);
const error = ref<string | null>(null);
const orders = ref<OrderSummary[]>([]);

async function fetchOrders() {
  loading.value = true;
  error.value = null;
  try {
    const response = await api.get('/shop/orders') as { orders: OrderSummary[] };
    orders.value = response.orders;
  } catch (fetchError) {
    error.value = (fetchError as Error).message || 'Failed to load orders';
  } finally {
    loading.value = false;
  }
}

onMounted(fetchOrders);

function formatPrice(price: string | number, currency: string): string {
  const num = typeof price === "string" ? parseFloat(price) : price;
  return new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "EUR" }).format(num);
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
</script>

<style scoped>
.order-history {
  max-width: 800px;
  margin: 0 auto;
  padding: 1.5rem;
}

.order-history__heading {
  font-size: 1.75rem;
  font-weight: 700;
  margin-bottom: 1.5rem;
}

.order-history__loading,
.order-history__error,
.order-history__empty {
  padding: 2rem;
  text-align: center;
  color: var(--vbwd-text-secondary, #666);
}

.order-history__error {
  color: var(--vbwd-color-danger, #dc3545);
}

.order-history__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.order-row__link {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  border: 1px solid var(--vbwd-border-color, #ddd);
  border-radius: 8px;
  text-decoration: none;
  color: inherit;
  transition: background-color 0.15s;
}

.order-row__link:hover {
  background-color: var(--vbwd-bg-hover, #f5f5f5);
}

.order-row__number {
  font-weight: 600;
  flex: 1;
}

.order-row__status {
  padding: 0.25rem 0.625rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: capitalize;
  background: var(--vbwd-bg-muted, #eee);
}

.order-row__status--pending {
  background: #fff3cd;
  color: #856404;
}

.order-row__status--processing {
  background: #cce5ff;
  color: #004085;
}

.order-row__status--shipped {
  background: #d4edda;
  color: #155724;
}

.order-row__status--delivered {
  background: #d4edda;
  color: #155724;
}

.order-row__status--cancelled {
  background: #f8d7da;
  color: #721c24;
}

.order-row__total {
  font-weight: 700;
  min-width: 5rem;
  text-align: right;
}

.order-row__date {
  font-size: 0.8125rem;
  color: var(--vbwd-text-secondary, #666);
  min-width: 6rem;
  text-align: right;
}

@media (max-width: 640px) {
  .order-row__link {
    flex-wrap: wrap;
  }
}
</style>
