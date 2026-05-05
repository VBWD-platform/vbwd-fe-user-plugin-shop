import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCartStore } from '../../shop/stores/cart'

// Mock localStorage
const storage: Record<string, string> = {}
vi.stubGlobal('localStorage', {
  getItem: (key: string) => storage[key] ?? null,
  setItem: (key: string, value: string) => { storage[key] = value },
  removeItem: (key: string) => { delete storage[key] },
  clear: () => { Object.keys(storage).forEach(k => delete storage[k]) },
})

const mockItem = {
  productId: 'prod-1',
  productSlug: 'headphones',
  productName: 'Wireless Headphones',
  imageUrl: '/images/headphones.jpg',
  price: 79.99,
  currency: 'EUR',
  quantity: 1,
  maxQuantity: 50,
  isDigital: false,
  weight: 0.25,
}

describe('useCartStore', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('starts with empty cart', () => {
    const store = useCartStore()
    expect(store.items).toHaveLength(0)
    expect(store.isEmpty).toBe(true)
    expect(store.itemCount).toBe(0)
    expect(store.subtotal).toBe(0)
  })

  it('adds item to cart', () => {
    const store = useCartStore()
    store.addItem(mockItem)

    expect(store.items).toHaveLength(1)
    expect(store.items[0].productName).toBe('Wireless Headphones')
    expect(store.itemCount).toBe(1)
    expect(store.isEmpty).toBe(false)
  })

  it('increments quantity when adding same product', () => {
    const store = useCartStore()
    store.addItem(mockItem)
    store.addItem(mockItem)

    expect(store.items).toHaveLength(1)
    expect(store.items[0].quantity).toBe(2)
    expect(store.itemCount).toBe(2)
  })

  it('caps quantity at maxQuantity', () => {
    const store = useCartStore()
    store.addItem({ ...mockItem, quantity: 45 })
    store.addItem({ ...mockItem, quantity: 10 })

    expect(store.items[0].quantity).toBe(50) // maxQuantity
  })

  it('removes item from cart', () => {
    const store = useCartStore()
    store.addItem(mockItem)
    store.removeItem('prod-1')

    expect(store.items).toHaveLength(0)
    expect(store.isEmpty).toBe(true)
  })

  it('updates quantity', () => {
    const store = useCartStore()
    store.addItem(mockItem)
    store.updateQuantity('prod-1', 5)

    expect(store.items[0].quantity).toBe(5)
  })

  it('quantity minimum is 1', () => {
    const store = useCartStore()
    store.addItem(mockItem)
    store.updateQuantity('prod-1', 0)

    expect(store.items[0].quantity).toBe(1)
  })

  it('calculates subtotal correctly', () => {
    const store = useCartStore()
    store.addItem({ ...mockItem, quantity: 2 })

    expect(store.subtotal).toBeCloseTo(159.98)
  })

  it('clears cart', () => {
    const store = useCartStore()
    store.addItem(mockItem)
    store.clearCart()

    expect(store.items).toHaveLength(0)
    expect(store.isEmpty).toBe(true)
  })

  it('persists to localStorage', () => {
    const store = useCartStore()
    store.addItem(mockItem)

    const stored = JSON.parse(localStorage.getItem('vbwd_shop_cart') || '[]')
    expect(stored).toHaveLength(1)
    expect(stored[0].productId).toBe('prod-1')
  })

  it('handles variant items separately', () => {
    const store = useCartStore()
    store.addItem({ ...mockItem, variantId: 'var-black' })
    store.addItem({ ...mockItem, variantId: 'var-white' })

    expect(store.items).toHaveLength(2)
    expect(store.itemCount).toBe(2)
  })
})
