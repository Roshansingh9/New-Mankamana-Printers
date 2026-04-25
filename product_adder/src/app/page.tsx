"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Product, Option, PriceRow, Service } from "./types";
import {
  getServices, getProducts, addProduct, saveProduct, removeProduct,
  addField, removeField, addChoice, removeChoice,
  loadPricing, addPricing, savePrice, removePrice,
  cartesian,
} from "./service";

// ─── tiny helpers ──────────────────────────────────────────────────────────────

function Spinner() {
  return <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />;
}

function Btn({ children, onClick, disabled, variant = "primary", small }: {
  children: React.ReactNode; onClick?: () => void; disabled?: boolean;
  variant?: "primary" | "secondary" | "danger" | "ghost"; small?: boolean;
}) {
  const base = `inline-flex items-center gap-1.5 font-medium rounded-lg transition-colors disabled:opacity-50 ${small ? "px-2.5 py-1 text-xs" : "px-4 py-2 text-sm"}`;
  const styles = {
    primary: "bg-blue-600 text-white hover:bg-blue-700",
    secondary: "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50",
    danger: "bg-red-50 text-red-600 hover:bg-red-100 border border-red-200",
    ghost: "text-gray-500 hover:text-gray-800 hover:bg-gray-100",
  };
  return <button type="button" className={`${base} ${styles[variant]}`} onClick={onClick} disabled={disabled}>{children}</button>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      {children}
    </div>
  );
}

const inputCls = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";

// ─── Toast ────────────────────────────────────────────────────────────────────

function useToast() {
  const [msg, setMsg] = useState<{ text: string; type: "ok" | "err" } | null>(null);
  const t = useRef<ReturnType<typeof setTimeout>>();
  function toast(text: string, type: "ok" | "err" = "ok") {
    clearTimeout(t.current);
    setMsg({ text, type });
    t.current = setTimeout(() => setMsg(null), 3500);
  }
  return { msg, toast };
}

// ─── ProductList ──────────────────────────────────────────────────────────────

