/**
 * S116.3 — shop product-type API client.
 *
 * A product type is an additive cluster of custom fields layered on the shared
 * base product. The storefront fetches a type's descriptor to label, order and
 * format the ``type_field_values`` a typed product carries. Base products
 * (``product_type_slug = null``) never hit this endpoint.
 */
import { api } from '@/api';

/** The field-config kinds the backend emits for a product-type field. */
export type ProductTypeFieldKind =
  | 'string'
  | 'text'
  | 'textarea'
  | 'url'
  | 'integer'
  | 'number'
  | 'float'
  | 'decimal'
  | 'boolean'
  | 'select'
  | 'multiselect';

/** One additive field on a product type — mirrors the backend descriptor. */
export interface ProductTypeField {
  slug: string;
  type: ProductTypeFieldKind;
  label: string;
  required: boolean;
  options?: string[];
  help?: string | null;
  sort_order: number;
}

/** A product type: a named, additive cluster of custom fields. */
export interface ProductType {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  product_type_fields: ProductTypeField[];
  source: string;
  is_active: boolean;
}

/** Fetch a single product type's descriptor by its stable slug. */
export async function getProductType(slug: string): Promise<ProductType> {
  const response = await api.get<{ product_type: ProductType }>(
    `/shop/product-types/${slug}`,
  );
  return response.product_type;
}
