"use client";

import { useState, useEffect } from "react";
import { useAuthStore, getAuthHeaders } from "@/store/authStore";
import { notify } from "@/utils/notifications";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8005/api/v1";

interface ProfileData {
    id: string;
    client_code?: string;
    phone_number: string;
    business_name: string;
    owner_name: string;
    email: string;
    address?: string;
    status: string;
}

export default function ProfilePage() {
    const { user } = useAuthStore();
    const [profile, setProfile] = useState<ProfileData | null>(null);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        business_name: "",
        owner_name: "",
        email: "",
        address: "",
    });

    useEffect(() => {
        fetch(`${API_BASE}/user/profile`, { headers: getAuthHeaders() })
            .then((r) => r.json())
            .then((data) => {
                if (data.data) {
                    const p: ProfileData = data.data;
                    setProfile(p);
                    setForm({
                        business_name: p.business_name || "",
                        owner_name: p.owner_name || "",
                        email: p.email || "",
                        address: p.address || "",
                    });
                }
            })
            .finally(() => setLoading(false));
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch(`${API_BASE}/user/profile`, {
                method: "PATCH",
                headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });
            const data = await res.json();
            if (!res.ok) { notify.error(data.error?.message || data.message || "Failed to update profile"); return; }
            setProfile(data.data);
            setEditing(false);
            notify.success("Profile updated successfully!");
        } catch {
            notify.error("Network error. Please try again.");
        } finally {
            setSaving(false);
        }
    };

    const displayName = profile?.owner_name || user?.ownerName || "C";
    const initials = displayName[0]?.toUpperCase() ?? "C";
    const clientCode = profile?.client_code || user?.clientId;

    const inputCls = (editable: boolean) =>
        `w-full px-3.5 py-2.5 rounded-lg border text-sm outline-none transition-all ${
            editable
                ? "border-slate-200 bg-white focus:border-[#0f172a] focus:ring-2 focus:ring-[#0f172a]/10"
                : "border-slate-100 bg-slate-50 text-slate-500 cursor-not-allowed"
        }`;

    return (
        <div className="min-h-[calc(100vh-68px)] bg-[#f8f7f4]">
            {/* Hero header */}
            <div className="relative overflow-hidden bg-[#0f172a] px-6 py-10 sm:py-12">
                <div className="hero-grid-overlay pointer-events-none absolute inset-0" />
                <div className="relative max-w-5xl mx-auto flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-amber-400 flex items-center justify-center text-[#0f172a] text-2xl font-black shrink-0 ring-4 ring-amber-400/20">
                        {initials}
                    </div>
                    <div>
                        <p className="text-[0.68rem] font-bold uppercase tracking-[0.1em] text-slate-400 mb-0.5">B2B Account</p>
                        <h1 className="font-serif text-2xl sm:text-3xl font-black text-white leading-tight">
                            {profile?.business_name || user?.businessName || "My Profile"}
                        </h1>
                        {clientCode && (
                            <p className="text-slate-400 text-xs mt-0.5 font-mono">{clientCode}</p>
                        )}
                    </div>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
                {loading ? (
                    <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center animate-pulse">
                        <div className="h-4 w-32 bg-slate-100 rounded mx-auto mb-3" />
                        <div className="h-3 w-48 bg-slate-100 rounded mx-auto" />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-6 items-start">
                        {/* Left sidebar card */}
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                            {/* Color band */}
                            <div className="h-2 bg-gradient-to-r from-[#0f172a] to-slate-700" />
                            <div className="p-6">
                                <div className="flex flex-col items-center text-center mb-5">
                                    <div className="w-16 h-16 rounded-full bg-[#0f172a] flex items-center justify-center text-white text-2xl font-black mb-3">
                                        {initials}
                                    </div>
                                    <h2 className="font-bold text-slate-900 text-base leading-tight">
                                        {profile?.business_name || user?.businessName}
                                    </h2>
                                    <p className="text-slate-400 text-xs mt-0.5">{profile?.email || user?.email}</p>
                                </div>

                                <div className="space-y-2.5">
                                    <div className="rounded-lg bg-[#0f172a]/5 border border-[#0f172a]/10 px-3.5 py-3">
                                        <p className="text-[0.62rem] font-bold uppercase tracking-[0.1em] text-slate-400 mb-0.5">Client ID</p>
                                        <p className="font-mono font-extrabold text-[#0f172a] text-base tracking-wide">
                                            {clientCode || "—"}
                                        </p>
                                    </div>

                                    <div className="rounded-lg bg-slate-50 border border-slate-100 px-3.5 py-3">
                                        <p className="text-[0.62rem] font-bold uppercase tracking-[0.1em] text-slate-400 mb-0.5">Phone</p>
                                        <p className="font-semibold text-slate-800 text-sm">{profile?.phone_number || user?.phoneNumber || "—"}</p>
                                    </div>

                                    <div className="rounded-lg bg-slate-50 border border-slate-100 px-3.5 py-3">
                                        <p className="text-[0.62rem] font-bold uppercase tracking-[0.1em] text-slate-400 mb-1">Status</p>
                                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                            {profile?.status === "active" ? "Active" : profile?.status || "Active"}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right: Details form */}
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-50">
                                <div>
                                    <h2 className="font-bold text-[#0f172a] text-base">Company Details</h2>
                                    <p className="text-slate-400 text-xs mt-0.5">Update your business information</p>
                                </div>
                                {editing ? (
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setEditing(false)}
                                            className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleSave}
                                            disabled={saving}
                                            className="px-5 py-2 rounded-lg bg-[#0f172a] text-white text-sm font-bold hover:bg-slate-800 disabled:opacity-60 transition-colors"
                                        >
                                            {saving ? "Saving…" : "Save Changes"}
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => setEditing(true)}
                                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors"
                                    >
                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                        Edit
                                    </button>
                                )}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {([
                                    { label: "Business Name", name: "business_name" as const, placeholder: "e.g. ABC Enterprises" },
                                    { label: "Owner Name", name: "owner_name" as const, placeholder: "e.g. Ram Sharma" },
                                    { label: "Email Address", name: "email" as const, placeholder: "e.g. contact@business.com" },
                                ] as const).map(({ label, name, placeholder }) => (
                                    <div key={name}>
                                        <label htmlFor={`field-${name}`} className="block text-[0.7rem] font-bold uppercase tracking-[0.08em] text-slate-400 mb-1.5">{label}</label>
                                        <input
                                            id={`field-${name}`}
                                            className={inputCls(editing)}
                                            value={form[name]}
                                            onChange={(e) => setForm((p) => ({ ...p, [name]: e.target.value }))}
                                            disabled={!editing}
                                            placeholder={placeholder}
                                        />
                                    </div>
                                ))}
                                <div>
                                    <label htmlFor="field-phone" className="block text-[0.7rem] font-bold uppercase tracking-[0.08em] text-slate-400 mb-1.5">Phone Number</label>
                                    <input
                                        id="field-phone"
                                        className={inputCls(false)}
                                        value={profile?.phone_number || user?.phoneNumber || ""}
                                        disabled
                                        placeholder="—"
                                    />
                                </div>
                                <div className="sm:col-span-2">
                                    <label htmlFor="field-address" className="block text-[0.7rem] font-bold uppercase tracking-[0.08em] text-slate-400 mb-1.5">Business Address</label>
                                    <input
                                        id="field-address"
                                        className={inputCls(editing)}
                                        value={form.address}
                                        onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
                                        disabled={!editing}
                                        placeholder="e.g. Kathmandu, Nepal"
                                    />
                                </div>
                            </div>

                            {/* Password reset info */}
                            <div className="mt-6 p-4 bg-slate-50 rounded-xl border border-slate-100">
                                <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-[#0f172a]/10 flex items-center justify-center shrink-0 mt-0.5">
                                        <svg className="w-4 h-4 text-[#0f172a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-sm text-[#0f172a] mb-1">Need to change your password?</h3>
                                        <p className="text-slate-500 text-xs leading-relaxed">
                                            Passwords are managed by admin. Contact us to reset your credentials.
                                        </p>
                                        <a
                                            href={`mailto:roshan.kr.singh9857@gmail.com?subject=Password Reset Request&body=Hello Admin, I need help with my account (Client ID: ${clientCode})`}
                                            className="inline-flex items-center gap-1.5 mt-3 px-3.5 py-2 bg-[#0f172a] text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition-colors"
                                        >
                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                            Contact Admin
                                        </a>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
