import type { IPlugin, IPlatformSDK } from 'vbwd-view-component';

export const shopPlugin: IPlugin = {
  name: 'shop',
  version: '0.1.0',
  description: 'Shop — product catalog, cart, checkout, orders',

  install(sdk: IPlatformSDK) {
    // Public CMS routes — rendered via CmsPage.vue which resolves layout + widgets
    sdk.addRoute({
      path: '/shop',
      name: 'shop-catalog',
      component: () => import('../cms/src/views/CmsPage.vue'),
      props: { slug: 'shop' },
      meta: { requiresAuth: false, cmsLayout: true },
    });
    sdk.addRoute({
      path: '/shop/category/:slug',
      name: 'shop-category',
      component: () => import('../cms/src/views/CmsPage.vue'),
      props: { slug: 'shop' },
      meta: { requiresAuth: false, cmsLayout: true },
    });
    sdk.addRoute({
      path: '/shop/product/:slug',
      name: 'shop-product',
      component: () => import('../cms/src/views/CmsPage.vue'),
      props: { slug: 'shop-product-detail' },
      meta: { requiresAuth: false, cmsLayout: true },
    });
    sdk.addRoute({
      path: '/shop/cart',
      name: 'shop-cart',
      component: () => import('../cms/src/views/CmsPage.vue'),
      props: { slug: 'shop-cart' },
      meta: { requiresAuth: false, cmsLayout: true },
    });

    // Dashboard routes (auth required — rendered in UserLayout)
    sdk.addRoute({
      path: '/shop/orders',
      name: 'shop-orders',
      component: () => import('./shop/views/OrderHistory.vue'),
      meta: { requiresAuth: true },
    });
    sdk.addRoute({
      path: '/shop/orders/:id',
      name: 'shop-order-detail',
      component: () => import('./shop/views/OrderDetail.vue'),
      meta: { requiresAuth: true },
    });

    // Register CMS vue-component widgets
    import('../cms/src/registry/vueComponentRegistry')
      .then(({ registerCmsVueComponent }) => {
        Promise.all([
          import('./shop/views/ProductCatalog.vue'),
          import('./shop/views/ProductDetail.vue'),
          import('./shop/views/Cart.vue'),
          import('./shop/components/CartBadge.vue'),
        ]).then(([catalog, detail, cart, cartBadge]) => {
          registerCmsVueComponent('ProductGrid', catalog.default);
          registerCmsVueComponent('ProductDetail', detail.default);
          registerCmsVueComponent('ShoppingCart', cart.default);
          registerCmsVueComponent('CartBadge', cartBadge.default);
        });
      })
      .catch(() => {
        // CMS plugin not installed — skip widget registration
      });
  },

  activate() {},
  deactivate() {},
};
