// All API calls for product_adder — routes live at /product_adder/api/*
import type { Product, ProductOption, PriceRow, Service } from "./types";

const BASE = "/product_adder/api";

async function call<T = unknown>(path: string, method = "GET", body?: unknown): Promise<T> {
  const init: RequestInit = { method, cache: "no-store" };
  if (body !== undefined) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${path}`, init);
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(json?.message || `Error ${res.status}`);
  return (json?.data ?? json) as T;
}

// ── Services (categories) ─────────────────────────────────────────────────────

export async function listServices(): Promise<Service[]> {
  const d = await call<Service[] | { data: Service[] }>("/services");
  return Array.isArray(d) ? d : [];
}

// ── Products ──────────────────────────────────────────────────────────────────

export async function listProducts(): Promise<Product[]> {
  const d = await call<RawProduct[]>("/products");
  return (Array.isArray(d) ? d : []).map(toProduct);
}

export async function createProduct(serviceId: string, payload: { product_code: string; name: string; description?: string }): Promise<Product> {
  return toProduct(await call<RawProduct>(`/services/${serviceId}/products`, "POST", payload));
}

export async function updateProduct(productId: string, payload: { name?: string; description?: string }): Promise<void> {
  await call(`/products/${productId}`, "PATCH", payload);
}

export async function deleteProduct(productId: string): Promise<void> {
  await call(`/products/${productId}`, "DELETE");
}

// ── Fields (options) ──────────────────────────────────────────────────────────

export async function createField(productId: string, label: string, isPricingField: boolean): Promise<ProductOption> {
  const key = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/(^_|_$)/g, "");
  const raw = await call<{ id: string; field_key: string; label: string; is_pricing_field?: boolean }>(`/products/${productId}/fields`, "POST", {
    field_key: key, label, type: "select", is_required: true, is_pricing_field: isPricingField,
  });
  return { id: raw.id, field_key: raw.field_key, label: raw.label, is_pricing_field: raw.is_pricing_field ?? isPricingField, choices: [] };
}

export async function deleteField(fieldId: string): Promise<void> {
  await call(`/fields/${fieldId}`, "DELETE");
}

// ── Choices (option values) ───────────────────────────────────────────────────

export async function createChoice(fieldId: string, label: string): Promise<{ id: string; value: string; label: string }> {
  const value = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return call(`/fields/${fieldId}/options`, "POST", { value, label });
}

export async function deleteChoice(optionId: string): Promise<void> {
  await call(`/options/${optionId}`, "DELETE");
}

// ── Pricing ───────────────────────────────────────────────────────────────────

export async function listPricing(productId: string): Promise<PriceRow[]> {
  const d = await call<RawPricingRow[]>(`/products/${productId}/pricing`);
  return (Array.isArray(d) ? d : []).map(toPriceRow);
}

export async function createPricingRow(productId: string, selectedOptions: Array<{ fieldId: string; value: string }>, price: number): Promise<PriceRow> {
  return toPriceRow(await call<RawPricingRow>(`/products/${productId}/pricing`, "POST", { selectedOptions, unit_price: price }));
}

export async function updatePricingRow(pricingId: string, price: number): Promise<void> {
  await call(`/pricing/${pricingId}`, "PATCH", { unit_price: price });
}

export async function deletePricingRow(pricingId: string): Promise<void> {
  await call(`/pricing/${pricingId}`, "DELETE");
}

// ── Auto-generate product code ────────────────────────────────────────────────

export function autoCode(name: string): string {
  const initials = name.trim().split(/\s+/).map((w) => w[0]?.toUpperCase() ?? "").join("").slice(0, 4);
  return `${initials}-${Math.floor(100 + Math.random() * 900)}`;
}

// ── Internal raw types + mappers ──────────────────────────────────────────────

interface RawProduct {
  id: string; name: string; product_code: string; description?: string | null; service_id: string;
  fields?: Array<{ id: string; field_key: string; label: string; is_pricing_field?: boolean; options?: Array<{ id: string; value: string; label: string }> }>;
}

interface RawPricingRow {
  id: string; unit_price?: number | null;
  selected_options?: Array<{ field_id: string; field_key?: string; label?: string; value: string; display_value?: string }>;
}

function toProduct(r: RawProduct): Product {
  return {
    id: r.id, name: r.name, product_code: r.product_code, description: r.description ?? null, service_id: r.service_id,
    options: (r.fields ?? []).map((f) => ({
      id: f.id, field_key: f.field_key, label: f.label, is_pricing_field: f.is_pricing_field ?? false,
      choices: (f.options ?? []).map((o) => ({ id: o.id, value: o.value, label: o.label })),
    })),
  };
}

function toPriceRow(r: RawPricingRow): PriceRow {
  const opts = (r.selected_options ?? []).map((o) => ({
    fieldId: o.field_id, fieldKey: o.field_key ?? "", label: o.label ?? "", value: o.value, displayValue: o.display_value ?? o.value,
  }));
  return { id: r.id, price: r.unit_price ?? null, selectedOptions: opts, combination: opts.map((o) => o.displayValue).join(" · ") || "—" };
}
