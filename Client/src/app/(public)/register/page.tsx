"use client";

import { useState } from "react";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { notify } from "@/utils/notifications";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8005/api/v1";
import Image from "next/image";

interface FormData {
    companyName: string;
    contactPerson: string;
    phone: string;
    email: string;
    address: string;
    printingNeeds: string;
}

const benefits = [
    { title: "Wholesale Rates", desc: "Exclusive B2B pricing on all printing services." },
    { title: "Free Templates", desc: "Access 200+ free professional design templates." },
    { title: "Reliable Delivery", desc: "On-time delivery across all of Nepal." },
    { title: "Dedicated Support", desc: "Personal account manager for all your needs." },
];

export default function RegisterPage() {
    const [form, setForm] = useState<FormData>({
        companyName: "", contactPerson: "", phone: "",
        email: "", address: "", printingNeeds: "",
    });
    const [errors, setErrors] = useState<Partial<FormData>>({});
    const [submitted, setSubmitted] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const validate = (): boolean => {
        const e: Partial<FormData> = {};
        if (!form.companyName.trim()) e.companyName = "Company name is required";
        if (!form.contactPerson.trim()) e.contactPerson = "Contact person name is required";
        if (!form.phone.trim()) e.phone = "Phone number is required";
        else if (!/^\d{10}$/.test(form.phone)) e.phone = "Phone number must be exactly 10 digits";
        if (!form.email.trim()) e.email = "Email is required";
        else if (!/^[a-zA-Z0-9._%+]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(form.email)) e.email = "Enter a valid email address";
        if (!form.address.trim()) e.address = "Business address is required";
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
        if (errors[name as keyof FormData]) {
            setErrors((prev) => ({ ...prev, [name]: undefined }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) return;

        setSubmitting(true);
        try {
            const res = await fetch(`${API_BASE}/register-request`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    business_name: form.companyName,
                    owner_name: form.contactPerson,
                    phone_number: form.phone,
                    email: form.email,
                    business_address: form.address,
                    notes: form.printingNeeds || undefined,
                }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error?.message || json.message || "Submission failed");
            setSubmitted(true);
        } catch (err: any) {
            notify.error(err.message || "Failed to submit registration. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <>
            <Navbar />
            <div className="bg-[#f0f4ff] min-h-[calc(100vh-64px)] py-10 px-2 sm:px-4">
                <div
                    className={`
                        max-w-[900px] w-full mx-auto bg-white rounded-[20px]
                        shadow-[0_20px_60px_rgba(0,0,0,0.12)] overflow-hidden
                        flex flex-col md:flex-row
                    `}
                >
                    {/* ── Left: Gradient Panel ── */}
                    <div
                        className={`
                            gradient-card
                            p-7 sm:p-10
                            flex flex-col justify-between relative overflow-hidden
                            md:w-1/2 w-full
                            min-h-[340px]
                        `}
                    >
                        <div className="absolute -top-[60px] -right-[60px] w-[160px] sm:w-[200px] h-[160px] sm:h-[200px] rounded-full bg-white/[0.06] pointer-events-none" />

                        <div>
                            <div className="mb-8">
                                <div className="flex items-center gap-2.5 mb-6">
                                <Image src={'/main-logo.png'} alt="this is logo" className="cursor-pointer" width={52} height={52}/>
                                    <div>
                                      <div className="text-white text-[0.9rem] font-extrabold tracking-[0.05em]">NEW MANKAMANA</div>
                                        <div className="text-white/[0.65] text-[0.6rem] tracking-[0.15em]">PRINTERS</div>
                                    </div>
                                </div>
                                <h2 className="text-white text-[1.18rem] sm:text-[1.5rem] font-extrabold mb-2">Join Our B2B Network</h2>
                                <p className="text-white/[0.78] text-[0.8rem] sm:text-[0.82rem] leading-[1.7]">
                                    Register your company and get access to exclusive wholesale printing rates and premium templates.
                                </p>
                            </div>

                            <div className="flex flex-col gap-4.5">
                                {benefits.map((b) => (
                                    <div key={b.title} className="flex gap-3 items-start">
                                        <div className="w-[36px] sm:w-[38px] h-[36px] sm:h-[38px] rounded-lg bg-white/[0.15] flex items-center justify-center shrink-0">
                                            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                            </svg>
                                        </div>
                                        <div>
                                            <h3 className="text-white font-bold text-[0.82rem] sm:text-[0.85rem] mb-0.5">{b.title}</h3>
                                            <p className="text-white/70 text-[0.73rem] sm:text-[0.75rem] leading-[1.5]">{b.desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="mt-8">
                            <p className="text-white/70 text-[0.77rem] sm:text-[0.78rem] mb-2.5">Already have an account?</p>
                            <Link
                                href="/login"
                                className="block border-2 border-white/70 rounded-[50px] p-2.5 text-center text-white font-bold text-[0.81rem] sm:text-[0.82rem] tracking-[0.08em] no-underline hover:bg-white/10 transition-colors"
                            >
                                SIGN IN
                            </Link>
                        </div>
                    </div>

                    {/* ── Right: Form ── */}
                    <div className="p-7 sm:p-10 sm:px-9 w-full md:w-1/2 overflow-y-auto max-h-[750px] custom-scrollbar">
                        {submitted ? (
                            <div className="flex flex-col items-center justify-center min-h-[360px] text-center">
                                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-5">
                                    <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                                <h2 className="font-extrabold text-[1.18rem] sm:text-[1.25rem] mb-3 text-[#0f172a]">Response Submitted!</h2>
                                <p className="text-[#64748b] text-[0.86rem] sm:text-[0.875rem] leading-[1.7] max-w-[300px]">
                                    Your response has been submitted. Once New Mankamana Printers approves your request, your ID and password will be sent to your email.
                                </p>
                                <Link href="/login" className="btn-primary mt-6 text-center">
                                    Go to Login
                                </Link>
                            </div>
                        ) : (
                            <>
                                <div className="mb-7">
                                    <h1 className="text-[1.27rem] sm:text-[1.5rem] font-extrabold text-[#0f172a] mb-1.5">Create Account</h1>
                                    <p className="text-[#64748b] text-[0.8rem] sm:text-[0.82rem]">Fill in your company details to register.</p>
                                </div>

                                <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
                                    {/* Company Name */}
                                    <div className="form-group">
                                        <label className="form-label">Company Name *</label>
                                        <input
                                            name="companyName"
                                            value={form.companyName}
                                            onChange={handleChange}
                                            placeholder="ABC Traders Pvt. Ltd."
                                            className="form-input"
                                            style={{ borderColor: errors.companyName ? "#ef4444" : undefined }}
                                        />
                                        {errors.companyName && <span className="text-[#ef4444] text-[0.72rem] mt-1">{errors.companyName}</span>}
                                    </div>

                                    {/* Contact Person */}
                                    <div className="form-group">
                                        <label className="form-label">Contact Person Name *</label>
                                        <input
                                            name="contactPerson"
                                            value={form.contactPerson}
                                            onChange={handleChange}
                                            placeholder="Ram Sharma"
                                            className="form-input"
                                            style={{ borderColor: errors.contactPerson ? "#ef4444" : undefined }}
                                        />
                                        {errors.contactPerson && <span className="text-[#ef4444] text-[0.72rem] mt-1">{errors.contactPerson}</span>}
                                    </div>

                                    {/* Phone + Email */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                        <div className="form-group">
                                            <label className="form-label">Phone Number *</label>
                                            <input
                                                name="phone"
                                                value={form.phone}
                                                onChange={(e) => {
                                                    const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
                                                    setForm((prev) => ({ ...prev, phone: digits }));
                                                    if (errors.phone) setErrors((prev) => ({ ...prev, phone: undefined }));
                                                }}
                                                placeholder="9800000000"
                                                inputMode="numeric"
                                                maxLength={10}
                                                className="form-input"
                                                style={{ borderColor: errors.phone ? "#ef4444" : undefined }}
                                            />
                                            {errors.phone && <span className="text-[#ef4444] text-[0.72rem] mt-1">{errors.phone}</span>}
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Email Address *</label>
                                            <input
                                                name="email"
                                                type="email"
                                                value={form.email}
                                                onChange={handleChange}
                                                placeholder="abc@gmail.com"
                                                className="form-input"
                                                style={{ borderColor: errors.email ? "#ef4444" : undefined }}
                                            />
                                            {errors.email && <span className="text-[#ef4444] text-[0.72rem] mt-1">{errors.email}</span>}
                                        </div>
                                    </div>

                                    {/* Business Address */}
                                    <div className="form-group">
                                        <label className="form-label">Business Address *</label>
                                        <input
                                            name="address"
                                            value={form.address}
                                            onChange={handleChange}
                                            placeholder="Kathmandu, Nepal"
                                            className="form-input"
                                            style={{ borderColor: errors.address ? "#ef4444" : undefined }}
                                        />
                                        {errors.address && <span className="text-[#ef4444] text-[0.72rem] mt-1">{errors.address}</span>}
                                    </div>

                                    {/* Printing Requirements */}
                                    <div className="form-group">
                                        <label className="form-label">Printing Requirements</label>
                                        <textarea
                                            name="printingNeeds"
                                            value={form.printingNeeds}
                                            onChange={handleChange}
                                            placeholder="Describe your printing needs (e.g. visiting cards, letterheads, pamphlets…)"
                                            className="form-input resize-y"
                                            rows={3}
                                        />
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className="btn-primary p-3.5 text-[0.865rem] sm:text-[0.875rem] font-bold tracking-[0.06em] mt-1 disabled:opacity-60 disabled:cursor-not-allowed"
                                    >
                                        {submitting ? "SUBMITTING..." : "SUBMIT REGISTRATION"}
                                    </button>

                                    <p className="text-center text-[#94a3b8] text-[0.69rem] sm:text-[0.7rem] leading-[1.5] mt-2">
                                        By registering, admin will review your request and send your Client ID and password to your email.
                                    </p>
                                </form>
                            </>
                        )}
                    </div>
                </div>
            </div>
            <Footer />
            {/* Responsive support for card & layout on mobile/tablet */}
            <style jsx global>{`
                .gradient-card {
                    background: linear-gradient(135deg, #2b3a66 65%, #6786df 100%);
                }
                @media (max-width: 900px) {
                    .gradient-card {
                        min-height: unset !important;
                    }
                }
                @media (max-width: 900px) {
                    .gradient-card {
                        border-radius: 20px 20px 0 0 !important;
                    }
                }
                @media (max-width: 767px) {
                    .gradient-card {
                        border-radius: 0 0 16px 16px !important;
                        padding: 1.7rem 1.1rem !important;
                    }
                }
                @media (max-width: 900px) {
                    /* Stack the columns for md breakpoint and below: flex -> flex-col */
                    .max-w-\[900px\] {
                        flex-direction: column !important;
                    }
                }
                @media (max-width: 600px) {
                    .max-w-\[900px\] {
                        border-radius: 0 !important;
                        box-shadow: none !important;
                    }
                }
            `}</style>
        </>
    );
}
