"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";
import { BsInstagram } from "react-icons/bs";
import { FaFacebookF } from "react-icons/fa";
import { IoLogoTiktok } from "react-icons/io5";

const socialLinks = [
    {
        label: "Facebook",
        href: "https://facebook.com",
        colorClass: "text-[#1877f3] hover:bg-[#1877f3] hover:text-white",
        icon: <FaFacebookF />
    },
    {
        label: "Instagram",
        href: "https://instagram.com",
        colorClass: "text-pink-500 hover:bg-pink-500 hover:text-white",
        icon: <BsInstagram />
    },
    {
        label: "TikTok",
        href: "https://tiktok.com",
        colorClass: "text-black hover:bg-black hover:text-white",
        icon: <IoLogoTiktok />
    },
]

const usefulLinks = [
    { label: "Our Services", href: "/services" },
    { label: "Contact Us", href: "/contact" },
    { label: "Terms & Conditions", href: "/terms" },
];


const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8005/api/v1";

export default function Footer() {
    const [email, setEmail] = useState("");
    const [totalVisits, setTotalVisits] = useState<number | null>(null);

    useEffect(() => {
        fetch(`${API_BASE}/analytics/total-visits`)
            .then((r) => r.json())
            .then((d) => { if (d.success) setTotalVisits(d.data.total); })
            .catch(() => {});
    }, []);

    return (
        <footer className="footer">
            <div className="max-w-[1200px] mx-auto pt-14 px-6 pb-8 grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-10">
                {/* Brand */}
                <div>
                    <div className="flex items-center gap-2.5 mb-4">
                        <Image src={'/main-logo.png'} alt="this is logo" width={52} height={52} />
                        <div>
                            <div className="text-white text-[0.9rem] font-extrabold tracking-[0.05em]">NEW MANKAMANA</div>
                            <div className="text-[color:var(--text-muted)] text-[0.6rem] tracking-[0.15em] uppercase">Printers</div>
                        </div>
                    </div>
                    <p className="text-[0.8rem] leading-[1.7] text-[color:var(--text-muted)] max-w-[200px]">
                        Providing premium quality printing services across Nepal since 1995. Your trusted partner for corporate branding and wholesale print solutions.
                    </p>
                </div>

                {/* Useful Links */}
                <div>
                    <p className="footer-heading">Useful Links</p>
                    {usefulLinks.map((item, idx) => (
                        <Link key={idx} href={item.href} className="footer-link">› {item.label}</Link>
                    ))}
                </div>

                {/* Location */}
                <div>
                    <p className="footer-heading">Our Location</p>
                    <div className="flex flex-col gap-3">
                        <div className="flex gap-2.5 items-start">
                            <span className="text-[color:var(--primary)] mt-[0.1rem]">📍</span>
                            <span className="text-[0.8rem] leading-[1.6]">Head Office<br />Butwal-6, Traffic Chowk, (Jagriti Path)</span>
                        </div>
                        <div className="flex gap-2.5 items-start">
                            <span className="text-[color:var(--primary)] mt-[0.1rem]">📞</span>
                            <div className="flex flex-col gap-1">
                                <span className="text-[0.8rem]">
                                    <span className="font-semibold">+977 9804458995</span> <span className="text-slate-400">(Office)</span>
                                </span>
                                <span className="text-[0.8rem]">
                                    <span className="font-semibold">+977 9847526152</span> <span className="text-slate-400">(Sagar Kapoor)</span>
                                </span>
                                <span className="text-[0.8rem]">
                                    <span className="font-semibold">+977 9806955313</span> <span className="text-slate-400">(Sagar Kapoor)</span>
                                </span>
                            </div>
                        </div>
                        <div className="flex gap-2.5 items-center">
                            <span className="text-[color:var(--primary)]">✉️</span>
                            <span className="text-[0.8rem]">nmpress2082@gmail.com</span>
                        </div>
                    </div>
                </div>

                {/* Social Media */}
                <div>
                    <p className="footer-heading">Connect With Us</p>
                    <p className="text-[0.8rem] text-[color:var(--text-muted)] mb-4 leading-[1.6]">
                        Follow us for updates, tips, and offers.
                    </p>
                    {/*
                      Define dummy data for social media links and map over it
                    */}
                    <div className="flex gap-3 mt-1">
                        {socialLinks.map((link) => (
                            <a
                                key={link.label}
                                href={link.href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`w-[38px] h-[38px] rounded-full border border-[#334155] flex items-center justify-center text-[1.1rem] bg-white/5 transition-colors ${link.colorClass}`}
                                aria-label={link.label}
                            >
                                {link.icon}
                            </a>
                        ))}
                    </div>
                </div>
            </div>

            <div className="border-t border-[#1e293b] py-5 px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-center">
                <p className="text-[0.75rem] text-[#475569]">
                    © 2024 New Mankamana Printers. All rights reserved.
                </p>
                {totalVisits !== null && (
                    <p className="text-[0.72rem] text-[#334155] flex items-center gap-1.5">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        {totalVisits.toLocaleString()} total site visits
                    </p>
                )}
            </div>
        </footer>
    );
}
