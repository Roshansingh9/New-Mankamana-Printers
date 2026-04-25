export interface Service { id: string; name: string }

export interface Choice { id: string; value: string; label: string }

export interface Option {
  id: string;
  field_key: string;
  label: string;
  is_pricing_field: boolean;
  choices: Choice[];
}

export interface Product {
  id: string;
  name: string;
  product_code: string;
  description: string | null;
  service_id: string;
  options: Option[];
}

export interface PriceRow {
  id: string;
  price: number | null;
  combination: string;
  selectedOptions: Array<{ fieldId: string; fieldKey: string; value: string; displayValue: string }>;
}
