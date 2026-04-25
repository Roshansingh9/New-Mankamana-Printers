"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, MousePointerClick } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { listProducts, listServices } from "./service";
import { ProductList } from "./components/ProductList";
import { ProductEditor } from "./components/ProductEditor";
import type { Product, Service } from "./types";

export default function ProductAdderPage() {
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [prods, svcs] = await Promise.all([listProducts(), listServices()]);
      setProducts(prods);
      setServices(svcs);
      setSelectedId(prev => prev ?? prods[0]?.id ?? null);
    } catch (e) {
      toast({ title: "Failed to load", description: (e as Error).message, variant: "destructive" });
    } finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const selected = products.find(p => p.id === selectedId) ?? null;

  function handleCreated(p: Product) {
    setProducts(prev => [p, ...prev]);
    setSelectedId(p.id);
  }

  function handleDeleted(id: string) {
    const remaining = products.filter(p => p.id !== id);
    setProducts(remaining);
    setSelectedId(prev => prev === id ? (remaining[0]?.id ?? null) : prev);
  }

  function handleUpdated(updated: Product) {
    setProducts(prev => prev.map(p => p.id === updated.id ? updated : p));
  }

  return (
    <div className="space-y-5 h-full">
      {/* Header */}
      <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#0061FF]">Catalog</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">Products</h1>
        <p className="mt-1 text-sm text-slate-500">
          Create and manage products, their options, and prices — all in one place.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-24 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading…</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden dark:border-slate-800 dark:bg-slate-900 min-h-[560px]">
          {/* Left */}
          <div className="border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800">
            <ProductList
              products={products}
              services={services}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onCreated={handleCreated}
              onDeleted={handleDeleted}
            />
          </div>

          {/* Right */}
          <div>
            {selected ? (
              <ProductEditor
                key={selected.id}
                product={selected}
                services={services}
                onUpdated={handleUpdated}
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-400 py-24">
                <MousePointerClick className="h-10 w-10 opacity-30" />
                <p className="text-sm">Select a product on the left, or create a new one.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
