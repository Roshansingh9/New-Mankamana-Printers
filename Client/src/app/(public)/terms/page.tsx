import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

export const metadata: Metadata = {
    title: "Terms & Conditions – New Mankamana Printers",
    description:
        "Read the Terms and Conditions governing use of the New Mankamana Printers B2B printing platform.",
};

const EFFECTIVE_DATE = "1 January 2025";

type Section = {
    id: string;
    title: string;
    important?: boolean;
    body: string;
};

const sections: Section[] = [
    {
        id: "b2b-only",
        title: "1. B2B Platform — Prohibited Content",
        important: true,
        body: `New Mankamana Printers is a B2B company that accepts print orders from registered printing presses and trade partners only. All orders must be for legitimate commercial use.\n\nOrders must not contain duplicate, counterfeit, or prohibited content, or any material reproduced without the permission of the originating organisation or rights holder. Full legal responsibility for the content of each order rests solely with the submitting Printing Press or Channel Partner.\n\nIf any partner — knowingly or unknowingly — submits an order for duplicate, counterfeit, or prohibited content, their membership will be permanently discontinued with no right of reinstatement.`,
    },
    {
        id: "colour-matching",
        title: "2. Colour Matching",
        important: true,
        body: `Exact colour matching between separate print runs is not guaranteed. Colour output varies between jobs due to substrate, ink, environmental conditions, and press settings — regardless of whether the previous print was produced by us or by another printer, and whether it was digital or offset.\n\nIf you require consistent colour reproduction across future print runs, you must request a Job Profile to be saved with us. Job profiling is available at an additional charge. Without a saved job profile, we accept no liability for colour variation between orders.`,
    },
    {
        id: "delivery-liability",
        title: "3. Liability Upon Dispatch",
        important: true,
        body: `New Mankamana Printers' responsibility for goods ceases the moment an order leaves our premises. Once dispatched, risk of loss, damage, or delay transfers entirely to the Client or the nominated delivery agent. We strongly recommend that clients arrange appropriate insurance for high-value orders.`,
    },
    {
        id: "printing-errors",
        title: "4. Printing Mistakes — Shared / Club Print Jobs",
        important: true,
        body: `For products produced as part of a shared or club print run (including but not limited to visiting cards, ATM pouches, letterheads, and envelopes), the following policy applies in the event of a printing error attributable to us:\n\n• If a printing mistake affects between 5% and 50% of the sheets or cards in your order, a proportional discount equivalent to the affected proportion will be applied — no reprint will be issued.\n\n• Only if a printing mistake affects more than 50% of the sheets or cards will the order be reprinted in full.\n\nThis clause applies solely to errors caused by our production process. Errors arising from client-supplied artwork, incorrect file specifications, or approved proofs are not covered.`,
    },
    {
        id: "reprint-transport",
        title: "5. Transportation Charges on Reprints",
        body: `If an order is reprinted due to a printing mistake on our part, the transportation and delivery charges for dispatching the reprinted order shall be borne by the Client. We will cover only the cost of materials and production for the reprint.`,
    },
    {
        id: "max-liability",
        title: "6. Maximum Liability",
        body: `In the event of any dispute, loss, delayed receipt, or other claim relating to an order, the maximum liability of New Mankamana Printers shall not exceed the invoice value of the specific disputed product or order. We accept no liability for indirect losses, including but not limited to loss of business, loss of profits, or consequential damages of any kind.`,
    },
    {
        id: "membership",
        title: "7. Membership & Channel Partner Codes",
        body: `New Mankamana Printers reserves the right, at its sole discretion and without prior notice, to suspend, cancel, or modify any client membership or channel partner code. This includes, but is not limited to, cases of non-compliance with these Terms, inactivity, or conduct that is deemed detrimental to the company or its partners.`,
    },
    {
        id: "payment",
        title: "8. Authorised Payment Accounts",
        body: `New Mankamana Printers accepts responsibility only for payments deposited directly into our officially designated bank account(s). Details of our authorised bank account are provided at checkout and upon request from our office.\n\nWe are not responsible for any payments made to any other account, person, or intermediary. Clients are advised to verify account details directly with our office before making any payment. In case of any discrepancy, please contact us immediately at nmpress2082@gmail.com.`,
    },
    {
        id: "sms-consent",
        title: "9. SMS & Communication Consent",
        body: `By registering on the Platform, you provide your express consent for New Mankamana Printers to send service-related and transactional SMS messages to the mobile number(s) associated with your account. These messages may relate to order status, payment confirmation, design approval, and other matters connected with your use of the Platform.`,
    },
    {
        id: "designs",
        title: "10. Design Submissions & Intellectual Property",
        body: `By submitting a design file through the Platform, you confirm that:\n\n• You own or hold full rights to reproduce all content (images, logos, text, fonts) included in the design.\n• The design does not infringe any third-party intellectual property rights.\n• The design does not contain unlawful, defamatory, obscene, or prohibited content.\n\nYou accept sole legal responsibility for any third-party IP claim arising from content you submit. New Mankamana Printers reserves the right to reject any design at its discretion. Approved designs are assigned a unique Design Code and stored in your account for future orders.`,
    },
    {
        id: "jurisdiction",
        title: "11. Governing Law & Jurisdiction",
        body: `These Terms and Conditions are governed by the laws of Nepal. All disputes arising out of or in connection with these Terms shall be subject to the exclusive jurisdiction of the competent courts of Rupandehi District, Nepal. By using the Platform, you irrevocably submit to this jurisdiction.`,
    },
    {
        id: "changes",
        title: "12. Changes to These Terms",
        body: `We reserve the right to update or amend these Terms at any time. Changes take effect upon publication on this page, with the effective date updated accordingly. Continued use of the Platform after any change constitutes acceptance of the revised Terms. We encourage you to review this page periodically.`,
    },
];

