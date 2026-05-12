"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getAuthHeaders } from "@/store/authStore";
import { fetchJsonCached, registerFocusRevalidation, startBackgroundRefresh } from "@/utils/requestCache";
import { normalizeImageUrl } from "@/utils/image";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8005/api/v1";

interface SubProduct {
    id: string;
    product_code: string;
    name: string;
    description: string | null;
    image_url: string | null;
    production_days: number;
}

interface GroupData {
    id: string;
    name: string;
    description: string | null;
    image_url: string | null;
    products: SubProduct[];
}

function SkeletonCard() {
    return (
        <div className="bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm animate-pulse">
            <div className="aspect-[4/3] bg-slate-100" />
            <div className="p-5 space-y-3">
                <div className="h-5 bg-slate-100 rounded-lg w-3/5" />
                <div className="h-3.5 bg-slate-50 rounded-lg w-4/5" />
                <div className="h-10 bg-slate-100 rounded-xl mt-4" />
            </div>
        </div>
    );
}

function CatalogCardImage({ imageUrl, alt }: { imageUrl: string | null; alt: string }) {
    const [failed, setFailed] = useState(false);
    const safeUrl = normalizeImageUrl(imageUrl);

    if (!safeUrl || failed) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 px-3 text-center">
                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-slate-500">
                    No preview available
                </p>
            </div>
        );
    }

    return (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
            src={safeUrl}
            alt={alt}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            onError={() => setFailed(true)}
        />
    );
}

export default function GroupPage() {
    const { groupId } = useParams<{ groupId: string }>();
    const [group, setGroup] = useState<GroupData | null>(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);

    useEffect(() => {
        if (!groupId) return;

        type GroupResponse = { success: boolean; data?: GroupData };
        const key = `catalog-group-${groupId}`;
        const url = `${API_BASE}/product-groups/${groupId}`;
        const init = { headers: getAuthHeaders() };
        let lastResponse: GroupResponse | null = null;

        const applyData = (d: GroupResponse) => {
            if (d.success && d.data) {
                lastResponse = d;
                setGroup(d.data);
                // Prefetch each sub-product's details + variants into L1+L2 cache
                d.data.products.forEach((p) => {
                    fetchJsonCached<unknown>(`catalog-product-${p.id}`, `${API_BASE}/products/${p.id}`, init, 60_000).catch(() => {});
                    fetchJsonCached<unknown>(`catalog-variants-${p.id}`, `${API_BASE}/products/${p.id}/variants`, init, 60_000).catch(() => {});
                });
            } else {
                setNotFound(true);
            }
        };

        fetchJsonCached<GroupResponse>(key, url, init, 60_000)
            .then(applyData)
            .catch(() => setNotFound(true))
            .finally(() => setLoading(false));

        const deregister = registerFocusRevalidation<GroupResponse>(key, url, init, 60_000, applyData);
        const stopBg = startBackgroundRefresh<GroupResponse>(
            key, url, init, 60_000,
            () => lastResponse as GroupResponse,
            applyData
        );
        return () => { deregister(); stopBg(); };
    }, [groupId]);

    return (
        <div className="min-h-[calc(100vh-72px)] bg-[#f8f7f4]">
            {/* Hero header */}
            <div className="relative overflow-hidden bg-[#0f172a] px-6 py-14 sm:px-10 sm:py-20">
                <div className="hero-grid-overlay pointer-events-none absolute inset-0" />
                <div className="relative max-w-4xl mx-auto">
                    <Link
                        href="/services"
                        className="inline-flex items-center gap-1.5 text-slate-400 hover:text-white text-sm mb-6 transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                        </svg>
                        All Services
                    </Link>
                    <span className="inline-block mb-4 px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/20 text-amber-400 text-[0.72rem] font-bold tracking-[0.15em] uppercase">
                        B2B Wholesale Rates
                    </span>
                    {loading ? (
                        <div className="h-10 w-64 bg-slate-800 rounded-xl animate-pulse" />
                    ) : (
                        <h1 className="font-serif text-4xl sm:text-5xl font-black text-white tracking-tight leading-[1.1]">
                            {group?.name ?? "Not Found"}
                        </h1>
                    )}
                    {group?.description && (
                        <p className="mt-4 text-slate-400 text-[0.95rem] max-w-xl leading-relaxed">
                            {group.description}
                        </p>
                    )}
                </div>
            </div>

            {/* Sub-products grid */}
            <div className="max-w-6xl mx-auto px-5 sm:px-8 py-10">
                {loading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
                    </div>
                ) : notFound ? (
                    <div className="text-center py-24">
                        <div className="text-5xl mb-4">🔍</div>
                        <p className="text-slate-500 font-medium">Product group not found.</p>
                        <Link href="/services" className="mt-4 inline-block text-blue-600 text-sm font-semibold hover:underline">
                            Back to all services
                        </Link>
                    </div>
                ) : !group || group.products.length === 0 ? (
                    <div className="text-center py-24">
                        <div className="text-5xl mb-4">📦</div>
                        <p className="text-slate-500 font-medium">No products available in this category.</p>
                        <p className="text-slate-400 text-sm mt-1">Check back soon.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {group.products.map((product) => (
                            <Link
                                key={product.id}
                                href={`/services/${product.id}`}
                                className="group relative bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col"
                            >
                                <div className="relative aspect-[4/3] bg-slate-50 overflow-hidden">
                                    <CatalogCardImage imageUrl={product.image_url} alt={product.name} />
                                    <span className="absolute top-3 left-3 bg-amber-400 text-[#0f172a] text-[0.62rem] font-black tracking-[0.1em] uppercase px-2 py-0.5 rounded-md shadow-sm">
                                        B2B
                                    </span>
                                </div>
                                <div className="flex flex-col flex-1 p-5">
                                    <h3 className="font-bold text-[1rem] text-slate-900 leading-snug mb-1.5 group-hover:text-[#1a56db] transition-colors">
                                        {product.name}
                                    </h3>
                                    {product.description && (
                                        <p className="text-[0.82rem] text-slate-400 leading-relaxed line-clamp-2 mb-3">
                                            {product.description}
                                        </p>
                                    )}
                                    <div className="mt-auto flex items-center justify-between pt-3 border-t border-slate-50">
                                        <div className="flex items-center gap-1.5 text-slate-400 text-[0.75rem]">
                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            <span>{product.production_days} day{product.production_days !== 1 ? "s" : ""}</span>
                                        </div>
                                        <span className="flex items-center gap-1 text-blue-600 text-[0.8rem] font-semibold group-hover:gap-2 transition-all">
                                            Order now
                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                            </svg>
                                        </span>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

