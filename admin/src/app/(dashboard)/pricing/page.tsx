"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SlidersHorizontal } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  createAdminPricingRow,
  fetchAdminPricingRows,
  fetchAdminProductById,
  fetchAdminProducts,
  updateAdminPricingRow,
  type AdminProduct,
  type AdminProductField,
  type DiscountType,
  type PricingRow,
} from "@/services/catalogAdminService";

export default function PricingPage() {
  const { toast } = useToast();
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [pricingFields, setPricingFields] = useState<AdminProductField[]>([]);
  const [pricingRows, setPricingRows] = useState<PricingRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [unitPrice, setUnitPrice] = useState("");
  const [discountType, setDiscountType] = useState<DiscountType>(null);
  const [discountValue, setDiscountValue] = useState("");

  const [editingRow, setEditingRow] = useState<PricingRow | null>(null);
  const [editUnitPrice, setEditUnitPrice] = useState("");
  const [editDiscountType, setEditDiscountType] = useState<DiscountType>(null);
  const [editDiscountValue, setEditDiscountValue] = useState("");

  const loadProducts = async () => {
    setIsLoading(true);
    try {
      const data = await fetchAdminProducts();
      setProducts(data);
      if (!selectedProductId && data.length > 0) {
        setSelectedProductId(data[0].id);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to load products.";
      toast({ title: "Load Failed", description: message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const loadPricingData = async (productId: string) => {
    if (!productId) return;
    setIsLoading(true);
    try {
      const [product, rows] = await Promise.all([
        fetchAdminProductById(productId),
        fetchAdminPricingRows(productId),
      ]);
      const pricingFieldsOnly = (product.fields || []).filter(
        (field) => field.is_pricing_field
      );
      setPricingFields(pricingFieldsOnly);
      setPricingRows(rows);
      setSelectedOptions({});
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to load pricing rows.";
      toast({ title: "Load Failed", description: message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    if (selectedProductId) {
      loadPricingData(selectedProductId);
    }
  }, [selectedProductId]);

  const handleCreatePricing = async () => {
    if (!selectedProductId || !unitPrice) return;
    if (pricingFields.some((field) => !selectedOptions[field.id])) {
      toast({
        title: "Missing Options",
        description: "Select values for every pricing field.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        selectedOptions: pricingFields.map((field) => ({
          fieldId: field.id,
          value: selectedOptions[field.id],
        })),
        unit_price: Number(unitPrice),
        discount_type: discountType || undefined,
        discount_value: discountValue ? Number(discountValue) : undefined,
      };
      const created = await createAdminPricingRow(selectedProductId, payload);
      setPricingRows((prev) => [created, ...prev]);
      setUnitPrice("");
      setDiscountType(null);
      setDiscountValue("");
      toast({
        title: "Pricing Saved",
        description: "Pricing line added to the matrix.",
        variant: "success",
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create pricing row.";
      toast({ title: "Create Failed", description: message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditDialog = (row: PricingRow) => {
    setEditingRow(row);
    setEditUnitPrice(row.unit_price?.toString() || "");
    setEditDiscountType(row.discount_type || null);
    setEditDiscountValue(
      row.discount_value !== undefined && row.discount_value !== null
        ? String(row.discount_value)
        : ""
    );
  };

  const handleUpdatePricing = async () => {
    if (!editingRow) return;
    setIsSubmitting(true);
    try {
      const updated = await updateAdminPricingRow(editingRow.id, {
        unit_price: editUnitPrice ? Number(editUnitPrice) : undefined,
        discount_type: editDiscountType || null,
        discount_value: editDiscountValue ? Number(editDiscountValue) : undefined,
      });
      setPricingRows((prev) =>
        prev.map((row) => (row.id === editingRow.id ? { ...row, ...updated } : row))
      );
      toast({
        title: "Pricing Updated",
        description: "Pricing line updated successfully.",
        variant: "success",
      });
      setEditingRow(null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to update pricing row.";
      toast({ title: "Update Failed", description: message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderCombination = (row: PricingRow) => {
    if (!row.selected_options || row.selected_options.length === 0) {
      return "—";
    }
    return row.selected_options
      .map((option) => option.display_value || option.value)
      .join(" · ");
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
          Configure pricing lines based on product configuration and quantity.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="border-slate-200/80 shadow-sm dark:border-slate-800 lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Select Product</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Product</Label>
              <select
                className="flex h-9 w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950 dark:border-slate-800 dark:focus-visible:ring-slate-300"
                value={selectedProductId}
                onChange={(event) => setSelectedProductId(event.target.value)}
              >
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </div>
            {pricingFields.map((field) => (
              <div className="space-y-2" key={field.id}>
                <Label>{field.label}</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950 dark:border-slate-800 dark:focus-visible:ring-slate-300"
                  value={selectedOptions[field.id] || ""}
                  onChange={(event) =>
                    setSelectedOptions((prev) => ({
                      ...prev,
                      [field.id]: event.target.value,
                    }))
                  }
                >
                  <option value="">Select option</option>
                  {(field.options || []).map((option) => (
                    <option key={option.id} value={option.value}>
                      {option.label}
                    </option>
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
                    <th className="px-6 py-4 font-semibold">Configuration</th>
                    <th className="px-6 py-4 font-semibold">Unit Price</th>
                    <th className="px-6 py-4 font-semibold">Discount</th>
                    <th className="px-6 py-4 text-right font-semibold">Action</th>
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
                    pricingRows.map((row) => (
                      <tr key={row.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="px-6 py-4">
                          <div className="font-medium text-slate-900 dark:text-white">
                            {renderCombination(row)}
                          </div>
                          <div className="text-xs text-slate-500">{row.id}</div>
                        </td>
                        <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                          NPR {row.unit_price ?? "—"}
                        </td>
                        <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                          {row.discount_type
                            ? `${row.discount_value ?? 0}${row.discount_type === "percentage" ? "%" : " NPR"}`
                            : "No discount"}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Button size="sm" variant="outline" onClick={() => openEditDialog(row)}>
                            Update
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!editingRow} onOpenChange={() => setEditingRow(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Update Pricing Row</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Unit Price</Label>
              <Input
                type="number"
                value={editUnitPrice}
                onChange={(event) => setEditUnitPrice(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Discount Type</Label>
              <select
                className="flex h-9 w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950 dark:border-slate-800 dark:focus-visible:ring-slate-300"
                value={editDiscountType || ""}
                onChange={(event) =>
                  setEditDiscountType(event.target.value as DiscountType)
                }
              >
                <option value="">None</option>
                <option value="percentage">Percentage</option>
                <option value="fixed">Fixed</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Discount Value</Label>
              <Input
                type="number"
                value={editDiscountValue}
                onChange={(event) => setEditDiscountValue(event.target.value)}
                disabled={!editDiscountType}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditingRow(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdatePricing} disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Update"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
