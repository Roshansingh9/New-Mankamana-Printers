"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { getAuthHeaders } from "@/store/authStore";
import { fetchJsonCached } from "@/utils/requestCache";
import { formatDate, formatCurrency } from "@/utils/helpers";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8005/api/v1";

interface WalletBalance {
    walletId: string;
    availableBalance: number;
    currency: string;
}

interface Transaction {
    transactionId: string;
    type: "CREDIT" | "DEBIT";
    source: string;
    amount: string | number;
    balanceBefore: string | number;
    balanceAfter: string | number;
    description?: string;
    createdAt: string;
}

interface TopupRequest {
    requestId: string;
    submittedAmount: string | number;
    approvedAmount?: string | number | null;
    paymentMethod: string;
    transferReference?: string | null;
    note?: string | null;
    status: "PENDING_REVIEW" | "APPROVED" | "REJECTED";
    rejectionReason?: string | null;
    submittedAt: string;
    reviewedAt?: string | null;
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

const TOPUP_STATUS_CONFIG: Record<string, { cls: string; label: string; dot: string }> = {
    PENDING_REVIEW: { cls: "bg-amber-50 text-amber-700 border border-amber-200", label: "Pending Review", dot: "bg-amber-400" },
    APPROVED:       { cls: "bg-emerald-50 text-emerald-700 border border-emerald-200", label: "Approved", dot: "bg-emerald-500" },
    REJECTED:       { cls: "bg-red-50 text-red-700 border border-red-200", label: "Rejected", dot: "bg-red-500" },
};

function FilterPills({ options, value, onChange }: {
    options: { label: string; value: string }[];
    value: string;
    onChange: (v: string) => void;
}) {
    return (
        <div className="flex gap-1.5 flex-wrap">
            {options.map((f) => (
                <button
                    key={f.value}
                    type="button"
                    onClick={() => onChange(f.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        value === f.value
                            ? "bg-[#0f172a] text-white"
                            : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                >
                    {f.label}
                </button>
            ))}
        </div>
    );
}

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
            const data = await fetchJsonCached<any>(
                "wallet-balance",
                `${API_BASE}/wallet/balance`,
                { headers: getAuthHeaders() },
                15_000
            );
            if (data.success) setBalance(data.data);
        } finally {
            setBalanceLoading(false);
        }
    }, []);

    const fetchTransactions = useCallback(async () => {
        setTxnLoading(true);
        try {
            const params = new URLSearchParams({ page: "1", limit: "50" });
            if (txnFilter !== "ALL") params.set("type", txnFilter);
            const cacheKey = `wallet-txns-${txnFilter}`;
            const data = await fetchJsonCached<any>(
                cacheKey,
                `${API_BASE}/wallet/transactions?${params}`,
                { headers: getAuthHeaders() },
                20_000
            );
            if (data.success) setTransactions(data.data?.items || data.data?.transactions || data.data || []);
        } finally {
            setTxnLoading(false);
        }
    }, [txnFilter]);

    const fetchTopups = useCallback(async () => {
        setTopupLoading(true);
        try {
            const params = new URLSearchParams({ page: "1", limit: "50" });
            if (topupFilter !== "ALL") params.set("status", topupFilter);
            const cacheKey = `wallet-topups-${topupFilter}`;
            const data = await fetchJsonCached<any>(
                cacheKey,
                `${API_BASE}/wallet/topup-requests?${params}`,
                { headers: getAuthHeaders() },
                20_000
            );
            if (data.success) setTopups(data.data?.items || data.data?.requests || data.data || []);
        } finally {
            setTopupLoading(false);
        }
    }, [topupFilter]);

    useEffect(() => {
        fetchBalance();
        const id = setInterval(fetchBalance, 30_000);
        return () => clearInterval(id);
    }, [fetchBalance]);

    useEffect(() => { fetchTransactions(); }, [fetchTransactions]);
    useEffect(() => { fetchTopups(); }, [fetchTopups]);

    const filteredTxns = transactions;
    const filteredTopups = topups;

    return (
        <div className="min-h-[calc(100vh-68px)] bg-[#f8f7f4]">
            {/* Hero header */}
            <div className="relative overflow-hidden bg-[#0f172a] px-6 py-10 sm:py-12">
                <div className="hero-grid-overlay pointer-events-none absolute inset-0" />
                <div className="relative max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-end justify-between gap-5">
                    <div>
                        <span className="inline-block mb-2 px-2.5 py-0.5 rounded-full bg-amber-400/10 border border-amber-400/20 text-amber-400 text-[0.68rem] font-bold tracking-[0.12em] uppercase">
                            B2B Wallet
                        </span>
                        <h1 className="font-serif text-3xl sm:text-4xl font-black text-white leading-tight">My Wallet</h1>
                        <p className="mt-1.5 text-slate-400 text-sm">Balance, transactions, and top-up history.</p>
                    </div>

                    {/* Balance card inside hero */}
                    <div className="sm:text-right">
                        <p className="text-[0.68rem] font-bold uppercase tracking-[0.1em] text-slate-400 mb-1">Available Balance</p>
                        {balanceLoading ? (
                            <div className="h-10 w-44 bg-white/10 rounded-lg animate-pulse" />
                        ) : (
                            <p className="text-3xl sm:text-4xl font-extrabold text-white leading-none">
                                {balance ? formatCurrency(balance.availableBalance) : "NPR 0.00"}
                            </p>
                        )}
                        <p className="text-slate-500 text-xs mt-1.5">{balance?.currency || "NPR"} · Wallet Account</p>
                        <Link
                            href="/wallet/topup"
                            className="inline-flex items-center gap-1.5 mt-3 px-4 py-2 bg-amber-400 text-[#0f172a] text-sm font-bold rounded-lg hover:bg-amber-300 transition-colors"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                            Top Up
                        </Link>
                    </div>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
                {/* Tabs */}
                <div className="flex gap-1 bg-white border border-slate-100 rounded-xl p-1 mb-6 w-fit shadow-sm">
                    {(["transactions", "topups"] as const).map((t) => (
                        <button
                            key={t}
                            type="button"
                            onClick={() => setTab(t)}
                            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                                tab === t
                                    ? "bg-[#0f172a] text-white shadow-sm"
                                    : "text-slate-500 hover:text-slate-800"
                            }`}
                        >
                            {t === "transactions" ? "Transactions" : "Top-up Requests"}
                        </button>
                    ))}
                </div>

                {/* Transactions Tab */}
                {tab === "transactions" && (
                    <>
                        <div className="mb-4">
                            <FilterPills options={TXN_TYPE_FILTERS} value={txnFilter} onChange={setTxnFilter} />
                        </div>

                        {txnLoading ? (
                            <div className="space-y-2">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="bg-white rounded-xl border border-slate-100 p-4 animate-pulse">
                                        <div className="flex justify-between">
                                            <div className="space-y-2">
                                                <div className="h-3 w-20 bg-slate-100 rounded" />
                                                <div className="h-3 w-36 bg-slate-100 rounded" />
                                            </div>
                                            <div className="h-5 w-24 bg-slate-100 rounded" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : filteredTxns.length === 0 ? (
                            <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
                                <div className="text-4xl mb-3">💳</div>
                                <p className="font-semibold text-slate-700">No transactions yet</p>
                                <p className="text-sm text-slate-400 mt-1">Your transaction history will appear here.</p>
                            </div>
                        ) : (
                            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
                                {/* Desktop table */}
                                <div className="hidden sm:block overflow-x-auto">
                                    <table className="w-full border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50 border-b border-slate-100 text-left">
                                                <th className="px-5 py-3 text-[0.68rem] font-bold uppercase tracking-[0.08em] text-slate-400">Date</th>
                                                <th className="px-5 py-3 text-[0.68rem] font-bold uppercase tracking-[0.08em] text-slate-400">Type</th>
                                                <th className="px-5 py-3 text-[0.68rem] font-bold uppercase tracking-[0.08em] text-slate-400">Source</th>
                                                <th className="px-5 py-3 text-[0.68rem] font-bold uppercase tracking-[0.08em] text-slate-400">Description</th>
                                                <th className="px-5 py-3 text-[0.68rem] font-bold uppercase tracking-[0.08em] text-slate-400 text-right">Amount</th>
                                                <th className="px-5 py-3 text-[0.68rem] font-bold uppercase tracking-[0.08em] text-slate-400 text-right">Balance After</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {filteredTxns.map((txn) => (
                                                <tr key={txn.transactionId} className="hover:bg-slate-50/60 transition-colors">
                                                    <td className="px-5 py-3.5 text-slate-500 text-xs">{formatDate(txn.createdAt)}</td>
                                                    <td className="px-5 py-3.5">
                                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[0.68rem] font-bold border ${
                                                            txn.type === "CREDIT"
                                                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                                : "bg-red-50 text-red-700 border-red-200"
                                                        }`}>
                                                            {txn.type === "CREDIT" ? "↑" : "↓"} {txn.type}
                                                        </span>
                                                    </td>
                                                    <td className="px-5 py-3.5 text-slate-600 text-xs font-medium">{txn.source}</td>
                                                    <td className="px-5 py-3.5 text-slate-500 text-xs max-w-[200px] truncate">{txn.description || "—"}</td>
                                                    <td className={`px-5 py-3.5 text-right font-bold text-sm ${
                                                        txn.type === "CREDIT" ? "text-emerald-600" : "text-red-500"
                                                    }`}>
                                                        {txn.type === "CREDIT" ? "+" : "−"}{formatCurrency(txn.amount)}
                                                    </td>
                                                    <td className="px-5 py-3.5 text-right text-[#0f172a] font-bold text-sm">
                                                        {formatCurrency(txn.balanceAfter)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Mobile cards */}
                                <div className="sm:hidden divide-y divide-slate-50">
                                    {filteredTxns.map((txn) => (
                                        <div key={txn.transactionId} className="px-4 py-3.5">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex items-center gap-2">
                                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[0.68rem] font-bold border ${
                                                        txn.type === "CREDIT"
                                                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                            : "bg-red-50 text-red-700 border-red-200"
                                                    }`}>
                                                        {txn.type === "CREDIT" ? "↑" : "↓"} {txn.type}
                                                    </span>
                                                    <span className="text-xs text-slate-500 font-medium">{txn.source}</span>
                                                </div>
                                                <span className={`font-extrabold text-sm ${txn.type === "CREDIT" ? "text-emerald-600" : "text-red-500"}`}>
                                                    {txn.type === "CREDIT" ? "+" : "−"}{formatCurrency(txn.amount)}
                                                </span>
                                            </div>
                                            {txn.description && (
                                                <p className="text-xs text-slate-400 mt-1 truncate">{txn.description}</p>
                                            )}
                                            <div className="flex justify-between mt-1.5 text-[0.68rem] text-slate-400">
                                                <span>{formatDate(txn.createdAt)}</span>
                                                <span className="font-semibold text-slate-600">Bal: {formatCurrency(txn.balanceAfter)}</span>
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
                        <div className="mb-4">
                            <FilterPills options={TOPUP_STATUS_FILTERS} value={topupFilter} onChange={setTopupFilter} />
                        </div>

                        {topupLoading ? (
                            <div className="space-y-2">
                                {[1, 2].map(i => (
                                    <div key={i} className="bg-white rounded-xl border border-slate-100 p-5 animate-pulse">
                                        <div className="flex justify-between">
                                            <div className="space-y-2">
                                                <div className="h-4 w-24 bg-slate-100 rounded" />
                                                <div className="h-3 w-48 bg-slate-100 rounded" />
                                            </div>
                                            <div className="h-6 w-20 bg-slate-100 rounded-lg" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : filteredTopups.length === 0 ? (
                            <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
                                <div className="text-4xl mb-3">🏦</div>
                                <p className="font-semibold text-slate-700">No top-up requests yet</p>
                                <p className="text-sm text-slate-400 mt-1 mb-4">Submit a payment proof to top up your wallet.</p>
                                <Link href="/wallet/topup" className="inline-flex items-center gap-2 px-4 py-2 bg-[#0f172a] text-white text-sm font-semibold rounded-lg hover:bg-slate-800 transition-colors">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                                    Submit Top-up
                                </Link>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-3">
                                {filteredTopups.map((req) => {
                                    const cfg = TOPUP_STATUS_CONFIG[req.status] || { cls: "bg-slate-100 text-slate-600 border border-slate-200", label: req.status, dot: "bg-slate-400" };
                                    return (
                                        <div
                                            key={req.requestId}
                                            className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm"
                                        >
                                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap mb-2">
                                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[0.72rem] font-bold ${cfg.cls}`}>
                                                            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                                                            {cfg.label}
                                                        </span>
                                                        <span className="text-xs text-slate-400">{formatDate(req.submittedAt)}</span>
                                                    </div>

                                                    <div className="flex items-baseline gap-2 flex-wrap">
                                                        <span className="font-extrabold text-[#0f172a] text-lg leading-none">
                                                            {formatCurrency(req.submittedAmount)}
                                                        </span>
                                                        {req.approvedAmount != null && (
                                                            <span className="text-emerald-600 font-semibold text-sm">
                                                                → Approved: {formatCurrency(req.approvedAmount)}
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
                                                        <span>Method: <strong className="text-slate-700">{req.paymentMethod}</strong></span>
                                                        {req.transferReference && (
                                                            <span>Ref: <span className="font-mono font-medium text-slate-700">{req.transferReference}</span></span>
                                                        )}
                                                    </div>

                                                    {req.note && (
                                                        <p className="mt-1.5 text-xs text-slate-400 italic">{req.note}</p>
                                                    )}

                                                    {req.status === "REJECTED" && req.rejectionReason && (
                                                        <div className="mt-2 flex items-start gap-1.5 text-xs text-red-600">
                                                            <svg className="w-3.5 h-3.5 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                                            <span><strong>Reason:</strong> {req.rejectionReason}</span>
                                                        </div>
                                                    )}
                                                </div>

                                                {req.reviewedAt && (
                                                    <div className="text-right shrink-0">
                                                        <p className="text-[0.68rem] text-slate-400 uppercase tracking-wide font-semibold">Reviewed</p>
                                                        <p className="text-xs text-slate-600 mt-0.5">{formatDate(req.reviewedAt)}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
