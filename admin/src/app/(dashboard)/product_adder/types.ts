// All TypeScript types for the product_adder module

export interface Service {
  id: string;
  name: string;
  description?: string | null;
}

export interface Choice {
  id: string;
  value: string;  // internal code e.g. "a4"
  label: string;  // human label e.g. "A4"
}

export interface ProductOption {
  id: string;
  field_key: string;
  label: string;          // e.g. "Paper Size"
  is_pricing_field: boolean;
  choices: Choice[];
}

export interface PriceRow {
  id: string;
  price: number | null;
  selectedOptions: Array<{
    fieldId: string;
    fieldKey: string;
    label: string;
    value: string;
    displayValue: string;
  }>;
  combination: string;    // human readable: "A4 · Glossy"
}

export interface Product {
  id: string;
  name: string;
  product_code: string;
  description: string | null;
  service_id: string;
  options: ProductOption[];
}
