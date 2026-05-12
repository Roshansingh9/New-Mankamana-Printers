"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { useState, useEffect, useRef } from "react";
import { notify } from "@/utils/notifications";
import { AnimatePresence, motion } from 'motion/react';
import Image from "next/image";

export default function Navbar() {
    const { isAuthenticated, logout, user } = useAuthStore();
    const pathname = usePathname();
    const router = useRouter();
    const [menuOpen, setMenuOpen] = useState(false);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const profileRef = useRef<HTMLDivElement>(null);

    // Close mobile menu and profile dropdown on route change — adjust during render
    // to avoid an extra render cycle from setState-in-effect.
    const [prevPathname, setPrevPathname] = useState(pathname);
    if (prevPathname !== pathname) {
        setPrevPathname(pathname);
        setMenuOpen(false);
        setIsProfileOpen(false);
    }

    // Close profile dropdown on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
                setIsProfileOpen(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const handleLogout = () => {
        logout();
        notify.success("Logged out successfully");
        router.push("/");
    };

    const initials = (user?.businessName || user?.ownerName || "U")[0]?.toUpperCase() ?? "U";

    const baseNavLinks = [
        { href: "/", label: "Home" },
        { href: "/services", label: "Services" },
        { href: "/templates", label: "Free Designs" },
        { href: "/contact", label: "Contact" },
    ];
    const authedNavLinks = [
        { href: "/", label: "Home" },
        { href: "/services", label: "Services" },
        { href: "/orders", label: "Orders" },
        { href: "/wallet", label: "Wallet" },
        { href: "/templates", label: "Designs" },
        { href: "/contact", label: "Contact" },
    ];
    const navLinks = isAuthenticated ? authedNavLinks : baseNavLinks;

    const profileMenuItems = [
        { href: "/profile", label: "Profile", icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
        )},
        { href: "/orders", label: "Order History", icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
        )},
        { href: "/wallet", label: "Wallet", icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
        )},
        { href: "/templates?tab=mydesigns", label: "My Designs", icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
        )},
    ];

    return (
        <nav className="bg-white border-b border-slate-100 sticky top-0 z-[100] shadow-sm">
            <div className="w-full mx-auto px-4 sm:px-8 md:px-16 flex items-center justify-between h-[68px]">
                {/* Logo */}
                <Link href="/" className="flex items-center gap-2.5 no-underline shrink-0">
                    <Image src="/main-logo.png" alt="New Mankamana Printers" width={44} height={44} className="object-contain" />
                    <div className="hidden sm:block">
                        <div className="text-[0.82rem] font-extrabold tracking-widest text-[#0f172a] leading-[1.1]">
                            NEW MANKAMANA
                        </div>
                        <div className="text-[0.52rem] font-semibold tracking-[0.18em] uppercase text-slate-400">
                            Printers
                        </div>
                    </div>
                </Link>

                {/* Desktop Nav */}
                <div className="hidden md:flex items-center gap-1">
                    {navLinks.map((link) => {
                        const isActive = pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href));
                        return (
                            <Link
                                key={link.href}
                                href={link.href}
                                className={`relative px-3.5 py-2 text-[0.84rem] font-medium transition-colors ${
                                    isActive
                                        ? "text-[#1a56db] font-semibold"
                                        : "text-slate-600 hover:text-[#0f172a] hover:bg-slate-50 rounded-lg"
                                }`}
                            >
                                {link.label}
                                {isActive && (
                                    <span className="absolute bottom-0 left-3.5 right-3.5 h-0.5 bg-[#2563eb] rounded-full" />
                                )}
                            </Link>
                        );
                    })}
                </div>

                {/* Right Actions */}
                <div className="flex items-center gap-2">
                    {isAuthenticated ? (
                        <div className="relative" ref={profileRef}>
                            <button
                                type="button"
                                onClick={() => setIsProfileOpen((v) => !v)}
                                aria-label="Open profile menu"
                                aria-expanded={isProfileOpen ? "true" : "false"}
                                className={`h-9 w-9 rounded-full flex items-center justify-center text-sm font-black border-2 transition-all ${
                                    isProfileOpen
                                        ? "bg-[#0f172a] text-white border-[#0f172a]"
                                        : "bg-slate-50 text-[#0f172a] border-[#0f172a]/30 hover:border-[#0f172a] hover:bg-[#0f172a] hover:text-white"
                                }`}
                            >
                                {initials}
                            </button>

                            <AnimatePresence>
                                {isProfileOpen && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -6, scale: 0.97 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: -6, scale: 0.97 }}
                                        transition={{ duration: 0.18, ease: "easeOut" }}
                                        className="absolute right-0 top-[calc(100%+8px)] z-[150] w-56 rounded-xl shadow-xl border border-slate-100 bg-white overflow-hidden"
                                    >
                                        {/* User info */}
                                        <div className="px-4 py-3 border-b border-slate-50 bg-slate-50/60">
                                            <p className="text-xs font-bold text-[#0f172a] truncate">
                                                {user?.businessName || user?.ownerName || "Client"}
                                            </p>
                                            <p className="text-[0.7rem] text-slate-400 truncate mt-0.5">
                                                {user?.clientId || ""}
                                            </p>
                                        </div>

                                        <div className="py-1.5">
                                            {profileMenuItems.map((item) => (
                                                <Link
                                                    key={item.href}
                                                    href={item.href}
                                                    onClick={() => setIsProfileOpen(false)}
                                                    className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-[#0f172a] transition-colors"
                                                >
                                                    <span className="text-slate-400">{item.icon}</span>
                                                    {item.label}
                                                </Link>
                                            ))}
                                        </div>

                                        <div className="border-t border-slate-50 py-1.5">
                                            <button
                                                type="button"
                                                onClick={() => { setIsProfileOpen(false); handleLogout(); }}
                                                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors"
                                            >
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                                                Logout
                                            </button>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    ) : (
                        <Link
                            href="/login"
                            className="hidden md:inline-flex px-4 py-2 bg-[#0f172a] text-white text-sm font-semibold rounded-lg hover:bg-slate-800 transition-colors"
                        >
                            Sign In
                        </Link>
                    )}

                    {/* Mobile hamburger */}
                    <button
                        type="button"
                        onClick={() => setMenuOpen((v) => !v)}
                        aria-label={menuOpen ? "Close menu" : "Open menu"}
                        className="md:hidden h-9 w-9 flex items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                        {menuOpen ? (
                            <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                        ) : (
                            <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
                        )}
                    </button>
                </div>
            </div>

            {/* Mobile Menu */}
            <AnimatePresence>
                {menuOpen && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2, ease: "easeInOut" }}
                        className="md:hidden overflow-hidden border-t border-slate-100 bg-white"
                    >
                        <div className="px-4 py-3 flex flex-col gap-0.5">
                            {navLinks.map((link) => {
                                const isActive = pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href));
                                return (
                                    <Link
                                        key={link.href}
                                        href={link.href}
                                        onClick={() => setMenuOpen(false)}
                                        className={`flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                                            isActive
                                                ? "bg-[#0f172a] text-white"
                                                : "text-slate-700 hover:bg-slate-50"
                                        }`}
                                    >
                                        {link.label}
                                    </Link>
                                );
                            })}

                            {!isAuthenticated && (
                                <>
                                    <div className="h-px bg-slate-100 my-1.5" />
                                    <Link
                                        href="/login"
                                        onClick={() => setMenuOpen(false)}
                                        className="flex items-center justify-center px-3 py-2.5 rounded-lg text-sm font-semibold bg-[#0f172a] text-white"
                                    >
                                        Sign In
                                    </Link>
                                    <Link
                                        href="/register"
                                        onClick={() => setMenuOpen(false)}
                                        className="flex items-center justify-center px-3 py-2.5 rounded-lg text-sm font-semibold border border-slate-200 text-slate-700 hover:bg-slate-50"
                                    >
                                        Register
                                    </Link>
                                </>
                            )}

                            {isAuthenticated && (
                                <>
                                    <div className="h-px bg-slate-100 my-1.5" />
                                    <div className="px-3 py-2">
                                        <p className="text-xs font-bold text-slate-900">{user?.businessName || user?.ownerName}</p>
                                        <p className="text-[0.7rem] text-slate-400">{user?.clientId}</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => { setMenuOpen(false); handleLogout(); }}
                                        className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                                        Logout
                                    </button>
                                </>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </nav>
    );
}
