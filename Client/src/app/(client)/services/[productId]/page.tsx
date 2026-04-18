"use client";

import { useState, useEffect, use, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuthStore, getAuthHeaders } from "@/store/authStore";
import { notify } from "@/utils/notifications";
import { fetchJsonCached, revalidateInBackground } from "@/utils/requestCache";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8005/api/v1";

interface Product {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  preview_images: string[];
  production_days: number;
  product_code: string;
}

interface Variant {
  id: string;
  variant_code: string;
  variant_name: string;
  min_quantity: number;
}

interface OptionValue {
  id: string;
  code: string;
  label: string;
  display_order: number;
}

interface OptionGroup {
  id: string;
  name: string;
  label: string;
  display_order: number;
  is_required: boolean;
  is_pricing_dimension: boolean;
  values: OptionValue[];
}

interface PricingRow {
  combination_key: string; // sorted JSON string of pricing-dimension option codes
  price: number;
  discount: number;       // pre-computed NPR discount amount (works for both fixed & percentage)
  discount_type: "fixed" | "percentage" | null;
  discount_value: number; // raw value: NPR amount for fixed, percentage number for percentage
}

interface PricingResult {
  unit_price: number;
  discount: number;
  discount_type: "fixed" | "percentage" | null;
  discount_value: number;
  final_unit_price: number;
  total_price: number;
  design_extra_per_unit: number;  // surcharge from approved design (0 if none)
  design_extra_total: number;     // surcharge × quantity
}

interface PaymentDetails {
  companyName: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  branch: string | null;
  paymentId: string | null;
  qrImageUrl: string | null;
  note: string | null;
}

