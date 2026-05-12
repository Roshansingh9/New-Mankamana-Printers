import { Service, Template } from "@/types";

const BUCKET = "https://hvvdnlsrwpenyulgfgsz.supabase.co/storage/v1/object/public/printing-assets";
const ASSETS = `${BUCKET}/product-assets`;
const FREE  = `${BUCKET}/free-designs`;

export const SERVICES: Service[] = [
    {
        id: "card-holders",
        name: "Card Holders",
        minimumQuantity: 100,
        image: `${ASSETS}/card-holders/thumb.jpg`,
    },
    {
        id: "pamphlets",
        name: "Pamphlets",
        minimumQuantity: 200,
        image: `${ASSETS}/pamphlet/thumb.jpg`,
    },
    {
        id: "posters",
        name: "Posters",
        minimumQuantity: 200,
        image: `${ASSETS}/poster/thumb.jpg`,
    },
    {
        id: "letterheads",
        name: "Letterheads",
        minimumQuantity: 100,
        image: `${ASSETS}/letterhead/thumb.jpg`,
    },
    {
        id: "bill-books",
        name: "Bill Books",
        minimumQuantity: 100,
        image: `${ASSETS}/bill-books/thumb.jpg`,
    },
    {
        id: "id-cards",
        name: "ID Cards",
        minimumQuantity: 1,
        image: `${ASSETS}/id-cards/thumb.jpg`,
    },
];

export const CATEGORY_PREVIEWS: Record<string, string> = {
    "Visiting Cards":         `${FREE}/visiting-card/preview.jpg`,
    "Die Cut Visiting Cards": `${FREE}/die-cut-visiting-card/preview.jpg`,
    "Letterheads":            `${FREE}/letter-head/preview.jpg`,
    "Envelopes":              `${FREE}/envelope/preview.jpg`,
    "Bill Books":             `${FREE}/bill-book/preview.jpg`,
    "ATM Pouch":              `${FREE}/atm-pouch/preview.jpg`,
    "Doctor Files":           `${FREE}/doctor-files/preview.jpg`,
    "UV Texture":             `${FREE}/uv-texture/preview.jpg`,
    "Garment Tags":           `${FREE}/garments-tags/preview.jpg`,
    "Stickers":               `${FREE}/sticker/preview.jpg`,
    "ID Cards":               `${FREE}/id-card/preview.jpg`,
};

export const TEMPLATE_CATEGORIES = [
    "Visiting Cards",
    "Die Cut Visiting Cards",
    "Letterheads",
    "Envelopes",
    "Bill Books",
    "ATM Pouch",
    "Doctor Files",
    "UV Texture",
    "Garment Tags",
    "Stickers",
    "ID Cards",
];

// ─── Visiting Cards (26 VC + 74 templated = 100 designs) ─────────────────────
const vcStandard: Template[] = Array.from({ length: 26 }, (_, i) => {
    const n = String(i + 1).padStart(2, "0");
    return {
        id: `vc-${n}`,
        name: `Business Card ${i + 1}`,
        category: "Visiting Cards",
        image: `${FREE}/visiting-card/designs/vc-${n}.jpg`,
    };
});

const vcTemplated: Template[] = Array.from({ length: 74 }, (_, i) => {
    const tplNum = 27 + i;
    return {
        id: `vc-t${tplNum}`,
        name: `Business Card Template ${tplNum}`,
        category: "Visiting Cards",
        image: `${FREE}/visiting-card/designs/template-${tplNum}.jpg`,
    };
});

// ─── Die Cut Visiting Cards (36 dies + Metal) ─────────────────────────────────
const dieCutDies: Template[] = Array.from({ length: 36 }, (_, i) => {
    const n = String(i + 1).padStart(2, "0");
    return {
        id: `die-no-${n}`,
        name: `Die Cut No. ${i + 1}`,
        category: "Die Cut Visiting Cards",
        image: `${FREE}/die-cut-visiting-card/die-no-${n}/preview.jpg`,
    };
});

const metalVC: Template = {
    id: "die-metal-vc",
    name: "Metal Visiting Card",
    category: "Die Cut Visiting Cards",
    image: `${FREE}/die-cut-visiting-card/metal-visiting-cards/preview.jpg`,
};

// ─── Letterheads (42 designs) ─────────────────────────────────────────────────
const lhPrefixes = [104,240,241,242,243,244,245,246,247,248,249,250,251,252,253,254,255,256,257,258,388,389,390,391,392,393,394,395,396,397,426,427,428,429,430,431,432,433,434,435,436,437];
const letterheads: Template[] = lhPrefixes.map((prefix, i) => ({
    id: `lh-${i + 1}`,
    name: `Letterhead Design ${i + 1}`,
    category: "Letterheads",
    image: `${FREE}/letter-head/designs/${prefix}-lh-${i + 1}.jpg`,
}));

// ─── Envelopes (8 sizes + gift — one card per size) ───────────────────────────
const envelopes: Template[] = [
    { id: "env-9x4",        name: "Envelope 9×4",        category: "Envelopes", image: `${FREE}/envelope/envelope-9x4/preview.jpg` },
    { id: "env-9-70x4-20",  name: "Envelope 9.70×4.20",  category: "Envelopes", image: `${FREE}/envelope/envelope-9-70x4-20/preview.jpg` },
    { id: "env-5x7",        name: "Envelope 5×7",         category: "Envelopes", image: `${FREE}/envelope/envelope-5x7/preview.jpg` },
    { id: "env-6x8",        name: "Envelope 6×8",         category: "Envelopes", image: `${FREE}/envelope/envelope-6x8/preview.jpg` },
    { id: "env-8-60x10-60", name: "Envelope 8.60×10.60",  category: "Envelopes", image: `${FREE}/envelope/envelope-8-60x10-60/preview.jpg` },
    { id: "env-9-40x12-40", name: "Envelope 9.40×12.40",  category: "Envelopes", image: `${FREE}/envelope/envelope-9-40x12-40/preview.jpg` },
    { id: "env-10-75x4-75", name: "Envelope 10.75×4.75",  category: "Envelopes", image: `${FREE}/envelope/envelope-10-75x4-75/preview.jpg` },
    { id: "env-gift",       name: "Gift Envelope",         category: "Envelopes", image: `${FREE}/envelope/gift-envelope/preview.jpg` },
];