function ProductList({ products, services, selectedId, onSelect, onCreated, onDeleted }: {
  products: Product[]; services: Service[]; selectedId: string | null;
  onSelect: (id: string) => void; onCreated: (p: Product) => void; onDeleted: (id: string) => void;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(""); const [desc, setDesc] = useState(""); const [svcId, setSvcId] = useState(services[0]?.id ?? "");
  const [saving, setSaving] = useState(false); const [deletingId, setDeletingId] = useState<string | null>(null);

  async function create() {
    if (!name.trim()) return;
    setSaving(true);
    try { const p = await addProduct(svcId, name.trim(), desc.trim() || undefined); onCreated(p); setName(""); setDesc(""); setOpen(false); }
    catch (e) { toast((e as Error).message, "err"); }
    finally { setSaving(false); }
  }

  async function del(p: Product, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`Remove "${p.name}"?`)) return;
    setDeletingId(p.id);
    try { await removeProduct(p.id); onDeleted(p.id); }
    catch (e) { toast((e as Error).message, "err"); }
    finally { setDeletingId(null); }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <span className="text-sm font-semibold text-gray-600">Products ({products.length})</span>
        <Btn small onClick={() => setOpen(v => !v)}>+ Add</Btn>
      </div>

      {open && (
        <div className="px-4 py-3 bg-blue-50 border-b border-blue-100 space-y-2">
          {services.length > 1 && (
            <select className={inputCls} value={svcId} onChange={e => setSvcId(e.target.value)}>
              {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
          <input className={inputCls} placeholder="Product name *" value={name} autoFocus
            onChange={e => setName(e.target.value)} onKeyDown={e => e.key === "Enter" && create()} />
          <input className={inputCls} placeholder="Description (optional)" value={desc}
            onChange={e => setDesc(e.target.value)} />
          <div className="flex gap-2">
            <Btn onClick={create} disabled={saving || !name.trim()}>{saving ? <Spinner /> : null} Create</Btn>
            <Btn variant="ghost" onClick={() => setOpen(false)}>Cancel</Btn>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {products.length === 0 && <p className="text-sm text-gray-400 text-center py-12">No products yet.</p>}
        {products.map(p => (
          <button key={p.id} type="button" onClick={() => onSelect(p.id)}
            className={`group w-full flex items-center justify-between px-4 py-3 text-left border-b border-gray-100 hover:bg-gray-50 transition-colors ${selectedId === p.id ? "bg-blue-50 border-l-2 border-l-blue-500" : ""}`}>
            <div className="min-w-0">
              <div className="text-sm font-medium text-gray-800 truncate">{p.name}</div>
              {p.description && <div className="text-xs text-gray-400 truncate mt-0.5">{p.description}</div>}
            </div>
            <button type="button" onClick={e => del(p, e)} disabled={deletingId === p.id}
              className="ml-2 shrink-0 p-1 rounded text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
              {deletingId === p.id ? <Spinner /> : "✕"}
            </button>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── OptionsPanel ─────────────────────────────────────────────────────────────

function OptionsPanel({ product, onChange }: { product: Product; onChange: (opts: Option[]) => void }) {
  const { msg, toast } = useToast();
  const [newLabel, setNewLabel] = useState(""); const [affectsPrice, setAffectsPrice] = useState(true); const [adding, setAdding] = useState(false);
  const [newChoice, setNewChoice] = useState<Record<string, string>>({});
  const [addingChoice, setAddingChoice] = useState<Record<string, boolean>>({});
  const [deletingOpt, setDeletingOpt] = useState<string | null>(null);
  const [deletingChoice, setDeletingChoice] = useState<string | null>(null);

  async function addOpt() {
    if (!newLabel.trim()) return;
    setAdding(true);
    try { const o = await addField(product.id, newLabel.trim(), affectsPrice); onChange([...product.options, o]); setNewLabel(""); }
    catch (e) { toast((e as Error).message, "err"); }
    finally { setAdding(false); }
  }

  async function delOpt(id: string, label: string) {
    if (!confirm(`Remove "${label}" and all its choices?`)) return;
    setDeletingOpt(id);
    try { await removeField(id); onChange(product.options.filter(o => o.id !== id)); }
    catch (e) { toast((e as Error).message, "err"); }
    finally { setDeletingOpt(null); }
  }

  async function addCh(optId: string) {
    const label = (newChoice[optId] ?? "").trim(); if (!label) return;
    setAddingChoice(p => ({ ...p, [optId]: true }));
    try {
      const c = await addChoice(optId, label);
      onChange(product.options.map(o => o.id === optId ? { ...o, choices: [...o.choices, c] } : o));
      setNewChoice(p => ({ ...p, [optId]: "" }));
    } catch (e) { toast((e as Error).message, "err"); }
    finally { setAddingChoice(p => ({ ...p, [optId]: false })); }
  }

  async function delCh(optId: string, choiceId: string) {
    setDeletingChoice(choiceId);
    try {
      await removeChoice(choiceId);
      onChange(product.options.map(o => o.id === optId ? { ...o, choices: o.choices.filter(c => c.id !== choiceId) } : o));
    } catch (e) { toast((e as Error).message, "err"); }
    finally { setDeletingChoice(null); }
  }

  return (
    <section className="space-y-4">
      {msg && <div className={`text-sm px-3 py-2 rounded-lg ${msg.type === "err" ? "bg-red-50 text-red-600" : "bg-green-50 text-green-700"}`}>{msg.text}</div>}
      <div>
        <h3 className="font-semibold text-gray-800">Customization Options</h3>
        <p className="text-sm text-gray-500 mt-0.5">What can the customer choose? e.g. Size, Paper Type, Finish.</p>
      </div>

      {product.options.map(opt => (
        <div key={opt.id} className="border border-gray-200 rounded-xl p-4 space-y-3 bg-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-800">{opt.label}</span>
              {opt.is_pricing_field && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">affects price</span>}
            </div>
            <Btn variant="danger" small onClick={() => delOpt(opt.id, opt.label)} disabled={deletingOpt === opt.id}>
              {deletingOpt === opt.id ? <Spinner /> : "Remove"}
            </Btn>
          </div>

          <div className="flex flex-wrap gap-2">
            {opt.choices.length === 0 && <span className="text-xs text-gray-400 italic">No choices yet</span>}
            {opt.choices.map(c => (
              <span key={c.id} className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-gray-100 text-sm text-gray-700">
                {c.label}
                <button type="button" disabled={deletingChoice === c.id} onClick={() => delCh(opt.id, c.id)}
                  className="text-gray-400 hover:text-red-500 transition-colors ml-1">
                  {deletingChoice === c.id ? <Spinner /> : "×"}
                </button>
              </span>
            ))}
          </div>

          <div className="flex gap-2">
            <input className={inputCls} placeholder="Add a choice…" value={newChoice[opt.id] ?? ""}
              onChange={e => setNewChoice(p => ({ ...p, [opt.id]: e.target.value }))}
              onKeyDown={e => e.key === "Enter" && addCh(opt.id)} />
            <Btn variant="secondary" small onClick={() => addCh(opt.id)} disabled={addingChoice[opt.id]}>
              {addingChoice[opt.id] ? <Spinner /> : "+ Add"}
            </Btn>
          </div>
        </div>
      ))}

      <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 space-y-2">
        <p className="text-sm font-medium text-gray-600">Add a new option</p>
        <div className="flex gap-2">
          <input className={inputCls} placeholder='e.g. "Paper Size" or "Finish"' value={newLabel}
            onChange={e => setNewLabel(e.target.value)} onKeyDown={e => e.key === "Enter" && addOpt()} />
          <Btn onClick={addOpt} disabled={adding || !newLabel.trim()}>{adding ? <Spinner /> : "+ Add"}</Btn>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input type="checkbox" checked={affectsPrice} onChange={e => setAffectsPrice(e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
          Different choices have different prices
        </label>
      </div>
    </section>
  );
}

// ─── PricingPanel ─────────────────────────────────────────────────────────────

function PricingPanel({ productId, options }: { productId: string; options: Option[] }) {
  const { msg, toast } = useToast();
  const [rows, setRows] = useState<PriceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const pricesRef = useRef<Record<string, string>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await loadPricing(productId);
      setRows(data);
      const init: Record<string, string> = {};
      data.forEach(r => { init[r.id] = r.price != null ? String(r.price) : ""; });
      pricesRef.current = init; setPrices(init);
    } catch (e) { toast((e as Error).message, "err"); }
    finally { setLoading(false); }
  }, [productId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);
  useEffect(() => { load(); }, [options, load]);

  function changePrice(id: string, val: string) {
    pricesRef.current[id] = val;
    setPrices(p => ({ ...p, [id]: val }));
    clearTimeout(timers.current[id]);
    timers.current[id] = setTimeout(async () => {
      const n = parseFloat(pricesRef.current[id]);
      if (isNaN(n)) return;
      setSavingId(id);
      try { await savePrice(id, n); }
      catch { toast("Could not save price", "err"); }
      finally { setSavingId(null); }
    }, 700);
  }

  async function delRow(id: string) {
    setDeletingId(id);
    try { await removePrice(id); setRows(r => r.filter(x => x.id !== id)); }
    catch (e) { toast((e as Error).message, "err"); }
    finally { setDeletingId(null); }
  }

  async function generate() {
    const pricingOpts = options.filter(o => o.is_pricing_field && o.choices.length > 0);
    if (!pricingOpts.length) return toast("Add an option with 'affects price' checked first.", "err");
    setGenerating(true);
    try {
      const existing = new Set(rows.map(r =>
        r.selectedOptions.slice().sort((a, b) => a.fieldKey.localeCompare(b.fieldKey)).map(o => `${o.fieldKey}:${o.value}`).join("|")
      ));
      const combos = cartesian(pricingOpts.map(o => o.choices.map(c => ({ fieldId: o.id, fk: o.field_key, value: c.value }))));
      let created = 0;
      for (const combo of combos) {
        const key = combo.slice().sort((a, b) => a.fk.localeCompare(b.fk)).map(x => `${x.fk}:${x.value}`).join("|");
        if (!existing.has(key)) { await addPricing(productId, combo.map(x => ({ fieldId: x.fieldId, value: x.value })), 0); created++; }
      }
      await load();
      toast(created > 0 ? `${created} price row${created > 1 ? "s" : ""} created — fill in the prices below.` : "All combinations already exist.");
    } catch (e) { toast((e as Error).message, "err"); }
    finally { setGenerating(false); }
  }

  const hasChoices = options.some(o => o.choices.length > 0);

  return (
    <section className="space-y-4">
      {msg && <div className={`text-sm px-3 py-2 rounded-lg ${msg.type === "err" ? "bg-red-50 text-red-600" : "bg-green-50 text-green-700"}`}>{msg.text}</div>}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold text-gray-800">Pricing</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            {hasChoices ? 'Click "Generate" to fill the price table automatically.' : "Add options with choices above first."}
          </p>
        </div>
        {hasChoices && (
          <Btn variant="secondary" onClick={generate} disabled={generating}>
            {generating ? <Spinner /> : "⚡"} Generate
          </Btn>
        )}
      </div>

      {loading ? <p className="text-sm text-gray-400">Loading…</p> : rows.length === 0 ? (
        <p className="text-sm text-gray-400 italic">{hasChoices ? "No prices yet — click Generate." : "No prices yet."}</p>
      ) : (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Configuration</th>
                <th className="px-4 py-3 text-left font-semibold w-44">Price (NPR)</th>
                <th className="w-12" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map(row => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-700">{row.combination}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <input type="number" min={0} placeholder="0"
                        className="w-28 px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={prices[row.id] ?? ""}
                        onChange={e => changePrice(row.id, e.target.value)} />
                      {savingId === row.id && <Spinner />}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <button type="button" onClick={() => delRow(row.id)} disabled={deletingId === row.id}
                      className="text-gray-400 hover:text-red-500 transition-colors p-1">
                      {deletingId === row.id ? <Spinner /> : "✕"}
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

// ─── ProductEditor ────────────────────────────────────────────────────────────

function ProductEditor({ product, services, onUpdated }: { product: Product; services: Service[]; onUpdated: (p: Product) => void }) {
  const { msg, toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(product.name); const [desc, setDesc] = useState(product.description ?? "");
  const [saving, setSaving] = useState(false);
  const [options, setOptions] = useState<Option[]>(product.options);
  const svcName = services.find(s => s.id === product.service_id)?.name ?? "";

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await saveProduct(product.id, name.trim(), desc.trim() || undefined);
      onUpdated({ ...product, name: name.trim(), description: desc.trim() || null, options });
      setEditing(false); toast("Saved");
    } catch (e) { toast((e as Error).message, "err"); }
    finally { setSaving(false); }
  }

  function handleOptions(opts: Option[]) { setOptions(opts); onUpdated({ ...product, options: opts }); }

  return (
    <div className="h-full flex flex-col overflow-y-auto">
      {msg && (
        <div className={`fixed top-4 right-4 z-50 text-sm px-4 py-2 rounded-lg shadow-lg ${msg.type === "err" ? "bg-red-600 text-white" : "bg-green-600 text-white"}`}>
          {msg.text}
        </div>
      )}

      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-white">
        {editing ? (
          <div className="space-y-2">
            <input className={inputCls} value={name} onChange={e => setName(e.target.value)} autoFocus />
            <input className={inputCls} placeholder="Description (optional)" value={desc} onChange={e => setDesc(e.target.value)} />
            <div className="flex gap-2">
              <Btn onClick={save} disabled={saving}>{saving ? <Spinner /> : "✓"} Save</Btn>
              <Btn variant="ghost" onClick={() => { setName(product.name); setDesc(product.description ?? ""); setEditing(false); }}>Cancel</Btn>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-gray-900">{product.name}</h2>
                <button type="button" onClick={() => setEditing(true)}
                  className="text-gray-400 hover:text-gray-600 text-sm transition-colors">✎</button>
              </div>
              {product.description && <p className="text-sm text-gray-500 mt-0.5">{product.description}</p>}
            </div>
            <div className="text-right shrink-0">
              <div className="text-xs text-gray-400 font-mono">{product.product_code}</div>
              {svcName && <div className="text-xs text-gray-400 mt-0.5">{svcName}</div>}
            </div>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 px-6 py-6 space-y-8">
        <OptionsPanel product={{ ...product, options }} onChange={handleOptions} />
        <hr className="border-gray-200" />
        <PricingPanel productId={product.id} options={options} />
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([getProducts(), getServices()])
      .then(([prods, svcs]) => {
        setProducts(prods); setServices(svcs);
        setSelectedId(prods[0]?.id ?? null);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const selected = products.find(p => p.id === selectedId) ?? null;

  if (loading) return (
    <div className="flex items-center justify-center h-screen gap-3 text-gray-400">
      <Spinner /> <span>Loading products…</span>
    </div>
  );
  if (error) return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center space-y-3">
        <p className="text-red-500 font-medium">Could not connect to database</p>
        <p className="text-sm text-gray-500">{error}</p>
        <p className="text-sm text-gray-400">Make sure DATABASE_URL is set in .env.local and the database is running.</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-3">
        <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center text-white text-xs font-bold">M</div>
        <div>
          <h1 className="font-bold text-gray-900">Product Manager</h1>
          <p className="text-xs text-gray-400">Manakamana Printing</p>
        </div>
      </header>

      {/* 2-panel layout */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left — product list */}
        <div className="w-64 shrink-0 border-r border-gray-200 bg-white flex flex-col h-[calc(100vh-57px)]">
          <ProductList
            products={products} services={services} selectedId={selectedId}
            onSelect={setSelectedId}
            onCreated={p => { setProducts(prev => [p, ...prev]); setSelectedId(p.id); }}
            onDeleted={id => {
              const rest = products.filter(p => p.id !== id);
              setProducts(rest);
              setSelectedId(prev => prev === id ? (rest[0]?.id ?? null) : prev);
            }}
          />
        </div>

        {/* Right — editor */}
        <div className="flex-1 h-[calc(100vh-57px)] overflow-hidden">
          {selected ? (
            <ProductEditor
              key={selected.id} product={selected} services={services}
              onUpdated={updated => setProducts(prev => prev.map(p => p.id === updated.id ? updated : p))}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-gray-400 text-sm">
              {products.length === 0 ? "Click \"+ Add\" to create your first product." : "Select a product on the left."}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
