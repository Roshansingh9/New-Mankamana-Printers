"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { notify } from "@/utils/notifications";
import Navbar from "./Navbar";
import Footer from "./Footer";
import QueryProvider from "@/components/providers/QueryProvider";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, isInitialized, logout } = useAuthStore();
    const router = useRouter();

    useEffect(() => {
        if (isInitialized && !isAuthenticated) {
            notify.lock();
            router.replace("/login");
        }
    }, [isAuthenticated, isInitialized, router]);

    // Intercept any 403 "deactivated" response globally — auto-logout and redirect
    useEffect(() => {
        const original = window.fetch;
        window.fetch = async (...args) => {
            const res = await original(...args);
            if (res.status === 403 && isAuthenticated) {
                const clone = res.clone();
                clone.json().then((data) => {
                    if (typeof data?.message === "string" && data.message.toLowerCase().includes("deactivated")) {
                        notify.error("Your account has been deactivated. Please contact the printer.");
                        logout().then(() => router.replace("/login"));
                    }
                }).catch(() => {});
            }
            return res;
        };
        return () => { window.fetch = original; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAuthenticated]);

    if (!isInitialized || !isAuthenticated) return null;

    const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "9779806955313";

    return (
        <div className="min-h-screen bg-[#f8fafc] flex flex-col">
            <Navbar />
            <main className="flex-1">
                <QueryProvider>{children}</QueryProvider>
            </main>
            <Footer />
            {/* Floating WhatsApp button */}
            <a
                href={`https://wa.me/${whatsappNumber}?text=Hello%2C%20I%20have%20a%20query%20about%20your%20printing%20services.`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Chat on WhatsApp"
                className="fixed bottom-6 right-6 z-50 flex items-center justify-center w-14 h-14 rounded-full shadow-lg bg-[#25D366] hover:bg-[#1ebe57] transition-colors"
            >
                <svg viewBox="0 0 32 32" className="w-7 h-7 fill-white" xmlns="http://www.w3.org/2000/svg">
                    <path d="M16 2C8.28 2 2 8.28 2 16c0 2.49.66 4.83 1.82 6.86L2 30l7.37-1.78A13.93 13.93 0 0016 30c7.72 0 14-6.28 14-14S23.72 2 16 2zm0 25.5a11.44 11.44 0 01-5.85-1.6l-.42-.25-4.37 1.06 1.1-4.26-.28-.44A11.5 11.5 0 1116 27.5zm6.3-8.6c-.35-.17-2.06-1.02-2.38-1.13-.32-.12-.55-.17-.78.17-.23.35-.9 1.13-1.1 1.37-.2.23-.4.26-.75.09-.35-.17-1.48-.55-2.82-1.74-1.04-.93-1.74-2.08-1.95-2.43-.2-.35-.02-.54.15-.71.16-.16.35-.4.52-.6.17-.2.23-.35.35-.58.12-.23.06-.43-.03-.6-.09-.17-.78-1.88-1.07-2.58-.28-.68-.57-.59-.78-.6h-.67c-.23 0-.6.09-.92.43-.32.35-1.2 1.17-1.2 2.85 0 1.68 1.23 3.3 1.4 3.53.17.23 2.42 3.7 5.87 5.19.82.35 1.46.56 1.96.72.82.26 1.57.22 2.16.13.66-.1 2.06-.84 2.35-1.66.29-.82.29-1.52.2-1.66-.08-.14-.32-.23-.67-.4z" />
                </svg>
            </a>
        </div>
    );
}
