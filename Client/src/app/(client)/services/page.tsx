"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getAuthHeaders } from "@/store/authStore";
import { fetchJsonCached, registerFocusRevalidation, startBackgroundRefresh } from "@/utils/requestCache";
import { normalizeImageUrl } from "@/utils/image";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8005/api/v1";

interface ProductGroup {
    id: string;
    group_code: string;
    name: string;
    description: string | null;
    image_url: string | null;
    product_count: number;
    type: "group";
}

interface StandaloneProduct {
    id: string;
    name: string;
    description: string | null;
    image_url: string | null;
    production_days: number;
    product_code: string;
    type: "product";
}

type CatalogItem = ProductGroup | StandaloneProduct;

function CatalogPreviewImage({ imageUrl, alt }: { imageUrl: string | null; alt: string }) {
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

function SkeletonCard() {
    return (
        <div className="group relative bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm animate-pulse">
            <div className="aspect-[4/3] bg-slate-100" />
            <div className="p-5 space-y-3">
                <div className="h-5 bg-slate-100 rounded-lg w-3/5" />
                <div className="h-3.5 bg-slate-50 rounded-lg w-4/5" />
                <div className="h-3.5 bg-slate-50 rounded-lg w-2/5" />
                <div className="h-10 bg-slate-100 rounded-xl mt-4" />
            </div>
        </div>
    );
}

function GroupCard({ item }: { item: ProductGroup }) {
    return (
        <Link
            href={`/services/group/${item.id}`}
            className="group relative bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col"
        >
            <div className="relative aspect-[4/3] bg-slate-50 overflow-hidden">
                <CatalogPreviewImage imageUrl={item.image_url} alt={item.name} />
                <span className="absolute top-3 left-3 bg-amber-400 text-[#0f172a] text-[0.62rem] font-black tracking-[0.1em] uppercase px-2 py-0.5 rounded-md shadow-sm">
                    B2B
                </span>
                <span className="absolute top-3 right-3 bg-slate-900/70 text-white text-[0.62rem] font-semibold px-2 py-0.5 rounded-md backdrop-blur-sm">
                    {item.product_count} {item.product_count === 1 ? "style" : "styles"}
                </span>
            </div>
            <div className="flex flex-col flex-1 p-5">
                <h3 className="font-bold text-[1rem] text-slate-900 leading-snug mb-1.5 group-hover:text-[#1a56db] transition-colors">
                    {item.name}
                </h3>
                {item.description && (
                    <p className="text-[0.82rem] text-slate-400 leading-relaxed line-clamp-2 mb-3">
                        {item.description}
                    </p>
                )}
                <div className="mt-auto flex items-center justify-end pt-3 border-t border-slate-50">
                    <span className="flex items-center gap-1 text-blue-600 text-[0.8rem] font-semibold group-hover:gap-2 transition-all">
                        View options
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                        </svg>
                    </span>
                </div>
            </div>
        </Link>
    );
}

function ProductCard({ item }: { item: StandaloneProduct }) {
    return (
        <Link
            href={`/services/${item.id}`}
            className="group relative bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col"
        >
            <div className="relative aspect-[4/3] bg-slate-50 overflow-hidden">
                <CatalogPreviewImage imageUrl={item.image_url} alt={item.name} />
                <span className="absolute top-3 left-3 bg-amber-400 text-[#0f172a] text-[0.62rem] font-black tracking-[0.1em] uppercase px-2 py-0.5 rounded-md shadow-sm">
                    B2B
                </span>
            </div>
            <div className="flex flex-col flex-1 p-5">
                <h3 className="font-bold text-[1rem] text-slate-900 leading-snug mb-1.5 group-hover:text-[#1a56db] transition-colors">
                    {item.name}
                </h3>
                {item.description && (
                    <p className="text-[0.82rem] text-slate-400 leading-relaxed line-clamp-2 mb-3">
                        {item.description}
                    </p>
                )}
                <div className="mt-auto flex items-center justify-between pt-3 border-t border-slate-50">
                    <div className="flex items-center gap-1.5 text-slate-400 text-[0.75rem]">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>{item.production_days} day{item.production_days !== 1 ? "s" : ""}</span>
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
    );
}

type CatalogResponse = { success: boolean; data?: { groups: ProductGroup[]; products: StandaloneProduct[] } };

export default function ServicesPage() {
    const [items, setItems] = useState<CatalogItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const CATALOG_KEY = "catalog-browse";
        const CATALOG_URL = `${API_BASE}/catalog`;
        const init = { headers: getAuthHeaders() };
        let lastResponse: CatalogResponse | null = null;

        const applyData = (d: CatalogResponse) => {
            if (!d.success || !d.data) return;
            lastResponse = d;
            setItems([...d.data.groups, ...d.data.products]);
            // Prefetch standalone product details into L1+L2 cache
            d.data.products.forEach((p) => {
                fetchJsonCached<unknown>(`catalog-product-${p.id}`, `${API_BASE}/products/${p.id}`, init, 60_000).catch(() => {});
                fetchJsonCached<unknown>(`catalog-variants-${p.id}`, `${API_BASE}/products/${p.id}/variants`, init, 60_000).catch(() => {});
            });
        };

        fetchJsonCached<CatalogResponse>(CATALOG_KEY, CATALOG_URL, init, 60_000)
            .then(applyData)
            .catch(() => {})
            .finally(() => setLoading(false));

        const deregister = registerFocusRevalidation<CatalogResponse>(
            CATALOG_KEY, CATALOG_URL, init, 60_000, applyData
        );
        const stopBg = startBackgroundRefresh<CatalogResponse>(
            CATALOG_KEY, CATALOG_URL, init, 60_000,
            () => lastResponse as CatalogResponse,
            applyData
        );
        return () => { deregister(); stopBg(); };
    }, []);

    return (
        <div className="min-h-[calc(100vh-72px)] bg-[#f8f7f4]">
            {/* Hero header */}
            <div className="relative overflow-hidden bg-[#0f172a] px-6 py-14 sm:px-10 sm:py-20">
                <div className="hero-grid-overlay pointer-events-none absolute inset-0" />
                <div className="relative max-w-4xl mx-auto text-center">
                    <span className="inline-block mb-4 px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/20 text-amber-400 text-[0.72rem] font-bold tracking-[0.15em] uppercase">
                        B2B Wholesale Rates
                    </span>
                    <h1 className="font-serif text-4xl sm:text-5xl font-black text-white tracking-tight leading-[1.1]">
                        Printing Services
                    </h1>
                    <p className="mt-4 text-slate-400 text-[0.95rem] max-w-xl mx-auto leading-relaxed">
                        Premium quality, trade pricing. Select a service to configure your order.
                    </p>
                </div>
            </div>

            {/* Catalog grid */}
            <div className="max-w-6xl mx-auto px-5 sm:px-8 py-10">
                {loading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[1, 2, 3, 4, 5, 6].map((i) => <SkeletonCard key={i} />)}
                    </div>
                ) : items.length === 0 ? (
                    <div className="text-center py-24">
                        <div className="text-5xl mb-4">??</div>
                        <p className="text-slate-500 font-medium">No services available at the moment.</p>
                        <p className="text-slate-400 text-sm mt-1">Check back soon.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {items.map((item) =>
                            item.type === "group" ? (
                                <GroupCard key={item.id} item={item} />
                            ) : (
                                <ProductCard key={item.id} item={item} />
                            )
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
