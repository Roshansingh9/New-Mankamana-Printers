"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Trash2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { listPricing, createPricingRow, updatePricingRow, deletePricingRow } from "../service";
import type { PriceRow, ProductOption } from "../types";

function cartesian<T>(arrays: T[][]): T[][] {
  if (!arrays.length) return [[]];
  const [first, ...rest] = arrays;
  return first.flatMap(item => cartesian(rest).map(combo => [item, ...combo]));
}

interface Props {
  productId: string;
  options: ProductOption[];
}

export function PricingSection({ productId, options }: Props) {
  const { toast } = useToast();
  const [rows, setRows] = useState<PriceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const pricesRef = useRef<Record<string, string>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const savedPricesRef = useRef<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listPricing(productId);
      setRows(data);
      const init: Record<string, string> = {};
      data.forEach(r => { init[r.id] = r.price != null ? String(r.price) : ""; });
      pricesRef.current = init;
      savedPricesRef.current = { ...init };
      setPrices(init);
    } catch (e) {
      toast({ title: "Could not load prices", description: (e as Error).message, variant: "destructive" });
    } finally { setLoading(false); }
  }, [productId, toast]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { load(); }, [options, load]);

  function handlePriceChange(rowId: string, val: string) {
    pricesRef.current[rowId] = val;
    setPrices(p => ({ ...p, [rowId]: val }));
    clearTimeout(timers.current[rowId]);
    timers.current[rowId] = setTimeout(async () => {
      const n = parseFloat(pricesRef.current[rowId]);
      if (isNaN(n) || n < 0) return;
      setSavingId(rowId);
      try {
        await updatePricingRow(rowId, n);
        savedPricesRef.current[rowId] = pricesRef.current[rowId];
      } catch {
        toast({ title: "Could not save price", variant: "destructive" });
        const revert = savedPricesRef.current[rowId] ?? "";
        pricesRef.current[rowId] = revert;
        setPrices(p => ({ ...p, [rowId]: revert }));
      }
      finally { setSavingId(null); }
    }, 700);
  }

  async function handleDelete(rowId: string) {
    setDeletingId(rowId);
    try {
      await deletePricingRow(rowId);
      setRows(r => r.filter(x => x.id !== rowId));
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    } finally { setDeletingId(null); }
  }

  async function handleGenerate() {
    const pricingOpts = options.filter(o => o.is_pricing_field && o.choices.length > 0);
    if (!pricingOpts.length) {
      toast({ title: "No pricing options", description: "Add an option marked 'affects price' with at least one choice first.", variant: "destructive" });
      return;
    }
    setGenerating(true);
    let created = 0;
    let skipped = 0;
    try {
      const existingKeys = new Set(rows.map(r =>
        r.selectedOptions.slice().sort((a, b) => a.fieldKey.localeCompare(b.fieldKey))
          .map(o => `${o.fieldKey}:${o.value}`).join("|")
      ));

      const choiceArrays = pricingOpts.map(o => o.choices.map(c => ({ fieldId: o.id, fk: o.field_key, value: c.value })));
      for (const combo of cartesian(choiceArrays)) {
        const key = combo.slice().sort((a, b) => a.fk.localeCompare(b.fk)).map(x => `${x.fk}:${x.value}`).join("|");
        if (!existingKeys.has(key)) {
          try {
            await createPricingRow(productId, combo.map(x => ({ fieldId: x.fieldId, value: x.value })), 0);
            created++;
          } catch {
            skipped++;
          }
        }
      }
      toast({ title: created > 0 ? `${created} price row${created > 1 ? "s" : ""} created` : "All combinations already exist" });
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    } finally {
      await load();
      setGenerating(false);
    }
  }

  const hasOptions = options.some(o => o.choices.length > 0);

  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">Pricing</h3>
          <p className="text-sm text-slate-500 mt-0.5">
            {hasOptions
              ? 'Click "Generate" to create all combinations, then fill in the prices.'
              : "Add options with choices above first, then set prices here."}
          </p>
        </div>
        {hasOptions && (
          <Button size="sm" variant="outline" className="shrink-0 gap-1.5" onClick={handleGenerate} disabled={generating}>
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            Generate
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex gap-2 items-center text-slate-400 text-sm py-4">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-400 italic">
          {hasOptions ? "No prices yet — click Generate." : "No prices yet."}
        </p>
      ) : (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs uppercase text-slate-500 tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Configuration</th>
                <th className="px-4 py-3 text-left font-semibold w-44">Price (NPR)</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.map(row => (
                <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{row.combination}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <Input type="number" min={0} placeholder="0"
                        value={prices[row.id] ?? ""}
                        onChange={e => handlePriceChange(row.id, e.target.value)}
                        className="h-8 w-28 text-sm" />
                      {savingId === row.id && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <button type="button" onClick={() => handleDelete(row.id)} disabled={deletingId === row.id}
                      className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                      {deletingId === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
