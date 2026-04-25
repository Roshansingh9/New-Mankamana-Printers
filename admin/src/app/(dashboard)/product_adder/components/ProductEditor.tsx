"use client";

import { useState } from "react";
import { Check, Loader2, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { updateProduct } from "../service";
import { OptionsSection } from "./OptionsSection";
import { PricingSection } from "./PricingSection";
import type { Product, ProductOption, Service } from "../types";

interface Props {
  product: Product;
  services: Service[];
  onProductUpdated: (updated: Product) => void;
}

export function ProductEditor({ product, services, onProductUpdated }: Props) {
  const { toast } = useToast();
  const serviceName = services.find((s) => s.id === product.service_id)?.name ?? "—";

  // Inline name/description editing
  const [editingName, setEditingName] = useState(false);
  const [editName, setEditName] = useState(product.name);
  const [editDesc, setEditDesc] = useState(product.description ?? "");
  const [saving, setSaving] = useState(false);

  // Live options (updated as user adds/removes)
  const [options, setOptions] = useState<ProductOption[]>(product.options);

  const handleSaveInfo = async () => {
    if (!editName.trim()) {
      toast({ title: "Name cannot be empty", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await updateProduct(product.id, {
        name: editName.trim(),
        description: editDesc.trim() || undefined,
      });
      onProductUpdated({ ...product, name: editName.trim(), description: editDesc.trim() || null });
      setEditingName(false);
      toast({ title: "Saved" });
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditName(product.name);
    setEditDesc(product.description ?? "");
    setEditingName(false);
  };

  const handleOptionsChange = (updated: ProductOption[]) => {
    setOptions(updated);
    onProductUpdated({ ...product, options: updated });
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {/* Top info bar */}
      <div className="border-b border-slate-100 px-6 py-4 dark:border-slate-800">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {editingName ? (
              <div className="space-y-2">
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="text-lg font-semibold h-9"
                  placeholder="Product name"
                  autoFocus
                />
                <Input
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="text-sm"
                  placeholder="Short description (optional)"
                />
                <div className="flex gap-2">
                  <Button size="sm" className="gap-1.5 h-7" onClick={handleSaveInfo} disabled={saving}>
                    {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7" onClick={handleCancelEdit}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white truncate">
                    {product.name}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setEditingName(true)}
                    className="shrink-0 rounded p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    title="Edit name"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>
                {product.description && (
                  <p className="text-sm text-slate-500 mt-0.5">{product.description}</p>
                )}
              </div>
            )}
          </div>
          <div className="shrink-0 text-right">
            <div className="text-xs text-slate-400 font-mono">{product.product_code}</div>
            <div className="text-xs text-slate-400 mt-0.5">{serviceName}</div>
          </div>
        </div>
      </div>

      {/* Sections */}
      <div className="flex-1 px-6 py-5 space-y-8">
        {/* Step indicator */}
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#0061FF] text-white text-[10px] font-bold">1</span>
          <span className="text-slate-500 font-medium">Options</span>
          <span className="flex-1 h-px bg-slate-200 dark:bg-slate-700 mx-1" />
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#0061FF] text-white text-[10px] font-bold">2</span>
          <span className="text-slate-500 font-medium">Pricing</span>
        </div>

        {/* Options */}
        <OptionsSection
          product={{ ...product, options }}
          onOptionsChange={handleOptionsChange}
        />

        {/* Divider */}
        <div className="border-t border-slate-100 dark:border-slate-800" />

        {/* Pricing */}
        <PricingSection productId={product.id} options={options} />
      </div>
    </div>
  );
}
