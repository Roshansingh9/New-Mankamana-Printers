"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getAuthHeaders } from "@/store/authStore";
import { notify } from "@/utils/notifications";
import { formatCurrency } from "@/utils/helpers";
import { fetchJsonCached } from "@/utils/requestCache";

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
    const [paymentDetails, setPaymentDetails] = useState<PaymentDetail[]>([]);
    const [loadingDetails, setLoadingDetails] = useState(true);

    const [amount, setAmount] = useState("");
    const [paymentMethod, setPaymentMethod] = useState("");
    const [transferReference, setTransferReference] = useState("");
    const [note, setNote] = useState("");
    const [proofFile, setProofFile] = useState<File | null>(null);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        const fetchDetails = async () => {
            try {
                const data = await fetchJsonCached<any>(
                    "wallet-payment-details",
                    `${API_BASE}/wallet/payment-details`,
                    { headers: getAuthHeaders() },
                    60000
                );
                if (data.success) {
                    setPaymentDetails(Array.isArray(data.data) ? data.data : [data.data]);
                }
            } finally {
                setLoadingDetails(false);
            }
        };
        fetchDetails();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!amount || Number(amount) <= 0) {
            notify.error("Please enter a valid amount");
            return;
        }
        if (Number(amount) > 100000) {
            notify.error("Entered amount is unusually high. Please verify before submitting.");
            return;
        }
        if (!paymentMethod) {
            notify.error("Please enter the payment method (e.g. eSewa, Bank Transfer)");
            return;
        }
        if (!proofFile) {
            notify.error("Payment proof is required");
            return;
        }

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
                notify.error(data.message || "Failed to submit top-up request");
                return;
            }
            notify.success("Top-up request submitted! Awaiting admin approval.");
            router.push("/wallet");
        } catch {
            notify.error("Network error. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto p-4 sm:p-8">
            <div className="mb-6">
                <h1 className="text-[1.3rem] sm:text-[1.5rem] font-extrabold text-[#0f172a]">Top Up Wallet</h1>
                <p className="text-[#64748b] text-[0.9rem] mt-1">
                    Transfer to our account, then upload your proof of payment.
                </p>
            </div>

            {/* Payment details */}
            {loadingDetails ? (
                <div className="bg-white rounded-2xl border border-[#e2e8f0] p-6 mb-6 text-center text-[#94a3b8]">
                    Loading payment details…
                </div>
            ) : paymentDetails.length === 0 ? (
                <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-5 mb-6 text-yellow-700 text-[0.88rem]">
                    No payment details configured. Please contact admin.
                </div>
            ) : (
                paymentDetails.map((pd, index) => (
                    <div
                        key={pd.id || `${pd.bankName}-${pd.accountNumber}-${index}`}
                        className="bg-white rounded-2xl border border-[#e2e8f0] p-5 sm:p-6 mb-5"
                    >
                        <h2 className="font-bold text-[#0f172a] text-[0.95rem] mb-3">{pd.companyName}</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[0.85rem]">
                            <div>
                                <span className="text-[#94a3b8] text-[0.72rem] uppercase font-semibold block">Bank</span>
                                <span className="text-[#0f172a] font-semibold">{pd.bankName}</span>
                            </div>
                            <div>
                                <span className="text-[#94a3b8] text-[0.72rem] uppercase font-semibold block">Account Name</span>
                                <span className="text-[#0f172a] font-semibold">{pd.accountName}</span>
                            </div>
                            <div>
                                <span className="text-[#94a3b8] text-[0.72rem] uppercase font-semibold block">Account Number</span>
                                <span className="text-[#0f172a] font-mono font-bold">{pd.accountNumber}</span>
                            </div>
                            {pd.branch && (
                                <div>
                                    <span className="text-[#94a3b8] text-[0.72rem] uppercase font-semibold block">Branch</span>
                                    <span className="text-[#0f172a]">{pd.branch}</span>
                                </div>
                            )}
                            {pd.paymentId && (
                                <div>
                                    <span className="text-[#94a3b8] text-[0.72rem] uppercase font-semibold block">Payment ID</span>
                                    <span className="text-[#0f172a] font-mono">{pd.paymentId}</span>
                                </div>
                            )}
                        </div>
                        {pd.qrImageUrl && (
                            <div className="mt-4 flex justify-center">
                                <img
                                    src={pd.qrImageUrl}
                                    alt="QR Code"
                                    className="w-[160px] h-[160px] object-contain rounded-lg border border-[#e2e8f0]"
                                />
                            </div>
                        )}
                        {pd.note && (
                            <p className="mt-3 text-[0.8rem] text-[#64748b] bg-[#f8fafc] rounded-lg p-3">
                                {pd.note}
                            </p>
                        )}
                    </div>
                ))
            )}

            {/* Submission form */}
            <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-[#e2e8f0] p-5 sm:p-7 flex flex-col gap-5">
                <h2 className="font-bold text-[#0f172a] text-[1rem]">Submit Proof of Payment</h2>

                <div className="form-group">
                    <label className="form-label">Amount (NPR) *</label>
                    <input
                        type="number"
                        min="1"
                        step="0.01"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="e.g. 5000"
                        className="form-input"
                        required
                    />
                    {amount && Number(amount) > 0 && (
                        <p className="text-[0.78rem] text-[#64748b] mt-1">{formatCurrency(amount)}</p>
                    )}
                    {Number(amount) > 20000 && (
                        <p className="text-[0.78rem] text-amber-600 mt-1">
                            High amount entered. Please double-check payment proof and amount.
                        </p>
                    )}
                </div>

                <div className="form-group">
                    <label className="form-label">Payment Method *</label>
                    <input
                        type="text"
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        placeholder="e.g. eSewa, Bank Transfer, Fonepay"
                        className="form-input"
                        required
                    />
                </div>

                <div className="form-group">
                    <label className="form-label">Transaction Reference / ID</label>
                    <input
                        type="text"
                        value={transferReference}
                        onChange={(e) => setTransferReference(e.target.value)}
                        placeholder="Transaction ID or reference number"
                        className="form-input"
                    />
                </div>

                <div className="form-group">
                    <label className="form-label">Note (optional)</label>
                    <input
                        type="text"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Any additional note"
                        className="form-input"
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="proof-file" className="form-label">Payment Proof (screenshot/PDF) *</label>
                    <input
                        id="proof-file"
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,application/pdf"
                        onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                        className="form-input py-2 cursor-pointer"
                        required
                    />
                    {proofFile && (
                        <p className="text-[0.78rem] text-[#64748b] mt-1">
                            Selected: {proofFile.name} ({(proofFile.size / 1024).toFixed(1)} KB)
                        </p>
                    )}
                </div>

                <button
                    type="submit"
                    disabled={submitting}
                    className={`btn-primary w-full p-3.5 text-[0.875rem] font-bold tracking-[0.08em] ${submitting ? "opacity-70" : ""}`}
                >
                    {submitting ? "SUBMITTING…" : "SUBMIT TOP-UP REQUEST"}
                </button>
            </form>
        </div>
    );
}
