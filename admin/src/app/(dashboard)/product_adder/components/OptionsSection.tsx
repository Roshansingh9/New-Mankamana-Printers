"use client";

import { useState } from "react";
import { Plus, X, Loader2, Pencil, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { createField, updateField, deleteField, createChoice, updateChoice, deleteChoice } from "../service";
import type { Product, ProductOption } from "../types";

interface Props {
  product: Product;
  onOptionsChange: (opts: ProductOption[]) => void;
}

export function OptionsSection({ product, onOptionsChange }: Props) {
  const { toast } = useToast();

  // --- add option ---
  const [newOptLabel, setNewOptLabel] = useState("");
  const [affectsPrice, setAffectsPrice] = useState(true);
  const [addingOpt, setAddingOpt] = useState(false);

  // --- edit option (field) ---
  const [editingOptId, setEditingOptId] = useState<string | null>(null);
  const [editOptLabel, setEditOptLabel] = useState("");
  const [editOptPricing, setEditOptPricing] = useState(false);
  const [savingOptId, setSavingOptId] = useState<string | null>(null);

  // --- delete option ---
  const [deletingOptId, setDeletingOptId] = useState<string | null>(null);

  // --- add choice ---
  const [newChoice, setNewChoice] = useState<Record<string, string>>({});
  const [addingChoice, setAddingChoice] = useState<Record<string, boolean>>({});

  // --- edit choice ---
  const [editingChoiceId, setEditingChoiceId] = useState<string | null>(null);
  const [editChoiceLabel, setEditChoiceLabel] = useState("");
  const [savingChoiceId, setSavingChoiceId] = useState<string | null>(null);

  // --- delete choice ---
  const [deletingChoiceId, setDeletingChoiceId] = useState<string | null>(null);

  async function handleAddOption() {
    if (!newOptLabel.trim()) return;
    setAddingOpt(true);
    try {
      const opt = await createField(product.id, newOptLabel.trim(), affectsPrice);
      onOptionsChange([...product.options, opt]);
      setNewOptLabel("");
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    } finally { setAddingOpt(false); }
  }

  function startEditOpt(opt: ProductOption) {
    setEditingOptId(opt.id);
    setEditOptLabel(opt.label);
    setEditOptPricing(opt.is_pricing_field);
  }

  async function handleSaveOpt(optId: string) {
    if (!editOptLabel.trim()) return;
    setSavingOptId(optId);
    try {
      await updateField(optId, editOptLabel.trim(), editOptPricing);
      onOptionsChange(product.options.map(o =>
        o.id === optId ? { ...o, label: editOptLabel.trim(), is_pricing_field: editOptPricing } : o
      ));
      setEditingOptId(null);
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    } finally { setSavingOptId(null); }
  }

  async function handleDeleteOption(id: string, label: string) {
    if (!confirm(`Remove "${label}" and all its choices?`)) return;
    setDeletingOptId(id);
    try {
      await deleteField(id);
      onOptionsChange(product.options.filter(o => o.id !== id));
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    } finally { setDeletingOptId(null); }
  }

  async function handleAddChoice(optId: string) {
    const label = (newChoice[optId] ?? "").trim();
    if (!label) return;
    setAddingChoice(p => ({ ...p, [optId]: true }));
    try {
      const c = await createChoice(optId, label);
      onOptionsChange(product.options.map(o =>
        o.id === optId ? { ...o, choices: [...o.choices, { id: c.id, value: c.value, label: c.label }] } : o
      ));
      setNewChoice(p => ({ ...p, [optId]: "" }));
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    } finally { setAddingChoice(p => ({ ...p, [optId]: false })); }
  }

  function startEditChoice(choiceId: string, label: string) {
    setEditingChoiceId(choiceId);
    setEditChoiceLabel(label);
  }

  async function handleSaveChoice(optId: string, choiceId: string) {
    if (!editChoiceLabel.trim()) return;
    setSavingChoiceId(choiceId);
    try {
      await updateChoice(choiceId, editChoiceLabel.trim());
      onOptionsChange(product.options.map(o =>
        o.id === optId
          ? { ...o, choices: o.choices.map(c => c.id === choiceId ? { ...c, label: editChoiceLabel.trim() } : c) }
          : o
      ));
      setEditingChoiceId(null);
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    } finally { setSavingChoiceId(null); }
  }

  async function handleDeleteChoice(optId: string, choiceId: string) {
    setDeletingChoiceId(choiceId);
    try {
      await deleteChoice(choiceId);
      onOptionsChange(product.options.map(o =>
        o.id === optId ? { ...o, choices: o.choices.filter(c => c.id !== choiceId) } : o
      ));
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    } finally { setDeletingChoiceId(null); }
  }

  return (
    <section className="space-y-4">
      <div>
        <h3 className="font-semibold text-slate-800 dark:text-slate-100">Customization Options</h3>
        <p className="text-sm text-slate-500 mt-0.5">
          What can customers choose when ordering? e.g. Size, Paper Type, Finish.
        </p>
      </div>

      {product.options.length === 0 && (
        <p className="text-sm text-slate-400 italic">No options yet — add one below.</p>
      )}

      {product.options.map(opt => (
        <div key={opt.id} className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
          {/* Option header */}
          <div className="flex items-center justify-between gap-2">
            {editingOptId === opt.id ? (
              <div className="flex flex-1 items-center gap-2 min-w-0">
                <Input value={editOptLabel} onChange={e => setEditOptLabel(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleSaveOpt(opt.id); if (e.key === "Escape") setEditingOptId(null); }}
                  className="h-7 text-sm flex-1" autoFocus />
                <label className="flex items-center gap-1.5 text-xs text-slate-500 whitespace-nowrap cursor-pointer shrink-0">
                  <input type="checkbox" checked={editOptPricing} onChange={e => setEditOptPricing(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-slate-300" />
                  affects price
                </label>
                <button type="button" onClick={() => handleSaveOpt(opt.id)} disabled={savingOptId === opt.id}
                  className="shrink-0 p-1 rounded text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors">
                  {savingOptId === opt.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                </button>
                <button type="button" onClick={() => setEditingOptId(null)}
                  className="shrink-0 p-1 rounded text-slate-400 hover:text-slate-600 transition-colors">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="font-medium text-slate-800 dark:text-slate-100 truncate">{opt.label}</span>
                {opt.is_pricing_field && (
                  <span className="text-[11px] bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-2 py-0.5 rounded-full font-medium shrink-0">
                    affects price
                  </span>
                )}
                <button type="button" onClick={() => startEditOpt(opt)}
                  className="shrink-0 p-1 rounded text-slate-300 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors opacity-0 group-hover:opacity-100">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {editingOptId !== opt.id && (
              <button type="button" disabled={deletingOptId === opt.id}
                onClick={() => handleDeleteOption(opt.id, opt.label)}
                className="shrink-0 text-slate-400 hover:text-red-500 transition-colors p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20">
                {deletingOptId === opt.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
              </button>
            )}
          </div>

          {/* Choices */}
          <div className="flex flex-wrap gap-2">
            {opt.choices.length === 0 && <span className="text-xs text-slate-400 italic">No choices yet</span>}
            {opt.choices.map(c => (
              <span key={c.id} className="group/chip inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-sm text-slate-700 dark:text-slate-200">
                {editingChoiceId === c.id ? (
                  <span className="flex items-center gap-1">
                    <input
                      value={editChoiceLabel}
                      onChange={e => setEditChoiceLabel(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") handleSaveChoice(opt.id, c.id); if (e.key === "Escape") setEditingChoiceId(null); }}
                      className="w-24 h-5 text-xs px-1 rounded border border-slate-300 dark:border-slate-500 bg-white dark:bg-slate-800 focus:outline-none"
                      autoFocus
                    />
                    <button type="button" onClick={() => handleSaveChoice(opt.id, c.id)} disabled={savingChoiceId === c.id}
                      className="text-green-600 hover:text-green-700 transition-colors">
                      {savingChoiceId === c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                    </button>
                    <button type="button" onClick={() => setEditingChoiceId(null)}
                      className="text-slate-400 hover:text-slate-600 transition-colors">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ) : (
                  <>
                    {c.label}
                    <button type="button" onClick={() => startEditChoice(c.id, c.label)}
                      className="text-slate-300 hover:text-slate-600 transition-colors ml-0.5 opacity-0 group-hover/chip:opacity-100">
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button type="button" disabled={deletingChoiceId === c.id}
                      onClick={() => handleDeleteChoice(opt.id, c.id)}
                      className="text-slate-400 hover:text-red-500 transition-colors ml-0.5">
                      {deletingChoiceId === c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                    </button>
                  </>
                )}
              </span>
            ))}
          </div>

          {/* Add choice */}
          <div className="flex gap-2">
            <Input placeholder="Add a choice…" value={newChoice[opt.id] ?? ""}
              onChange={e => setNewChoice(p => ({ ...p, [opt.id]: e.target.value }))}
              onKeyDown={e => e.key === "Enter" && handleAddChoice(opt.id)}
              className="h-8 text-sm" />
            <Button size="sm" variant="outline" className="h-8 shrink-0"
              onClick={() => handleAddChoice(opt.id)} disabled={addingChoice[opt.id]}>
              {addingChoice[opt.id] ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
      ))}

      {/* Add new option */}
      <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-600 p-4 space-y-2">
        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Add a new option</p>
        <div className="flex gap-2">
          <Input placeholder='e.g. "Paper Size" or "Finish"' value={newOptLabel}
            onChange={e => setNewOptLabel(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleAddOption()}
            className="h-9" />
          <Button onClick={handleAddOption} disabled={addingOpt || !newOptLabel.trim()} className="h-9 shrink-0 gap-1">
            {addingOpt ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add
          </Button>
        </div>
        <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-600 dark:text-slate-400">
          <input type="checkbox" checked={affectsPrice} onChange={e => setAffectsPrice(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300" />
          Different choices have different prices
        </label>
      </div>
    </section>
  );
}
