"use client";

import React from "react";

// Supabase bucket base — replace images by uploading to the bucket at the same path
const ASSETS = "https://hvvdnlsrwpenyulgfgsz.supabase.co/storage/v1/object/public/printing-assets/product-assets";
import { ProductDef } from "@/types";

// ─── Card Holders ─────────────────────────────────────────────────────────────

const cardHolderSpecialization = (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-black font-semibold text-lg hover:underline cursor-pointer mb-3">Our Specialization</h3>
        <ul className="space-y-2 text-sm text-gray-700">
            <li>● We are India&apos;s No. 1 Visiting card manufacturer.</li>
            <li><span className="font-semibold text-gray-900">● B2B Exclusive:</span> Serving only printing presses, no direct sales to customers.</li>
            <li><span className="font-semibold text-gray-900">● Real-Time Order Tracking:</span> Full transparency with online tracking.</li>
            <li><span className="font-semibold text-gray-900">● Fast &amp; Reliable Service:</span> Competitive pricing with quick turnaround.</li>
        </ul>
    </div>
);

const printingSpecialization = (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-black font-semibold text-lg hover:underline cursor-pointer mb-3">Our Specialization</h3>
        <ul className="space-y-2 text-sm text-gray-700 font-medium">
            <li><span className="text-gray-500 font-normal">● </span>Printing with latest Komori offset machines (2023 Model)</li>
            <li><span className="text-gray-500 font-normal">● </span>Innovative, Advanced &amp; Equipped Post Printing Unit</li>
            <li><span className="text-gray-500 font-normal">● </span>Constant quality with reasonable price</li>
        </ul>
    </div>
);

function cardHolderActiveIndex(state: Record<string, string>): number {
    if (!state.holderType) return 0;
    const match = state.holderType.match(/\d+/);
    return match ? Math.max(0, parseInt(match[0]) - 1) : 0;
}

// ─── Products Array ───────────────────────────────────────────────────────────

