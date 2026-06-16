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
              <PriceDisplay
                :net-amount="lineNet(item) * item.quantity"
                :gross-amount="lineGross(item) * item.quantity"
                :currency="order.currency"
                :account-type="authStore.user?.account_type"
              />
            </span>
          </li>
        </ul>
      </div>

      <div class="order-detail__summary">
        <!-- If the order carries a persisted net/tax/gross breakdown, disclose
             it; otherwise (FLAG: shop orders carry only the gross ``total``) fall
             back to the single-figure total threaded with the viewer side. -->
        <PriceBreakdown
          v-if="orderBreakdownPrice"
          class="order-detail__breakdown"
          data-testid="order-detail-breakdown"
          :price="orderBreakdownPrice"
        />
        <span
          v-else
          class="order-detail__total"
          data-testid="order-detail-total"
        >
          Total:
          <PriceDisplay
            :net-amount="order.total"
            :gross-amount="order.total"
            :currency="order.currency"
            :account-type="authStore.user?.account_type"
          />
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
import { ref, computed } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from 'vbwd-view-component';
import PriceDisplay from '@/components/PriceDisplay.vue';
import PriceBreakdown from '@/components/PriceBreakdown.vue';
import { aggregatePrice } from '@/utils/aggregatePrice';
import type { PriceVO } from '@/utils/priceDisplay';

/** One applied tax line carried from the order line's persisted breakdown. */
interface OrderItemTax {
  code: string;
  name?: string;
  rate: string | number;
  amount: number;
}

interface OrderItem {
  id: string;
  productName: string;
  quantity: number;
  price: number;
  // S96.4 — the persisted per-line net/gross/taxes split (S85). Absent for
  // older orders, in which case the line shows net == gross == ``price``.
  netAmount?: number;
  grossAmount?: number;
  taxes?: OrderItemTax[];
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
  // S85 persisted order-level net / tax totals (fallback when the item lines
  // carry no per-rate ``taxes`` split).
  subtotal?: number;
  taxAmount?: number;
  currency: string;
  createdAt: string;
  items: OrderItem[];
  tracking: TrackingInfo | null;
}

// The order is fed via an optional prop (a display-only seam mirrored by the
// live fetch, so the netto/tax/brutto disclosure is unit-testable).
const props = defineProps<{ order?: OrderInfo | null }>();

const route = useRoute();
const authStore = useAuthStore();
const orderId = route.params.id as string;

const loading = ref(false);
const error = ref<string | null>(null);
const fetchedOrder = ref<OrderInfo | null>(null);
const order = computed<OrderInfo | null>(() => props.order ?? fetchedOrder.value);

function lineNet(item: OrderItem): number {
  return item.netAmount ?? item.price;
}

function lineGross(item: OrderItem): number {
  return item.grossAmount ?? item.price;
}

function hasItemTaxSplit(current: OrderInfo): boolean {
  return current.items.some((item) => (item.taxes?.length ?? 0) > 0);
}

// Build the order-level Price VO. Prefer the persisted per-line ``taxes`` split
// (summed via the shared aggregator → real per-rate lines); otherwise fall back
// to the persisted order-level net/tax totals; otherwise null → single total.
// No fe-side tax math anywhere — only a display sum of persisted amounts.
const orderBreakdownPrice = computed<PriceVO | null>(() => {
  const current = order.value;
  if (!current) return null;

  if (hasItemTaxSplit(current)) {
    return aggregatePrice(
      current.items.map((item) => ({
        priceVO: {
          netto: lineNet(item),
          taxes: (item.taxes ?? []).map((tax) => ({
            code: tax.code,
            name: tax.name,
            rate: Number(tax.rate),
            amount: tax.amount,
          })),
          brutto: lineGross(item),
          currency: current.currency,
        },
        grossFallback: item.price,
        quantity: item.quantity,
        currency: current.currency,
      })),
      current.currency,
    );
  }

  if (current.subtotal === undefined) return null;
  const tax = current.taxAmount ?? 0;
  return {
    netto: current.subtotal,
    taxes: tax > 0 ? [{ code: 'TAX', rate: 0, amount: tax }] : [],
    brutto: current.total,
    currency: current.currency,
  };
});

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
