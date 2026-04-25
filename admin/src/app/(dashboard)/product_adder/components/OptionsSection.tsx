"use client";

import { useState } from "react";
import { PlusCircle, Trash2, Loader2, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { createField, deleteField, createChoice, deleteChoice } from "../service";
import type { Product, ProductOption } from "../types";

interface Props {
  product: Product;
  onOptionsChange: (options: ProductOption[]) => void;
}

export function OptionsSection({ product, onOptionsChange }: Props) {
  const { toast } = useToast();

  // New option form
  const [newOptionLabel, setNewOptionLabel] = useState("");
  const [isPricingField, setIsPricingField] = useState(true);
  const [addingOption, setAddingOption] = useState(false);

  // New choice forms — one per option
  const [newChoiceLabel, setNewChoiceLabel] = useState<Record<string, string>>({});
  const [addingChoice, setAddingChoice] = useState<Record<string, boolean>>({});
  const [deletingChoiceId, setDeletingChoiceId] = useState<string | null>(null);
  const [deletingOptionId, setDeletingOptionId] = useState<string | null>(null);

  const handleAddOption = async () => {
    if (!newOptionLabel.trim()) return;
    setAddingOption(true);
    try {
      const opt = await createField(product.id, newOptionLabel.trim(), isPricingField);
      const updated = [...product.options, opt];
      onOptionsChange(updated);
      setNewOptionLabel("");
      toast({ title: "Option added", description: opt.label });
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setAddingOption(false);
    }
  };

  const handleDeleteOption = async (optionId: string, label: string) => {
    if (!confirm(`Remove option "${label}" and all its choices?`)) return;
    setDeletingOptionId(optionId);
    try {
      await deleteField(optionId);
      onOptionsChange(product.options.filter((o) => o.id !== optionId));
      toast({ title: "Option removed" });
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setDeletingOptionId(null);
    }
  };

  const handleAddChoice = async (optionId: string) => {
    const label = (newChoiceLabel[optionId] ?? "").trim();
    if (!label) return;
    setAddingChoice((prev) => ({ ...prev, [optionId]: true }));
    try {
      const choice = await createChoice(optionId, label);
      const updated = product.options.map((o) =>
        o.id === optionId ? { ...o, choices: [...o.choices, { id: choice.id, value: choice.value, label: choice.label }] } : o
      );
      onOptionsChange(updated);
      setNewChoiceLabel((prev) => ({ ...prev, [optionId]: "" }));
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setAddingChoice((prev) => ({ ...prev, [optionId]: false }));
    }
  };

  const handleDeleteChoice = async (optionId: string, choiceId: string, label: string) => {
    setDeletingChoiceId(choiceId);
    try {
      await deleteChoice(choiceId);
      const updated = product.options.map((o) =>
        o.id === optionId ? { ...o, choices: o.choices.filter((c) => c.id !== choiceId) } : o
      );
      onOptionsChange(updated);
      toast({ title: "Choice removed", description: label });
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setDeletingChoiceId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          Customization Options
        </h3>
        <p className="text-xs text-slate-500 mt-0.5">
          What can customers choose when ordering? e.g. Size, Paper Type, Finish.
        </p>
      </div>

      {/* Existing options */}
      {product.options.length === 0 ? (
        <p className="text-xs text-slate-400 italic">No options yet — add one below.</p>
      ) : (
        <div className="space-y-3">
          {product.options.map((opt) => (
            <div key={opt.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/40">
              {/* Option header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Tag className="h-3.5 w-3.5 text-[#0061FF]" />
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
                    {opt.label}
                  </span>
                  {opt.is_pricing_field && (
                    <span className="rounded-full bg-[#0061FF]/10 px-1.5 py-0.5 text-[10px] font-medium text-[#0061FF]">
                      affects price
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteOption(opt.id, opt.label)}
                  disabled={deletingOptionId === opt.id}
                  className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 transition-colors"
                >
                  {deletingOptionId === opt.id
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Trash2 className="h-3.5 w-3.5" />
                  }
                </button>
              </div>

              {/* Choices chips */}
              <div className="flex flex-wrap gap-1.5 mb-2">
                {opt.choices.length === 0 && (
                  <span className="text-xs text-slate-400 italic">No choices yet</span>
                )}
                {opt.choices.map((c) => (
                  <span
                    key={c.id}
                    className="inline-flex items-center gap-1 rounded-full bg-white border border-slate-200 px-2.5 py-0.5 text-xs text-slate-700 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200"
                  >
                    {c.label}
                    <button
                      type="button"
                      disabled={deletingChoiceId === c.id}
                      onClick={() => handleDeleteChoice(opt.id, c.id, c.label)}
                      className="ml-0.5 text-slate-400 hover:text-red-500 transition-colors"
                    >
                      {deletingChoiceId === c.id
                        ? <Loader2 className="h-2.5 w-2.5 animate-spin" />
                        : <span className="text-[10px] leading-none">✕</span>
                      }
                    </button>
                  </span>
                ))}
              </div>

              {/* Add choice inline */}
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Add a choice…"
                  value={newChoiceLabel[opt.id] ?? ""}
                  onChange={(e) => setNewChoiceLabel((prev) => ({ ...prev, [opt.id]: e.target.value }))}
                  onKeyDown={(e) => e.key === "Enter" && handleAddChoice(opt.id)}
                  className="h-7 text-xs"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs gap-1 shrink-0"
                  onClick={() => handleAddChoice(opt.id)}
                  disabled={addingChoice[opt.id]}
                >
                  {addingChoice[opt.id] ? <Loader2 className="h-3 w-3 animate-spin" /> : <PlusCircle className="h-3 w-3" />}
                  Add
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add new option form */}
      <div className="rounded-lg border border-dashed border-slate-300 p-3 space-y-2 dark:border-slate-700">
        <p className="text-xs font-medium text-slate-500">Add a new option</p>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Option name, e.g. Paper Size"
            value={newOptionLabel}
            onChange={(e) => setNewOptionLabel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddOption()}
            className="h-8 text-sm"
          />
          <Button
            size="sm"
            onClick={handleAddOption}
            disabled={addingOption || !newOptionLabel.trim()}
            className="gap-1.5 shrink-0"
          >
            {addingOption ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlusCircle className="h-3.5 w-3.5" />}
            Add
          </Button>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isPricingField}
            onChange={(e) => setIsPricingField(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-slate-300 text-[#0061FF]"
          />
          <span className="text-xs text-slate-600 dark:text-slate-400">
            Different choices have different prices
          </span>
        </label>
      </div>
    </div>
  );
}
