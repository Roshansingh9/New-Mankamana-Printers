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
  onUpdated: (p: Product) => void;
}

export function ProductEditor({ product, services, onUpdated }: Props) {
  const { toast } = useToast();
  const serviceName = services.find(s => s.id === product.service_id)?.name ?? "";
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(product.name);
  const [desc, setDesc] = useState(product.description ?? "");
  const [saving, setSaving] = useState(false);
  const [options, setOptions] = useState<ProductOption[]>(product.options);

  async function handleSave() {
    if (!name.trim()) return toast({ title: "Name cannot be empty", variant: "destructive" });
    setSaving(true);
    try {
      await updateProduct(product.id, { name: name.trim(), description: desc.trim() || undefined });
      onUpdated({ ...product, name: name.trim(), description: desc.trim() || null, options });
      setEditing(false);
      toast({ title: "Saved" });
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    } finally { setSaving(false); }
  }

  function handleOptionsChange(opts: ProductOption[]) {
    setOptions(opts);
    onUpdated({ ...product, options: opts });
  }

  return (
    <div className="h-full flex flex-col overflow-y-auto">
      {/* Info bar */}
      <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800">
        {editing ? (
          <div className="space-y-2">
            <Input value={name} onChange={e => setName(e.target.value)} className="font-semibold text-base h-9" autoFocus />
            <Input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Description (optional)" className="text-sm" />
            <div className="flex gap-2">
              <Button size="sm" className="h-7 gap-1" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Save
              </Button>
              <Button size="sm" variant="ghost" className="h-7" onClick={() => { setName(product.name); setDesc(product.description ?? ""); setEditing(false); }}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{product.name}</h2>
                <button type="button" onClick={() => setEditing(true)}
                  className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
              {product.description && <p className="text-sm text-slate-500 mt-0.5">{product.description}</p>}
            </div>
            <div className="text-right shrink-0">
              <div className="text-xs text-slate-400 font-mono">{product.product_code}</div>
              {serviceName && <div className="text-xs text-slate-400 mt-0.5">{serviceName}</div>}
            </div>
          </div>
        )}
      </div>

      {/* Sections */}
      <div className="flex-1 px-6 py-6 space-y-8">
        <OptionsSection product={{ ...product, options }} onOptionsChange={handleOptionsChange} />
        <div className="border-t border-slate-100 dark:border-slate-800" />
        <PricingSection productId={product.id} options={options} />
      </div>
    </div>
  );
}
