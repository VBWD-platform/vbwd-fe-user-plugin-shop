# vbwd-fe-user-plugin-ecommerce

Product catalog, shopping cart, checkout extension, and order history.

## Structure

```
plugins/ecommerce/
├── index.ts                          # Plugin entry (IPlugin, named export)
├── config.json                       # Default plugin config
├── admin-config.json                 # Admin settings panel schema
├── ecommerce/                        # Source code
│   ├── views/
│   │   ├── ProductCatalog.vue        # Grid/list catalog with search, category filter
│   │   ├── ProductDetail.vue         # Product page (images, variants, add-to-cart)
│   │   ├── Cart.vue                  # Shopping cart with quantity controls
│   │   ├── OrderHistory.vue          # Paginated order list
│   │   └── OrderDetail.vue           # Order detail (items, status, tracking)
│   └── stores/
│       └── cart.ts                   # Cart store (Pinia, localStorage-backed)
└── tests/
    └── unit/
        └── cart.spec.ts
```

## Routes

| Path | View | Auth | Description |
|------|------|------|-------------|
| `/shop` | ProductCatalog.vue | No | Product catalog |
| `/shop/category/:slug` | ProductCatalog.vue | No | Category-filtered catalog |
| `/shop/product/:slug` | ProductDetail.vue | No | Product detail page |
| `/shop/cart` | Cart.vue | No | Shopping cart |
| `/shop/orders` | OrderHistory.vue | Yes | User's order history |
| `/shop/orders/:id` | OrderDetail.vue | Yes | Order detail |

## Cart Store

The cart store (`useCartStore`) persists to `localStorage` under the key `vbwd_shop_cart`.

**Guest users:** Cart lives entirely in localStorage. No backend calls.

**Logged-in users:** When `cart_sync_on_login` is enabled, the cart syncs with the backend on login so the user can resume their cart across devices.

### Cart Item Interface

```typescript
interface CartItem {
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
```

### Actions

| Action | Description |
|--------|-------------|
| `addItem(item)` | Add item or increment quantity (capped at maxQuantity) |
| `removeItem(productId, variantId?)` | Remove item from cart |
| `updateQuantity(productId, quantity, variantId?)` | Set item quantity (min 1, max maxQuantity) |
| `clearCart()` | Empty the cart |

### Getters

| Getter | Description |
|--------|-------------|
| `itemCount` | Total quantity across all items |
| `subtotal` | Sum of price * quantity for all items |
| `isEmpty` | Whether the cart has zero items |

## Configuration

### config.json

| Key | Default | Description |
|-----|---------|-------------|
| `products_per_page` | `12` | Products shown per page |
| `show_out_of_stock` | `true` | Display out-of-stock products |
| `default_catalog_view` | `"grid"` | Default catalog layout (grid or list) |
| `cart_sync_on_login` | `true` | Sync localStorage cart with backend on login |

### admin-config.json

Defines the settings panel with a **Catalog Display** tab for configuring catalog view, pagination, stock visibility, and cart sync.

## Development

```bash
# Unit tests
npm run test -- plugins/ecommerce/

# Lint
npm run lint
```
