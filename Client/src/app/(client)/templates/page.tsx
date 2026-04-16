"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TEMPLATES, TEMPLATE_CATEGORIES } from "@/constants";
import { useAuthStore, getAuthHeaders } from "@/store/authStore";
import { notify } from "@/utils/notifications";
import { fetchJsonCached } from "@/utils/requestCache";
import { FiUploadCloud, FiGrid, FiEdit3, FiChevronRight, FiAward, FiDownload } from "react-icons/fi";
import Image from "next/image";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8005/api/v1";

interface MyDesignSubmission {
    submissionId: string;
    title: string | null;
    status: "PENDING_REVIEW" | "APPROVED" | "REJECTED";
    submittedAt: string;
    feedbackMessage: string | null;
    designCode: string | null;
    approvedFileUrl: string | null;
    approvedAt: string | null;
}

const categoryInitials: Record<string, string> = {
    "Visiting Cards": "VC",
    "Letterheads": "LH",
    "Envelopes": "EN",
    "ID Cards": "ID",
    "Garment Tags": "GT",
};

const getCategoryTheme = (category: string) => {
    switch (category) {
        case "Visiting Cards": return "bg-[#fde8e8]";
        case "Letterheads": return "bg-[#e8f0fe]";
        case "Envelopes": return "bg-[#fef3e8]";
        case "ID Cards": return "bg-[#e8fdf0]";
        case "Garment Tags": return "bg-[#fde8ff]";
        default: return "bg-[#f1f5f9]";
    }
};

type Tab = "free" | "custom" | "mydesigns";

