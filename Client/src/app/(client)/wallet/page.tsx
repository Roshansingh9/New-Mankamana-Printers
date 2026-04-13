"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { getAuthHeaders } from "@/store/authStore";
import { formatDate, formatCurrency } from "@/utils/helpers";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8005/api/v1";

interface WalletBalance {
    walletId: string;
    availableBalance: number;
    currency: string;
}

interface Transaction {
    id: string;
    type: "CREDIT" | "DEBIT";
    source: string;
    amount: string | number;
    balanceBefore: string | number;
    balanceAfter: string | number;
    description?: string;
    createdAt: string;
}

interface TopupRequest {
    id: string;
    submittedAmount: string | number;
    approvedAmount?: string | number | null;
    paymentMethod: string;
    transferReference?: string;
    note?: string;
    status: "PENDING_REVIEW" | "APPROVED" | "REJECTED";
    rejectionReason?: string;
    createdAt: string;
    reviewedAt?: string;
}

const TXN_TYPE_FILTERS = [
    { label: "All", value: "ALL" },
    { label: "Credits", value: "CREDIT" },
    { label: "Debits", value: "DEBIT" },
];

const TOPUP_STATUS_FILTERS = [
    { label: "All", value: "ALL" },
    { label: "Pending", value: "PENDING_REVIEW" },
    { label: "Approved", value: "APPROVED" },
    { label: "Rejected", value: "REJECTED" },
];

const topupStatusBadge = (status: string) => {
    const map: Record<string, string> = {
        PENDING_REVIEW: "bg-yellow-100 text-yellow-700",
        APPROVED: "bg-green-100 text-green-700",
        REJECTED: "bg-red-100 text-red-700",
    };
    const label: Record<string, string> = {
        PENDING_REVIEW: "Pending Review",
        APPROVED: "Approved",
        REJECTED: "Rejected",
    };
    return { cls: map[status] || "bg-gray-100 text-gray-600", label: label[status] || status };
};

