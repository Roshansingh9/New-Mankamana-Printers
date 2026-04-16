"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { getAuthHeaders } from "@/store/authStore";
import { notify } from "@/utils/notifications";
import { formatCurrency } from "@/utils/helpers";
import { fetchJsonCached, invalidateClientCache } from "@/utils/requestCache";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8005/api/v1";

interface PaymentDetail {
    id: string;
    companyName: string;
    bankName: string;
    accountName: string;
    accountNumber: string;
    branch?: string;
    paymentId?: string;
    qrImageUrl?: string;
    note?: string;
}

export default function TopUpPage() {
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [paymentDetails, setPaymentDetails] = useState<PaymentDetail[]>([]);
    const [loadingDetails, setLoadingDetails] = useState(true);

    const [amount, setAmount] = useState("");
    const [paymentMethod, setPaymentMethod] = useState("BANK_TRANSFER");
    const [transferReference, setTransferReference] = useState("");
    const [note, setNote] = useState("");
    const [proofFile, setProofFile] = useState<File | null>(null);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetchJsonCached<any>(
            "wallet-payment-details",
            `${API_BASE}/wallet/payment-details`,
            { headers: getAuthHeaders() },
            10_000
        )
            .then((data) => {
                if (data.success) {
                    setPaymentDetails(Array.isArray(data.data) ? data.data : [data.data]);
                }
            })
            .finally(() => setLoadingDetails(false));
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const parsed = Number(amount);
        if (!amount || parsed <= 0) { notify.error("Please enter a valid amount"); return; }
        if (parsed > 100_000) { notify.error("Amount seems unusually high. Please verify."); return; }
        if (!proofFile) { notify.error("Payment proof is required"); return; }

        setSubmitting(true);
        try {
            const formData = new FormData();
            formData.append("amount", amount);
            formData.append("paymentMethod", paymentMethod);
            if (transferReference) formData.append("transferReference", transferReference);
            if (note) formData.append("note", note);
            formData.append("proofFile", proofFile);

            const res = await fetch(`${API_BASE}/wallet/topup-requests`, {
                method: "POST",
                headers: getAuthHeaders(),
                body: formData,
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                notify.error(data.error?.message || data.message || "Failed to submit top-up request");
                return;
            }
            // Bust the topup list and balance caches so wallet page shows fresh data
            invalidateClientCache("wallet-topups-ALL");
            invalidateClientCache("wallet-topups-PENDING_REVIEW");
            invalidateClientCache("wallet-balance");
            notify.success("Top-up submitted! Awaiting admin approval.");
            router.push("/wallet");
        } catch {
            notify.error("Network error. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    const inputCls = "w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-800 bg-white outline-none focus:border-[#0f172a] focus:ring-2 focus:ring-[#0f172a]/10 transition-all";

    return (
        <div className="min-h-[calc(100vh-68px)] bg-[#f8f7f4]">
            {/* Hero header */}
            <div className="relative overflow-hidden bg-[#0f172a] px-6 py-10 sm:py-12">
                <div className="hero-grid-overlay pointer-events-none absolute inset-0" />
                <div className="relative max-w-2xl mx-auto">
                    <button
                        type="button"
                        onClick={() => router.push("/wallet")}
                        className="flex items-center gap-1.5 text-slate-400 text-xs font-semibold hover:text-white transition-colors mb-4"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                        Back to Wallet
                    </button>
                    <span className="inline-block mb-2 px-2.5 py-0.5 rounded-full bg-amber-400/10 border border-amber-400/20 text-amber-400 text-[0.68rem] font-bold tracking-[0.12em] uppercase">
                        Wallet
                    </span>
                    <h1 className="font-serif text-3xl sm:text-4xl font-black text-white leading-tight">Top Up Wallet</h1>
                    <p className="mt-1.5 text-slate-400 text-sm">Transfer to our account, then upload your proof of payment.</p>
                </div>
            </div>

            <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-5">

                {/* Payment details card */}
                {loadingDetails ? (
                    <div className="bg-white rounded-2xl border border-slate-100 p-6 animate-pulse">
                        <div className="h-4 w-32 bg-slate-100 rounded mb-4" />
                        <div className="grid grid-cols-2 gap-3">
                            {[1,2,3,4].map(i => <div key={i} className="h-10 bg-slate-50 rounded-lg" />)}
                        </div>
                    </div>
                ) : paymentDetails.length === 0 ? (
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-amber-700 text-sm">
                        No payment details configured. Please contact admin.
                    </div>
                ) : (
                    paymentDetails.map((pd, index) => (
                        <div key={pd.id || `pd-${index}`} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                            <div className="bg-[#0f172a] px-5 py-3 flex items-center justify-between">
                                <span className="text-white font-bold text-sm">{pd.companyName}</span>
                                <span className="text-amber-400 text-[0.68rem] font-bold uppercase tracking-widest">Bank Details</span>
                            </div>
                            <div className="p-5">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {[
                                        ["Bank", pd.bankName],
                                        ["Account Name", pd.accountName],
                                        ["Account Number", pd.accountNumber],
                                        ...(pd.branch ? [["Branch", pd.branch]] : []),
                                        ...(pd.paymentId ? [["Payment ID", pd.paymentId]] : []),
                                    ].map(([label, value]) => (
                                        <div key={label} className="rounded-lg bg-slate-50 border border-slate-100 px-3.5 py-3">
                                            <p className="text-[0.62rem] font-bold uppercase tracking-[0.1em] text-slate-400 mb-0.5">{label}</p>
                                            <p className={`font-bold text-[#0f172a] text-sm ${label === "Account Number" ? "font-mono tracking-wider" : ""}`}>{value}</p>
                                        </div>
                                    ))}
                                </div>
                                {pd.note && (
                                    <div className="mt-3 flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-lg px-3.5 py-3">
                                        <svg className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        <p className="text-xs text-amber-700">{pd.note}</p>
                                    </div>
                                )}
                                {pd.qrImageUrl && (
                                    <div className="mt-4 flex flex-col items-center gap-2">
                                        <p className="text-[0.68rem] font-bold uppercase tracking-[0.1em] text-slate-400">Scan to Pay</p>
                                        <img
                                            src={`${API_BASE}/wallet/qr-image`}
                                            alt="QR Code"
                                            className="w-44 h-44 object-contain rounded-xl border border-slate-100 shadow-sm p-2"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}

                {/* Submission form */}
                <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="bg-slate-50 border-b border-slate-100 px-5 py-3">
                        <h2 className="font-bold text-[#0f172a] text-sm">Submit Proof of Payment</h2>
                        <p className="text-slate-400 text-xs mt-0.5">Fill in the details exactly as shown on your transaction.</p>
                    </div>
                    <div className="p-5 space-y-4">
                        {/* Amount */}
                        <div>
                            <label htmlFor="amount" className="block text-[0.7rem] font-bold uppercase tracking-[0.08em] text-slate-400 mb-1.5">
                                Amount (NPR) <span className="text-red-400">*</span>
                            </label>
                            <input
                                id="amount"
                                type="number"
                                min="1"
                                step="1"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="e.g. 5000"
                                className={inputCls}
                                required
                            />
                            {amount && Number(amount) > 0 && (
                                <p className="text-xs text-slate-500 mt-1">{formatCurrency(amount)}</p>
                            )}
                            {Number(amount) > 20_000 && (
                                <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                    High amount — please double-check before submitting.
                                </p>
                            )}
                        </div>

                        {/* Payment method */}
                        <div>
                            <label htmlFor="payment-method" className="block text-[0.7rem] font-bold uppercase tracking-[0.08em] text-slate-400 mb-1.5">
                                Payment Method <span className="text-red-400">*</span>
                            </label>
                            <input
                                id="payment-method"
                                type="text"
                                value={paymentMethod}
                                onChange={(e) => setPaymentMethod(e.target.value)}
                                placeholder="e.g. eSewa, Bank Transfer, Fonepay"
                                className={inputCls}
                                required
                            />
                        </div>

                        {/* Transaction reference */}
                        <div>
                            <label htmlFor="txn-ref" className="block text-[0.7rem] font-bold uppercase tracking-[0.08em] text-slate-400 mb-1.5">
                                Transaction Reference / ID
                                <span className="ml-1 text-slate-400 font-normal normal-case">(optional)</span>
                            </label>
                            <input
                                id="txn-ref"
                                type="text"
                                value={transferReference}
                                onChange={(e) => setTransferReference(e.target.value)}
                                placeholder="Transaction ID or reference number"
                                className={inputCls}
                            />
                        </div>

                        {/* Note */}
                        <div>
                            <label htmlFor="topup-note" className="block text-[0.7rem] font-bold uppercase tracking-[0.08em] text-slate-400 mb-1.5">
                                Note <span className="text-slate-400 font-normal normal-case">(optional)</span>
                            </label>
                            <input
                                id="topup-note"
                                type="text"
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                placeholder="Any additional information for admin"
                                className={inputCls}
                            />
                        </div>

                        {/* File upload */}
                        <div>
                            <p className="block text-[0.7rem] font-bold uppercase tracking-[0.08em] text-slate-400 mb-1.5">
                                Payment Proof <span className="text-red-400">*</span>
                                <span className="ml-1 text-slate-400 font-normal normal-case">(screenshot or PDF)</span>
                            </p>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/png,image/jpeg,image/jpg,application/pdf"
                                className="hidden"
                                onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                            />
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className={`w-full rounded-xl border-2 border-dashed py-8 px-4 flex flex-col items-center gap-2 transition-all ${
                                    proofFile
                                        ? "border-emerald-300 bg-emerald-50"
                                        : "border-slate-200 bg-slate-50 hover:border-[#0f172a]/30 hover:bg-white"
                                }`}
                            >
                                {proofFile ? (
                                    <>
                                        <svg className="w-7 h-7 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        <p className="text-sm font-semibold text-emerald-700 text-center truncate max-w-[260px]">{proofFile.name}</p>
                                        <p className="text-xs text-emerald-500">({(proofFile.size / 1024).toFixed(1)} KB) · click to replace</p>
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-7 h-7 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
                                        <p className="text-sm font-semibold text-slate-600">Click to upload screenshot or PDF</p>
                                        <p className="text-xs text-slate-400">PNG, JPG, PDF · max 10 MB</p>
                                    </>
                                )}
                            </button>
                        </div>

                        {/* How it works note */}
                        <div className="flex items-start gap-2.5 bg-[#0f172a]/5 rounded-xl border border-[#0f172a]/10 px-4 py-3">
                            <svg className="w-4 h-4 text-[#0f172a] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            <p className="text-xs text-slate-600 leading-relaxed">
                                Once you submit, our admin will review and credit your wallet within <strong>1 business day</strong>.
                                You can track the status in <strong>Wallet → Top-up Requests</strong>.
                            </p>
                        </div>

                        <button
                            type="submit"
                            disabled={submitting}
                            className="w-full py-3.5 bg-[#0f172a] text-white text-sm font-bold rounded-xl hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {submitting ? "Submitting…" : "Submit Top-up Request"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
