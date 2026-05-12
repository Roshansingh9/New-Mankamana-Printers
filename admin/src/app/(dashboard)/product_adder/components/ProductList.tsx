"use client";

import { useState } from "react";
import { Plus, Trash2, Loader2, Box } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleCreate() {
    if (!name.trim()) return toast({ title: "Enter a product name", variant: "destructive" });
    if (!serviceId) return toast({ title: "Select a service category first", variant: "destructive" });
    setSaving(true);
    try {
      const p = await createProduct(serviceId, { product_code: autoCode(name), name: name.trim(), description: desc.trim() || undefined });
      onCreated(p);
      setName(""); setDesc(""); setOpen(false);
      toast({ title: `"${p.name}" created` });
    } catch (e) {
      toast({ title: "Failed", description: (e as Error).message, variant: "destructive" });
    } finally { setSaving(false); }
  }

  async function handleDelete(p: Product, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`Remove "${p.name}"?`)) return;
    setDeletingId(p.id);
    try {
      await deleteProduct(p.id);
      onDeleted(p.id);
    } catch (e) {
      toast({ title: "Failed", description: (e as Error).message, variant: "destructive" });
    } finally { setDeletingId(null); }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          All Products
        </span>
        <Button size="sm" className="h-8 gap-1" onClick={() => setOpen(v => !v)}>
          <Plus className="h-3.5 w-3.5" /> Add
        </Button>
      </div>

      {/* New product form */}
      {open && (
        <div className="px-4 py-3 bg-blue-50 dark:bg-blue-950/30 border-b border-blue-100 dark:border-blue-900 space-y-2">
          <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">New Product</p>

          {services.length > 1 && (
            <select
              className="w-full h-8 rounded-md border border-slate-200 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-900"
              value={serviceId}
              onChange={e => setServiceId(e.target.value)}
            >
              {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}

          <Input placeholder="Product name *" value={name} onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleCreate()} className="h-8 text-sm" autoFocus />
          <Input placeholder="Short description (optional)" value={desc} onChange={e => setDesc(e.target.value)} className="h-8 text-sm" />

          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreate} disabled={saving} className="h-7 gap-1">
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />} Create
            </Button>
            <Button size="sm" variant="ghost" className="h-7" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {products.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-14 text-slate-400 text-sm text-center">
            <Box className="h-8 w-8 opacity-30" />
            <p>No products yet.</p>
            <p className="text-xs">Click &quot;Add&quot; to create one.</p>
          </div>
        ) : products.map(p => (
          <button key={p.id} type="button" onClick={() => onSelect(p.id)}
            className={`group w-full flex items-center justify-between px-4 py-3 text-left border-b border-slate-100 dark:border-slate-800 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40
              ${selectedId === p.id ? "bg-blue-50 dark:bg-blue-950/20 border-l-2 border-l-[#0061FF]" : ""}`}>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{p.name}</div>
              {p.description && <div className="truncate text-xs text-slate-400 mt-0.5">{p.description}</div>}
            </div>
            <button type="button" onClick={e => handleDelete(p, e)} disabled={deletingId === p.id}
              className="ml-2 shrink-0 p-1 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors opacity-0 group-hover:opacity-100">
              {deletingId === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            </button>
          </button>
        ))}
      </div>
    </div>
  );
}