export const PRODUCTS: ProductDef[] = [
    // ── Card Holders ──
    {
        id: "horizontal",
        categoryId: "Card Holders",
        name: "Horizontal Laser Printed Card Holders",
        images: [
            `${ASSETS}/card-holders/swatches/h-1.jpg`,
            `${ASSETS}/card-holders/swatches/h-2.jpg`,
            `${ASSETS}/card-holders/swatches/h-3.jpg`,
            `${ASSETS}/card-holders/swatches/h-4.jpg`,
        ],
        fields: [
            { type: "number", id: "quantity", label: "Quantity", min: 5, icon: "🔢", hint: "(Min Qty. : 5)" },
            {
                type: "select", id: "holderType", label: "Holder Type", icon: "🏷️", options: [
                    { value: "H-1", label: "H - 1" },
                    { value: "H-2", label: "H - 2" },
                    { value: "H-3", label: "H - 3" },
                    { value: "H-4", label: "H - 4" },
                ]
            }
        ],
        getActiveImageIndex: cardHolderActiveIndex,
        calculatePrice: (state) => {
            const qty = parseInt(state.quantity) || 5;
            const prices: Record<string, number> = { "H-1": 100, "H-2": 110, "H-3": 120, "H-4": 130 };
            return { applicableCost: (prices[state.holderType] || 100) * qty, discount: 0 };
        },
        emailExtraCharge: 10,
        freeDeliveryThreshold: 500,
        renderProductInfo: () => (
            <>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                    <h3 className="text-black font-semibold text-lg hover:underline cursor-pointer mb-3">Product Description</h3>
                    <ul className="space-y-1.5 text-sm text-gray-700 font-medium">
                        <li><span className="text-gray-500 font-normal">● Product Ref. : </span><span className="text-blue-600 font-semibold cursor-pointer">VC/11th Edition (Sample File)</span></li>
                        <li><span className="text-gray-500 font-normal">● Product Code : </span><span className="font-bold text-gray-800">Horizontal Card Holder (H)</span></li>
                        <li><span className="text-gray-500 font-normal">● Product Class : </span><span className="font-bold text-gray-800">Premium (Unique)</span></li>
                        <li><span className="text-gray-500 font-normal">● Printing Option : </span><span className="font-bold text-gray-800">Available (Laser Printing)</span></li>
                        <li><span className="text-gray-500 font-normal">● Product Quality : </span><span className="font-bold text-gray-800">Super</span></li>
                        <li><span className="text-gray-500 font-normal">● Holders Type : </span><span className="font-bold text-gray-800">4 Type</span></li>
                        <li><span className="text-gray-500 font-normal">● Dispatch Time : </span><span className="font-bold text-gray-800">1 days</span></li>
                        <li><span className="text-gray-500 font-normal">● Uses : </span><span className="font-semibold text-blue-800">Ideal for Corporate Gifting, Business Meetings, &amp; Top Management Use.</span></li>
                        <li className="text-blue-800 font-semibold">● Perfect for Brand Promotion &amp; Premium Client Presentation.</li>
                    </ul>
                </div>
                {cardHolderSpecialization}
            </>
        )
    },
    {
        id: "vertical",
        categoryId: "Card Holders",
        name: "Vertical Laser Printed Card Holders",
        images: [
            `${ASSETS}/card-holders/swatches/v-1.jpg`,
            `${ASSETS}/card-holders/swatches/v-2.jpg`,
            `${ASSETS}/card-holders/swatches/v-3.jpg`,
            `${ASSETS}/card-holders/swatches/v-4.jpg`,
        ],
        fields: [
            { type: "number", id: "quantity", label: "Quantity", min: 5, icon: "🔢", hint: "(Min Qty. : 5)" },
            {
                type: "select", id: "holderType", label: "Holder Type", icon: "🏷️", options: [
                    { value: "V-1", label: "V - 1" },
                    { value: "V-2", label: "V - 2" },
                    { value: "V-3", label: "V - 3" },
                    { value: "V-4", label: "V - 4" },
                ]
            }
        ],
        getActiveImageIndex: cardHolderActiveIndex,
        calculatePrice: (state) => {
            const qty = parseInt(state.quantity) || 5;
            const prices: Record<string, number> = { "V-1": 110, "V-2": 120, "V-3": 130, "V-4": 140 };
            return { applicableCost: (prices[state.holderType] || 110) * qty, discount: 0 };
        },
        emailExtraCharge: 10,
        freeDeliveryThreshold: 500,
        renderProductInfo: () => (
            <>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                    <h3 className="text-black font-semibold text-lg hover:underline cursor-pointer mb-3">Product Description</h3>
                    <ul className="space-y-1.5 text-sm text-gray-700 font-medium">
                        <li><span className="text-gray-500 font-normal">● Product Ref. : </span><span className="text-blue-600 font-semibold cursor-pointer">VC/11th Edition (Sample File)</span></li>
                        <li><span className="text-gray-500 font-normal">● Product Code : </span><span className="font-bold text-gray-800">Vertical Card Holder (V)</span></li>
                        <li><span className="text-gray-500 font-normal">● Product Class : </span><span className="font-bold text-gray-800">Premium (Unique)</span></li>
                        <li><span className="text-gray-500 font-normal">● Printing Option : </span><span className="font-bold text-gray-800">Available (Laser Printing)</span></li>
                        <li><span className="text-gray-500 font-normal">● Product Quality : </span><span className="font-bold text-gray-800">Super</span></li>
                        <li><span className="text-gray-500 font-normal">● Holders Type : </span><span className="font-bold text-gray-800">4 Type</span></li>
                        <li><span className="text-gray-500 font-normal">● Dispatch Time : </span><span className="font-bold text-gray-800">1 days</span></li>
                        <li><span className="text-gray-500 font-normal">● Uses : </span><span className="font-semibold text-blue-800">Ideal for Corporate Gifting, Business Meetings, &amp; Top Management Use.</span></li>
                        <li className="text-blue-800 font-semibold">● Perfect for Brand Promotion &amp; Premium Client Presentation.</li>
                    </ul>
                </div>
                {cardHolderSpecialization}
            </>
        )
    },

    // ── Pamphlets ──
    {
        id: "pamphlet-70gsm-maplitho",
        categoryId: "Pamphlets",
        name: "Pamphlet - 70 GSM Maplitho Paper",
        images: [
            `${ASSETS}/pamphlet/pmp-1.jpg`,
            `${ASSETS}/pamphlet/pmp-2.jpg`,
            `${ASSETS}/pamphlet/pmp-3.jpg`,
        ],
        fields: [
            { type: "select", id: "size", label: "Size", icon: "🏷️", options: [{ value: "Letter Size (8.5\" x 11\")", label: "Letter Size (8.5\" x 11\")" }, { value: "A4 Size (8.26\" x 11.69\")", label: "A4 Size (8.26\" x 11.69\")" }] },
            { type: "select", id: "printing", label: "Printing", icon: "🖨️", options: [{ value: "Single Side", label: "Single Side" }, { value: "Both Side", label: "Both Side" }] },
            { type: "select", id: "quantity", label: "Qty.", icon: "🏷️", options: [{ value: "1000", label: "1000" }, { value: "2000", label: "2000" }, { value: "4000", label: "4000" }, { value: "5000", label: "5000" }] }
        ],
        calculatePrice: (state) => {
            const qty = parseInt(state.quantity) || 1000;
            const baseUnitPrice = state.printing === "Single Side" ? 1.5 : 2.5;
            const total = qty * baseUnitPrice;
            return { applicableCost: total, discount: qty >= 4000 ? total * 0.1 : 0 };
        },
        emailExtraCharge: 10,
        freeDeliveryThreshold: 2000,
        renderProductInfo: () => (
            <>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                    <h3 className="text-black font-semibold text-lg hover:underline cursor-pointer mb-3">Product Description</h3>
                    <ul className="space-y-1.5 text-sm text-gray-700 font-medium">
                        <li><span className="text-gray-500 font-normal">● Product Ref. : </span><span className="text-blue-600 font-semibold cursor-pointer">PP/02nd Edition (Sample File)</span></li>
                        <li><span className="text-gray-500 font-normal">● Product Code : </span><span className="font-bold text-gray-800">PP-1</span></li>
                        <li><span className="text-gray-500 font-normal">● Product Class : </span><span className="font-bold text-gray-800">Regular</span></li>
                        <li><span className="text-gray-500 font-normal">● Product Size : </span><span className="font-bold text-gray-800">Letter Size (8.5&quot; X 11&quot;)</span></li>
                        <li><span className="text-gray-500 font-normal">● Paper Quality : </span><span className="font-bold text-gray-800">70 GSM Maplitho Paper</span></li>
                        <li><span className="text-gray-500 font-normal">● Printing Options : </span><span className="text-blue-600 font-semibold">Single Side or Both Side</span></li>
                        <li><span className="text-gray-500 font-normal">● Price discount applicable (System auto calculate) with increase in Quantity</span></li>
                    </ul>
                </div>
                {printingSpecialization}
            </>
        )
    },
    {
        id: "pamphlet-90gsm-art",
        categoryId: "Pamphlets",
        name: "Pamphlet - 90 GSM Art Paper",
        images: [
            `${ASSETS}/pamphlet/pmp-1.jpg`,
            `${ASSETS}/pamphlet/pmp-2.jpg`,
            `${ASSETS}/pamphlet/pmp-3.jpg`,
        ],
        fields: [
            { type: "select", id: "size", label: "Size", icon: "🏷️", options: [{ value: "Letter Size (8.5\" x 11\")", label: "Letter Size (8.5\" x 11\")" }, { value: "A4 Size (8.26\" x 11.69\")", label: "A4 Size (8.26\" x 11.69\")" }] },
            { type: "select", id: "printing", label: "Printing", icon: "🖨️", options: [{ value: "Single Side", label: "Single Side" }, { value: "Both Side", label: "Both Side" }] },
            { type: "select", id: "quantity", label: "Qty.", icon: "🏷️", options: [{ value: "1000", label: "1000" }, { value: "2000", label: "2000" }, { value: "4000", label: "4000" }, { value: "5000", label: "5000" }] }
        ],
        calculatePrice: (state) => {
            const qty = parseInt(state.quantity) || 1000;
            const baseUnitPrice = state.printing === "Single Side" ? 1.9 : 3.2;
            const total = qty * baseUnitPrice;
            return { applicableCost: total, discount: qty >= 4000 ? total * 0.1 : 0 };
        },
        emailExtraCharge: 10,
        freeDeliveryThreshold: 2500,
        renderProductInfo: () => (
            <>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                    <h3 className="text-black font-semibold text-lg hover:underline cursor-pointer mb-3">Product Description</h3>
                    <ul className="space-y-1.5 text-sm text-gray-700 font-medium">
                        <li><span className="text-gray-500 font-normal">● Product Ref. : </span><span className="text-blue-600 font-semibold cursor-pointer">PP/02nd Edition (Sample File)</span></li>
                        <li><span className="text-gray-500 font-normal">● Product Code : </span><span className="font-bold text-gray-800">PP-2</span></li>
                        <li><span className="text-gray-500 font-normal">● Paper Quality : </span><span className="font-bold text-gray-800">90 GSM Art Paper</span></li>
                        <li><span className="text-gray-500 font-normal">● Printing Options : </span><span className="text-blue-600 font-semibold">Single Side or Both Side</span></li>
                        <li><span className="text-gray-500 font-normal">● Price discount applicable (System auto calculate) with increase in Quantity</span></li>
                    </ul>
                </div>
                {printingSpecialization}
            </>
        )
    },
    {
        id: "pamphlet-115gsm-art",
        categoryId: "Pamphlets",
        name: "Pamphlet - 115 GSM Art Paper",
        images: [
            `${ASSETS}/pamphlet/pmp-1.jpg`,
            `${ASSETS}/pamphlet/pmp-2.jpg`,
            `${ASSETS}/pamphlet/pmp-3.jpg`,
        ],
        fields: [
            { type: "select", id: "size", label: "Size", icon: "🏷️", options: [{ value: "Letter Size (8.5\" x 11\")", label: "Letter Size (8.5\" x 11\")" }, { value: "A4 Size (8.26\" x 11.69\")", label: "A4 Size (8.26\" x 11.69\")" }] },
            { type: "select", id: "printing", label: "Printing", icon: "🖨️", options: [{ value: "Single Side", label: "Single Side" }, { value: "Both Side", label: "Both Side" }] },
            { type: "select", id: "quantity", label: "Qty.", icon: "🏷️", options: [{ value: "1000", label: "1000" }, { value: "2000", label: "2000" }, { value: "4000", label: "4000" }, { value: "5000", label: "5000" }] }
        ],
        calculatePrice: (state) => {
            const qty = parseInt(state.quantity) || 1000;
            const baseUnitPrice = state.printing === "Single Side" ? 2.4 : 3.8;
            const total = qty * baseUnitPrice;
            return { applicableCost: total, discount: qty >= 4000 ? total * 0.1 : 0 };
        },
        emailExtraCharge: 10,
        freeDeliveryThreshold: 2500,
        renderProductInfo: () => (
            <>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                    <h3 className="text-black font-semibold text-lg hover:underline cursor-pointer mb-3">Product Description</h3>
                    <ul className="space-y-1.5 text-sm text-gray-700 font-medium">
                        <li><span className="text-gray-500 font-normal">● Product Code : </span><span className="font-bold text-gray-800">PP-3</span></li>
                        <li><span className="text-gray-500 font-normal">● Paper Quality : </span><span className="font-bold text-gray-800">115 GSM Art Paper</span></li>
                        <li><span className="text-gray-500 font-normal">● Printing Options : </span><span className="text-blue-600 font-semibold">Single Side or Both Side</span></li>
                        <li><span className="text-gray-500 font-normal">● Price discount applicable (System auto calculate) with increase in Quantity</span></li>
                    </ul>
                </div>
                {printingSpecialization}
            </>
        )
    },
    {
        id: "pamphlet-170gsm-art",
        categoryId: "Pamphlets",
        name: "Pamphlet - 170 GSM Art Paper",
        images: [
            `${ASSETS}/pamphlet/pmp-1.jpg`,
            `${ASSETS}/pamphlet/pmp-2.jpg`,
            `${ASSETS}/pamphlet/pmp-3.jpg`,
        ],
        fields: [
            { type: "select", id: "size", label: "Size", icon: "🏷️", options: [{ value: "Letter Size (8.5\" x 11\")", label: "Letter Size (8.5\" x 11\")" }, { value: "A4 Size (8.26\" x 11.69\")", label: "A4 Size (8.26\" x 11.69\")" }] },
            { type: "select", id: "printing", label: "Printing", icon: "🖨️", options: [{ value: "Single Side", label: "Single Side" }, { value: "Both Side", label: "Both Side" }] },
            { type: "select", id: "quantity", label: "Qty.", icon: "🏷️", options: [{ value: "1000", label: "1000" }, { value: "2000", label: "2000" }, { value: "4000", label: "4000" }, { value: "5000", label: "5000" }] }
        ],
        calculatePrice: (state) => {
            const qty = parseInt(state.quantity) || 1000;
            const baseUnitPrice = state.printing === "Single Side" ? 3.6 : 5.0;
            const total = qty * baseUnitPrice;
            return { applicableCost: total, discount: qty >= 4000 ? total * 0.1 : 0 };
        },
        emailExtraCharge: 10,
        freeDeliveryThreshold: 2500,
        renderProductInfo: () => (
            <>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                    <h3 className="text-black font-semibold text-lg hover:underline cursor-pointer mb-3">Product Description</h3>
                    <ul className="space-y-1.5 text-sm text-gray-700 font-medium">
                        <li><span className="text-gray-500 font-normal">● Product Code : </span><span className="font-bold text-gray-800">PP-4</span></li>
                        <li><span className="text-gray-500 font-normal">● Paper Quality : </span><span className="font-bold text-gray-800">170 GSM Art Paper</span></li>
                        <li><span className="text-gray-500 font-normal">● Printing Options : </span><span className="text-blue-600 font-semibold">Single Side or Both Side</span></li>
                        <li><span className="text-gray-500 font-normal">● Price discount applicable (System auto calculate) with increase in Quantity</span></li>
                    </ul>
                </div>
                {printingSpecialization}
            </>
        )
    },

    // ── Posters ──
    {
        id: "poster-15x20",
        categoryId: "Posters",
        name: "Poster - 15x20\" (Multiple Paper Types)",
        images: [
            `${ASSETS}/poster/pos-1.jpg`,
            `${ASSETS}/poster/pos-2.jpg`,
        ],
        fields: [
            { type: "select", id: "paperType", label: "Paper Quality", icon: "📄", options: [{ value: "70 GSM Maplitho", label: "70 GSM Maplitho" }, { value: "90 GSM Art Paper", label: "90 GSM Art Paper" }, { value: "115 GSM Art Paper", label: "115 GSM Art Paper" }, { value: "170 GSM Art Paper", label: "170 GSM Art Paper" }] },
            { type: "select", id: "printing", label: "Printing Options", icon: "🖨️", options: [{ value: "Single Side", label: "Single Side" }, { value: "Both Side", label: "Both Side" }] },
            { type: "select", id: "quantity", label: "Qty.", icon: "🔢", options: [{ value: "50", label: "50" }, { value: "100", label: "100" }, { value: "250", label: "250" }, { value: "500", label: "500" }, { value: "1000", label: "1000" }] }
        ],
        calculatePrice: (state) => {
            const qty = parseInt(state.quantity) || 50;
            const basePrices: Record<string, number> = { "70 GSM Maplitho": 5, "90 GSM Art Paper": 7, "115 GSM Art Paper": 8.5, "170 GSM Art Paper": 11 };
            const paperPrice = basePrices[state.paperType] || 5;
            const printMult = state.printing === "Both Side" ? 1.7 : 1.0;
            const total = qty * paperPrice * printMult;
            return { applicableCost: total, discount: qty >= 500 ? total * 0.07 : 0 };
        },
        emailExtraCharge: 10,
        freeDeliveryThreshold: 1200,
        renderProductInfo: () => (
            <>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                    <h3 className="text-black font-semibold text-lg hover:underline cursor-pointer mb-3">Product Description</h3>
                    <ul className="space-y-1.5 text-sm text-gray-700 font-medium">
                        <li><span className="text-gray-500 font-normal">● Product Code : </span><span className="font-bold text-gray-800">PP-5</span></li>
                        <li><span className="text-gray-500 font-normal">● Product Name : </span><span className="font-bold text-gray-800">Poster - 15x20</span></li>
                        <li><span className="text-gray-500 font-normal">● Printing Size : </span><span className="font-bold text-gray-800">14.4&quot; x 19.4&quot;</span></li>
                        <li>
                            <span className="text-gray-500 font-normal">● Paper Quality : </span>
                            <span className="text-blue-600 font-semibold">Available with:</span>
                            <div className="ml-8 mt-1 flex flex-col gap-0.5">
                                <span className="font-semibold">⇛ 70 GSM Maplitho</span>
                                <span className="font-semibold">⇛ 90 GSM Art Paper</span>
                                <span className="font-semibold">⇛ 115 GSM Art Paper</span>
                                <span className="font-semibold">⇛ 170 GSM Art Paper</span>
                            </div>
                        </li>
                        <li><span className="text-gray-500 font-normal">● Price discount applicable (System auto calculate) with increase in Quantity</span></li>
                    </ul>
                </div>
                {printingSpecialization}
            </>
        )
    },

    // ── Letterheads ──
    {
        id: "letterhead",
        categoryId: "Letterheads",
        name: "Letter Head - 90 GSM, Sunshine Paper (A4 Size)",
        images: [`${ASSETS}/letterhead/lh-1.jpg`],
        fields: [
            { type: "select", id: "printing", label: "Printing", icon: "🖨️", options: [{ value: "Single Side", label: "Single Side" }, { value: "Double Side", label: "Double Side" }] },
            { type: "select", id: "binding", label: "Binding", icon: "📚", options: [{ value: "Pad Binding (100 leaves/pad)", label: "Pad Binding (100 leaves/pad)" }, { value: "Loose", label: "Loose" }] },
            { type: "select", id: "quantity", label: "Qty.", icon: "🏷️", options: [{ value: "1000", label: "1000" }, { value: "2000", label: "2000" }, { value: "5000", label: "5000" }] }
        ],
        calculatePrice: (state) => {
            const qty = parseInt(state.quantity) || 1000;
            const isPad = state.binding?.includes("Pad");
            const baseUnit = isPad ? 2.5 : 2.0;
            const total = qty * baseUnit;
            return { applicableCost: total, discount: qty >= 2000 ? total * 0.15 : 0 };
        },
        emailExtraCharge: 10,
        freeDeliveryThreshold: 2000,
        renderProductInfo: () => (
            <>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                    <h3 className="text-black font-semibold text-lg hover:underline cursor-pointer mb-3">Product Description</h3>
                    <ul className="space-y-1.5 text-sm text-gray-700 font-medium">
                        <li><span className="text-gray-500 font-normal">● Product Ref. : </span><span className="text-blue-600 font-semibold cursor-pointer">LH/03rd Edition (Sample File)</span></li>
                        <li><span className="text-gray-500 font-normal">● Product Code : </span><span className="font-bold text-gray-800">LH-2</span></li>
                        <li><span className="text-gray-500 font-normal">● Product Size : </span><span className="font-bold text-gray-800">A4 Size (8.26&quot; X 11.69&quot;)</span></li>
                        <li><span className="text-gray-500 font-normal">● Paper Quality : </span><span className="font-bold text-gray-800">90 GSM Sunshine</span></li>
                        <li><span className="text-gray-500 font-normal">● Printing Options : </span><span className="text-blue-600 font-semibold">Single Side</span></li>
                        <li><span className="text-gray-500 font-normal">● Price discount applicable (System auto calculate) with increase in Quantity</span></li>
                    </ul>
                </div>
                {printingSpecialization}
            </>
        )
    },

    // ── Bill Books ──
    {
        id: "billbook",
        categoryId: "Bill Books",
        name: "A4 Bill Book - 2 Copy",
        images: [`${ASSETS}/bill-books/bill-1.jpg`],
        fields: [
            { type: "number", id: "quantity", label: "Quantity", min: 10, icon: "📦", hint: "(Min Qty. : 10)" },
            { type: "select", id: "paper1", label: "1st Paper Quality", icon: "📄", options: [{ value: "100 GSM Deo (Multicolor)", label: "100 GSM Deo (Multicolor)" }, { value: "90 GSM Sunshine (Multicolor)", label: "90 GSM Sunshine (Multicolor)" }] },
            { type: "select", id: "paper2", label: "2nd Copy Paper Color", icon: "📄", options: [{ value: "56 GSM Maplitho (Pink)", label: "56 GSM Maplitho (Pink)" }, { value: "56 GSM Maplitho (Yellow)", label: "56 GSM Maplitho (Yellow)" }, { value: "56 GSM Maplitho (Green)", label: "56 GSM Maplitho (Green)" }] },
            { type: "select", id: "binding", label: "Binding Quality", icon: "📚", options: [{ value: "Quarter Bound", label: "Quarter Bound" }, { value: "Perfect Binding", label: "Perfect Binding" }] }
        ],
        calculatePrice: (state) => {
            const qty = parseInt(state.quantity) || 10;
            return { applicableCost: qty * 150, discount: qty >= 50 ? qty * 20 : 0 };
        },
        emailExtraCharge: 10,
        freeDeliveryThreshold: 4000,
        renderProductInfo: () => (
            <>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                    <h3 className="text-black font-semibold text-lg hover:underline cursor-pointer mb-3">Product Description</h3>
                    <ul className="space-y-1.5 text-sm text-gray-700 font-medium">
                        <li><span className="text-gray-500 font-normal">● Product Code : </span><span className="font-bold text-gray-800">BB-1 / BB-2</span></li>
                        <li><span className="text-gray-500 font-normal">● Product Core : </span><span className="font-bold text-gray-800">Best Binding Quality</span></li>
                        <li className="flex items-start">
                            <span className="text-gray-500 font-normal mr-1 mt-[2px]">● Paper Quality : </span>
                            <ul className="ml-1 space-y-1 flex-1">
                                <li className="font-bold text-gray-800">● 1st Copy - 100 GSM Deo / 90 GSM Sunshine With Multicolor Printing</li>
                                <li className="font-bold text-gray-800">● 2nd Copy - 56 GSM Maplitho with Single color Printing</li>
                            </ul>
                        </li>
                        <li><span className="text-gray-500 font-normal mt-1">● Production Time : </span><span className="font-bold text-gray-800">5-7 Working Days</span></li>
                    </ul>
                    <h3 className="text-black font-semibold text-lg hover:underline cursor-pointer mt-4 mb-2">Important Note</h3>
                    <ul className="space-y-1.5 text-sm text-gray-700 font-medium pl-1">
                        <li><span className="text-gray-500 font-normal">● </span>Both Side Printing Available Only 100 GSM Deo Paper</li>
                        <li><span className="text-gray-500 font-normal">● </span>Please mention starting serial number in CDR or PDF file</li>
                    </ul>
                </div>
                {printingSpecialization}
            </>
        )
    },

    // ── ID Cards ──
    {
        id: "id-card",
        categoryId: "ID Cards",
        name: "Premium ID Cards",
        images: [`${ASSETS}/id-cards/id-1.jpg`],
        fields: [
            { type: "number", id: "quantity", label: "Quantity", min: 1, icon: "🔢" },
            { type: "select", id: "printingSide", label: "Printing Side", icon: "🖨️", options: [{ value: "Single Side", label: "Single" }, { value: "Both Side", label: "Double" }] },
            { type: "text", id: "photosLink", label: "Photos Link (Google Drive)", icon: "🔗", placeholder: "https://drive.google.com/..." },
            { type: "select", id: "orientation", label: "Orientation", icon: "📐", options: [{ value: "Landscape", label: "Landscape" }, { value: "Portrait", label: "Portrait" }] },
            { type: "text", id: "strapeColor", label: "Strap Color", icon: "🎨" },
            { type: "text", id: "strapeText", label: "Strap Text", icon: "✍️" },
        ],
        calculatePrice: (state) => {
            const qty = parseInt(state.quantity) || 1;
            const sideMult = state.printingSide === "Both Side" ? 1.5 : 1.0;
            return { applicableCost: qty * 25 * sideMult, discount: 0 };
        },
        emailExtraCharge: 10,
        freeDeliveryThreshold: 1000,
        renderProductInfo: () => (
            <>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                    <h3 className="text-black font-semibold text-lg hover:underline cursor-pointer mb-3">Product Description</h3>
                    <ul className="space-y-1.5 text-sm text-gray-700 font-medium">
                        <li><span className="text-gray-500 font-normal">● Product Class : </span><span className="font-bold text-gray-800">Premium ID Cards</span></li>
                        <li><span className="text-gray-500 font-normal">● Material : </span><span className="font-bold text-gray-800">High-Quality PVC</span></li>
                        <li><span className="text-gray-500 font-normal">● Printing : </span><span className="font-bold text-gray-800">Thermal Re-transfer Printing</span></li>
                    </ul>
                </div>
            </>
        )
    },
];
