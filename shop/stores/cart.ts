import { defineStore } from 'pinia';

export interface CartItem {
  productId: string;
  productSlug: string;
  productName: string;
  imageUrl: string;
  price: number;
  currency: string;
  quantity: number;
  maxQuantity: number;
  isDigital: boolean;
  weight: number;
  variantId?: string;
  variantName?: string;
}

const STORAGE_KEY = 'vbwd_shop_cart';

function loadFromStorage(): CartItem[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveToStorage(items: CartItem[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export const useCartStore = defineStore('shopCart', {
  state: () => ({
    items: loadFromStorage() as CartItem[],
    loading: false,
    error: null as string | null,
  }),

  getters: {
    itemCount(): number {
      return this.items.reduce((sum, item) => sum + item.quantity, 0);
    },
    subtotal(): number {
      return this.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    },
    isEmpty(): boolean {
      return this.items.length === 0;
    },
  },

  actions: {
    addItem(item: CartItem) {
      const existing = this.items.find(
        (i) => i.productId === item.productId && i.variantId === item.variantId
      );
      if (existing) {
        existing.quantity = Math.min(existing.quantity + item.quantity, item.maxQuantity);
      } else {
        this.items.push({ ...item });
      }
      saveToStorage(this.items);
    },

    removeItem(productId: string, variantId?: string) {
      this.items = this.items.filter(
        (i) => !(i.productId === productId && i.variantId === variantId)
      );
      saveToStorage(this.items);
    },

    updateQuantity(productId: string, quantity: number, variantId?: string) {
      const item = this.items.find(
        (i) => i.productId === productId && i.variantId === variantId
      );
      if (item) {
        item.quantity = Math.max(1, Math.min(quantity, item.maxQuantity));
        saveToStorage(this.items);
      }
    },

    clearCart() {
      this.items = [];
      saveToStorage(this.items);
    },
  },
});
