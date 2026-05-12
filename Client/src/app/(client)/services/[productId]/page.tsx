"use client";

import { useState, useEffect, use, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore, getAuthHeaders } from "@/store/authStore";
import { notify } from "@/utils/notifications";
import { fetchJsonCached, revalidateInBackground, registerFocusRevalidation } from "@/utils/requestCache";
import { uniqueImageUrls } from "@/utils/image";

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
  combination_key: string;
  price: number;
  discount: number;
  discount_type: "fixed" | "percentage" | null;
  discount_value: number;
}

interface PricingResult {
  unit_price: number;
  discount: number;
  discount_type: "fixed" | "percentage" | null;
  discount_value: number;
  final_unit_price: number;
  total_price: number;
  design_extra_per_unit: number;
  design_extra_total: number;
}

interface PaymentDetails {
  id: string;
  companyName: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  branch: string | null;
  paymentId: string | null;
  qrImageUrl: string | null;
  note: string | null;
}

interface ApiResponse<T> { success: boolean; data: T }

interface VariantOptionsResponse {
  success: boolean;
  option_groups: OptionGroup[];
  pricing_rows: PricingRow[];
  min_quantity: number;
}

function StepBar({ step }: { step: 1 | 2 | 3 | 4 }) {
  const steps = [
    { n: 1, label: "Product Info" },
    { n: 2, label: "Files" },
    { n: 3, label: "Payment" },
    { n: 4, label: "Confirm" },
  ];
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
            <span className={`text-[0.65rem] font-semibold tracking-wide ${step >= n ? "text-slate-700" : "text-slate-400"}`}>{label}</span>
          </div>
          {idx < steps.length - 1 && (
            <div className="w-10 sm:w-14 mx-1.5 mb-5">
              <div className="h-0.5 w-full bg-slate-200 relative overflow-hidden rounded-full">
                <div className={`absolute inset-y-0 left-0 bg-emerald-500 transition-all duration-500 ${step > n ? "w-full" : "w-0"}`} />
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

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [failedPreviewUrls, setFailedPreviewUrls] = useState<Record<string, true>>({});
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
  const [paymentMethods, setPaymentMethods] = useState<PaymentDetails[]>([]);
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string | null>(null);
  const [failedPaymentQrById, setFailedPaymentQrById] = useState<Record<string, true>>({});
  const [paymentMethod, setPaymentMethod] = useState<"proof" | "wallet">("proof");
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [proofPath, setProofPath] = useState<string | null>(null);
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [attachmentPaths, setAttachmentPaths] = useState<string[]>([]);
  const [uploadingAttachments, setUploadingAttachments] = useState(false);
  const [uploadBatchId] = useState(() => crypto.randomUUID());
  const [submitting, setSubmitting] = useState(false);
  const [loadingProduct, setLoadingProduct] = useState(true);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [priceVerifying, setPriceVerifying] = useState(false);
  interface PriceChangedInfo {
    prevUnitPrice: number;
    newUnitPrice: number;
    newFinalUnitPrice: number;
    newDiscount: number;
    newTotal: number;
    combinationKey: string;
  }
  const [priceChangedInfo, setPriceChangedInfo] = useState<PriceChangedInfo | null>(null);

  type VariantData = { optionGroups: OptionGroup[]; pricingRows: PricingRow[]; minQuantity: number };
  const variantDataCache = useRef<Map<string, VariantData>>(new Map());

  const quantityNames = useMemo(() => new Set(["quantity", "qty"]), []);

  useEffect(() => {
    const init = { headers: getAuthHeaders() };
    const productKey = `catalog-product-${productId}`;
    const variantsKey = `catalog-variants-${productId}`;

    const applyProduct = (d: ApiResponse<Product>) => {
      if (d.success && d.data) {
        setProduct(d.data);
        setPreviewIndex(0);
        setFailedPreviewUrls({});
        return;
      }
      const legacyProduct = d as unknown as Product;
      if (legacyProduct?.id) {
        setProduct(legacyProduct);
        setPreviewIndex(0);
        setFailedPreviewUrls({});
      }
    };

    setLoadingProduct(true);
    fetchJsonCached<ApiResponse<Product>>(productKey, `${API_BASE}/products/${productId}`, init, 60_000)
      .then((d) => { applyProduct(d); if (!d.success && !(d as unknown as Product)?.id) notify.error("Product not found"); })
      .catch(() => notify.error("Failed to load product"))
      .finally(() => setLoadingProduct(false));

    fetchJsonCached<ApiResponse<Variant[]>>(variantsKey, `${API_BASE}/products/${productId}/variants`, init, 60_000)
      .then((d) => {
        if (d.success) {
          const list: Variant[] = d.data || [];
          setVariants(list);
          list.forEach((v) => {
            fetchJsonCached<VariantOptionsResponse>(`variant-options-${v.id}`, `${API_BASE}/variants/${v.id}/options`, { headers: getAuthHeaders(), cache: "no-store" }, 5000)
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

    const deregProduct = registerFocusRevalidation<ApiResponse<Product>>(
      productKey, `${API_BASE}/products/${productId}`, init, 60_000,
      (d) => { if (d.success && d.data) setProduct(d.data); }
    );
    const deregVariants = registerFocusRevalidation<ApiResponse<Variant[]>>(
      variantsKey, `${API_BASE}/products/${productId}/variants`, init, 60_000,
      (d) => { if (d.success && d.data) setVariants(d.data); }
    );

    return () => { deregProduct(); deregVariants(); };
  }, [productId]);

  useEffect(() => {
    if (!product || !selectedVariantId) return;
    const url = `${API_BASE}/designs/my?productId=${encodeURIComponent(productId)}&productName=${encodeURIComponent(product.name)}`;
    fetchJsonCached<ApiResponse<{ designCode: string; title: string | null; approvedFileUrl: string | null; extraPrice: number }[]>>(`approved-designs-${productId}`, url, { headers: getAuthHeaders() }, 20000)
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
      setPriceChangedInfo(null);
      return;
    }

    const cached = variantDataCache.current.get(selectedVariantId);
    if (cached) {
      setOptionGroups(cached.optionGroups);
      setPricingRows(cached.pricingRows);
      setMinQty(cached.minQuantity);
      setQuantity("");
      setSelectedOptions({});
      setPriceChangedInfo(null);
      setPricingError(null);

      const cacheKey = `variant-options-${selectedVariantId}`;
      const optionsUrl = `${API_BASE}/variants/${selectedVariantId}/options`;
      const optionsInit: RequestInit = { headers: getAuthHeaders(), cache: "no-store" };

      const applyFresh = (fresh: VariantOptionsResponse) => {
        if (!fresh?.success) return;
        const freshData: VariantData = {
          optionGroups: fresh.option_groups || [],
          pricingRows: fresh.pricing_rows || [],
          minQuantity: fresh.min_quantity || 1,
        };
        variantDataCache.current.set(selectedVariantId, freshData);
        setPricingRows(freshData.pricingRows);
        setOptionGroups(freshData.optionGroups);
      };

      revalidateInBackground(
        cacheKey, optionsUrl, optionsInit, 5000,
        { success: true, option_groups: cached.optionGroups, pricing_rows: cached.pricingRows, min_quantity: cached.minQuantity },
        applyFresh
      );

      const pollInterval = setInterval(() => {
        revalidateInBackground(
          cacheKey, optionsUrl, optionsInit, 5000,
          variantDataCache.current.get(selectedVariantId)
            ? { success: true, option_groups: variantDataCache.current.get(selectedVariantId)!.optionGroups, pricing_rows: variantDataCache.current.get(selectedVariantId)!.pricingRows, min_quantity: variantDataCache.current.get(selectedVariantId)!.minQuantity }
            : { success: true, option_groups: [], pricing_rows: [], min_quantity: 1 },
          applyFresh
        );
      }, 5000);

      return () => clearInterval(pollInterval);
    }

    const cacheKey = `variant-options-${selectedVariantId}`;
    const optionsUrl = `${API_BASE}/variants/${selectedVariantId}/options`;
    const optionsInit: RequestInit = { headers: getAuthHeaders(), cache: "no-store" };
    let pollInterval: ReturnType<typeof setInterval> | null = null;

    const applyFresh = (fresh: VariantOptionsResponse) => {
      if (!fresh?.success) return;
      const freshData: VariantData = {
        optionGroups: fresh.option_groups || [],
        pricingRows: fresh.pricing_rows || [],
        minQuantity: fresh.min_quantity || 1,
      };
      variantDataCache.current.set(selectedVariantId, freshData);
      setPricingRows(freshData.pricingRows);
      setOptionGroups(freshData.optionGroups);
    };

    const startPolling = () => {
      pollInterval = setInterval(() => {
        const current = variantDataCache.current.get(selectedVariantId);
        revalidateInBackground(
          cacheKey, optionsUrl, optionsInit, 5000,
          current
            ? { success: true, option_groups: current.optionGroups, pricing_rows: current.pricingRows, min_quantity: current.minQuantity }
            : { success: true, option_groups: [], pricing_rows: [], min_quantity: 1 },
          applyFresh
        );
      }, 5000);
    };

    setLoadingOptions(true);
    fetchJsonCached<VariantOptionsResponse>(cacheKey, optionsUrl, optionsInit, 5000)
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
          startPolling();
        }
      })
      .catch(() => notify.error("Failed to load options"))
      .finally(() => setLoadingOptions(false));

    return () => { if (pollInterval) clearInterval(pollInterval); };
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
  // Non-numeric codes (e.g. "500_minus") = pricing-tier group; user also enters actual qty number
  const hasNonNumericQtyGroup = Boolean(quantityGroup && !hasNumericQuantityGroup);

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

  // For non-numeric tier groups (e.g. "500_minus"), parse the first numeric sequence from the code.
  const nonNumericTierQty = useMemo(() => {
    if (!hasNonNumericQtyGroup || !quantityGroup) return NaN;
    const code = selectedOptions[quantityGroup.name] || "";
    const match = code.match(/\d+/);
    return match ? Number(match[0]) : minQty;
  }, [hasNonNumericQtyGroup, quantityGroup, selectedOptions, minQty]);

  const effectiveQuantity = hasMultipleQtyChoices
    ? quantityFromGroup
    : hasSingleQtyBase
      ? quantityNumber
      : hasNonNumericQtyGroup
        ? nonNumericTierQty
        : quantityNumber;

  const isQuantityValid =
    Number.isFinite(effectiveQuantity) &&
    effectiveQuantity >= minQty &&
    (!hasSingleQtyBase || (quantityStep > 0 && effectiveQuantity % quantityStep === 0)) &&
    // For non-numeric tier groups, also require a tier to be selected for pricing lookup
    (!hasNonNumericQtyGroup || !!selectedOptions[quantityGroup!.name]);

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

  const pricingMap = useMemo(
    () => new Map(pricingRows.map((r) => [r.combination_key, r])),
    [pricingRows]
  );

  const pricing = useMemo<PricingResult | null>(() => {
    if (!isSelectionComplete || pricingMap.size === 0) return null;

    const pricingDims = optionGroups
      .filter((g) => g.is_pricing_dimension && selectedOptions[g.name])
      .reduce<Record<string, string>>((acc, g) => { acc[g.name] = selectedOptions[g.name]; return acc; }, {});

    const entries = Object.entries(pricingDims).sort(([a], [b]) => a.localeCompare(b));
    const combinationKey = entries.length === 0
      ? "__NO_OPTIONS__"
      : entries.map(([k, v]) => `${k}:${v}`).join("|");

    const row = pricingMap.get(combinationKey);
    if (!row) return null;

    const finalUnitPrice = Number((row.price - row.discount).toFixed(2));

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

  // Auto-upload attachments as soon as they are selected
  const uploadingRef = useRef(false);
  useEffect(() => {
    const pending = attachmentFiles.slice(attachmentPaths.length);
    if (pending.length === 0 || uploadingRef.current) return;

    let cancelled = false;
    uploadingRef.current = true;
    setUploadingAttachments(true);

    (async () => {
      const newPaths: string[] = [];
      for (const file of pending) {
        if (cancelled) break;
        const fd = new FormData();
        fd.append("file", file);
        fd.append("folder", `orders/batch-${uploadBatchId}`);
        try {
          const res = await fetch(`${API_BASE}/uploads`, { method: "POST", headers: getAuthHeaders(), body: fd });
          const data = await res.json();
          if (!res.ok) throw new Error(data.message || "Upload failed");
          if (data.data?.fileUrl) newPaths.push(data.data.fileUrl);
        } catch (err) {
          notify.error(`Could not upload "${file.name}": ${err instanceof Error ? err.message : "Upload failed"}`);
        }
      }
      if (!cancelled) {
        setAttachmentPaths((prev) => [...prev, ...newPaths]);
        setUploadingAttachments(false);
        uploadingRef.current = false;
      }
    })();

    return () => { cancelled = true; };
  }, [attachmentFiles.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRemoveAttachment = async (index: number) => {
    const pathToDelete = index < attachmentPaths.length ? attachmentPaths[index] : null;
    setAttachmentFiles((prev) => prev.filter((_, i) => i !== index));
    setAttachmentPaths((prev) => prev.filter((_, i) => i !== index));
    if (pathToDelete) {
      fetch(`${API_BASE}/uploads`, {
        method: "DELETE",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ path: pathToDelete }),
      }).catch(() => {});
    }
  };

  // Step 1 → 2: validate selection only
  const handleProceedToStep2 = () => {
    if (!selectedVariantId) { notify.error("Please select a variant"); return; }
    if (!pricing) { notify.error("This option combination has no pricing. Please select different options."); return; }
    if (!isQuantityValid) { notify.error(`Minimum quantity is ${minQty}`); return; }
    setStep(2);
  };

  // Step 2 → 3: verify price + fetch payment details
  const proceedToStep3 = async () => {
    await Promise.allSettled([
      fetchJsonCached<ApiResponse<PaymentDetails[]>>("wallet-payment-details", `${API_BASE}/wallet/payment-details`, { headers: getAuthHeaders() }, 10_000)
        .then((d) => {
          if (d.success && Array.isArray(d.data)) {
            setPaymentMethods(d.data);
            setFailedPaymentQrById({});
            if (d.data.length > 0) setSelectedPaymentMethodId(d.data[0].id);
          }
        })
        .catch(() => {}),
      fetch(`${API_BASE}/wallet/balance`, { headers: getAuthHeaders() })
        .then((r) => r.json())
        .then((d) => { if (d.success) setWalletBalance(Number(d.data.availableBalance)); })
        .catch(() => {}),
    ]);
    setStep(3);
  };

  const handleProceedToStep3 = async () => {
    if (uploadingAttachments) { notify.error("Please wait for file uploads to complete"); return; }

    setPriceVerifying(true);
    setPriceChangedInfo(null);
    try {
      const res = await fetch(`${API_BASE}/pricing/calculate`, {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          variant_id: selectedVariantId,
          selected_options: selectedOptions,
          quantity: effectiveQuantity,
        }),
      });
      if (res.ok) {
        const json = await res.json() as { success: boolean; data: { unit_price: number; discount: number; final_unit_price: number; total_price: number } };
        if (json.success && pricing && Math.abs(json.data.unit_price - pricing.unit_price) > 0.009) {
          const pricingDimsEntries = optionGroups
            .filter((g) => g.is_pricing_dimension && selectedOptions[g.name])
            .map((g): [string, string] => [g.name, selectedOptions[g.name]])
            .sort(([a], [b]) => a.localeCompare(b));
          const combinationKey = pricingDimsEntries.length === 0
            ? "__NO_OPTIONS__"
            : pricingDimsEntries.map(([k, v]) => `${k}:${v}`).join("|");
          setPriceChangedInfo({
            prevUnitPrice: pricing.unit_price,
            newUnitPrice: json.data.unit_price,
            newFinalUnitPrice: json.data.final_unit_price,
            newDiscount: json.data.discount,
            newTotal: Number((json.data.final_unit_price * effectiveQuantity + (pricing.design_extra_total ?? 0)).toFixed(2)),
            combinationKey,
          });
          return;
        }
      }
    } catch {
      // Verification network failure — don't block checkout
    } finally {
      setPriceVerifying(false);
    }

    await proceedToStep3();
  };

  const handleConfirmNewPrice = async () => {
    if (!priceChangedInfo) return;
    setPricingRows((prev) =>
      prev.map((r) =>
        r.combination_key === priceChangedInfo.combinationKey
          ? { ...r, price: priceChangedInfo.newUnitPrice, discount: priceChangedInfo.newDiscount }
          : r
      )
    );
    setPriceChangedInfo(null);
    await proceedToStep3();
  };

  // Step 3 → 4: validate payment choice
  const handleProceedToStep4 = () => {
    if (paymentMethod === "proof" && !proofFile && !proofPath) {
      notify.error("Please upload your payment proof");
      return;
    }
    if (paymentMethod === "wallet") {
      const total = pricing!.total_price;
      if (walletBalance === null || walletBalance < total) {
        notify.error("Insufficient wallet balance");
        return;
      }
    }
    setStep(4);
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
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Failed to upload payment proof");
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

  const selectCls = "w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-800 bg-white focus:border-[#0f172a] focus:ring-2 focus:ring-[#0f172a]/10 outline-none transition-shadow";
  const labelCls = "block text-[0.72rem] font-bold text-slate-500 uppercase tracking-[0.08em] mb-1.5";

  const renderStep1 = () => {
    const images = uniqueImageUrls([
      ...(Array.isArray(product.preview_images) ? product.preview_images : []),
      product.image_url,
    ]).filter((src) => !failedPreviewUrls[src]);

    const activeIndex = images.length === 0 ? -1 : Math.min(previewIndex, images.length - 1);
    const activeImg = activeIndex >= 0 ? images[activeIndex] : null;

    const markPreviewFailed = (src: string) => {
      setFailedPreviewUrls((prev) => (prev[src] ? prev : { ...prev, [src]: true }));
    };

    return (
      <div className="flex flex-col gap-5">
        {/* Product preview card */}
        <div className="rounded-xl overflow-hidden border border-slate-100 bg-white shadow-sm">
          <div className="relative w-full h-56 bg-slate-50">
            {activeImg ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={activeImg} alt={product.name} className="w-full h-full object-contain p-3" loading="eager" onError={() => markPreviewFailed(activeImg)} />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 px-4 text-center">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                  No preview available
                </p>
              </div>
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
                  key={`${src}-${i}`}
                  type="button"
                  aria-label={`Preview ${i + 1}`}
                  onClick={() => setPreviewIndex(i)}
                  className={`relative w-11 h-11 rounded-lg shrink-0 overflow-hidden border-2 transition-all ${i === activeIndex ? "border-[#0f172a] shadow-sm" : "border-slate-200 opacity-60 hover:opacity-100"}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="w-full h-full object-cover" loading="lazy" onError={() => markPreviewFailed(src)} />
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
              {/* Quantity input — 3 modes */}
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
              ) : quantityGroup && hasNonNumericQtyGroup ? (
                // Pricing tier dropdown — the selected tier IS the quantity
                <div>
                  <label className={labelCls}>Quantity</label>
                  <select
                    value={selectedOptions[quantityGroup.name] || ""}
                    onChange={(e) => { setSelectedOptions((prev) => ({ ...prev, [quantityGroup.name]: e.target.value })); setPricingError(null); }}
                    aria-label="Quantity"
                    className={selectCls}
                  >
                    <option value="">— Select quantity —</option>
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
            onClick={handleProceedToStep2}
            disabled={!pricing}
            className="flex-1 py-2.5 bg-[#0f172a] text-white text-sm font-bold rounded-lg hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Continue
            <svg className="inline-block w-4 h-4 ml-1.5 -mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </button>
        </div>
      </div>
    );
  };

  const renderStep2 = () => (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-sm font-semibold text-slate-700 mb-1">Reference Files</p>
        <p className="text-xs text-slate-400 mb-4">Upload your design references, images, or any files needed for this order. You can skip this step if no files are needed.</p>
        <div
          className="rounded-lg border-2 border-dashed border-slate-200 p-4 text-center cursor-pointer hover:border-slate-300 hover:bg-slate-50/50 transition-colors"
          onClick={() => document.getElementById("attachment-files")?.click()}
        >
          {attachmentFiles.length === 0 ? (
            <div>
              <svg className="mx-auto w-7 h-7 text-slate-300 mb-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" /></svg>
              <p className="text-sm text-slate-400">Click to attach files</p>
              <p className="text-xs text-slate-300 mt-0.5">Any file type accepted · Multiple files allowed</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-xs font-semibold text-slate-500">
                  {attachmentFiles.length} file{attachmentFiles.length !== 1 ? "s" : ""} selected
                </span>
                {attachmentFiles.length > 0 && (
                  <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    attachmentPaths.length === attachmentFiles.length
                      ? "bg-emerald-50 text-emerald-600"
                      : uploadingAttachments
                      ? "bg-blue-50 text-blue-500"
                      : "bg-amber-50 text-amber-600"
                  }`}>
                    {uploadingAttachments ? (
                      <>
                        <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                        Uploading…
                      </>
                    ) : attachmentPaths.length === attachmentFiles.length && attachmentPaths.length > 0 ? (
                      <>{attachmentPaths.length}/{attachmentFiles.length} uploaded ✓</>
                    ) : (
                      <>{attachmentPaths.length}/{attachmentFiles.length} uploaded</>
                    )}
                  </span>
                )}
              </div>

              {attachmentFiles.map((f, i) => {
                const isUploaded = i < attachmentPaths.length;
                const isUploading = uploadingAttachments && i === attachmentPaths.length;
                return (
                  <div key={i} className={`flex items-center justify-between rounded-lg px-3 py-2 border text-sm transition-colors ${
                    isUploaded ? "bg-emerald-50 border-emerald-100" : isUploading ? "bg-blue-50 border-blue-100" : "bg-white border-slate-100"
                  }`}>
                    <div className="flex items-center gap-2 min-w-0">
                      {isUploaded ? (
                        <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                      ) : isUploading ? (
                        <svg className="w-4 h-4 text-blue-400 flex-shrink-0 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                      ) : (
                        <svg className="w-4 h-4 text-slate-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/></svg>
                      )}
                      <span className={`font-medium truncate ${isUploaded ? "text-emerald-700" : isUploading ? "text-blue-600" : "text-slate-700"}`}>{f.name}</span>
                      <span className="text-slate-400 text-xs flex-shrink-0">{(f.size / 1024).toFixed(0)} KB</span>
                    </div>
                    {!isUploading && (
                      <button type="button" title={`Remove ${f.name}`} aria-label={`Remove ${f.name}`}
                        onClick={(e) => { e.stopPropagation(); handleRemoveAttachment(i); }}
                        className="text-slate-300 hover:text-red-400 ml-2 flex-shrink-0">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                      </button>
                    )}
                  </div>
                );
              })}
              <button type="button" onClick={(e) => { e.stopPropagation(); document.getElementById("attachment-files")?.click(); }} className="text-xs text-slate-400 hover:text-slate-600 mt-1">+ Add more files</button>
            </div>
          )}
        </div>
        <input
          id="attachment-files"
          type="file"
          multiple
          accept="image/*,.pdf,.tiff,.tif,.zip,.eps,.ai,.psd,.cdr"
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

      {/* Price change alert (shown if price changed during step 1 → 2 transition) */}
      {priceChangedInfo && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">
          <p className="font-semibold text-amber-800">Price updated by admin</p>
          <p className="mt-1 text-amber-700">
            Unit price changed from{" "}
            <span className="line-through">NPR {priceChangedInfo.prevUnitPrice.toLocaleString()}</span>
            {" → "}
            <span className="font-bold">NPR {priceChangedInfo.newUnitPrice.toLocaleString()}</span>.
            New total: <span className="font-bold">NPR {priceChangedInfo.newTotal.toLocaleString()}</span>.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={handleConfirmNewPrice}
              className="px-4 py-1.5 bg-amber-700 text-white text-xs font-bold rounded-md hover:bg-amber-800 transition-colors"
            >
              Confirm new price &amp; continue
            </button>
            <button
              type="button"
              onClick={() => { setPriceChangedInfo(null); setStep(1); }}
              className="px-4 py-1.5 border border-amber-300 text-amber-800 text-xs font-semibold rounded-md hover:bg-amber-100 transition-colors"
            >
              Go back
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-3 pt-1">
        <button type="button" onClick={() => setStep(1)}
          className="px-5 py-2.5 border border-slate-200 text-slate-600 text-sm font-semibold rounded-lg hover:bg-slate-50 transition-colors">
          Back
        </button>
        <button
          type="button"
          onClick={handleProceedToStep3}
          disabled={uploadingAttachments || priceVerifying || !!priceChangedInfo}
          className="flex-1 py-2.5 bg-[#0f172a] text-white text-sm font-bold rounded-lg hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {priceVerifying ? "Verifying price…" : uploadingAttachments ? "Uploading files…" : (
            <>
              Continue to Payment
              <svg className="inline-block w-4 h-4 ml-1.5 -mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </>
          )}
        </button>
      </div>
    </div>
  );

  const renderStep3 = () => {
    const total = pricing!.total_price;
    const walletSufficient = walletBalance !== null && walletBalance >= total;

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
            {paymentMethods.length > 0 && (() => {
              const paymentDetails = paymentMethods.find((m) => m.id === selectedPaymentMethodId) ?? paymentMethods[0];
              return (
                <div className="border border-slate-100 rounded-xl overflow-hidden shadow-sm">
                  <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-100">
                    <span className="text-[0.72rem] font-bold text-slate-500 uppercase tracking-[0.08em]">Bank / QR Details</span>
                  </div>
                  {/* Tabs when multiple payment methods */}
                  {paymentMethods.length > 1 && (
                    <div className="flex gap-1 px-4 pt-3 overflow-x-auto">
                      {paymentMethods.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setSelectedPaymentMethodId(m.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                            (selectedPaymentMethodId ?? paymentMethods[0].id) === m.id
                              ? "bg-[#0f172a] text-white"
                              : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                          }`}
                        >
                          {m.companyName}
                        </button>
                      ))}
                    </div>
                  )}
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
                    {paymentDetails.qrImageUrl && !failedPaymentQrById[paymentDetails.id] ? (
                      <div className="mt-2 flex justify-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`${API_BASE}/wallet/qr-image?id=${paymentDetails.id}`}
                          alt="QR Code"
                          className="w-44 h-44 object-contain border border-slate-100 rounded-xl p-2 shadow-sm"
                          onError={() => setFailedPaymentQrById((prev) => ({ ...prev, [paymentDetails.id]: true }))}
                        />
                      </div>
                    ) : (
                      <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-5 text-center">
                        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-slate-500">
                          No preview available
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

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
          <button type="button" onClick={() => setStep(2)}
            className="px-5 py-2.5 border border-slate-200 text-slate-600 text-sm font-semibold rounded-lg hover:bg-slate-50 transition-colors">
            Back
          </button>
          <button
            type="button"
            onClick={handleProceedToStep4}
            disabled={paymentMethod === "proof" ? (!proofFile && !proofPath) : (walletBalance === null || walletBalance < pricing!.total_price)}
            className="flex-1 py-2.5 bg-[#0f172a] text-white text-sm font-bold rounded-lg hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Review Order
            <svg className="inline-block w-4 h-4 ml-1.5 -mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </button>
        </div>
      </div>
    );
  };

  const renderStep4 = () => {
    const total = pricing!.total_price;
    const configuredOptions = optionGroups.filter((g) => selectedOptions[g.name]);

    return (
      <div className="flex flex-col gap-5">
        <div>
          <p className="text-sm font-semibold text-slate-700 mb-0.5">Review your order</p>
          <p className="text-xs text-slate-400">Please confirm the details before placing your order.</p>
        </div>

        {/* Order summary card */}
        <div className="rounded-xl border border-slate-100 overflow-hidden shadow-sm">
          <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-100">
            <span className="text-[0.72rem] font-bold text-slate-500 uppercase tracking-[0.08em]">Order Details</span>
          </div>
          <div className="bg-white divide-y divide-slate-50 text-sm">
            <div className="px-4 py-2.5 flex justify-between">
              <span className="text-slate-400">Product</span>
              <span className="font-semibold text-slate-800 text-right max-w-[60%]">{product.name}</span>
            </div>
            <div className="px-4 py-2.5 flex justify-between">
              <span className="text-slate-400">Variant</span>
              <span className="font-semibold text-slate-800 text-right max-w-[60%]">
                {variants.find((v) => v.id === selectedVariantId)?.variant_name || "—"}
              </span>
            </div>
            {configuredOptions.map((g) => {
              const val = g.values.find((v) => v.code === selectedOptions[g.name]);
              return (
                <div key={g.id} className="px-4 py-2.5 flex justify-between">
                  <span className="text-slate-400">{g.label}</span>
                  <span className="font-semibold text-slate-800">{val?.label || selectedOptions[g.name]}</span>
                </div>
              );
            })}
            <div className="px-4 py-2.5 flex justify-between">
              <span className="text-slate-400">Quantity</span>
              <span className="font-semibold text-slate-800">{effectiveQuantity}</span>
            </div>
            {attachmentFiles.length > 0 && (
              <div className="px-4 py-2.5 flex justify-between">
                <span className="text-slate-400">Files</span>
                <span className="font-semibold text-slate-800">{attachmentPaths.length} uploaded</span>
              </div>
            )}
            {designCode && (
              <div className="px-4 py-2.5 flex justify-between">
                <span className="text-slate-400">Design</span>
                <span className="font-semibold text-slate-800">{designCode}</span>
              </div>
            )}
            {notes && (
              <div className="px-4 py-2.5 flex justify-between gap-3">
                <span className="text-slate-400 shrink-0">Remarks</span>
                <span className="font-semibold text-slate-800 text-right">{notes}</span>
              </div>
            )}
          </div>
        </div>

        {/* Payment summary */}
        <div className="rounded-xl border border-slate-100 overflow-hidden shadow-sm">
          <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-100">
            <span className="text-[0.72rem] font-bold text-slate-500 uppercase tracking-[0.08em]">Payment</span>
          </div>
          <div className="bg-white divide-y divide-slate-50 text-sm">
            <div className="px-4 py-2.5 flex justify-between">
              <span className="text-slate-400">Method</span>
              <span className="font-semibold text-slate-800">{paymentMethod === "wallet" ? "Wallet" : "Bank / QR Transfer"}</span>
            </div>
            {paymentMethod === "proof" && proofFile && (
              <div className="px-4 py-2.5 flex justify-between">
                <span className="text-slate-400">Proof</span>
                <span className="font-semibold text-slate-800 truncate max-w-[60%]">{proofFile.name}</span>
              </div>
            )}
            <div className="px-4 py-3.5 flex justify-between items-center bg-slate-50/60">
              <span className="font-bold text-slate-900">Total</span>
              <span className="font-extrabold text-[#0f172a] text-xl">NPR {total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={() => setStep(3)}
            className="px-5 py-2.5 border border-slate-200 text-slate-600 text-sm font-semibold rounded-lg hover:bg-slate-50 transition-colors">
            Back
          </button>
          <button
            type="button"
            onClick={handleSubmitOrder}
            disabled={submitting || uploadingProof}
            className="flex-[2] py-3 bg-[#0f172a] text-white text-sm font-bold rounded-lg hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {uploadingProof ? "Uploading proof…" : submitting ? "Placing order…" : "Place Order"}
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
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderStep4()}
        </div>
      </div>
    </div>
  );
}