export default function TermsPage() {
    return (
        <div className="min-h-screen bg-slate-50">
            <Navbar />

            <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
                {/* Header */}
                <div className="mb-10 text-center flex flex-col items-center">
                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                        Terms &amp; Conditions
                    </h1>
                    <div className="mt-1 h-[4px] rounded-full w-52 bg-blue-500 my-4" />
                    <p className="text-sm sm:text-base text-slate-500 max-w-2xl">
                        Please read these terms carefully before using the New Mankamana Printers
                        platform. By registering or placing an order, you agree to be bound by these terms.
                    </p>
                    <p className="mt-3 text-xs text-slate-400">
                        Effective date: {EFFECTIVE_DATE}
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-8 items-start">
                    {/* Sidebar TOC */}
                    <aside className="hidden lg:block sticky top-8 bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                        <p className="text-[0.65rem] font-bold tracking-[0.16em] uppercase text-slate-400 mb-3">
                            Contents
                        </p>
                        <nav className="flex flex-col gap-1.5">
                            {sections.map((s) => (
                                <a
                                    key={s.id}
                                    href={`#${s.id}`}
                                    className="text-[0.78rem] text-slate-600 hover:text-blue-600 transition-colors leading-snug"
                                >
                                    {s.title}
                                </a>
                            ))}
                            <a
                                href="#contact"
                                className="text-[0.78rem] text-slate-600 hover:text-blue-600 transition-colors leading-snug"
                            >
                                13. Contact Us
                            </a>
                        </nav>
                    </aside>

                    {/* Main content */}
                    <div className="space-y-5">
                        {sections.map((s) => (
                            <section
                                key={s.id}
                                id={s.id}
                                className={`rounded-xl border shadow-sm p-6 scroll-mt-6 ${
                                    s.important
                                        ? "bg-amber-50 border-amber-200"
                                        : "bg-white border-slate-200"
                                }`}
                            >
                                <div className="flex items-start gap-2.5 mb-3">
                                    {s.important && (
                                        <span className="mt-0.5 flex-shrink-0 inline-block bg-amber-500 text-white text-[0.6rem] font-bold tracking-[0.1em] uppercase px-2 py-0.5 rounded">
                                            Important
                                        </span>
                                    )}
                                    <h2 className="text-base font-bold text-slate-800">
                                        {s.title}
                                    </h2>
                                </div>
                                <div className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                                    {s.body}
                                </div>
                            </section>
                        ))}

                        {/* Contact section */}
                        <section
                            id="contact"
                            className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 scroll-mt-6"
                        >
                            <h2 className="text-base font-bold text-slate-800 mb-3">
                                13. Contact Us
                            </h2>
                            <p className="text-sm text-slate-600 leading-relaxed mb-4">
                                For any queries regarding these Terms, please reach out through the
                                channels below or visit our{" "}
                                <Link href="/contact" className="text-blue-600 hover:underline font-medium">
                                    Contact page
                                </Link>
                                .
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="bg-slate-50 rounded-lg border border-slate-200 p-4">
                                    <p className="text-[0.65rem] font-bold tracking-[0.14em] uppercase text-slate-400 mb-2">
                                        Address
                                    </p>
                                    <p className="text-sm text-slate-700 leading-relaxed">
                                        Traffic Chowk, Jagriti Path
                                        <br />
                                        Butwal, Rupandehi
                                        <br />
                                        Nepal
                                    </p>
                                </div>
                                <div className="bg-slate-50 rounded-lg border border-slate-200 p-4">
                                    <p className="text-[0.65rem] font-bold tracking-[0.14em] uppercase text-slate-400 mb-2">
                                        Phone
                                    </p>
                                    <div className="flex flex-col gap-1 text-sm">
                                        <a
                                            href="tel:+9779804458995"
                                            className="text-blue-600 font-semibold hover:underline"
                                        >
                                            +977 9804458995
                                        </a>
                                        <a
                                            href="tel:+9779705396330"
                                            className="text-blue-600 font-semibold hover:underline"
                                        >
                                            +977 9705396330
                                        </a>
                                    </div>
                                </div>
                                <div className="bg-slate-50 rounded-lg border border-slate-200 p-4">
                                    <p className="text-[0.65rem] font-bold tracking-[0.14em] uppercase text-slate-400 mb-2">
                                        Email
                                    </p>
                                    <a
                                        href="mailto:nmpress2082@gmail.com"
                                        className="text-sm text-blue-600 font-semibold hover:underline break-all"
                                    >
                                        nmpress2082@gmail.com
                                    </a>
                                </div>
                            </div>
                        </section>

                        <p className="text-xs text-slate-400 text-center pb-4">
                            © {new Date().getFullYear()} New Mankamana Printers. All legal matters are subject to Rupandehi District jurisdiction, Nepal.
                        </p>
                    </div>
                </div>
            </div>

            <Footer />
        </div>
    );
}