// ─── Bill Books (20 designs) ──────────────────────────────────────────────────
const bbPrefixes = [103,259,260,261,262,263,264,265,266,267,318,319,320,321,322,323,324,325,326,327];
const billBooks: Template[] = bbPrefixes.map((prefix, i) => ({
    id: `bb-${i + 1}`,
    name: `Bill Book Design ${i + 1}`,
    category: "Bill Books",
    image: `${FREE}/bill-book/designs/${prefix}-inv-${i + 1}.jpg`,
}));

// ─── ATM Pouch (13 designs) ───────────────────────────────────────────────────
const atmPrefixes = [102,297,398,399,400,401,402,403,404,405,549,550,594];
const atmPouch: Template[] = atmPrefixes.map((prefix, i) => ({
    id: `atm-${i + 1}`,
    name: `ATM Pouch Design ${i + 1}`,
    category: "ATM Pouch",
    image: `${FREE}/atm-pouch/designs/${prefix}-atm-${i + 1}.jpg`,
}));

// ─── Doctor Files (5 designs — 2 big, 3 small) ───────────────────────────────
const doctorFiles: Template[] = [
    { id: "df-1", name: "Doctor File – Big 1",   category: "Doctor Files", image: `${FREE}/doctor-files/designs/573-4422-1.jpg` },
    { id: "df-2", name: "Doctor File – Big 2",   category: "Doctor Files", image: `${FREE}/doctor-files/designs/574-a3.jpg` },
    { id: "df-3", name: "Doctor File – Small 1", category: "Doctor Files", image: `${FREE}/doctor-files/designs/470-5454.jpg` },
    { id: "df-4", name: "Doctor File – Small 2", category: "Doctor Files", image: `${FREE}/doctor-files/designs/471-0222222.jpg` },
    { id: "df-5", name: "Doctor File – Small 3", category: "Doctor Files", image: `${FREE}/doctor-files/designs/572-b3.jpg` },
];

// ─── UV Texture (25 designs) ──────────────────────────────────────────────────
const uvTextureFiles = [
    "96-texture-uv-type-1.jpg","97-texture-uv-type-2.jpg","99-texture-uv-type-4.jpg",
    "100-texture-uv-type-5.jpg","101-texture-uv-type-6.jpg","454-texture-uv-type-7.jpg",
    "455-texture-uv-type-8.jpg","456-texture-uv-type-9.jpg","457-texture-uv-type-10.jpg",
    "458-texture-uv-type-11.jpg","459-texture-uv-type-12.jpg","461-texture-uv-type-14.jpg",
    "482-texture-uv-type-15.jpg","483-texture-uv-type-16.jpg","484-texture-uv-type-17.jpg",
    "485-texture-uv-type-18.jpg","486-texture-uv-type-19.jpg","487-texture-uv-type-20.jpg",
    "632-1.jpg","633-2.jpg","634-3.jpg","635-4.jpg","636-5.jpg","637-6.jpg","638-7.jpg",
];
const uvTexture: Template[] = uvTextureFiles.map((file, i) => ({
    id: `uv-${i + 1}`,
    name: `UV Texture ${i + 1}`,
    category: "UV Texture",
    image: `${FREE}/uv-texture/designs/${file}`,
}));

// ─── Garment Tags (3 size categories) ────────────────────────────────────────
const garmentTags: Template[] = [
    { id: "gt-large",  name: "Garment Tag – Large",  category: "Garment Tags", image: `${FREE}/garments-tags/large-tags/preview.jpg` },
    { id: "gt-medium", name: "Garment Tag – Medium", category: "Garment Tags", image: `${FREE}/garments-tags/medium-tags/preview.jpg` },
    { id: "gt-small",  name: "Garment Tag – Small",  category: "Garment Tags", image: `${FREE}/garments-tags/small-tags/preview.jpg` },
];

// ─── Stickers (Round + Straight cut) ─────────────────────────────────────────
const stickers: Template[] = [
    { id: "sticker-round",    name: "Sticker – Round Cut",    category: "Stickers", image: `${FREE}/sticker/round-cut/preview.jpg` },
    { id: "sticker-straight", name: "Sticker – Straight Cut", category: "Stickers", image: `${FREE}/sticker/straight-cut/preview.jpg` },
];

// ─── ID Cards (20 designs) ───────────────────────────────────────────────────
const idPrefixes = [93,107,268,269,270,271,272,273,274,275,338,339,340,341,342,343,344,345,346,347];
const idCards: Template[] = idPrefixes.map((prefix, i) => ({
    id: `id-${i + 1}`,
    name: `ID Card Design ${i + 1}`,
    category: "ID Cards",
    image: `${FREE}/id-card/designs/${prefix}-id-${i + 1}.jpg`,
}));

export const TEMPLATES: Template[] = [
    ...vcStandard,
    ...vcTemplated,
    ...dieCutDies,
    metalVC,
    ...letterheads,
    ...envelopes,
    ...billBooks,
    ...atmPouch,
    ...doctorFiles,
    ...uvTexture,
    ...garmentTags,
    ...stickers,
    ...idCards,
];
