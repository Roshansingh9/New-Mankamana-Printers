"use client";

import { useState } from "react";
import { PlusCircle, Trash2, Loader2, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { autoCode, createProduct, deleteProduct } from "../service";
import type { Product, Service } from "../types";

interface Props {
  products: Product[];
  services: Service[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreated: (p: Product) => void;
  onDeleted: (id: string) => void;
}

export function ProductList({ products, services, selectedId, onSelect, onCreated, onDeleted }: Props) {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!name.trim()) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    if (!serviceId) {
      toast({ title: "Select a category", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const p = await createProduct(serviceId, {
        product_code: autoCode(name),
        name: name.trim(),
        description: description.trim() || undefined,
      });
      onCreated(p);
      setName(""); setDescription(""); setShowForm(false);
      toast({ title: "Product created", description: p.name });
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (p: Product, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Remove "${p.name}"? This cannot be undone.`)) return;
    setDeletingId(p.id);
    try {
      await deleteProduct(p.id);
      onDeleted(p.id);
      toast({ title: "Removed", description: p.name });
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          Products ({products.length})
        </span>
        <Button size="sm" className="gap-1.5 h-8" onClick={() => setShowForm((v) => !v)}>
          <PlusCircle className="h-3.5 w-3.5" />
          New
        </Button>
      </div>

      {/* New product form */}
      {showForm && (
        <div className="border-b border-slate-100 bg-slate-50 p-4 space-y-3 dark:border-slate-800 dark:bg-slate-800/50">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">New Product</p>

          <div className="space-y-1.5">
            <Label htmlFor="np-service">Category</Label>
            <select
              id="np-service"
              className="flex h-9 w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950 dark:border-slate-700"
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
            >
              {services.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="np-name">Product Name</Label>
            <Input
              id="np-name"
              placeholder="e.g. Business Card"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="np-desc">Description (optional)</Label>
            <Input
              id="np-desc"
              placeholder="Short description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreate} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlusCircle className="h-3.5 w-3.5" />}
              Create
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Product list */}
      <div className="flex-1 overflow-y-auto">
        {products.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-sm text-slate-400">
            <Package className="h-8 w-8 opacity-40" />
            <p>No products yet.</p>
            <p className="text-xs">Click "New" to add one.</p>
          </div>
        ) : (
          products.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelect(p.id)}
              className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 ${
                selectedId === p.id
                  ? "bg-[#0061FF]/5 border-l-2 border-l-[#0061FF]"
                  : ""
              }`}
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                  {p.name}
                </div>
                <div className="text-xs text-slate-400 font-mono">{p.product_code}</div>
              </div>
              <button
                type="button"
                onClick={(e) => handleDelete(p, e)}
                disabled={deletingId === p.id}
                className="ml-2 shrink-0 rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 transition-colors"
                title="Remove product"
              >
                {deletingId === p.id
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Trash2 className="h-3.5 w-3.5" />
                }
              </button>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