function TemplatesContent() {
    const { user } = useAuthStore();
    const router = useRouter();
    const searchParams = useSearchParams();
    const tabParam = (searchParams.get("tab") as Tab) ?? "free";
    const [activeTab, setActiveTab] = useState<Tab>(tabParam);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setActiveTab(tabParam);
    }, [tabParam]);

    const [activeCategory, setActiveCategory] = useState("All");
    const [customDesignType, setCustomDesignType] = useState("");
    const [customDesignProductId, setCustomDesignProductId] = useState("");
    const [products, setProducts] = useState<{ id: string; name: string }[]>([]);
    const [customDesignFile, setCustomDesignFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isSending, setIsSending] = useState(false);
    const [myDesigns, setMyDesigns] = useState<MyDesignSubmission[]>([]);
    const [myDesignsLoading, setMyDesignsLoading] = useState(false);
    const [myDesignsError, setMyDesignsError] = useState<string | null>(null);

    // Fetch product list for the custom design product selector
    useEffect(() => {
        fetchJsonCached<any>(
            "products-list",
            `${API_BASE}/products`,
            { headers: getAuthHeaders() },
            300_000 // 5 min — product list rarely changes
        )
            .then((d) => { if (d.success) setProducts(d.data || []); })
            .catch(() => {});
    }, []);

    useEffect(() => {
        if (activeTab !== "mydesigns") return;
        const fetchMyDesigns = async (showLoader = false) => {
            if (showLoader) setMyDesignsLoading(true);
            setMyDesignsError(null);
            try {
                const res = await fetch(`${API_BASE}/design-submissions/my`, {
                    headers: getAuthHeaders(),
                });
                const json = await res.json();
                if (!res.ok) throw new Error(json.error?.message || json.message || "Failed to load designs");
                setMyDesigns(json.data?.items || []);
            } catch (err: any) {
                setMyDesignsError(err.message || "Failed to load designs");
            } finally {
                setMyDesignsLoading(false);
            }
        };
        void fetchMyDesigns(true);
        const id = setInterval(() => void fetchMyDesigns(false), 30_000);
        return () => clearInterval(id);
    }, [activeTab]);

    const categories = ["All", ...TEMPLATE_CATEGORIES];
    const filtered = activeCategory === "All" ? TEMPLATES : TEMPLATES.filter((t) => t.category === activeCategory);

    const handleDownload = (imageSrc: string, name: string) => {
        const link = document.createElement("a");
        link.href = imageSrc;
        link.download = name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        notify.success(`"${name}" download started!`);
    };

    const handleViewDesignFile = async (submissionId: string, title: string | null) => {
        try {
            const res = await fetch(`${API_BASE}/design-submissions/my/${submissionId}/file`, {
                headers: getAuthHeaders(),
            });
            if (!res.ok) { notify.error("Could not load design file."); return; }
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            window.open(url, "_blank");
            // Revoke after a short delay to allow the new tab to load
            setTimeout(() => URL.revokeObjectURL(url), 60_000);
        } catch {
            notify.error("Failed to open design file.");
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] || null;
        setCustomDesignFile(file);
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        if (file) {
            setPreviewUrl(URL.createObjectURL(file));
        } else {
            setPreviewUrl(null);
        }
    };

    const handleRemoveFile = () => {
        setCustomDesignFile(null);
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleCustomDesign = async () => {
        if (!customDesignProductId) { notify.error("Please select which product this design is for."); return; }
        if (!customDesignType.trim()) { notify.error("Please enter a title for your design."); return; }
        if (!customDesignFile) { notify.error("Please attach your design image file."); return; }

        setIsSending(true);
        try {
            const formData = new FormData();
            formData.append("file", customDesignFile);
            formData.append("title", customDesignType.trim());
            formData.append("productId", customDesignProductId);

            const res = await fetch(`${API_BASE}/design-submissions`, {
                method: "POST",
                headers: getAuthHeaders(),
                body: formData,
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error?.message || json.message || "Submission failed");

            notify.success("Design submitted! You'll receive a design code via email once approved.");
            setCustomDesignFile(null);
            setCustomDesignType("");
            setCustomDesignProductId("");
            if (previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }
            if (fileInputRef.current) fileInputRef.current.value = "";
            router.push("/templates?tab=mydesigns");
        } catch (err: any) {
            notify.error(err.message || "Failed to submit design. Please try again.");
        } finally {
            setIsSending(false);
        }
    };

    const sidebarItems: { id: Tab; label: string; icon: React.ReactNode; description: string }[] = [
        { id: "free", label: "Free Templates", icon: <FiGrid className="w-5 h-5" />, description: "Browse & download ready-made templates" },
        { id: "custom", label: "Submit Custom Design", icon: <FiEdit3 className="w-5 h-5" />, description: "Upload your own design for review" },
        { id: "mydesigns", label: "My Designs", icon: <FiAward className="w-5 h-5" />, description: "View your submitted & approved designs" },
    ];

    return (
        <div className="min-h-[calc(100vh-68px)] bg-[#f8f7f4]">
            {/* Dark hero header */}
            <div className="relative overflow-hidden bg-[#0f172a] px-6 py-10 sm:py-12">
                <div className="hero-grid-overlay pointer-events-none absolute inset-0" />
                <div className="relative max-w-5xl mx-auto">
                    <span className="inline-block mb-2 px-2.5 py-0.5 rounded-full bg-amber-400/10 border border-amber-400/20 text-amber-400 text-[0.68rem] font-bold tracking-[0.12em] uppercase">
                        Design Centre
                    </span>
                    <h1 className="font-serif text-3xl sm:text-4xl font-black text-white leading-tight">
                        Templates &amp; Designs
                    </h1>
                    <p className="mt-1.5 text-slate-400 text-sm max-w-xl">
                        Browse free professional templates, submit your custom designs, and track your design approvals.
                    </p>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
                <div className="flex flex-col lg:flex-row gap-6">

                    {/* ── Sidebar ── */}
                    <aside className="lg:w-60 xl:w-64 shrink-0">
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                            <div className="px-4 py-3 bg-[#0f172a]">
                                <p className="text-slate-400 font-bold text-[0.72rem] uppercase tracking-widest">Options</p>
                            </div>
                            <nav className="p-2 flex flex-row lg:flex-col gap-1.5">
                                {sidebarItems.map((item) => {
                                    const isActive = activeTab === item.id;
                                    return (
                                        <button
                                            key={item.id}
                                            type="button"
                                            onClick={() => setActiveTab(item.id)}
                                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all duration-200 group ${
                                                isActive
                                                    ? "bg-[#0f172a] text-white shadow-sm"
                                                    : "hover:bg-slate-50 text-slate-600"
                                            }`}
                                        >
                                            <span className={`shrink-0 ${isActive ? "text-amber-400" : "text-slate-400"}`}>
                                                {item.icon}
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                <p className={`font-bold text-[0.8rem] leading-tight ${isActive ? "text-white" : "text-[#0f172a]"}`}>
                                                    {item.label}
                                                </p>
                                                <p className={`text-[0.68rem] mt-0.5 hidden sm:block ${isActive ? "text-slate-400" : "text-slate-400"}`}>
                                                    {item.description}
                                                </p>
                                            </div>
                                            <FiChevronRight className={`w-4 h-4 shrink-0 transition-transform ${isActive ? "text-slate-400 translate-x-0.5" : "text-slate-200 group-hover:text-slate-400"}`} />
                                        </button>
                                    );
                                })}
                            </nav>

                            <div className="mx-3 mb-3 p-3 bg-amber-50 rounded-xl border border-amber-100">
                                <p className="text-[0.72rem] font-semibold text-amber-700 mb-1">Tip</p>
                                <p className="text-[0.7rem] text-slate-600 leading-relaxed">
                                    Download a free template, customize it, then submit it as a Custom Design!
                                </p>
                            </div>
                        </div>
                    </aside>

                    {/* ── Main Content ── */}
                    <div className="flex-1 min-w-0">

                        {/* ══ FREE TEMPLATES TAB ══ */}
                        {activeTab === "free" && (
                            <div>
                                <div className="flex items-center gap-3 mb-5">
                                    <div className="w-9 h-9 rounded-xl bg-[#0f172a] flex items-center justify-center">
                                        <FiGrid className="w-4 h-4 text-amber-400" />
                                    </div>
                                    <div>
                                        <h3 className="font-extrabold text-[1.05rem] text-[#0f172a]">Free Design Templates</h3>
                                        <p className="text-[0.75rem] text-slate-500">Download and customize for your brand</p>
                                    </div>
                                </div>

                                {/* Category Filter */}
                                <div className="flex gap-2 flex-wrap mb-6">
                                    {categories.map((cat) => {
                                        const isActive = activeCategory === cat;
                                        return (
                                            <button
                                                key={cat}
                                                type="button"
                                                onClick={() => setActiveCategory(cat)}
                                                className={`px-3.5 py-1.5 rounded-full font-semibold text-[0.78rem] transition-all border ${
                                                    isActive
                                                        ? "bg-[#0f172a] text-white border-transparent"
                                                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                                                }`}
                                            >
                                                {cat}
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Template Grid */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                                    {filtered.map((template) => (
                                        <div key={template.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                                            <div className={`h-[110px] sm:h-[130px] ${getCategoryTheme(template.category)} flex flex-col items-center justify-center gap-2 relative overflow-hidden`}>
                                                {template.image ? (
                                                    <Image src={template.image} alt={template.name} fill className="object-cover" />
                                                ) : (
                                                    <>
                                                        <span className="text-[1.1rem] font-black text-slate-500 tracking-widest">{categoryInitials[template.category] || "TP"}</span>
                                                        <span className="text-[0.6rem] bg-black/[0.06] px-2 py-0.5 rounded font-semibold text-slate-500">TEMPLATE</span>
                                                    </>
                                                )}
                                            </div>
                                            <div className="p-3.5">
                                                <h3 className="font-bold text-[0.83rem] text-[#0f172a] mb-0.5">{template.name}</h3>
                                                <p className="text-[0.68rem] text-amber-600 font-semibold mb-3">Free Design Available</p>
                                                <button
                                                    type="button"
                                                    onClick={() => template.image
                                                        ? handleDownload(template.image, template.name)
                                                        : notify.error("No image available to download.")
                                                    }
                                                    className="w-full py-2 px-3 bg-[#0f172a] text-white text-[0.72rem] font-bold rounded-lg hover:bg-slate-800 transition-colors"
                                                >
                                                    Download
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* CTA to custom tab */}
                                <div className="mt-8 p-5 bg-[#0f172a] rounded-2xl flex flex-col sm:flex-row items-center gap-4">
                                    <div className="flex-1">
                                        <p className="font-bold text-[0.9rem] text-white">Have your own design ready?</p>
                                        <p className="text-[0.78rem] text-slate-400 mt-0.5">Upload it and submit directly to our admin for review.</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab("custom")}
                                        className="py-2.5 px-5 rounded-xl bg-amber-400 text-[#0f172a] text-[0.82rem] font-bold hover:bg-amber-300 transition-colors whitespace-nowrap shrink-0"
                                    >
                                        Submit Custom Design
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* ══ MY DESIGNS TAB ══ */}
                        {activeTab === "mydesigns" && (
                            <div>
                                <div className="flex items-center gap-3 mb-5">
                                    <div className="w-9 h-9 rounded-xl bg-[#0f172a] flex items-center justify-center">
                                        <FiAward className="w-4 h-4 text-amber-400" />
                                    </div>
                                    <div>
                                        <h3 className="font-extrabold text-[1.05rem] text-[#0f172a]">My Designs</h3>
                                        <p className="text-[0.75rem] text-slate-500">Track your submitted and approved designs</p>
                                    </div>
                                </div>

                                {myDesignsLoading && (
                                    <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center animate-pulse">
                                        <div className="h-4 w-40 bg-slate-100 rounded mx-auto mb-3" />
                                        <div className="h-3 w-56 bg-slate-100 rounded mx-auto" />
                                    </div>
                                )}
                                {myDesignsError && (
                                    <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center text-red-600 text-sm">
                                        {myDesignsError}
                                    </div>
                                )}
                                {!myDesignsLoading && !myDesignsError && myDesigns.length === 0 && (
                                    <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center">
                                        <FiAward className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                                        <p className="font-semibold text-slate-600">No designs submitted yet</p>
                                        <p className="text-[0.78rem] text-slate-400 mt-1">Submit a custom design to get started.</p>
                                        <button type="button" onClick={() => setActiveTab("custom")} className="mt-4 py-2 px-5 bg-[#0f172a] text-white text-[0.82rem] font-bold rounded-xl hover:bg-slate-800 transition-colors">
                                            Submit a Design
                                        </button>
                                    </div>
                                )}
                                {!myDesignsLoading && !myDesignsError && myDesigns.length > 0 && (
                                    <div className="flex flex-col gap-3">
                                        {myDesigns.map((d) => {
                                            const statusMap = {
                                                PENDING_REVIEW: { label: "Pending Review", cls: "bg-amber-100 text-amber-700 border border-amber-200", dot: "bg-amber-500" },
                                                APPROVED: { label: "Approved", cls: "bg-emerald-100 text-emerald-700 border border-emerald-200", dot: "bg-emerald-500" },
                                                REJECTED: { label: "Rejected", cls: "bg-red-100 text-red-700 border border-red-200", dot: "bg-red-500" },
                                            };
                                            const s = statusMap[d.status] || statusMap.PENDING_REVIEW;
                                            return (
                                                <div key={d.submissionId} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                                                    <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <p className="font-bold text-[0.95rem] text-[#0f172a] truncate">
                                                                    {d.title || "Untitled Design"}
                                                                </p>
                                                                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[0.7rem] font-semibold ${s.cls}`}>
                                                                    <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                                                                    {s.label}
                                                                </span>
                                                            </div>
                                                            <p className="text-[0.75rem] text-slate-400 mt-1">
                                                                Submitted: {new Date(d.submittedAt).toLocaleDateString()}
                                                            </p>
                                                            {d.status === "REJECTED" && d.feedbackMessage && (
                                                                <p className="mt-2 text-[0.75rem] text-red-600 bg-red-50 px-3 py-1.5 rounded-lg border border-red-100">
                                                                    Feedback: {d.feedbackMessage}
                                                                </p>
                                                            )}
                                                        </div>
                                                        {d.status === "APPROVED" && d.designCode && (
                                                            <div className="shrink-0 flex flex-col gap-2">
                                                                <div className="bg-[#0f172a] rounded-xl px-4 py-3 text-center">
                                                                    <p className="text-[0.62rem] font-bold uppercase tracking-[0.1em] text-slate-400 mb-1">Design Code</p>
                                                                    <p className="font-mono font-extrabold text-[1rem] text-amber-400 tracking-widest">{d.designCode}</p>
                                                                    <p className="text-[0.62rem] text-slate-500 mt-0.5">Use this when placing an order</p>
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleViewDesignFile(d.submissionId, d.title)}
                                                                    className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-slate-200 bg-white text-[0.72rem] font-bold text-[#0061FF] hover:bg-slate-50 transition-colors"
                                                                >
                                                                    <FiDownload className="w-3.5 h-3.5" />
                                                                    View / Download
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ══ CUSTOM DESIGN TAB ══ */}
                        {activeTab === "custom" && (
                            <div>
                                <div className="flex items-center gap-3 mb-5">
                                    <div className="w-9 h-9 rounded-xl bg-[#0f172a] flex items-center justify-center">
                                        <FiEdit3 className="w-4 h-4 text-amber-400" />
                                    </div>
                                    <div>
                                        <h3 className="font-extrabold text-[1.05rem] text-[#0f172a]">Submit Custom Design</h3>
                                        <p className="text-[0.75rem] text-slate-500">Upload your finalized design for admin review</p>
                                    </div>
                                </div>

                                {/* Steps */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
                                    {["Download a template", "Edit in design software", "Upload & Send to admin"].map((step, i) => (
                                        <div key={i} className="bg-white rounded-xl p-4 text-center border border-slate-100 shadow-sm">
                                            <div className="w-7 h-7 rounded-full bg-[#0f172a] text-amber-400 text-[0.72rem] font-bold flex items-center justify-center mx-auto mb-2">
                                                {i + 1}
                                            </div>
                                            <div className="text-[0.82rem] font-semibold text-[#0f172a]">{step}</div>
                                        </div>
                                    ))}
                                </div>

                                {/* Form */}
                                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                                    <div className="bg-slate-50 border-b border-slate-100 px-5 py-3">
                                        <h2 className="font-bold text-[#0f172a] text-sm">Design Details</h2>
                                        <p className="text-slate-400 text-xs mt-0.5">All fields are required.</p>
                                    </div>
                                    <div className="p-5 sm:p-6 space-y-5">

                                        {/* Product selector */}
                                        <div>
                                            <label htmlFor="design-product" className="block text-[0.7rem] font-bold uppercase tracking-[0.08em] text-slate-400 mb-1.5">
                                                Product <span className="text-red-400">*</span>
                                            </label>
                                            <select
                                                id="design-product"
                                                title="Select product for this design"
                                                value={customDesignProductId}
                                                onChange={(e) => setCustomDesignProductId(e.target.value)}
                                                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-800 bg-white outline-none focus:border-[#0f172a] focus:ring-2 focus:ring-[#0f172a]/10 transition-all appearance-none"
                                            >
                                                <option value="">Select which product this design is for…</option>
                                                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                                            </select>
                                        </div>

                                        {/* Design Title */}
                                        <div>
                                            <label htmlFor="design-title" className="block text-[0.7rem] font-bold uppercase tracking-[0.08em] text-slate-400 mb-1.5">
                                                Design Title <span className="text-red-400">*</span>
                                            </label>
                                            <input
                                                id="design-title"
                                                type="text"
                                                value={customDesignType}
                                                onChange={(e) => setCustomDesignType(e.target.value)}
                                                placeholder="e.g. Business Card Front Side"
                                                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-800 bg-white outline-none focus:border-[#0f172a] focus:ring-2 focus:ring-[#0f172a]/10 transition-all"
                                            />
                                        </div>

                                        {/* File Upload */}
                                        <div>
                                            <p className="block text-[0.7rem] font-bold uppercase tracking-[0.08em] text-slate-400 mb-1.5">
                                                Design File <span className="text-red-400">*</span>
                                                <span className="ml-1 text-slate-400 font-normal normal-case">(image or PDF)</span>
                                            </p>
                                            <input
                                                ref={fileInputRef}
                                                type="file"
                                                accept="image/*,.pdf"
                                                title="Upload your design file (image or PDF)"
                                                aria-label="Design file upload"
                                                className="hidden"
                                                onChange={handleFileChange}
                                            />

                                            {!customDesignFile ? (
                                                <button
                                                    type="button"
                                                    onClick={() => fileInputRef.current?.click()}
                                                    className="w-full rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 hover:border-[#0f172a]/30 hover:bg-white py-10 px-4 flex flex-col items-center gap-2 transition-all"
                                                >
                                                    <FiUploadCloud className="w-7 h-7 text-slate-400" />
                                                    <span className="text-sm font-semibold text-slate-600">Click to upload your design</span>
                                                    <span className="text-xs text-slate-400">PNG, JPG, PDF · max 10 MB</span>
                                                </button>
                                            ) : (
                                                <div className="rounded-xl border-2 border-emerald-300 bg-emerald-50 p-4 flex gap-4 items-start">
                                                    {previewUrl && (
                                                        <img
                                                            src={previewUrl}
                                                            alt="Design preview"
                                                            className="w-20 h-20 object-cover rounded-lg border border-slate-100 shrink-0"
                                                        />
                                                    )}
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-semibold text-[0.85rem] text-emerald-800 truncate">{customDesignFile.name}</p>
                                                        <p className="text-[0.72rem] text-emerald-600 mt-0.5">
                                                            {(customDesignFile.size / 1024).toFixed(1)} KB &bull; Ready to submit
                                                        </p>
                                                        <span className="inline-flex items-center gap-1 mt-1.5 text-[0.68rem] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200">
                                                            File selected
                                                        </span>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={handleRemoveFile}
                                                        className="shrink-0 text-xs font-semibold text-slate-500 hover:text-red-500 transition-colors"
                                                    >
                                                        Remove
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {/* How it works */}
                                        <div className="flex items-start gap-2.5 bg-[#0f172a]/5 rounded-xl border border-[#0f172a]/10 px-4 py-3">
                                            <svg className="w-4 h-4 text-[#0f172a] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                            <p className="text-xs text-slate-600 leading-relaxed">
                                                Once submitted, admin will review your design. When approved, your <strong>Design Code</strong> will be sent to your registered email.
                                            </p>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex flex-col sm:flex-row gap-3 pt-1">
                                            <button
                                                type="button"
                                                onClick={handleCustomDesign}
                                                disabled={isSending}
                                                className="flex-1 py-3.5 bg-[#0f172a] text-white text-sm font-bold rounded-xl hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                            >
                                                {isSending ? "Submitting…" : "Submit Design for Review"}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setActiveTab("free")}
                                                className="py-3.5 px-5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                                            >
                                                ← Back to Templates
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function TemplatesPage() {
    return (
        <Suspense fallback={
            <div className="min-h-[calc(100vh-68px)] bg-[#f8f7f4]">
                <div className="bg-[#0f172a] px-6 py-10 sm:py-12 animate-pulse">
                    <div className="max-w-5xl mx-auto">
                        <div className="h-5 w-24 bg-slate-800 rounded mb-3" />
                        <div className="h-8 w-64 bg-slate-800 rounded" />
                    </div>
                </div>
            </div>
        }>
            <TemplatesContent />
        </Suspense>
    );
}