export default function WalletPage() {
    const [tab, setTab] = useState<"transactions" | "topups">("transactions");

    const [balance, setBalance] = useState<WalletBalance | null>(null);
    const [balanceLoading, setBalanceLoading] = useState(true);

    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [txnLoading, setTxnLoading] = useState(true);
    const [txnFilter, setTxnFilter] = useState("ALL");

    const [topups, setTopups] = useState<TopupRequest[]>([]);
    const [topupLoading, setTopupLoading] = useState(true);
    const [topupFilter, setTopupFilter] = useState("ALL");

    const fetchBalance = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/wallet/balance`, { headers: getAuthHeaders() });
            const data = await res.json();
            if (res.ok && data.success) setBalance(data.data);
        } finally {
            setBalanceLoading(false);
        }
    }, []);

    const fetchTransactions = useCallback(async () => {
        setTxnLoading(true);
        try {
            const params = new URLSearchParams({ page: "1", limit: "50" });
            if (txnFilter !== "ALL") params.set("type", txnFilter);
            const res = await fetch(`${API_BASE}/wallet/transactions?${params}`, { headers: getAuthHeaders() });
            const data = await res.json();
            if (res.ok && data.success) setTransactions(data.data?.items || data.data?.transactions || data.data || []);
        } finally {
            setTxnLoading(false);
        }
    }, [txnFilter]);

    const fetchTopups = useCallback(async () => {
        setTopupLoading(true);
        try {
            const params = new URLSearchParams({ page: "1", limit: "50" });
            if (topupFilter !== "ALL") params.set("status", topupFilter);
            const res = await fetch(`${API_BASE}/wallet/topup-requests?${params}`, { headers: getAuthHeaders() });
            const data = await res.json();
            if (res.ok && data.success) setTopups(data.data?.items || data.data?.requests || data.data || []);
        } finally {
            setTopupLoading(false);
        }
    }, [topupFilter]);

    useEffect(() => { fetchBalance(); }, [fetchBalance]);
    useEffect(() => { fetchTransactions(); }, [fetchTransactions]);
    useEffect(() => { fetchTopups(); }, [fetchTopups]);

    return (
        <div className="p-3 sm:p-6 md:p-10 max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-7 gap-3 flex-wrap">
                <div>
                    <h1 className="text-[1.3rem] sm:text-[1.5rem] font-extrabold text-[#0f172a]">My Wallet</h1>
                    <p className="text-[#64748b] text-[0.9rem] mt-1">
                        View your balance, transactions, and top-up history.
                    </p>
                </div>
                <Link href="/wallet/topup" className="btn-primary w-full sm:w-auto text-center">
                    + Top Up Wallet
                </Link>
            </div>

            {/* Balance Card */}
            <div className="gradient-card rounded-2xl p-6 sm:p-8 mb-7 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <p className="text-white/70 text-[0.82rem] font-semibold tracking-widest uppercase mb-1">Available Balance</p>
                    {balanceLoading ? (
                        <div className="h-10 w-40 bg-white/20 rounded animate-pulse" />
                    ) : (
                        <p className="text-white text-[2rem] sm:text-[2.5rem] font-extrabold leading-none">
                            {balance ? formatCurrency(balance.availableBalance) : "NPR 0.00"}
                        </p>
                    )}
                    <p className="text-white/60 text-[0.78rem] mt-1">{balance?.currency || "NPR"} · Wallet Account</p>
                </div>
                <div className="text-white/50 text-[2.5rem] hidden sm:block">💳</div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-[#f1f5f9] rounded-xl p-1 mb-6 w-fit">
                <button
                    type="button"
                    onClick={() => setTab("transactions")}
                    className={`px-5 py-2 rounded-lg font-semibold text-[0.85rem] transition ${
                        tab === "transactions"
                            ? "bg-white text-[#1a56db] shadow-sm"
                            : "text-[#64748b] hover:text-[#0f172a]"
                    }`}
                >
                    Transactions
                </button>
                <button
                    type="button"
                    onClick={() => setTab("topups")}
                    className={`px-5 py-2 rounded-lg font-semibold text-[0.85rem] transition ${
                        tab === "topups"
                            ? "bg-white text-[#1a56db] shadow-sm"
                            : "text-[#64748b] hover:text-[#0f172a]"
                    }`}
                >
                    Top-up Requests
                </button>
            </div>

            {/* Transactions Tab */}
            {tab === "transactions" && (
                <>
                    <div className="flex gap-2 mb-4 flex-wrap">
                        {TXN_TYPE_FILTERS.map((f) => (
                            <button
                                key={f.value}
                                type="button"
                                onClick={() => setTxnFilter(f.value)}
                                className={`py-1.5 px-4 rounded-[50px] font-semibold text-[0.8rem] cursor-pointer transition ${
                                    txnFilter === f.value
                                        ? "bg-gradient-to-r from-[#1a56db] to-[#2563eb] text-white border-none"
                                        : "border-[1.5px] border-[#e2e8f0] bg-white text-[#475569] hover:bg-gray-50"
                                }`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>

                    {txnLoading ? (
                        <div className="bg-white rounded-2xl border border-[#e2e8f0] p-10 text-center text-[#94a3b8]">
                            Loading transactions…
                        </div>
                    ) : transactions.length === 0 ? (
                        <div className="bg-white rounded-2xl border border-[#e2e8f0] p-10 text-center text-[#94a3b8]">
                            No transactions found.
                        </div>
                    ) : (
                        <div className="bg-white rounded-2xl border border-[#e2e8f0] overflow-hidden">
                            <div className="hidden sm:block overflow-x-auto">
                                <table className="w-full border-collapse">
                                    <thead>
                                        <tr className="bg-[#f8fafc] border-b border-[#e2e8f0] text-[#64748b] text-left text-[0.75rem] uppercase tracking-[0.04em]">
                                            <th className="p-4 font-bold">Date</th>
                                            <th className="p-4 font-bold">Type</th>
                                            <th className="p-4 font-bold">Source</th>
                                            <th className="p-4 font-bold">Description</th>
                                            <th className="p-4 font-bold text-right">Amount</th>
                                            <th className="p-4 font-bold text-right">Balance After</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#e2e8f0]">
                                        {transactions.map((txn) => (
                                            <tr key={txn.id} className="hover:bg-[#f8fafc] transition-colors">
                                                <td className="p-4 text-[#64748b] text-[0.82rem]">{formatDate(txn.createdAt)}</td>
                                                <td className="p-4">
                                                    <span className={`px-2.5 py-1 rounded-full text-[0.72rem] font-bold ${
                                                        txn.type === "CREDIT"
                                                            ? "bg-green-100 text-green-700"
                                                            : "bg-red-100 text-red-700"
                                                    }`}>
                                                        {txn.type}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-[#475569] text-[0.82rem]">{txn.source}</td>
                                                <td className="p-4 text-[#64748b] text-[0.82rem]">{txn.description || "—"}</td>
                                                <td className={`p-4 text-right font-bold text-[0.88rem] ${
                                                    txn.type === "CREDIT" ? "text-green-600" : "text-red-500"
                                                }`}>
                                                    {txn.type === "CREDIT" ? "+" : "−"}{formatCurrency(txn.amount)}
                                                </td>
                                                <td className="p-4 text-right text-[#0f172a] font-semibold text-[0.85rem]">
                                                    {formatCurrency(txn.balanceAfter)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile cards */}
                            <div className="sm:hidden divide-y divide-[#e2e8f0]">
                                {transactions.map((txn) => (
                                    <div key={txn.id} className="p-4 flex flex-col gap-1.5">
                                        <div className="flex items-center justify-between">
                                            <span className={`px-2.5 py-0.5 rounded-full text-[0.72rem] font-bold ${
                                                txn.type === "CREDIT" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                                            }`}>
                                                {txn.type}
                                            </span>
                                            <span className={`font-bold text-[0.95rem] ${
                                                txn.type === "CREDIT" ? "text-green-600" : "text-red-500"
                                            }`}>
                                                {txn.type === "CREDIT" ? "+" : "−"}{formatCurrency(txn.amount)}
                                            </span>
                                        </div>
                                        <div className="text-[0.8rem] text-[#475569]">{txn.source}{txn.description ? ` · ${txn.description}` : ""}</div>
                                        <div className="flex justify-between text-[0.75rem] text-[#94a3b8]">
                                            <span>{formatDate(txn.createdAt)}</span>
                                            <span>Bal: {formatCurrency(txn.balanceAfter)}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Top-up Requests Tab */}
            {tab === "topups" && (
                <>
                    <div className="flex gap-2 mb-4 flex-wrap">
                        {TOPUP_STATUS_FILTERS.map((f) => (
                            <button
                                key={f.value}
                                type="button"
                                onClick={() => setTopupFilter(f.value)}
                                className={`py-1.5 px-4 rounded-[50px] font-semibold text-[0.8rem] cursor-pointer transition ${
                                    topupFilter === f.value
                                        ? "bg-gradient-to-r from-[#1a56db] to-[#2563eb] text-white border-none"
                                        : "border-[1.5px] border-[#e2e8f0] bg-white text-[#475569] hover:bg-gray-50"
                                }`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>

                    {topupLoading ? (
                        <div className="bg-white rounded-2xl border border-[#e2e8f0] p-10 text-center text-[#94a3b8]">
                            Loading top-up requests…
                        </div>
                    ) : topups.length === 0 ? (
                        <div className="bg-white rounded-2xl border border-[#e2e8f0] p-10 text-center">
                            <p className="text-[#94a3b8] mb-4">No top-up requests yet.</p>
                            <Link href="/wallet/topup" className="btn-primary inline-block">
                                Submit your first top-up
                            </Link>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {topups.map((req) => {
                                const { cls, label } = topupStatusBadge(req.status);
                                return (
                                    <div
                                        key={req.id}
                                        className="bg-white rounded-2xl border border-[#e2e8f0] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                                    >
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className={`px-2.5 py-0.5 rounded-full text-[0.72rem] font-bold ${cls}`}>
                                                    {label}
                                                </span>
                                                <span className="text-[0.75rem] text-[#94a3b8]">{formatDate(req.createdAt)}</span>
                                            </div>
                                            <p className="text-[#0f172a] font-semibold text-[0.92rem] mt-1">
                                                Submitted: {formatCurrency(req.submittedAmount)}
                                                {req.approvedAmount != null && (
                                                    <span className="ml-2 text-green-600 text-[0.85rem]">
                                                        → Approved: {formatCurrency(req.approvedAmount)}
                                                    </span>
                                                )}
                                            </p>
                                            <p className="text-[#64748b] text-[0.82rem]">
                                                Method: {req.paymentMethod}
                                                {req.transferReference && <> · Ref: <span className="font-mono">{req.transferReference}</span></>}
                                            </p>
                                            {req.note && (
                                                <p className="text-[#94a3b8] text-[0.78rem]">{req.note}</p>
                                            )}
                                            {req.status === "REJECTED" && req.rejectionReason && (
                                                <p className="text-red-500 text-[0.8rem] mt-1">
                                                    Reason: {req.rejectionReason}
                                                </p>
                                            )}
                                        </div>
                                        {req.reviewedAt && (
                                            <div className="text-right shrink-0">
                                                <p className="text-[0.72rem] text-[#94a3b8]">Reviewed</p>
                                                <p className="text-[0.8rem] text-[#64748b]">{formatDate(req.reviewedAt)}</p>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
