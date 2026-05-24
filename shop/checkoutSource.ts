/**
 * Shop checkout source — lets the generic public /checkout page purchase the
 * shop cart (`/checkout?source=shop`) without the core checkout store knowing
 * anything about ecommerce. Derives line items from the shop cart store and
 * submits to the ecommerce endpoint.
 */
import { defineAsyncComponent } from 'vue';
import { api } from '@/api';
import {
  type CheckoutSource,
  type CheckoutResult,
  type LineItem,
} from '@/registries/checkoutSourceRegistry';
import { useCartStore } from './stores/cart';

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
    return cart.items.map((item) => ({
      type: 'shop_product',
      id: item.productId,
      name: item.productName,
      price: item.price * item.quantity,
      quantity: item.quantity,
      currency: item.currency || 'EUR',
      total_price: String(item.price * item.quantity),
    }));
  },

  getOrderTotal: () => useCartStore().subtotal,

  async submit(paymentMethodCode): Promise<CheckoutResult> {
    const cart = useCartStore();
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

    const response = (await api.post('/shop/cart/checkout', payload)) as {
      invoice_id: string;
      invoice_number: string;
      total: string;
    };

    cart.clearCart();

    return {
      invoice: {
        id: response.invoice_id,
        invoice_number: response.invoice_number,
        status: 'PENDING',
        amount: response.total,
        total_amount: response.total,
        currency: 'EUR',
        line_items: [],
      },
      message: 'Order created',
    };
  },

  // The cart store persists to localStorage; nothing to reset between visits.
  reset: () => {},

  summaryComponent: defineAsyncComponent(
    () => import('./components/ShopCheckoutSummary.vue')
  ),
};
