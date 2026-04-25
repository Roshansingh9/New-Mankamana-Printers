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
      // Auto-select first product if none selected
      setSelectedId((prev) => prev ?? (prods[0]?.id ?? null));
    } catch (e) {
      toast({ title: "Failed to load", description: (e as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const selectedProduct = products.find((p) => p.id === selectedId) ?? null;

  const handleCreated = (p: Product) => {
    setProducts((prev) => [p, ...prev]);
    setSelectedId(p.id);
  };

  const handleDeleted = (id: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));
    setSelectedId((prev) => {
      if (prev !== id) return prev;
      const remaining = products.filter((p) => p.id !== id);
      return remaining[0]?.id ?? null;
    });
  };

  const handleUpdated = (updated: Product) => {
    setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  };

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#0061FF]">Catalog</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">Products</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Add and manage products, their customization options, and pricing.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-20 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading products…</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-0 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden dark:border-slate-800 dark:bg-slate-900">
          {/* Left: product list */}
          <div className="border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 min-h-[420px]">
            <ProductList
              products={products}
              services={services}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onCreated={handleCreated}
              onDeleted={handleDeleted}
            />
          </div>

          {/* Right: product editor */}
          <div className="min-h-[420px]">
            {selectedProduct ? (
              <ProductEditor
                key={selectedProduct.id}
                product={selectedProduct}
                services={services}
                onProductUpdated={handleUpdated}
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 py-20 text-slate-400">
                <MousePointerClick className="h-8 w-8 opacity-40" />
                <p className="text-sm">Select a product to edit, or create a new one.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
