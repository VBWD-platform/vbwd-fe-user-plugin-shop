/**
 * Shop checkout source — lets the generic public /checkout page purchase the
 * shop cart (`/checkout?source=shop`) without the core checkout store knowing
 * anything about ecommerce. Derives line items from the shop cart store and
 * submits to the ecommerce endpoint.
 */
import { defineAsyncComponent, ref } from 'vue';
import { api } from '@/api';
import {
  type CheckoutSource,
  type CheckoutResult,
  type LineItem,
} from '@/registries/checkoutSourceRegistry';
import { aggregatePrice } from '@/utils/aggregatePrice';
import type { PriceVO } from '@/utils/priceDisplay';
import { useAppConfigStore } from '@/stores/appConfig';
import { useCartStore } from './stores/cart';

// Coupon state for the shop source (the cart store persists items; the coupon
// is per-checkout-visit, so module-level reactive state is enough).
const shopDiscount = ref(0);
const shopCouponCode = ref<string | null>(null);

export const shopCheckoutSource: CheckoutSource = {
  id: 'shop',

  matches: (ctx) => ctx.source === 'shop',

  async load() {
    const cart = useCartStore();
    if (cart.isEmpty) {
      throw new Error('Cart is empty');
    }
  },

  getLineItems(): LineItem[] {
    const cart = useCartStore();
    const billingCurrency = useAppConfigStore().defaultCurrency;
    return cart.items.map((item) => ({
      type: 'shop_product',
      id: item.productId,
      name: item.productName,
      price: item.price * item.quantity,
      quantity: item.quantity,
      // Resolve: the item's own currency, else the billing default (S99).
      currency: item.currency || billingCurrency,
      total_price: String(item.price * item.quantity),
    }));
  },

  // Net total (gross cart subtotal minus any applied coupon discount).
  getOrderTotal: () => Math.max(0, useCartStore().subtotal - shopDiscount.value),

  getDiscountAmount: () => shopDiscount.value,

  // Order-level tax breakdown across all cart lines. Each line's per-unit Price
  // VO is built from the split the cart carries (netto=netAmount??price,
  // brutto=grossAmount??price, taxes with Number(rate)); the shared aggregator
  // sums them by code+rate. Display only — never recomputes tax.
  getTaxBreakdown(): PriceVO {
    const cart = useCartStore();
    const billingCurrency = useAppConfigStore().defaultCurrency;
    return aggregatePrice(
      cart.items.map((item) => ({
        priceVO: {
          netto: item.netAmount ?? item.price,
          taxes: (item.taxes ?? []).map((tax) => ({
            code: tax.code,
            rate: Number(tax.rate),
            amount: tax.amount,
          })),
          brutto: item.grossAmount ?? item.price,
          currency: item.currency || billingCurrency,
        },
        grossFallback: item.price,
        quantity: item.quantity,
        currency: item.currency || billingCurrency,
      })),
      billingCurrency,
    );
  },

  async applyCoupon(code: string): Promise<{ valid: boolean; discountAmount: number; error?: string }> {
    const cart = useCartStore();
    const response = (await api.post('/coupons/validate', {
      code,
      cart_total: cart.subtotal,
      scope: 'ECOMMERCE',
    })) as { valid: boolean; discount_amount?: string; error?: string };
    if (response.valid) {
      shopDiscount.value = Number(response.discount_amount || 0);
      shopCouponCode.value = code;
      return { valid: true, discountAmount: shopDiscount.value };
    }
    shopDiscount.value = 0;
    shopCouponCode.value = null;
    return { valid: false, discountAmount: 0, error: response.error };
  },

  clearCoupon(): void {
    shopDiscount.value = 0;
    shopCouponCode.value = null;
  },

  async submit(paymentMethodCode): Promise<CheckoutResult> {
    const cart = useCartStore();
    const billingCurrency = useAppConfigStore().defaultCurrency;
    const payload: Record<string, unknown> = {
      items: cart.items.map((item) => ({
        product_id: item.productId,
        quantity: item.quantity || 1,
        variant_id: item.variantId || null,
      })),
    };
    if (paymentMethodCode) {
      payload.payment_method_code = paymentMethodCode;
    }
    if (shopCouponCode.value) {
      payload.coupon_code = shopCouponCode.value;
    }

    const response = (await api.post('/shop/cart/checkout', payload)) as {
      invoice_id: string;
      invoice_number: string;
      total: string;
    };

    cart.clearCart();
    shopDiscount.value = 0;
    shopCouponCode.value = null;

    return {
      invoice: {
        id: response.invoice_id,
        invoice_number: response.invoice_number,
        status: 'PENDING',
        amount: response.total,
        total_amount: response.total,
        // The backend creates the invoice in the billing currency (S99).
        currency: billingCurrency,
        line_items: [],
      },
      message: 'Order created',
    };
  },

  // The cart store persists to localStorage; only the coupon resets between visits.
  reset: () => {
    shopDiscount.value = 0;
    shopCouponCode.value = null;
  },

  summaryComponent: defineAsyncComponent(
    () => import('./components/ShopCheckoutSummary.vue')
  ),
};
