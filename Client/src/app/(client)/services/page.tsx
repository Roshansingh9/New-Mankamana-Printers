"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { getAuthHeaders } from "@/store/authStore";
import { fetchJsonCached } from "@/utils/requestCache";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8005/api/v1";

interface Product {
    id: string;
    name: string;
    description: string | null;
    image_url: string | null;
    production_days: number;
    product_code: string;
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

export default function ServicesPage() {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchJsonCached<any>(
            "catalog-products",
            `${API_BASE}/products`,
            { headers: getAuthHeaders() },
            60000
        )
            .then((d) => {
                if (d.success) {
                    const list: Product[] = d.data || [];
                    setProducts(list);
                    // Prefetch details + variants for all products so product pages load instantly
                    list.forEach((p) => {
                        fetchJsonCached<any>(`catalog-product-${p.id}`, `${API_BASE}/products/${p.id}`, { headers: getAuthHeaders() }, 60000).catch(() => {});
                        fetchJsonCached<any>(`catalog-variants-${p.id}`, `${API_BASE}/products/${p.id}/variants`, { headers: getAuthHeaders() }, 60000).catch(() => {});
                    });
                }
            })
            .catch(() => {})
            .finally(() => setLoading(false));
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

            {/* Product grid */}
            <div className="max-w-6xl mx-auto px-5 sm:px-8 py-10">
                {loading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[1, 2, 3, 4, 5, 6].map((i) => <SkeletonCard key={i} />)}
                    </div>
                ) : products.length === 0 ? (
                    <div className="text-center py-24">
                        <div className="text-5xl mb-4">📦</div>
                        <p className="text-slate-500 font-medium">No services available at the moment.</p>
                        <p className="text-slate-400 text-sm mt-1">Check back soon.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {products.map((product, index) => (
                            <Link
                                key={product.id}
                                href={`/services/${product.id}`}
                                className="group relative bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col"
                            >
                                {/* Image */}
                                <div className="relative aspect-[4/3] bg-slate-50 overflow-hidden">
                                    {product.image_url ? (
                                        <Image
                                            src={product.image_url}
                                            alt={product.name}
                                            fill
                                            priority={index < 3}
                                            quality={70}
                                            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                                            className="object-cover group-hover:scale-105 transition-transform duration-500"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-5xl">
                                            🖨️
                                        </div>
                                    )}
                                    {/* B2B badge */}
                                    <span className="absolute top-3 left-3 bg-amber-400 text-[#0f172a] text-[0.62rem] font-black tracking-[0.1em] uppercase px-2 py-0.5 rounded-md shadow-sm">
                                        B2B
                                    </span>
                                </div>

                                {/* Content */}
                                <div className="flex flex-col flex-1 p-5">
                                    <h3 className="font-bold text-[1rem] text-slate-900 leading-snug mb-1.5 group-hover:text-blue-700 transition-colors">
                                        {product.name}
                                    </h3>
                                    {product.description && (
                                        <p className="text-[0.82rem] text-slate-400 leading-relaxed line-clamp-2 mb-3">
                                            {product.description}
                                        </p>
                                    )}

                                    {/* Meta row */}
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
