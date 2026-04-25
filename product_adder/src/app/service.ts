import type { Product, Option, PriceRow, Service } from "./types";

async function api<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    cache: "no-store",
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error ?? json?.message ?? `Error ${res.status}`);
  return json as T;
}

export const getServices  = () => api<Service[]>("/services");
export const getProducts  = () => api<Product[]>("/products");
export const addProduct   = (service_id: string, name: string, description?: string) =>
  api<Product>("/products", "POST", { service_id, name, description });
export const saveProduct  = (id: string, name: string, description?: string) =>
  api<Partial<Product>>(`/products/${id}`, "PATCH", { name, description });
export const removeProduct = (id: string) => api(`/products/${id}`, "DELETE");

export const addField = (productId: string, label: string, is_pricing_field: boolean) =>
  api<Option>(`/products/${productId}/fields`, "POST", { label, is_pricing_field });
export const removeField  = (fieldId: string) => api(`/fields/${fieldId}`, "DELETE");

export const addChoice    = (fieldId: string, label: string) =>
  api<{ id: string; value: string; label: string }>(`/fields/${fieldId}/options`, "POST", { label });
export const removeChoice = (optionId: string) => api(`/options/${optionId}`, "DELETE");

export const getPricing   = (productId: string) => api<Array<{ id: string; unit_price: number; selected_options: Array<{ field_id: string; field_key: string; value: string; display_value: string }> }>>(`/products/${productId}/pricing`);
export const addPricing   = (productId: string, selectedOptions: Array<{ fieldId: string; value: string }>, unit_price: number) =>
  api(`/products/${productId}/pricing`, "POST", { selectedOptions, unit_price });
export const savePrice    = (pricingId: string, unit_price: number) => api(`/pricing/${pricingId}`, "PATCH", { unit_price });
export const removePrice  = (pricingId: string) => api(`/pricing/${pricingId}`, "DELETE");

// Load pricing and reshape into PriceRow[]
export async function loadPricing(productId: string): Promise<PriceRow[]> {
  const rows = await getPricing(productId);
  return rows.map(r => ({
    id: r.id,
    price: r.unit_price,
    combination: (r.selected_options ?? []).map(o => o.display_value || o.value).join(" · ") || "—",
    selectedOptions: (r.selected_options ?? []).map(o => ({
      fieldId: o.field_id, fieldKey: o.field_key, value: o.value, displayValue: o.display_value ?? o.value,
    })),
  }));
}

// Cartesian product helper
export function cartesian<T>(arrays: T[][]): T[][] {
  if (!arrays.length) return [[]];
  const [first, ...rest] = arrays;
  return first.flatMap(item => cartesian(rest).map(combo => [item, ...combo]));
}
