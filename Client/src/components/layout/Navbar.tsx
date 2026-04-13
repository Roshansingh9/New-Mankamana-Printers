"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { useState } from "react";
import { notify } from "@/utils/notifications";
import { AnimatePresence, easeInOut, motion } from 'motion/react'
import Image from "next/image";

export default function Navbar() {
    const { isAuthenticated, logout } = useAuthStore();
    const pathname = usePathname();
    const router = useRouter();
    const [menuOpen, setMenuOpen] = useState(false);
    const [isProfileOpen, setIsProfileOpen] = useState(false)

    const handleLogout = () => {
        logout();
        notify.success("Logged out successfully");
        router.push("/");
    };

    const baseNavLinks = [
        { href: "/", label: "Home" },
        { href: "/services", label: "Our Services" },
        { href: "/templates", label: "Free Designs" },
        { href: "/contact", label: "Contact" },
    ];
    const navLinks = isAuthenticated
        ? [...baseNavLinks.slice(0, 3), { href: "/wallet", label: "Wallet" }, ...baseNavLinks.slice(3)]
        : baseNavLinks;

    return (
        <nav className="bg-white shadow-[0_1px_0_var(--border)] sticky top-0 z-[100]">
            <div className="w-full mx-auto px-4 sm:px-8 md:px-20 flex items-center justify-between h-16">
                {/* Logo */}
                <Link
                    href="/"
                    className="flex items-center gap-2.5 no-underline"
                >
                    <Image src={'/main-logo.png'} alt="this is logo" width={52} height={52}/>
                    <div className="max-sm:hidden">
                        <div className="text-base font-extrabold tracking-wider text-[color:var(--primary)] leading-[1]">
                            NEW MANKAMANA
                        </div>
                        <div className="text-[0.55rem] font-medium tracking-widest uppercase text-[color:var(--text-muted)]">
                            Printers
                        </div>
                    </div>
                </Link>

                {/* Desktop Nav */}
                <div className="hidden md:flex items-center gap-8">
                    {navLinks.map((link) => (
                        <Link
                            key={link.href}
                            href={link.href}
                            className={`
                                font-medium
                                text-[0.875rem]
                                py-1
                                transition-colors
                                duration-200
                                hover:text-[var(--primary)]
                                hover:border-[var(--primary)]
                                ${pathname === link.href ? "text-[var(--primary)] border-b-2 border-[var(--primary)]" : ""}
                                `}

                        >
                            {link.label}
                        </Link>
                    ))}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3">
                    {isAuthenticated ? (
                        <div className="flex gap-2 items-center">

                            <div
                                onClick={() => setIsProfileOpen(!isProfileOpen)}
                                className="border border-blue-500 cursor-pointer h-10 w-10 flex items-center justify-center border-2 rounded-full text-xl font-bold "
                            >
                                P
                            </div>
                        </div>
                    ) : (
                        <Link href="/login" className="btn-primary">
                            Login
                        </Link>
                    )}
                    {/* Mobile menu */}
                    <button
                        type="button"
                        onClick={() => setMenuOpen(!menuOpen)}
                        className="md:hidden bg-transparent border-none cursor-pointer text-xl p-1"
                    >
                        {menuOpen ? (
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                        ) : (
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
                        )}
                    </button>
                </div>
            </div>

            <AnimatePresence>
                {isProfileOpen && (
                    <motion.div
                        initial={{ y: -10, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -10, opacity: 0 }}
                        transition={{ duration: 0.35, ease: "easeInOut" }}
                        className="absolute right-6 top-16 z-[150] mt-2 rounded-xl shadow-xl py-4 px-6 min-w-[200px] flex flex-col gap-3 border border-gray-200 bg-white">
                        <Link
                            href="/profile"
                            className="py-2 px-2 font-semibold text-[color:var(--primary)] rounded hover:bg-[var(--primary-light)] transition-colors cursor-pointer"
                            onClick={() => setIsProfileOpen(false)}
                        >
                            Profile
                        </Link>
                        <Link
                            href="/orders"
                            className="py-2 px-2 font-semibold text-blue-600 rounded hover:bg-blue-50 transition-colors cursor-pointer"
                            onClick={() => setIsProfileOpen(false)}
                        >
                            Order History
                        </Link>
                        <Link
                            href="/wallet"
                            className="py-2 px-2 font-semibold text-blue-600 rounded hover:bg-blue-50 transition-colors cursor-pointer"
                            onClick={() => setIsProfileOpen(false)}
                        >
                            Wallet
                        </Link>
                        <Link
                            href="/templates?tab=mydesigns"
                            className="py-2 px-2 font-semibold text-blue-600 rounded hover:bg-blue-50 transition-colors cursor-pointer"
                            onClick={() => setIsProfileOpen(false)}
                        >
                            My Designs
                        </Link>
                        <button
                            type="button"
                            onClick={() => {
                                setIsProfileOpen(false);
                                handleLogout();
                            }}
                            className="py-2 px-2 bg-red-500 text-white font-semibold rounded hover:bg-red-600 transition-colors cursor-pointer"
                        >
                            Logout
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Mobile Menu */}
            {menuOpen && (
                <div className="bg-white border-t border-gray-200 px-6 py-4 flex flex-col gap-3">
                    {navLinks.map((link) => (
                        <Link
                            key={link.href}
                            href={link.href}
                            onClick={() => setMenuOpen(false)}
                            className={
                                `
                                    font-medium 
                                    text-[0.875rem] 
                                    py-1 
                                    text-[color:var(--text-dark)]
                                    transition-colors
                                    duration-200
                                    no-underline
                                    border-b-2
                                    border-transparent
                                    hover:text-[color:var(--primary)]
                                    hover:border-[color:var(--primary)]
                                    ${pathname === link.href
                                    ? "text-[color:var(--primary)] border-[color:var(--primary)]"
                                    : ""
                                }
                                `
                            }
                        >
                            {link.label}
                        </Link>
                    ))}
                    {!isAuthenticated && (
                        <Link
                            href="/register"
                            className="
                                font-medium 
                                text-[0.875rem] 
                                py-1 
                                text-[color:var(--text-dark)]
                                transition-colors
                                duration-200
                                no-underline
                                border-b-2
                                border-transparent
                                hover:text-[color:var(--primary)]
                                hover:border-[color:var(--primary)]
                            "
                            onClick={() => setMenuOpen(false)}
                        >
                            Join Us
                        </Link>
                    )}
                    {isAuthenticated && (
                        <Link
                            href="/orders"
                            onClick={() => setMenuOpen(false)}
                            className="font-medium text-[0.875rem] py-1 text-[color:var(--text-dark)] transition-colors duration-200 no-underline border-b-2 border-transparent hover:text-[color:var(--primary)] hover:border-[color:var(--primary)]"
                        >
                            Order History
                        </Link>
                    )}
                </div>
            )}
        </nav>
    );
}
