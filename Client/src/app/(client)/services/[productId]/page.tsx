"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuthStore, getAuthHeaders } from "@/store/authStore";
import { notify } from "@/utils/notifications";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8005/api/v1";

interface Product {
    id: string;
    name: string;
    description: string | null;
    image_url: string | null;
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
    values: OptionValue[];
}

interface PricingResult {
    variant_id: string;
    variant_code: string;
    selected_options: Record<string, string>;
    quantity: number;
    unit_price: number;
    discount: number;
    final_unit_price: number;
    total_price: number;
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
    return (
        <div className="flex items-center justify-center gap-0 mb-8">
            {[{ n: 1, label: "Configure Order" }, { n: 2, label: "Payment & Submit" }].map(({ n, label }, idx) => (
                <div key={n} className="flex items-center">
                    <div className="flex flex-col items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 ${step >= n ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-gray-300 text-gray-400"}`}>
                            {step > n ? "✓" : n}
                        </div>
                        <span className={`text-xs mt-1 font-medium ${step >= n ? "text-blue-600" : "text-gray-400"}`}>{label}</span>
                    </div>
                    {idx === 0 && <div className={`w-24 h-0.5 mx-2 mb-5 ${step > 1 ? "bg-blue-600" : "bg-gray-200"}`} />}
                </div>
            ))}
        </div>
    );
}

export default function ProductOrderPage({ params }: { params: Promise<{ productId: string }> }) {
    const { productId } = use(params);
    const router = useRouter();
    const { user } = useAuthStore();

    const [step, setStep] = useState<1 | 2>(1);
    const [product, setProduct] = useState<Product | null>(null);
    const [variants, setVariants] = useState<Variant[]>([]);
    const [selectedVariantId, setSelectedVariantId] = useState("");
    const [optionGroups, setOptionGroups] = useState<OptionGroup[]>([]);
    const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
    const [quantity, setQuantity] = useState(1);
    const [minQty, setMinQty] = useState(1);
    const [designCode, setDesignCode] = useState("");
    const [approvedDesigns, setApprovedDesigns] = useState<{ designCode: string; title: string | null }[]>([]);
    const [notes, setNotes] = useState("");
    const [pricing, setPricing] = useState<PricingResult | null>(null);
    const [pricingLoading, setPricingLoading] = useState(false);
    const [paymentDetails, setPaymentDetails] = useState<PaymentDetails | null>(null);
    const [proofFile, setProofFile] = useState<File | null>(null);
    const [uploadingProof, setUploadingProof] = useState(false);
    const [proofPath, setProofPath] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [loadingProduct, setLoadingProduct] = useState(true);
    const [loadingVariants, setLoadingVariants] = useState(false);
    const [loadingOptions, setLoadingOptions] = useState(false);

    // Fetch product details
    useEffect(() => {
        setLoadingProduct(true);
        fetch(`${API_BASE}/products/${productId}`, { headers: getAuthHeaders() })
            .then((r) => r.json())
            .then((d) => { if (d.success || d.data) setProduct(d.data || d); else notify.error("Product not found"); })
            .catch(() => notify.error("Failed to load product"))
            .finally(() => setLoadingProduct(false));

        fetch(`${API_BASE}/products/${productId}/variants`, { headers: getAuthHeaders() })
            .then((r) => r.json())
            .then((d) => { if (d.success) setVariants(d.data || []); })
            .catch(() => {});
    }, [productId]);

    // Fetch approved designs
    useEffect(() => {
        fetch(`${API_BASE}/designs/my`, { headers: getAuthHeaders() })
            .then((r) => r.json())
            .then((d) => { if (d.success) setApprovedDesigns(d.data || []); })
            .catch(() => {});
    }, []);

    // Fetch options when variant changes
    useEffect(() => {
        if (!selectedVariantId) { setOptionGroups([]); setSelectedOptions({}); return; }
        setLoadingOptions(true);
        fetch(`${API_BASE}/variants/${selectedVariantId}/options`, { headers: getAuthHeaders() })
            .then((r) => r.json())
            .then((d) => {
                if (d.success) {
                    setOptionGroups(d.option_groups);
                    setMinQty(d.min_quantity);
                    setQuantity(d.min_quantity);
                    const defaults: Record<string, string> = {};
                    d.option_groups.forEach((g: OptionGroup) => { if (g.values.length > 0) defaults[g.name] = g.values[0].code; });
                    setSelectedOptions(defaults);
                }
            })
            .catch(() => notify.error("Failed to load options"))
            .finally(() => setLoadingOptions(false));
        setPricing(null);
    }, [selectedVariantId]);

    // Calculate price
    const calculatePrice = useCallback(async () => {
        if (!selectedVariantId || optionGroups.some(g => g.is_required && !selectedOptions[g.name])) return;
        setPricingLoading(true);
        try {
            const res = await fetch(`${API_BASE}/pricing/calculate`, {
                method: "POST",
                headers: { "Content-Type": "application/json", ...getAuthHeaders() },
                body: JSON.stringify({ variant_id: selectedVariantId, selected_options: selectedOptions, quantity }),
            });
            const data = await res.json();
            if (data.success) setPricing(data.data);
            else if (res.status === 422) { setPricing(null); notify.error("This option combination is not available."); }
            else notify.error(data.error?.message || "Pricing error");
        } catch { notify.error("Failed to calculate price"); }
        finally { setPricingLoading(false); }
    }, [selectedVariantId, selectedOptions, quantity, optionGroups]);

    useEffect(() => {
        if (selectedVariantId && Object.keys(selectedOptions).length > 0) calculatePrice();
    }, [calculatePrice, selectedVariantId, selectedOptions, quantity]);

    const handleProceedToPayment = async () => {
        if (!selectedVariantId) { notify.error("Please select a variant"); return; }
        if (!pricing) { notify.error("Please wait for pricing to load"); return; }
        if (quantity < minQty) { notify.error(`Minimum quantity is ${minQty}`); return; }
        try {
            const res = await fetch(`${API_BASE}/wallet/payment-details`, { headers: getAuthHeaders() });
            const data = await res.json();
            if (data.success) setPaymentDetails(data.data);
            else notify.error("Could not load payment details");
        } catch { notify.error("Could not load payment details"); }
        setStep(2);
    };

    // Upload proof first, then submit order with path
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
            if (!res.ok) throw new Error(data.message || "Upload failed");
            return data.data?.fileUrl || null;
        } catch (err: any) {
            notify.error(err.message || "Failed to upload payment proof");
            return null;
        } finally {
            setUploadingProof(false);
        }
    };

    const handleSubmitOrder = async () => {
        if (!proofFile && !proofPath) { notify.error("Please upload your payment proof"); return; }
        if (!pricing) return;

        setSubmitting(true);
        try {
            let path = proofPath;
            if (!path) {
                path = await handleUploadProof();
                if (!path) { setSubmitting(false); return; }
                setProofPath(path);
            }

            const configDetails = optionGroups
                .filter((g) => selectedOptions[g.name])
                .map((g) => {
                    const val = g.values.find((v) => v.code === selectedOptions[g.name])!;
                    return { groupName: g.name, groupLabel: g.label, selectedCode: val.code, selectedLabel: val.label };
                });

            const formData = new FormData();
            formData.append("variantId", selectedVariantId);
            formData.append("quantity", String(quantity));
            Object.entries(selectedOptions).forEach(([k, v]) => formData.append(`options[${k}]`, v));
            formData.append("options[configDetails]", JSON.stringify(configDetails));
            if (notes) formData.append("notes", notes);
            if (designCode) formData.append("designCode", designCode);
            formData.append("paymentProofPath", path);
            // Also append file name/type metadata (no raw file)
            formData.append("paymentProofFileName", proofFile?.name || "");
            formData.append("paymentProofMimeType", proofFile?.type || "");

            const res = await fetch(`${API_BASE}/orders`, {
                method: "POST",
                headers: getAuthHeaders(),
                body: formData,
            });
            const data = await res.json();

            if (data.success) {
                notify.success("Order placed successfully!");
                router.push("/orders");
            } else {
                notify.error(data.message || "Failed to place order");
            }
        } catch { notify.error("Network error. Please try again."); }
        finally { setSubmitting(false); }
    };

    if (loadingProduct) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                <p className="text-gray-500 animate-pulse">Loading product…</p>
            </div>
        );
    }

    if (!product) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                <div className="text-center">
                    <p className="text-gray-600 font-medium mb-4">Product not found.</p>
                    <button type="button" onClick={() => router.push("/services")} className="text-blue-600 underline text-sm">← Back to Services</button>
                </div>
            </div>
        );
    }

    const renderStep1 = () => (
        <div className="flex flex-col gap-5">
            {/* Product info card */}
            <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 flex gap-4">
                {product.image_url && (
                    <div className="relative w-20 h-20 rounded-lg overflow-hidden shrink-0">
                        <Image src={product.image_url} alt={product.name} fill className="object-cover" />
                    </div>
                )}
                <div>
                    <h2 className="font-bold text-base text-gray-900">{product.name}</h2>
                    {product.description && <p className="text-xs text-gray-500 mt-1">{product.description}</p>}
                    <p className="text-xs text-blue-600 mt-1 font-medium">Production: {product.production_days} day{product.production_days !== 1 ? "s" : ""}</p>
                </div>
            </div>

            {/* Variant */}
            <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1">Variant</label>
                {loadingVariants ? (
                    <p className="text-sm text-gray-400 animate-pulse">Loading variants…</p>
                ) : variants.length === 0 ? (
                    <p className="text-sm text-red-500">No variants available for this product.</p>
                ) : (
                    <select
                        value={selectedVariantId}
                        onChange={(e) => { setSelectedVariantId(e.target.value); setOptionGroups([]); setSelectedOptions({}); setPricing(null); }}
                        aria-label="Select variant"
                        className="w-full px-3 py-2.5 rounded border border-gray-300 text-sm text-gray-800 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                    >
                        <option value="">-- Choose a Variant --</option>
                        {variants.map((v) => (
                            <option key={v.id} value={v.id}>{v.variant_name}</option>
                        ))}
                    </select>
                )}
            </div>

            {/* Option Groups */}
            {selectedVariantId && !loadingOptions && optionGroups.length > 0 && (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                        <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">Configure Options</span>
                    </div>
                    <div className="px-4 py-4 flex flex-col gap-4 bg-white">
                        {optionGroups.map((group) => (
                            <div key={group.id}>
                                <label className="block text-sm font-semibold text-blue-700 mb-1">
                                    {group.label} {group.is_required && <span className="text-red-500">*</span>}
                                </label>
                                <select
                                    value={selectedOptions[group.name] || ""}
                                    onChange={(e) => setSelectedOptions((prev) => ({ ...prev, [group.name]: e.target.value }))}
                                    aria-label={group.label}
                                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-800 bg-gray-50 focus:border-blue-500 focus:bg-white outline-none"
                                >
                                    {!group.is_required && <option value="">-- None --</option>}
                                    {group.values.map((v) => (
                                        <option key={v.id} value={v.code}>{v.label}</option>
                                    ))}
                                </select>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Quantity */}
            {selectedVariantId && (
                <div>
                    <label htmlFor="qty" className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1">
                        Quantity <span className="text-gray-400 font-normal normal-case">(min: {minQty})</span>
                    </label>
                    <input
                        id="qty"
                        type="number"
                        min={minQty}
                        value={quantity}
                        onChange={(e) => setQuantity(Math.max(minQty, parseInt(e.target.value) || minQty))}
                        className="w-32 px-3 py-2 border border-gray-300 rounded text-sm text-gray-800 text-center focus:border-blue-500 outline-none"
                    />
                </div>
            )}

            {/* Approved Design */}
            {selectedVariantId && approvedDesigns.length > 0 && (
                <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1">
                        Approved Design <span className="text-gray-400 font-normal normal-case">(optional)</span>
                    </label>
                    <select
                        value={designCode}
                        onChange={(e) => setDesignCode(e.target.value)}
                        aria-label="Select approved design"
                        className="w-full px-3 py-2.5 rounded border border-gray-300 text-sm text-gray-800 bg-white focus:border-blue-500 outline-none"
                    >
                        <option value="">— No design (skip) —</option>
                        {approvedDesigns.map((d) => (
                            <option key={d.designCode} value={d.designCode}>
                                {d.designCode}{d.title ? ` — ${d.title}` : ""}
                            </option>
                        ))}
                    </select>
                </div>
            )}

            {/* Notes */}
            {selectedVariantId && (
                <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1">
                        Remarks <span className="text-gray-400 font-normal normal-case">(optional)</span>
                    </label>
                    <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={2}
                        placeholder="Any special instructions…"
                        className="w-full px-3 py-2 rounded border border-gray-300 text-sm text-gray-800 resize-y focus:border-blue-500 outline-none"
                    />
                </div>
            )}

            {/* Price Summary */}
            {selectedVariantId && (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                        <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">Price Summary</span>
                    </div>
                    {pricingLoading ? (
                        <p className="px-4 py-4 text-sm text-gray-400 animate-pulse">Calculating price…</p>
                    ) : pricing ? (
                        <table className="w-full text-sm">
                            <tbody>
                                <tr className="border-b border-gray-100">
                                    <td className="px-4 py-2.5 text-gray-500">Unit Price</td>
                                    <td className="px-4 py-2.5 text-right font-medium">NPR {pricing.unit_price.toFixed(2)}</td>
                                </tr>
                                {pricing.discount > 0 && (
                                    <tr className="border-b border-gray-100">
                                        <td className="px-4 py-2.5 text-green-600">Discount</td>
                                        <td className="px-4 py-2.5 text-right font-medium text-green-600">- NPR {pricing.discount.toFixed(2)}</td>
                                    </tr>
                                )}
                                <tr className="border-b border-gray-100">
                                    <td className="px-4 py-2.5 text-gray-500">Quantity</td>
                                    <td className="px-4 py-2.5 text-right font-medium">× {pricing.quantity}</td>
                                </tr>
                                <tr>
                                    <td className="px-4 py-3 font-bold text-gray-800">Total Payable</td>
                                    <td className="px-4 py-3 text-right font-extrabold text-blue-600 text-lg">NPR {pricing.total_price.toFixed(2)}</td>
                                </tr>
                            </tbody>
                        </table>
                    ) : (
                        <p className="px-4 py-4 text-sm text-gray-400">Select all required options to see pricing.</p>
                    )}
                </div>
            )}

            <div className="flex gap-3">
                <button type="button" onClick={() => router.push("/services")} className="px-4 py-3 border border-gray-300 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-50">
                    ← Back
                </button>
                <button
                    type="button"
                    onClick={handleProceedToPayment}
                    disabled={!pricing || pricingLoading}
                    className="flex-1 py-3 bg-blue-600 text-white text-sm font-bold uppercase tracking-wide rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    Proceed to Payment →
                </button>
            </div>
        </div>
    );

    const renderStep2 = () => (
        <div className="flex flex-col gap-5">
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-5 py-4">
                <p className="text-sm text-blue-700 font-medium mb-1">Amount to Pay</p>
                <p className="text-3xl font-extrabold text-blue-700">NPR {pricing!.total_price.toFixed(2)}</p>
                <p className="text-xs text-blue-500 mt-1">{product?.name} · Qty {pricing!.quantity}</p>
            </div>

            {paymentDetails && (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                        <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">Pay via Bank Transfer / QR</span>
                    </div>
                    <div className="px-4 py-4 bg-white flex flex-col gap-2 text-sm">
                        {[
                            ["Bank", paymentDetails.bankName],
                            ["Account Name", paymentDetails.accountName],
                            ["Account No.", paymentDetails.accountNumber],
                            ...(paymentDetails.branch ? [["Branch", paymentDetails.branch]] : []),
                            ...(paymentDetails.paymentId ? [["UPI / Payment ID", paymentDetails.paymentId]] : []),
                        ].map(([label, value]) => (
                            <div key={label} className="flex justify-between">
                                <span className="text-gray-500">{label}</span>
                                <span className="font-semibold text-gray-800">{value}</span>
                            </div>
                        ))}
                        {paymentDetails.note && (
                            <p className="mt-1 text-xs text-orange-600 bg-orange-50 px-3 py-2 rounded border border-orange-100">{paymentDetails.note}</p>
                        )}
                        {paymentDetails.qrImageUrl && (
                            <div className="mt-3 flex justify-center">
                                <img src={paymentDetails.qrImageUrl} alt="QR Code" className="w-40 h-40 object-contain border border-gray-200 rounded-lg p-2" />
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Upload proof */}
            <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                    <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">Upload Payment Proof <span className="text-red-500">*</span></span>
                </div>
                <div className="px-4 py-4 bg-white">
                    <label
                        htmlFor="proof-file"
                        className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${proofFile ? "border-green-400 bg-green-50" : "border-gray-300 bg-gray-50 hover:bg-gray-100"}`}
                    >
                        <input
                            id="proof-file"
                            type="file"
                            accept="image/png,image/jpeg,image/jpg,application/pdf"
                            className="hidden"
                            onChange={(e) => { setProofFile(e.target.files?.[0] || null); setProofPath(null); }}
                        />
                        {proofFile ? (
                            <div className="text-center">
                                <p className="text-green-600 font-semibold text-sm">✓ {proofFile.name}</p>
                                <p className="text-green-500 text-xs mt-1">Click to change</p>
                            </div>
                        ) : (
                            <div className="text-center">
                                <p className="text-gray-500 text-sm font-medium">Click to upload screenshot or PDF</p>
                                <p className="text-gray-400 text-xs mt-1">PNG, JPG, PDF up to 10MB</p>
                            </div>
                        )}
                    </label>
                </div>
            </div>

            <div className="flex gap-3">
                <button type="button" onClick={() => setStep(1)} className="flex-1 py-3 border border-gray-300 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-50">
                    ← Back
                </button>
                <button
                    type="button"
                    onClick={handleSubmitOrder}
                    disabled={submitting || uploadingProof || (!proofFile && !proofPath)}
                    className="flex-[2] py-3 bg-blue-600 text-white text-sm font-bold uppercase tracking-wide rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    {uploadingProof ? "Uploading Proof…" : submitting ? "Placing Order…" : "Place Order"}
                </button>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-100">
            <div className="max-w-2xl mx-auto px-4 py-8">
                <h1 className="text-center text-lg font-extrabold text-gray-800 tracking-widest uppercase border-b border-red-500 pb-2 mb-6">
                    NEW ORDER — {product.name}
                </h1>
                <StepBar step={step} />
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                    {step === 1 ? renderStep1() : renderStep2()}
                </div>
            </div>
        </div>
    );
}
