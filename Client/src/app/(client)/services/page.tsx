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
    category?: { name: string; slug: string } | null;
    variants?: { min_quantity: number }[];
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
            .then((d) => { if (d.success) setProducts(d.data || []); })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="py-10 px-10">
                <div className="mb-8 flex flex-col items-center">
                    <h2 className="text-4xl font-bold">Printing Services</h2>
                    <div className="divider mt-2 h-[4px] rounded-full w-32 bg-blue-500 my-4" />
                </div>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-6">
                    {[1,2,3,4].map((i) => (
                        <div key={i} className="card animate-pulse">
                            <div className="h-[160px] bg-gray-200 rounded-t-xl" />
                            <div className="p-5 space-y-2">
                                <div className="h-4 bg-gray-200 rounded w-3/4" />
                                <div className="h-3 bg-gray-100 rounded w-1/2" />
                                <div className="h-10 bg-gray-200 rounded mt-4" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="py-10 px-10">
            <div className="mb-8 flex flex-col items-center">
                <h2 className="text-4xl font-bold">Printing Services</h2>
                <div className="divider mt-2 h-[4px] rounded-full w-32 bg-blue-500 my-4" />
                <p className="max-w-[50%] text-center text-[#64748b] text-[0.875rem] mt-1">
                    Choose from our range of premium printing services. All prices are wholesale B2B rates.
                </p>
            </div>

            {products.length === 0 ? (
                <p className="text-center text-slate-400 py-10">No services available at the moment.</p>
            ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-6">
                    {products.map((product) => (
                        <div key={product.id} className="card cursor-pointer">
                            <div className="h-[160px] relative overflow-hidden">
                                {product.image_url ? (
                                    <Image src={product.image_url} alt={product.name} fill className="object-cover" />
                                ) : (
                                    <div className="w-full h-full bg-gradient-to-br from-[#f1f5f9] to-[#e2e8f0] flex items-center justify-center text-[3.5rem]">📄</div>
                                )}
                                <span className="absolute top-2.5 left-2.5 bg-gradient-to-r from-[var(--gradient-start)] to-[var(--gradient-mid)] text-white rounded-[50px] px-2.5 py-[3px] text-[0.6rem] font-bold tracking-[0.06em]">
                                    B2B
                                </span>
                            </div>

                            <div className="p-5">
                                <h3 className="font-bold text-base mb-1.5">{product.name}</h3>
                                {product.description && (
                                    <p className="text-xs text-slate-500 mb-3 line-clamp-2">{product.description}</p>
                                )}
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <div className="text-[0.65rem] text-[#94a3b8] font-semibold tracking-[0.08em] uppercase">Production Days</div>
                                        <div className="font-bold text-[#0f172a] text-[0.9rem]">{product.production_days} day{product.production_days !== 1 ? "s" : ""}</div>
                                    </div>
                                </div>

                                <Link
                                    href={`/services/${product.id}`}
                                    className="btn-primary w-full text-center block p-2.5"
                                >
                                    View &amp; Order
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
