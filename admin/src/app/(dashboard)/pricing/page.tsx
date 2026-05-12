"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SlidersHorizontal, Check, Loader2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  fetchAdminPricingRows,
  fetchAdminProductById,
  updateAdminPricingRow,
  type AdminProduct,
  type AdminProductField,
  type AdminService,
  type DiscountType,
  type PricingRow,
} from "@/services/catalogAdminService";
import { cachedJsonFetch } from "@/lib/requestCache";

type RowEdit = {
  unit_price: string;
  discount_type: DiscountType;
  discount_value: string;
};

type SaveState = "idle" | "saving" | "saved" | "error";

const selectCls =
  "flex h-9 w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950 dark:border-slate-800 dark:focus-visible:ring-slate-300";

export default function PricingPage() {
  const { toast } = useToast();
  const [services, setServices] = useState<AdminService[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [pricingFields, setPricingFields] = useState<AdminProductField[]>([]);
  const [pricingRows, setPricingRows] = useState<PricingRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});

  // Local edit state per row — initialized when rows load, NOT synced back on every pricingRows change
  const [rowEdits, setRowEdits] = useState<Record<string, RowEdit>>({});
  const rowEditsRef = useRef<Record<string, RowEdit>>({});

  // Per-row save status
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({});

  // Debounce timers per row (ref → no re-renders)
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Cleanup all pending timers on unmount
  useEffect(() => () => { Object.values(debounceTimers.current).forEach(clearTimeout); }, []);

  const initRowEdits = (rows: PricingRow[]) => {
    const edits: Record<string, RowEdit> = {};
    for (const row of rows) {
      edits[row.id] = {
        unit_price: row.unit_price?.toString() ?? "",
        discount_type: row.discount_type ?? null,
        discount_value:
          row.discount_value !== undefined && row.discount_value !== null
            ? String(row.discount_value)
            : "",
      };
    }
    rowEditsRef.current = edits;
    setRowEdits(edits);
    setSaveStates({});
  };

  const loadServices = useCallback(async () => {
    try {
      const data = await cachedJsonFetch<AdminService[]>("admin-pricing-services", "/api/admin/services", 60_000);
      setServices(data);
      if (data.length > 0) setSelectedServiceId(data[0].id);
    } catch {
      // Non-critical — service filter degrades gracefully
    }
  }, []);

  const loadProducts = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await cachedJsonFetch<AdminProduct[]>("admin-pricing-products", "/api/admin/products", 60_000);
      setProducts(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load products.";
      toast({ title: "Load Failed", description: message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const loadPricingData = useCallback(async (productId: string) => {
    if (!productId) return;
    setIsLoading(true);
    try {
      const [product, rows] = await Promise.all([
        fetchAdminProductById(productId),
        fetchAdminPricingRows(productId),
      ]);
      const pricingFieldsOnly = (product.fields || []).filter((f) => f.is_pricing_field);
      setPricingFields(pricingFieldsOnly);
      setPricingRows(rows);
      setSelectedOptions({});
      initRowEdits(rows);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load pricing rows.";
      toast({ title: "Load Failed", description: message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadServices(); }, [loadServices]);
  useEffect(() => { loadProducts(); }, [loadProducts]);
  useEffect(() => { if (selectedProductId) loadPricingData(selectedProductId); }, [selectedProductId, loadPricingData]);

  const filteredProducts = selectedServiceId
    ? products.filter((p) => p.service_id === selectedServiceId)
    : products;

  // Auto-select first product when service changes or products load
  useEffect(() => {
    if (filteredProducts.length > 0) {
      setSelectedProductId((prev) => {
        const stillValid = filteredProducts.some((p) => p.id === prev);
        return stillValid ? prev : filteredProducts[0].id;
      });
    } else {
      setSelectedProductId("");
    }
  }, [selectedServiceId, filteredProducts.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveRowById = async (rowId: string) => {
    const edit = rowEditsRef.current[rowId];
    if (!edit) return;

    setSaveStates((prev) => ({ ...prev, [rowId]: "saving" }));
    try {
      const updated = await updateAdminPricingRow(rowId, {
        unit_price: edit.unit_price ? Number(edit.unit_price) : undefined,
        discount_type: edit.discount_type || null,
        discount_value: edit.discount_value ? Number(edit.discount_value) : undefined,
      });
      setPricingRows((prev) =>
        prev.map((r) => (r.id === rowId ? { ...r, ...updated } : r))
      );
      setSaveStates((prev) => ({ ...prev, [rowId]: "saved" }));
      setTimeout(
        () => setSaveStates((prev) => (prev[rowId] === "saved" ? { ...prev, [rowId]: "idle" } : prev)),
        2000
      );
    } catch {
      setSaveStates((prev) => ({ ...prev, [rowId]: "error" }));
      toast({ title: "Save Failed", description: "Could not save pricing row.", variant: "destructive" });
    }
  };

  const handleFieldChange = (rowId: string, field: keyof RowEdit, value: string) => {
    const current = rowEditsRef.current[rowId] ?? { unit_price: "", discount_type: null, discount_value: "" };
    const newEdit: RowEdit = { ...current, [field]: value as DiscountType };
    // Clearing discount type also clears the value
    if (field === "discount_type" && !value) newEdit.discount_value = "";

    rowEditsRef.current[rowId] = newEdit;
    setRowEdits((prev) => ({ ...prev, [rowId]: newEdit }));
    setSaveStates((prev) => ({ ...prev, [rowId]: "idle" }));

    clearTimeout(debounceTimers.current[rowId]);
    debounceTimers.current[rowId] = setTimeout(() => void saveRowById(rowId), 800);
  };

  const renderCombination = (row: PricingRow) => {
    if (!row.selected_options || row.selected_options.length === 0) return "—";
    return row.selected_options.map((o) => o.display_value || o.value).join(" · ");
  };

  const renderSaveState = (rowId: string) => {
    const state = saveStates[rowId] ?? "idle";
    if (state === "saving") return <Loader2 className="h-4 w-4 animate-spin text-slate-400" />;
    if (state === "saved") return <Check className="h-4 w-4 text-emerald-500" />;
    if (state === "error") return <AlertCircle className="h-4 w-4 text-red-500" />;
    return null;
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#0061FF]">
          Pricing Rules
        </p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
          Product Pricing Matrix
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Edit prices inline — changes save automatically.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="border-slate-200/80 shadow-sm dark:border-slate-800 lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Select Product</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {services.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="select-service">Service</Label>
                <select
                  id="select-service"
                  aria-label="Select service"
                  className={selectCls}
                  value={selectedServiceId}
                  onChange={(e) => {
                    setSelectedServiceId(e.target.value);
                    setSelectedProductId("");
                  }}
                >
                  <option value="">All Services</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="select-product">Product</Label>
              <select
                id="select-product"
                aria-label="Select product"
                className={selectCls}
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
              >
                {filteredProducts.length === 0 && (
                  <option value="" disabled>No products for this service</option>
                )}
                {filteredProducts.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {pricingFields.map((field) => (
              <div className="space-y-2" key={field.id}>
                <Label htmlFor={`field-${field.id}`}>{field.label}</Label>
                <select
                  id={`field-${field.id}`}
                  aria-label={field.label}
                  className={selectCls}
                  value={selectedOptions[field.id] || ""}
                  onChange={(e) =>
                    setSelectedOptions((prev) => ({ ...prev, [field.id]: e.target.value }))
                  }
                >
                  <option value="">Select option</option>
                  {(field.options || []).map((opt) => (
                    <option key={opt.id} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            ))}

            <Button
              className="gap-2"
              variant="outline"
              onClick={() => selectedProductId && loadPricingData(selectedProductId)}
            >
              <SlidersHorizontal className="h-4 w-4" />
              Refresh Pricing
            </Button>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 shadow-sm dark:border-slate-800 lg:col-span-2">
          <CardHeader className="border-b border-slate-100 dark:border-slate-800">
            <CardTitle className="text-base font-semibold">Pricing Matrix</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-4 font-semibold">Configuration</th>
                    <th className="px-4 py-4 font-semibold">Unit Price (NPR)</th>
                    <th className="px-4 py-4 font-semibold">Discount</th>
                    <th className="px-4 py-4 w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {isLoading ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-10 text-center text-sm text-slate-500">
                        Loading pricing rows...
                      </td>
                    </tr>
                  ) : pricingRows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-10 text-center text-sm text-slate-500">
                        No pricing rows found.
                      </td>
                    </tr>
                  ) : (
                    pricingRows.map((row) => {
                      const edit = rowEdits[row.id] ?? {
                        unit_price: row.unit_price?.toString() ?? "",
                        discount_type: row.discount_type ?? null,
                        discount_value: row.discount_value != null ? String(row.discount_value) : "",
                      };
                      return (
                        <tr key={row.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-900 dark:text-white">
                              {renderCombination(row)}
                            </div>
                          </td>

                          <td className="px-4 py-3">
                            <Input
                              type="number"
                              min={0}
                              value={edit.unit_price}
                              onChange={(e) => handleFieldChange(row.id, "unit_price", e.target.value)}
                              className="h-8 w-32 text-sm"
                            />
                          </td>

                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <select
                                aria-label="Discount type"
                                className={`${selectCls} w-28`}
                                value={edit.discount_type || ""}
                                onChange={(e) => handleFieldChange(row.id, "discount_type", e.target.value)}
                              >
                                <option value="">None</option>
                                <option value="percentage">%</option>
                                <option value="fixed">NPR</option>
                              </select>
                              <Input
                                type="number"
                                min={0}
                                value={edit.discount_value}
                                disabled={!edit.discount_type}
                                onChange={(e) => handleFieldChange(row.id, "discount_value", e.target.value)}
                                className="h-8 w-20 text-sm disabled:opacity-40"
                                placeholder="0"
                              />
                            </div>
                          </td>

                          <td className="px-4 py-3 text-center">
                            {renderSaveState(row.id)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
