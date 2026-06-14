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
      <span>
        <PriceDisplay
          :net-amount="lineNet(item) * item.quantity"
          :gross-amount="lineGross(item) * item.quantity"
          :effective-display-mode="item.effectiveDisplayMode"
          :global-mode="item.pricesDisplayMode"
          :currency="item.currency || 'EUR'"
          :account-type="authStore.user?.account_type"
        />
      </span>
      <!-- Per-line tax disclosure in the HETEROGENEOUS case (cart lines span
           different tax rates). The homogeneous single-rate case is covered once
           by the order-level OrderTaxSummary the checkout view renders, so no
           per-line breakdown there (avoids duplication). -->
      <PriceBreakdown
        v-if="isHeterogeneous && lineBreakdown(item).taxes.length > 0"
        :price="lineBreakdown(item)"
        class="line-breakdown"
      />
    </div>
    <!-- The order-level net / total-taxes / brutto breakdown (and the net order
         total) is rendered by the checkout view from the agnostic core store via
         <OrderTaxSummary> — no duplicate aggregate here. -->
  </div>
</template>

<script setup lang="ts">
/**
 * Order summary for a shop-cart checkout, contributed by the shop plugin's
 * CheckoutSource and rendered by the generic public checkout page.
 *
 * S85.4 — each cart line now carries the product's computed net/gross/taxes
 * split + display-mode pair, so we feed the real net/gross to <PriceDisplay>
 * (the business overlay flips the side) and render the aggregate
 * <PriceBreakdown> from the summed per-line ``taxes``. The only arithmetic here
 * is the display sum of already-computed tax amounts — never a tax computation.
 */
import { computed } from 'vue';
import { useAuthStore } from 'vbwd-view-component';
import { useCartStore, type CartItem } from '../stores/cart';
import PriceDisplay from '@/components/PriceDisplay.vue';
import PriceBreakdown from '@/components/PriceBreakdown.vue';
import { aggregatePrice } from '@/utils/aggregatePrice';
import type { PriceVO } from '@/utils/priceDisplay';

const cart = useCartStore();
const authStore = useAuthStore();

// A line's net/gross fall back to its bare gross ``price`` (net == gross) when
// the product carried no pricing split — keeps older carts rendering correctly.
function lineNet(item: CartItem): number {
  return item.netAmount ?? item.price;
}

function lineGross(item: CartItem): number {
  return item.grossAmount ?? item.price;
}

// Build a single cart line's per-unit-summed Price VO (× quantity) for its own
// breakdown — display sum of the per-line ``taxes`` the cart carries, no math.
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
          currency: item.currency || 'EUR',
        },
        grossFallback: item.price,
        quantity: item.quantity,
        currency: item.currency || 'EUR',
      },
    ],
    item.currency || 'EUR',
  );
}

// Heterogeneous = the cart's line items span more than one distinct tax group.
// Decided by the order-level aggregate's tax-array length (the SAME shared
// aggregator the checkout view's <OrderTaxSummary> uses).
const orderPrice = computed<PriceVO>(() =>
  aggregatePrice(
    cart.items.map((item) => ({
      priceVO: {
        netto: lineNet(item),
        taxes: (item.taxes ?? []).map((tax) => ({
          code: tax.code,
          rate: Number(tax.rate),
          amount: tax.amount,
        })),
        brutto: lineGross(item),
        currency: item.currency || 'EUR',
      },
      grossFallback: item.price,
      quantity: item.quantity,
      currency: item.currency || 'EUR',
    })),
    cart.items[0]?.currency || 'EUR',
  ),
);
const isHeterogeneous = computed(() => orderPrice.value.taxes.length > 1);
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
.line-breakdown {
  margin: 2px 0 8px;
  padding-left: 12px;
}
.total {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #e5e7eb;
  text-align: right;
}
</style>