function StepBar({ step }: { step: 1 | 2 }) {
  const steps = [{ n: 1, label: "Configure" }, { n: 2, label: "Payment" }];
  return (
    <div className="flex items-center justify-center mb-8">
      {steps.map(({ n, label }, idx) => (
        <div key={n} className="flex items-center">
          <div className="flex flex-col items-center gap-1.5">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
              step > n ? "bg-emerald-500 text-white" : step === n ? "bg-[#0f172a] text-white ring-4 ring-[#0f172a]/10" : "bg-slate-100 text-slate-400"
            }`}>
              {step > n ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              ) : n}
            </div>
            <span className={`text-[0.72rem] font-semibold tracking-wide ${step >= n ? "text-slate-700" : "text-slate-400"}`}>{label}</span>
          </div>
          {idx === 0 && (
            <div className="w-20 sm:w-28 mx-3 mb-5">
              <div className="h-0.5 w-full bg-slate-200 relative overflow-hidden rounded-full">
                <div className={`absolute inset-y-0 left-0 bg-emerald-500 transition-all duration-500 ${step > 1 ? "w-full" : "w-0"}`} />
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function ProductOrderPage({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = use(params);
  const router = useRouter();
  useAuthStore();

  const [step, setStep] = useState<1 | 2>(1);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [product, setProduct] = useState<Product | null>(null);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [optionGroups, setOptionGroups] = useState<OptionGroup[]>([]);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState("");
  const [minQty, setMinQty] = useState(1);
  const [designCode, setDesignCode] = useState("");
  const [approvedDesigns, setApprovedDesigns] = useState<{ designCode: string; title: string | null; approvedFileUrl: string | null; extraPrice: number }[]>([]);
  const [notes, setNotes] = useState("");
  const [pricingRows, setPricingRows] = useState<PricingRow[]>([]);
  const [pricingError, setPricingError] = useState<string | null>(null);
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetails | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"proof" | "wallet">("proof");
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [proofPath, setProofPath] = useState<string | null>(null);
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [attachmentPaths, setAttachmentPaths] = useState<string[]>([]);
  const [uploadingAttachments, setUploadingAttachments] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadingProduct, setLoadingProduct] = useState(true);
  const [loadingOptions, setLoadingOptions] = useState(false);

  // In-memory Map storing pre-loaded variant option data — avoids any async on variant select
  type VariantData = { optionGroups: OptionGroup[]; pricingRows: PricingRow[]; minQuantity: number };
  const variantDataCache = useRef<Map<string, VariantData>>(new Map());

  const quantityNames = useMemo(() => new Set(["quantity", "qty"]), []);

  useEffect(() => {
    setLoadingProduct(true);
    fetchJsonCached<any>(`catalog-product-${productId}`, `${API_BASE}/products/${productId}`, { headers: getAuthHeaders() }, 60000)
      .then((d) => {
        if (d.success || d.data) setProduct(d.data || d);
        else notify.error("Product not found");
      })
      .catch(() => notify.error("Failed to load product"))
      .finally(() => setLoadingProduct(false));

    fetchJsonCached<any>(`catalog-variants-${productId}`, `${API_BASE}/products/${productId}/variants`, { headers: getAuthHeaders() }, 60000)
      .then((d) => {
        if (d.success) {
          const list: Variant[] = d.data || [];
          setVariants(list);
          // Bulk-load ALL variant options in parallel; store in ref Map so variant
          // switching never needs to wait for a network round-trip.
          list.forEach((v) => {
            fetchJsonCached<any>(`variant-options-${v.id}`, `${API_BASE}/variants/${v.id}/options`, { headers: getAuthHeaders() }, 60000)
              .then((od) => {
                if (od.success) {
                  variantDataCache.current.set(v.id, {
                    optionGroups: od.option_groups || [],
                    pricingRows: od.pricing_rows || [],
                    minQuantity: od.min_quantity || 1,
                  });
                }
              })
              .catch(() => {});
          });
        }
      })
      .catch(() => {});
  }, [productId]);

  useEffect(() => {
    if (!product || !selectedVariantId) return;
    const url = `${API_BASE}/designs/my?productId=${encodeURIComponent(productId)}&productName=${encodeURIComponent(product.name)}`;
    fetchJsonCached<any>(`approved-designs-${productId}`, url, { headers: getAuthHeaders() }, 20000)
      .then((d) => {
        if (d.success) setApprovedDesigns(d.data || []);
        else setApprovedDesigns([]);
      })
      .catch(() => setApprovedDesigns([]));
  }, [productId, product, selectedVariantId]);

  useEffect(() => {
    if (!selectedVariantId) {
      setOptionGroups([]);
      setPricingRows([]);
      setSelectedOptions({});
      setQuantity("");
      setPricingError(null);
      return;
    }

    // Check in-memory Map first (populated by bulk-load) — instant, no network
    const cached = variantDataCache.current.get(selectedVariantId);
    if (cached) {
      setOptionGroups(cached.optionGroups);
      setPricingRows(cached.pricingRows);
      setMinQty(cached.minQuantity);
      setQuantity("");
      setSelectedOptions({});
      setPricingError(null);

      // Background revalidation: silently re-fetch and update if prices changed
      const cacheKey = `variant-options-${selectedVariantId}`;
      const optionsUrl = `${API_BASE}/variants/${selectedVariantId}/options`;
      revalidateInBackground(
        cacheKey,
        optionsUrl,
        { headers: getAuthHeaders() },
        60000,
        // pass the raw cached API response shape for comparison
        { success: true, option_groups: cached.optionGroups, pricing_rows: cached.pricingRows, min_quantity: cached.minQuantity },
        (fresh: any) => {
          if (!fresh?.success) return;
          const freshData: VariantData = {
            optionGroups: fresh.option_groups || [],
            pricingRows: fresh.pricing_rows || [],
            minQuantity: fresh.min_quantity || 1,
          };
          variantDataCache.current.set(selectedVariantId, freshData);
          setPricingRows(freshData.pricingRows);
          setOptionGroups(freshData.optionGroups);
          notify.info("Prices updated — please review before proceeding.");
        }
      );
      return;
    }

    setLoadingOptions(true);
    fetchJsonCached<any>(`variant-options-${selectedVariantId}`, `${API_BASE}/variants/${selectedVariantId}/options`, { headers: getAuthHeaders() }, 60000)
      .then((d) => {
        if (d.success) {
          const data: VariantData = {
            optionGroups: d.option_groups || [],
            pricingRows: d.pricing_rows || [],
            minQuantity: d.min_quantity || 1,
          };
          variantDataCache.current.set(selectedVariantId, data);
          setOptionGroups(data.optionGroups);
          setPricingRows(data.pricingRows);
          setMinQty(data.minQuantity);
          setQuantity("");
          setSelectedOptions({});
          setPricingError(null);
        }
      })
      .catch(() => notify.error("Failed to load options"))
      .finally(() => setLoadingOptions(false));
  }, [selectedVariantId]);

  const quantityGroup = useMemo(
    () => optionGroups.find((g) => quantityNames.has(g.name.trim().toLowerCase())) ?? null,
    [optionGroups, quantityNames]
  );
  const quantityGroupNumericValues = useMemo(
    () =>
      (quantityGroup?.values ?? [])
        .map((v) => ({ code: v.code, num: Number(v.code) }))
        .filter((v) => Number.isFinite(v.num) && v.num > 0),
    [quantityGroup]
  );
  const hasNumericQuantityGroup = Boolean(quantityGroup && quantityGroupNumericValues.length === (quantityGroup?.values.length ?? 0));
  const hasMultipleQtyChoices = Boolean(hasNumericQuantityGroup && quantityGroupNumericValues.length > 1);
  const hasSingleQtyBase = Boolean(hasNumericQuantityGroup && quantityGroupNumericValues.length === 1);
  const quantityStep = useMemo(() => {
    if (!hasSingleQtyBase || !quantityGroup) return 1;
    const selected = Number(selectedOptions[quantityGroup.name] || "");
    if (Number.isFinite(selected) && selected > 0) return selected;
    if (quantityGroupNumericValues.length > 0) return quantityGroupNumericValues[0].num;
    return 1;
  }, [hasSingleQtyBase, quantityGroup, quantityGroupNumericValues, selectedOptions]);
  const nonQuantityGroups = useMemo(
    () => optionGroups.filter((g) => !quantityNames.has(g.name.trim().toLowerCase())),
    [optionGroups, quantityNames]
  );
  const requiredGroups = useMemo(() => nonQuantityGroups.filter((g) => g.is_required), [nonQuantityGroups]);

  const quantityNumber = Number(quantity);
  const quantityFromGroup = quantityGroup ? Number(selectedOptions[quantityGroup.name] || "") : NaN;
  const effectiveQuantity = hasMultipleQtyChoices
    ? quantityFromGroup
    : hasSingleQtyBase
      ? quantityNumber
      : quantityGroup
        ? quantityFromGroup
        : quantityNumber;
  const isQuantityValid =
    Number.isFinite(effectiveQuantity) &&
    effectiveQuantity >= minQty &&
    (!hasSingleQtyBase || (quantityStep > 0 && effectiveQuantity % quantityStep === 0));
  const isSelectionComplete = selectedVariantId !== "" && requiredGroups.every((g) => Boolean(selectedOptions[g.name])) && isQuantityValid;

  useEffect(() => {
    if (!quantityGroup || !hasSingleQtyBase) return;

    const only = quantityGroupNumericValues[0];
    const currentCode = selectedOptions[quantityGroup.name];
    const nextSelectedOptions =
      currentCode === only.code
        ? selectedOptions
        : { ...selectedOptions, [quantityGroup.name]: only.code };

    if (currentCode !== only.code) {
      setSelectedOptions(nextSelectedOptions);
    }

    const currentQty = Number(quantity);
    if (!Number.isFinite(currentQty) || currentQty < only.num || currentQty % only.num !== 0) {
      const normalized = Math.max(minQty, only.num);
      const rounded = Math.ceil(normalized / only.num) * only.num;
      setQuantity(String(rounded));
    }
  }, [quantityGroup, hasSingleQtyBase, quantityGroupNumericValues, selectedOptions, quantity, minQty]);

  // O(1) lookup map: combination_key → PricingRow. Rebuilt only when pricingRows array changes.
  const pricingMap = useMemo(
    () => new Map(pricingRows.map((r) => [r.combination_key, r])),
    [pricingRows]
  );

  // Compute pricing locally from embedded pricing_rows — zero API calls, instant.
  // Builds the same combination_key the backend uses (sorted JSON of pricing-dimension options).
  const pricing = useMemo<PricingResult | null>(() => {
    if (!isSelectionComplete || pricingMap.size === 0) return null;

    // Filter selected options to only pricing-dimension groups
    const pricingDims = optionGroups
      .filter((g) => g.is_pricing_dimension && selectedOptions[g.name])
      .reduce<Record<string, string>>((acc, g) => { acc[g.name] = selectedOptions[g.name]; return acc; }, {});

    // Build the same combination_key the backend stores:
    // Sorted "key:value" pairs joined with "|", or "__NO_OPTIONS__" if empty.
    // This MUST match buildCombinationKey() in server/src/services/catalog/product-pricing.service.ts
    const entries = Object.entries(pricingDims).sort(([a], [b]) => a.localeCompare(b));
    const combinationKey = entries.length === 0
      ? "__NO_OPTIONS__"
      : entries.map(([k, v]) => `${k}:${v}`).join("|");

    const row = pricingMap.get(combinationKey); // O(1)
    if (!row) return null;

    const finalUnitPrice = Number((row.price - row.discount).toFixed(2));

    // Add design surcharge if an approved design with extraPrice > 0 is selected
    const selectedDesignMeta = designCode
      ? approvedDesigns.find((d) => d.designCode === designCode)
      : undefined;
    const designExtraPerUnit = selectedDesignMeta?.extraPrice ?? 0;
    const designExtraTotal = Number((designExtraPerUnit * effectiveQuantity).toFixed(2));

    const totalPrice = Number((finalUnitPrice * effectiveQuantity + designExtraTotal).toFixed(2));
    return {
      unit_price: row.price,
      discount: row.discount,
      discount_type: row.discount_type,
      discount_value: row.discount_value,
      final_unit_price: finalUnitPrice,
      total_price: totalPrice,
      design_extra_per_unit: designExtraPerUnit,
      design_extra_total: designExtraTotal,
    };
  }, [isSelectionComplete, pricingMap, optionGroups, selectedOptions, effectiveQuantity, designCode, approvedDesigns]);

  const handleUploadAttachments = async (): Promise<string[]> => {
    if (attachmentFiles.length === 0) return attachmentPaths;
    if (attachmentPaths.length === attachmentFiles.length) return attachmentPaths;
    setUploadingAttachments(true);
    try {
      const uploaded: string[] = [];
      for (const file of attachmentFiles) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("folder", "orders/attachments");
        const res = await fetch(`${API_BASE}/uploads`, { method: "POST", headers: getAuthHeaders(), body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || data.message || "Upload failed");
        if (data.data?.fileUrl) uploaded.push(data.data.fileUrl);
      }
      setAttachmentPaths(uploaded);
      return uploaded;
    } catch (err: any) {
      notify.error(err.message || "Failed to upload attachments");
      return [];
    } finally {
      setUploadingAttachments(false);
    }
  };

  const handleProceedToPayment = async () => {
    if (!selectedVariantId) { notify.error("Please select a variant"); return; }
    if (!pricing) { notify.error("This option combination has no pricing. Please select different options."); return; }
    if (!isQuantityValid) { notify.error(`Minimum quantity is ${minQty}`); return; }

    // Upload attachments if any
    if (attachmentFiles.length > 0 && attachmentPaths.length !== attachmentFiles.length) {
      await handleUploadAttachments();
    }

    // Fetch bank details + wallet balance in parallel
    await Promise.allSettled([
      fetchJsonCached<any>("wallet-payment-details", `${API_BASE}/wallet/payment-details`, { headers: getAuthHeaders() }, 10_000)
        .then((d) => { if (d.success) setPaymentDetails(d.data); })
        .catch(() => {}),
      fetch(`${API_BASE}/wallet/balance`, { headers: getAuthHeaders() })
        .then((r) => r.json())
        .then((d) => { if (d.success) setWalletBalance(Number(d.data.availableBalance)); })
        .catch(() => {}),
    ]);
    setStep(2);
  };

  const handleUploadProof = async (): Promise<string | null> => {
    if (!proofFile) return null;
    setUploadingProof(true);
    try {
      const fd = new FormData();
      fd.append("file", proofFile);
      fd.append("folder", "orders/payment-proofs");
      const res = await fetch(`${API_BASE}/uploads`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || data.message || "Upload failed");
      return data.data?.fileUrl || null;
    } catch (err: any) {
      notify.error(err.message || "Failed to upload payment proof");
      return null;
    } finally {
      setUploadingProof(false);
    }
  };

  const handleSubmitOrder = async () => {
    if (!pricing) return;

    const configDetails = optionGroups
      .filter((g) => selectedOptions[g.name])
      .map((g) => {
        const val = g.values.find((v) => v.code === selectedOptions[g.name])!;
        return { groupName: g.name, groupLabel: g.label, selectedCode: val.code, selectedLabel: val.label };
      });

    setSubmitting(true);
    try {
      if (paymentMethod === "wallet") {
        // Wallet payment: send JSON, no file upload
        const body = {
          variantId: selectedVariantId,
          quantity: effectiveQuantity,
          options: { ...selectedOptions, configDetails },
          useWallet: true,
          ...(notes ? { notes } : {}),
          ...(designCode ? { designCode } : {}),
          ...(attachmentPaths.length > 0 ? { attachmentUrls: attachmentPaths } : {}),
        };
        const res = await fetch(`${API_BASE}/orders`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (data.success) {
          notify.success("Order placed — NPR " + pricing.total_price.toFixed(2) + " deducted from wallet");
          router.push("/orders");
        } else {
          notify.error(data.error?.message || data.message || "Failed to place order");
        }
      } else {
        // Proof upload payment: existing flow
        if (!proofFile && !proofPath) {
          notify.error("Please upload your payment proof");
          setSubmitting(false);
          return;
        }
        let path = proofPath;
        if (!path) {
          path = await handleUploadProof();
          if (!path) { setSubmitting(false); return; }
          setProofPath(path);
        }
        const formData = new FormData();
        formData.append("variantId", selectedVariantId);
        formData.append("quantity", String(effectiveQuantity));
        Object.entries(selectedOptions).forEach(([k, v]) => formData.append(`options[${k}]`, v));
        formData.append("options[configDetails]", JSON.stringify(configDetails));
        if (notes) formData.append("notes", notes);
        if (designCode) formData.append("designCode", designCode);
        formData.append("paymentProofPath", path);
        formData.append("paymentProofFileName", proofFile?.name || "");
        formData.append("paymentProofMimeType", proofFile?.type || "");
        if (attachmentPaths.length > 0) formData.append("attachmentUrls", JSON.stringify(attachmentPaths));
        const res = await fetch(`${API_BASE}/orders`, {
          method: "POST",
          headers: getAuthHeaders(),
          body: formData,
        });
        const data = await res.json();
        if (data.success) {
          notify.success("Order placed successfully");
          router.push("/orders");
        } else {
          notify.error(data.error?.message || data.message || "Failed to place order");
        }
      }
    } catch {
      notify.error("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingProduct) {
    return (
      <div className="min-h-[calc(100vh-72px)] bg-[#f8f7f4] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#0f172a] border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 text-sm font-medium">Loading product…</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-[calc(100vh-72px)] bg-[#f8f7f4] flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-3">📦</div>
          <p className="text-slate-700 font-semibold mb-1">Product not found</p>
          <p className="text-slate-400 text-sm mb-5">This product may have been removed or doesn&apos;t exist.</p>
          <button type="button" onClick={() => router.push("/services")}
            className="px-4 py-2 bg-[#0f172a] text-white text-sm font-semibold rounded-lg hover:bg-slate-800 transition-colors">
            Back to Services
          </button>
        </div>
      </div>
    );
  }

  const renderStep1 = () => {
    const images = [...(product.preview_images?.length ? product.preview_images : []), ...(product.image_url ? [product.image_url] : [])].filter(Boolean);
    const activeImg = images[previewIndex] ?? null;

    const selectCls = "w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-800 bg-white focus:border-[#0f172a] focus:ring-2 focus:ring-[#0f172a]/10 outline-none transition-shadow";
    const labelCls = "block text-[0.72rem] font-bold text-slate-500 uppercase tracking-[0.08em] mb-1.5";

    return (
      <div className="flex flex-col gap-5">
        {/* Product preview card */}
        <div className="rounded-xl overflow-hidden border border-slate-100 bg-white shadow-sm">
          <div className="relative w-full h-56 bg-slate-50">
            {activeImg ? (
              <Image src={activeImg} alt={product.name} fill priority sizes="(max-width: 768px) 100vw, 720px" className="object-contain p-3" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-4xl">🖨️</div>
            )}
            {images.length > 1 && (
              <>
                <button
                  type="button"
                  aria-label="Previous image"
                  onClick={() => setPreviewIndex((i) => (i - 1 + images.length) % images.length)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm border border-slate-200 shadow-sm flex items-center justify-center text-slate-600 hover:text-slate-900 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                </button>
                <button
                  type="button"
                  aria-label="Next image"
                  onClick={() => setPreviewIndex((i) => (i + 1) % images.length)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm border border-slate-200 shadow-sm flex items-center justify-center text-slate-600 hover:text-slate-900 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                </button>
              </>
            )}
          </div>

          {images.length > 1 && (
            <div className="flex gap-1.5 px-3 pb-3 pt-2 overflow-x-auto">
              {images.map((src, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Preview ${i + 1}`}
                  onClick={() => setPreviewIndex(i)}
                  className={`relative w-11 h-11 rounded-lg shrink-0 overflow-hidden border-2 transition-all ${i === previewIndex ? "border-[#0f172a] shadow-sm" : "border-slate-200 opacity-60 hover:opacity-100"}`}
                >
                  <Image src={src} alt="" fill className="object-cover" />
                </button>
              ))}
            </div>
          )}

          <div className="px-4 py-3 border-t border-slate-50 flex items-start justify-between gap-2">
            <div>
              <p className="font-bold text-sm text-slate-900">{product.name}</p>
              {product.description && <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{product.description}</p>}
            </div>
            <span className="shrink-0 bg-amber-400 text-[#0f172a] text-[0.6rem] font-black tracking-[0.1em] uppercase px-2 py-0.5 rounded-md">B2B</span>
          </div>
        </div>

        {/* Variant selector */}
        <div>
          <label className={labelCls}>Variant</label>
          <select
            value={selectedVariantId}
            onChange={(e) => {
              setSelectedVariantId(e.target.value);
              setOptionGroups([]);
              setPricingRows([]);
              setSelectedOptions({});
              setQuantity("");
              setPricingError(null);
            }}
            aria-label="Select variant"
            className={selectCls}
          >
            <option value="">— Select variant —</option>
            {variants.map((v) => (
              <option key={v.id} value={v.id}>{v.variant_name}</option>
            ))}
          </select>
        </div>

        {/* Options section */}
        {selectedVariantId && loadingOptions && (
          <div className="flex items-center gap-2 py-3 text-slate-400 text-sm">
            <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
            Loading options…
          </div>
        )}

        {selectedVariantId && !loadingOptions && (
          <div className="rounded-xl border border-slate-100 overflow-hidden shadow-sm">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100">
              <span className="text-[0.72rem] font-bold text-slate-500 uppercase tracking-[0.08em]">Order Configuration</span>
            </div>
            <div className="px-4 py-4 flex flex-col gap-4 bg-white">
              {quantityGroup && hasMultipleQtyChoices ? (
                <div>
                  <label className={labelCls}>
                    Quantity <span className="text-slate-400 font-normal normal-case">min. {minQty}</span>
                  </label>
                  <select
                    value={selectedOptions[quantityGroup.name] || ""}
                    onChange={(e) => { setSelectedOptions((prev) => ({ ...prev, [quantityGroup.name]: e.target.value })); setPricingError(null); }}
                    aria-label="Quantity"
                    className={selectCls}
                  >
                    <option value="">— Select —</option>
                    {quantityGroup.values.map((v) => <option key={v.id} value={v.code}>{v.label}</option>)}
                  </select>
                </div>
              ) : quantityGroup && hasSingleQtyBase ? (
                <div>
                  <label htmlFor="qty" className={labelCls}>
                    Quantity <span className="text-slate-400 font-normal normal-case">min. {minQty}, multiples of {quantityStep}</span>
                  </label>
                  <input
                    id="qty"
                    type="number"
                    min={Math.max(minQty, quantityStep)}
                    step={quantityStep}
                    value={quantity}
                    onChange={(e) => { setQuantity(e.target.value); setPricingError(null); }}
                    className="w-44 px-3 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-800 text-center focus:border-[#0f172a] focus:ring-2 focus:ring-[#0f172a]/10 outline-none"
                  />
                </div>
              ) : quantityGroup ? (
                <div>
                  <label className={labelCls}>
                    {quantityGroup.label} <span className="text-slate-400 font-normal normal-case">min. {minQty}</span>
                  </label>
                  <select
                    value={selectedOptions[quantityGroup.name] || ""}
                    onChange={(e) => { setSelectedOptions((prev) => ({ ...prev, [quantityGroup.name]: e.target.value })); setPricingError(null); }}
                    aria-label={quantityGroup.label}
                    className={selectCls}
                  >
                    <option value="">— Select —</option>
                    {quantityGroup.values.map((v) => <option key={v.id} value={v.code}>{v.label}</option>)}
                  </select>
                </div>
              ) : (
                <div>
                  <label htmlFor="qty" className={labelCls}>
                    Quantity <span className="text-slate-400 font-normal normal-case">min. {minQty}</span>
                  </label>
                  <input
                    id="qty"
                    type="number"
                    min={minQty}
                    step={1}
                    value={quantity}
                    onChange={(e) => { setQuantity(e.target.value); setPricingError(null); }}
                    className="w-36 px-3 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-800 text-center focus:border-[#0f172a] focus:ring-2 focus:ring-[#0f172a]/10 outline-none"
                  />
                </div>
              )}

              {nonQuantityGroups.map((group) => (
                <div key={group.id}>
                  <label className={labelCls}>
                    {group.label}
                    {group.is_required && <span className="text-red-400 ml-1">*</span>}
                  </label>
                  <select
                    value={selectedOptions[group.name] || ""}
                    onChange={(e) => { setSelectedOptions((prev) => ({ ...prev, [group.name]: e.target.value })); setPricingError(null); }}
                    aria-label={group.label}
                    className={selectCls}
                  >
                    {group.is_required && <option value="">— Select —</option>}
                    {!group.is_required && <option value="">— None —</option>}
                    {group.values.map((v) => <option key={v.id} value={v.code}>{v.label}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Optional fields */}
        {selectedVariantId && approvedDesigns.length > 0 && (
          <div>
            <label className={labelCls}>
              Approved Design <span className="text-slate-400 font-normal normal-case">(optional)</span>
            </label>
            <select
              value={designCode}
              onChange={(e) => setDesignCode(e.target.value)}
              aria-label="Select approved design"
              className={selectCls}
            >
              <option value="">— No design —</option>
              {approvedDesigns.map((d) => (
                <option key={d.designCode} value={d.designCode}>
                  {d.designCode}{d.title ? ` — ${d.title}` : ""}
                </option>
              ))}
            </select>
          </div>
        )}

        {selectedVariantId && (
          <div>
            <label className={labelCls}>
              Remarks <span className="text-slate-400 font-normal normal-case">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Any special instructions…"
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-700 resize-none focus:border-[#0f172a] focus:ring-2 focus:ring-[#0f172a]/10 outline-none transition-shadow"
            />
          </div>
        )}

        {/* Reference file attachments */}
        {selectedVariantId && (
          <div>
            <label className={labelCls}>
              Reference Files <span className="text-slate-400 font-normal normal-case">(optional — design references, images, etc.)</span>
            </label>
            <div
              className="rounded-lg border-2 border-dashed border-slate-200 p-4 text-center cursor-pointer hover:border-slate-300 hover:bg-slate-50/50 transition-colors"
              onClick={() => document.getElementById("attachment-files")?.click()}
            >
              {attachmentFiles.length === 0 ? (
                <div>
                  <svg className="mx-auto w-7 h-7 text-slate-300 mb-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" /></svg>
                  <p className="text-sm text-slate-400">Click to attach files</p>
                  <p className="text-xs text-slate-300 mt-0.5">Any file type accepted • Multiple files allowed</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {attachmentFiles.map((f, i) => (
                    <div key={i} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-slate-100 text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                        <span className="text-slate-700 font-medium truncate">{f.name}</span>
                        <span className="text-slate-400 text-xs flex-shrink-0">{(f.size / 1024).toFixed(0)} KB</span>
                      </div>
                      <button type="button" title={`Remove ${f.name}`} aria-label={`Remove ${f.name}`} onClick={(e) => { e.stopPropagation(); setAttachmentFiles((prev) => prev.filter((_, j) => j !== i)); setAttachmentPaths([]); }} className="text-slate-300 hover:text-red-400 ml-2 flex-shrink-0">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  ))}
                  <button type="button" onClick={(e) => { e.stopPropagation(); document.getElementById("attachment-files")?.click(); }} className="text-xs text-slate-400 hover:text-slate-600 mt-1">+ Add more files</button>
                </div>
              )}
            </div>
            <input
              id="attachment-files"
              type="file"
              multiple
              className="hidden"
              title="Attach reference files for your order"
              aria-label="Attach reference files"
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                if (files.length > 0) {
                  setAttachmentFiles((prev) => [...prev, ...files]);
                  setAttachmentPaths([]);
                }
                e.target.value = "";
              }}
            />
          </div>
        )}

        {/* Pricing summary */}
        {selectedVariantId && (
          <div className={`rounded-xl border overflow-hidden transition-all ${pricing ? "border-[#0f172a]/20 shadow-sm" : "border-slate-100"}`}>
            {pricing ? (
              <>
                <div className="px-4 py-2.5 bg-[#0f172a] flex items-center justify-between">
                  <span className="text-[0.72rem] font-bold text-slate-400 uppercase tracking-[0.08em]">Price Summary</span>
                  <span className="text-amber-400 text-[0.72rem] font-bold tracking-wide">B2B Rate</span>
                </div>
                <div className="bg-white divide-y divide-slate-50">
                  <div className="px-4 py-2.5 flex justify-between text-sm">
                    <span className="text-slate-500">Unit Price</span>
                    <span className="font-semibold text-slate-800">NPR {pricing.unit_price.toFixed(2)}</span>
                  </div>
                  {pricing.discount > 0 && (
                    <div className="px-4 py-2.5 flex justify-between text-sm">
                      <span className="text-emerald-600">
                        Discount{pricing.discount_type === "percentage" ? ` (${pricing.discount_value}%)` : ""}
                      </span>
                      <span className="font-semibold text-emerald-600">− NPR {pricing.discount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="px-4 py-2.5 flex justify-between text-sm">
                    <span className="text-slate-500">Quantity</span>
                    <span className="font-semibold text-slate-800">× {effectiveQuantity}</span>
                  </div>
                  {pricing.design_extra_per_unit > 0 && (
                    <div className="px-4 py-2.5 flex justify-between text-sm border-t border-slate-100">
                      <span className="text-indigo-600">Design surcharge (NPR {pricing.design_extra_per_unit.toFixed(2)} × {effectiveQuantity})</span>
                      <span className="font-semibold text-indigo-600">+ NPR {pricing.design_extra_total.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="px-4 py-3.5 flex justify-between items-center bg-slate-50/60">
                    <span className="font-bold text-slate-900">Total</span>
                    <span className="font-extrabold text-[#0f172a] text-xl">NPR {pricing.total_price.toFixed(2)}</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="px-4 py-5 text-center">
                {isSelectionComplete && pricingMap.size === 0 ? (
                  <p className="text-amber-600 text-sm">No pricing has been configured for this variant yet. Please contact support.</p>
                ) : isSelectionComplete ? (
                  <p className="text-amber-600 text-sm">No pricing found for the selected combination. Try different options.</p>
                ) : (
                  <p className="text-slate-400 text-sm">Complete all required fields to see pricing.</p>
                )}
                {pricingError && <p className="text-amber-600 text-xs mt-1.5">{pricingError}</p>}
              </div>
            )}
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={() => router.push("/services")}
            className="px-5 py-2.5 border border-slate-200 text-slate-600 text-sm font-semibold rounded-lg hover:bg-slate-50 transition-colors"
          >
            Back
          </button>
          <button
            type="button"
            onClick={handleProceedToPayment}
            disabled={!pricing || uploadingAttachments}
            className="flex-1 py-2.5 bg-[#0f172a] text-white text-sm font-bold rounded-lg hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {uploadingAttachments ? "Uploading files…" : "Continue"}
            {!uploadingAttachments && (
              <svg className="inline-block w-4 h-4 ml-1.5 -mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            )}
          </button>
        </div>
      </div>
    );
  };

  const renderStep2 = () => {
    const total = pricing!.total_price;
    const walletSufficient = walletBalance !== null && walletBalance >= total;
    const canSubmitWallet = paymentMethod === "wallet" && walletSufficient;
    const canSubmitProof = paymentMethod === "proof" && (!!proofFile || !!proofPath);
    const canSubmit = canSubmitWallet || canSubmitProof;

    return (
      <div className="flex flex-col gap-5">
        {/* Amount summary */}
        <div className="rounded-xl bg-[#0f172a] px-5 py-5">
          <p className="text-[0.72rem] font-bold text-slate-400 uppercase tracking-[0.1em] mb-1">Amount to Pay</p>
          <p className="text-4xl font-extrabold text-white">NPR {total.toFixed(2)}</p>
          <p className="text-xs text-slate-400 mt-1.5">{product?.name} · Qty {effectiveQuantity}</p>
        </div>

        {/* Payment method toggle */}
        <div>
          <p className="text-[0.72rem] font-bold text-slate-500 uppercase tracking-[0.08em] mb-2">Payment Method</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setPaymentMethod("proof")}
              className={`py-3 px-4 rounded-lg border-2 text-sm font-semibold transition-all ${
                paymentMethod === "proof"
                  ? "border-[#0f172a] bg-[#0f172a]/5 text-[#0f172a]"
                  : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
              }`}
            >
              <span className="block text-base mb-0.5">🏦</span>
              Bank / QR
            </button>
            <button
              type="button"
              onClick={() => setPaymentMethod("wallet")}
              className={`py-3 px-4 rounded-lg border-2 text-sm font-semibold transition-all ${
                paymentMethod === "wallet"
                  ? "border-[#0f172a] bg-[#0f172a]/5 text-[#0f172a]"
                  : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
              }`}
            >
              <span className="block text-base mb-0.5">💳</span>
              Wallet
            </button>
          </div>
        </div>

        {/* Bank transfer details */}
        {paymentMethod === "proof" && (
          <>
            {paymentDetails && (
              <div className="border border-slate-100 rounded-xl overflow-hidden shadow-sm">
                <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-100">
                  <span className="text-[0.72rem] font-bold text-slate-500 uppercase tracking-[0.08em]">Bank / QR Details</span>
                </div>
                <div className="px-4 py-4 bg-white flex flex-col gap-2.5 text-sm">
                  {[
                    ["Bank", paymentDetails.bankName],
                    ["Account Name", paymentDetails.accountName],
                    ["Account No.", paymentDetails.accountNumber],
                    ...(paymentDetails.branch ? [["Branch", paymentDetails.branch]] : []),
                    ...(paymentDetails.paymentId ? [["UPI / Payment ID", paymentDetails.paymentId]] : []),
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between items-center">
                      <span className="text-slate-400 text-xs">{label}</span>
                      <span className="font-semibold text-slate-900 text-right max-w-[60%]">{value}</span>
                    </div>
                  ))}
                  {paymentDetails.note && (
                    <p className="mt-0.5 text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded-lg border border-amber-100">{paymentDetails.note}</p>
                  )}
                  {paymentDetails.qrImageUrl && (
                    <div className="mt-2 flex justify-center">
                      <img src={`${API_BASE}/wallet/qr-image`} alt="QR Code" className="w-44 h-44 object-contain border border-slate-100 rounded-xl p-2 shadow-sm" />
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="border border-slate-100 rounded-xl overflow-hidden shadow-sm">
              <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-100">
                <span className="text-[0.72rem] font-bold text-slate-500 uppercase tracking-[0.08em]">Upload Payment Proof <span className="text-red-400">*</span></span>
              </div>
              <div className="px-4 py-4 bg-white">
                <label
                  htmlFor="proof-file"
                  className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
                    proofFile ? "border-emerald-400 bg-emerald-50" : "border-slate-200 bg-slate-50 hover:border-slate-400 hover:bg-slate-100"
                  }`}
                >
                  <input
                    id="proof-file"
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,application/pdf"
                    className="hidden"
                    onChange={(e) => { setProofFile(e.target.files?.[0] || null); setProofPath(null); }}
                  />
                  {proofFile ? (
                    <div className="text-center px-4">
                      <svg className="w-6 h-6 text-emerald-500 mx-auto mb-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      <p className="text-emerald-700 font-semibold text-sm truncate max-w-[200px]">{proofFile.name}</p>
                      <p className="text-emerald-500 text-xs mt-0.5">Click to change</p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <svg className="w-6 h-6 text-slate-400 mx-auto mb-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
                      <p className="text-slate-600 text-sm font-medium">Click to upload screenshot or PDF</p>
                      <p className="text-slate-400 text-xs mt-0.5">PNG, JPG, PDF · max 10 MB</p>
                    </div>
                  )}
                </label>
              </div>
            </div>
          </>
        )}

        {/* Wallet payment details */}
        {paymentMethod === "wallet" && (
          <div className={`rounded-xl border-2 px-5 py-4 transition-all ${walletSufficient ? "border-emerald-200 bg-emerald-50/60" : "border-red-200 bg-red-50/60"}`}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[0.72rem] font-bold text-slate-500 uppercase tracking-[0.08em]">Wallet Balance</span>
              <span className={`text-xl font-extrabold ${walletSufficient ? "text-emerald-700" : "text-red-600"}`}>
                {walletBalance !== null ? `NPR ${walletBalance.toFixed(2)}` : "Loading…"}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm border-t border-slate-100 pt-3">
              <span className="text-slate-500">Order Amount</span>
              <span className="font-bold text-slate-900">NPR {total.toFixed(2)}</span>
            </div>
            {walletBalance !== null && (
              walletSufficient ? (
                <div className="mt-3 flex items-center gap-2 text-emerald-700 text-xs font-semibold">
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  Balance after order: NPR {(walletBalance - total).toFixed(2)}
                </div>
              ) : (
                <div className="mt-3 text-xs text-red-600 font-medium">
                  Insufficient balance. You need NPR {(total - walletBalance).toFixed(2)} more.{" "}
                  <a href="/wallet/topup" className="underline font-bold">Top up →</a>
                </div>
              )
            )}
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={() => setStep(1)}
            className="flex-1 py-3 border border-slate-200 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-50 transition-colors">
            Back
          </button>
          <button
            type="button"
            onClick={handleSubmitOrder}
            disabled={submitting || uploadingProof || !canSubmit}
            className="flex-[2] py-3 bg-[#0f172a] text-white text-sm font-bold rounded-lg hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {uploadingProof ? "Uploading…" : submitting ? "Placing order…" : "Place Order"}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-[calc(100vh-72px)] bg-[#f8f7f4]">
      {/* Header */}
      <div className="relative overflow-hidden bg-[#0f172a] px-6 py-10 sm:py-12">
        <div className="hero-grid-overlay pointer-events-none absolute inset-0" />
        <div className="relative max-w-2xl mx-auto">
          <button
            type="button"
            onClick={() => router.push("/services")}
            className="flex items-center gap-1.5 text-slate-400 text-xs font-semibold hover:text-white transition-colors mb-4"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            All Services
          </button>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-block px-2 py-0.5 rounded-md bg-amber-400 text-[#0f172a] text-[0.6rem] font-black tracking-[0.1em] uppercase shrink-0">B2B</span>
            <div>
              <h1 className="font-serif text-2xl sm:text-3xl font-black text-white leading-tight">
                {product.name}
              </h1>
              {product.description && (
                <p className="text-slate-400 text-sm mt-1 leading-relaxed">{product.description}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-8">
        <StepBar step={step} />
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 sm:p-6">
          {step === 1 ? renderStep1() : renderStep2()}
        </div>
      </div>
    </div>
  );
}
