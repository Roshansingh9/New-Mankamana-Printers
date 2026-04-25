// All API calls for the product_adder module — self-contained, no external service imports
import type { Product, ProductOption, PriceRow, Service } from "./types";

const BASE = "/api/admin";

async function call<T = unknown>(
  path: string,
  method = "GET",
  body?: unknown
): Promise<T> {
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

// ── Services ──────────────────────────────────────────────────────────────────

export async function listServices(): Promise<Service[]> {
  const data = await call<Service[]>("/services");
  return Array.isArray(data) ? data : [];
}

// ── Products ──────────────────────────────────────────────────────────────────

export async function listProducts(): Promise<Product[]> {
  const raw = await call<
    Array<{
      id: string;
      name: string;
      product_code: string;
      description: string | null;
      service_id: string;
      fields?: Array<{
        id: string;
        field_key: string;
        label: string;
        is_pricing_field?: boolean;
        options?: Array<{ id: string; value: string; label: string }>;
      }>;
    }>
  >("/products");
  const arr = Array.isArray(raw) ? raw : [];
  return arr.map(toProduct);
}

export async function createProduct(
  serviceId: string,
  payload: { product_code: string; name: string; description?: string }
): Promise<Product> {
  const raw = await call<{
    id: string;
    name: string;
    product_code: string;
    description: string | null;
    service_id: string;
    fields?: [];
  }>(`/services/${serviceId}/products`, "POST", payload);
  return toProduct(raw);
}

export async function updateProduct(
  productId: string,
  payload: { name?: string; description?: string }
): Promise<void> {
  await call(`/products/${productId}`, "PATCH", payload);
}

export async function deleteProduct(productId: string): Promise<void> {
  await call(`/products/${productId}`, "DELETE");
}

// ── Fields (Customization Options) ───────────────────────────────────────────

export async function createField(
  productId: string,
  label: string,
  isPricingField: boolean
): Promise<ProductOption> {
  const key = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/(^_|_$)/g, "");
  const raw = await call<{
    id: string;
    field_key: string;
    label: string;
    is_pricing_field?: boolean;
    options?: [];
  }>(`/products/${productId}/fields`, "POST", {
    field_key: key,
    label,
    type: "select",
    is_required: true,
    is_pricing_field: isPricingField,
  });
  return {
    id: raw.id,
    field_key: raw.field_key,
    label: raw.label,
    is_pricing_field: raw.is_pricing_field ?? isPricingField,
    choices: [],
  };
}

export async function deleteField(fieldId: string): Promise<void> {
  await call(`/fields/${fieldId}`, "DELETE");
}

// ── Choices (Option Values) ───────────────────────────────────────────────────

export async function createChoice(
  fieldId: string,
  label: string
): Promise<{ id: string; value: string; label: string }> {
  const value = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return call<{ id: string; value: string; label: string }>(
    `/fields/${fieldId}/options`,
    "POST",
    { value, label }
  );
}

export async function deleteChoice(optionId: string): Promise<void> {
  await call(`/options/${optionId}`, "DELETE");
}

// ── Pricing ───────────────────────────────────────────────────────────────────

export async function listPricing(productId: string): Promise<PriceRow[]> {
  const raw = await call<
    Array<{
      id: string;
      unit_price?: number | null;
      selected_options?: Array<{
        field_id: string;
        field_key?: string;
        label?: string;
        value: string;
        display_value?: string;
      }>;
    }>
  >(`/products/${productId}/pricing`);
  const arr = Array.isArray(raw) ? raw : [];
  return arr.map(toPriceRow);
}

export async function createPricingRow(
  productId: string,
  selectedOptions: Array<{ fieldId: string; value: string }>,
  price: number
): Promise<PriceRow> {
  const raw = await call<{
    id: string;
    unit_price?: number | null;
    selected_options?: Array<{
      field_id: string;
      field_key?: string;
      label?: string;
      value: string;
      display_value?: string;
    }>;
  }>(`/products/${productId}/pricing`, "POST", { selectedOptions, unit_price: price });
  return toPriceRow(raw);
}

export async function updatePricingRow(pricingId: string, price: number): Promise<void> {
  await call(`/pricing/${pricingId}`, "PATCH", { unit_price: price });
}

export async function deletePricingRow(pricingId: string): Promise<void> {
  await call(`/pricing/${pricingId}`, "DELETE");
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toProduct(raw: {
  id: string;
  name: string;
  product_code: string;
  description?: string | null;
  service_id: string;
  fields?: Array<{
    id: string;
    field_key: string;
    label: string;
    is_pricing_field?: boolean;
    options?: Array<{ id: string; value: string; label: string }>;
  }>;
}): Product {
  return {
    id: raw.id,
    name: raw.name,
    product_code: raw.product_code,
    description: raw.description ?? null,
    service_id: raw.service_id,
    options: (raw.fields ?? []).map((f) => ({
      id: f.id,
      field_key: f.field_key,
      label: f.label,
      is_pricing_field: f.is_pricing_field ?? false,
      choices: (f.options ?? []).map((o) => ({
        id: o.id,
        value: o.value,
        label: o.label,
      })),
    })),
  };
}

function toPriceRow(raw: {
  id: string;
  unit_price?: number | null;
  selected_options?: Array<{
    field_id: string;
    field_key?: string;
    label?: string;
    value: string;
    display_value?: string;
  }>;
}): PriceRow {
  const opts = (raw.selected_options ?? []).map((o) => ({
    fieldId: o.field_id,
    fieldKey: o.field_key ?? o.field_id,
    label: o.label ?? o.field_key ?? "",
    value: o.value,
    displayValue: o.display_value ?? o.value,
  }));
  const combination = opts.map((o) => o.displayValue).join(" · ") || "—";
  return {
    id: raw.id,
    price: raw.unit_price ?? null,
    selectedOptions: opts,
    combination,
  };
}

// Auto-generate a product code from a name: "Business Card" → "BC-847"
export function autoCode(name: string): string {
  const initials = name
    .trim()
    .split(/\s+/)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 4);
  const suffix = String(Math.floor(100 + Math.random() * 900));
  return `${initials}-${suffix}`;
}
