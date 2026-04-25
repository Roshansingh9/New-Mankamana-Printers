"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Trash2, Wand2, IndianRupee } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { listPricing, createPricingRow, updatePricingRow, deletePricingRow } from "../service";
import type { PriceRow, ProductOption } from "../types";

interface Props {
  productId: string;
  options: ProductOption[];
}

// Cartesian product of arrays
function cartesian<T>(arrays: T[][]): T[][] {
  if (arrays.length === 0) return [[]];
  const [first, ...rest] = arrays;
  const restProduct = cartesian(rest);
  return first.flatMap((item) => restProduct.map((combo) => [item, ...combo]));
}

export function PricingSection({ productId, options }: Props) {
  const { toast } = useToast();
  const [rows, setRows] = useState<PriceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Debounced price edits
  const [prices, setPrices] = useState<Record<string, string>>({});
  const pricesRef = useRef<Record<string, string>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listPricing(productId);
      setRows(data);
      const init: Record<string, string> = {};
      data.forEach((r) => { init[r.id] = r.price != null ? String(r.price) : ""; });
      pricesRef.current = init;
      setPrices(init);
    } catch (e) {
      toast({ title: "Error loading prices", description: (e as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [productId, toast]);

  useEffect(() => { load(); }, [load]);
  // Reload when options change (choices added/removed)
  useEffect(() => { load(); }, [options, load]);

  const handlePriceChange = (rowId: string, value: string) => {
    pricesRef.current[rowId] = value;
    setPrices((prev) => ({ ...prev, [rowId]: value }));
    clearTimeout(timers.current[rowId]);
    timers.current[rowId] = setTimeout(async () => {
      const num = parseFloat(pricesRef.current[rowId]);
      if (isNaN(num) || num < 0) return;
      setSavingId(rowId);
      try {
        await updatePricingRow(rowId, num);
        setRows((prev) => prev.map((r) => r.id === rowId ? { ...r, price: num } : r));
      } catch {
        toast({ title: "Could not save price", variant: "destructive" });
      } finally {
        setSavingId(null);
      }
    }, 700);
  };

  const handleDelete = async (rowId: string) => {
    setDeletingId(rowId);
    try {
      await deletePricingRow(rowId);
      setRows((prev) => prev.filter((r) => r.id !== rowId));
      setPrices((prev) => { const n = { ...prev }; delete n[rowId]; return n; });
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  // Pricing options only (options that affect price)
  const pricingOptions = options.filter((o) => o.is_pricing_field && o.choices.length > 0);

  const handleGenerate = async () => {
    if (pricingOptions.length === 0) {
      toast({ title: "No pricing options", description: "Add at least one option marked as 'affects price' with choices.", variant: "destructive" });
      return;
    }
    setGenerating(true);
    try {
      const choiceArrays = pricingOptions.map((o) => o.choices.map((c) => ({ fieldId: o.id, value: c.value })));
      const combinations = cartesian(choiceArrays);

      // Find already existing combination keys
      const existingKeys = new Set(
        rows.map((r) =>
          r.selectedOptions
            .slice()
            .sort((a, b) => a.fieldKey.localeCompare(b.fieldKey))
            .map((o) => `${o.fieldKey}:${o.value}`)
            .join("|")
        )
      );

      let created = 0;
      for (const combo of combinations) {
        const key = combo
          .slice()
          .sort((a, b) => {
            const fa = pricingOptions.find((o) => o.id === a.fieldId)?.field_key ?? a.fieldId;
            const fb = pricingOptions.find((o) => o.id === b.fieldId)?.field_key ?? b.fieldId;
            return fa.localeCompare(fb);
          })
          .map((item) => {
            const fk = pricingOptions.find((o) => o.id === item.fieldId)?.field_key ?? item.fieldId;
            return `${fk}:${item.value}`;
          })
          .join("|");

        if (!existingKeys.has(key)) {
          await createPricingRow(productId, combo, 0);
          created++;
        }
      }

      await load();
      if (created > 0) {
        toast({ title: `${created} price row${created !== 1 ? "s" : ""} generated`, description: "Fill in the prices below." });
      } else {
        toast({ title: "All combinations already exist" });
      }
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const hasOptions = options.some((o) => o.choices.length > 0);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Pricing</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {hasOptions
              ? "Click \"Generate\" to create all combinations, then fill in the prices."
              : "Add customization options above first, then come back here to set prices."}
          </p>
        </div>
        {hasOptions && (
          <Button size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={handleGenerate} disabled={generating}>
            {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
            Generate
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-400 py-4">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading prices…
        </div>
      ) : rows.length === 0 ? (
        <p className="text-xs text-slate-400 italic py-2">
          {hasOptions ? "No prices yet — click Generate." : "No prices yet."}
        </p>
      ) : (
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Configuration
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide w-40">
                  Price (NPR)
                </th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-2.5">
                    <span className="text-slate-700 dark:text-slate-300">
                      {row.combination}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <IndianRupee className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <Input
                        type="number"
                        min={0}
                        value={prices[row.id] ?? ""}
                        onChange={(e) => handlePriceChange(row.id, e.target.value)}
                        className="h-7 w-28 text-sm"
                        placeholder="0"
                      />
                      {savingId === row.id && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => handleDelete(row.id)}
                      disabled={deletingId === row.id}
                      className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 transition-colors"
                    >
                      {deletingId === row.id
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Trash2 className="h-3.5 w-3.5" />
                      }
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
