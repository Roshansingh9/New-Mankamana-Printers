import { Service, Template, Order } from "@/types";

// Supabase public storage base — swap images by uploading to the bucket without touching code
const BUCKET = "https://hvvdnlsrwpenyulgfgsz.supabase.co/storage/v1/object/public/printing-assets";
const ASSETS = `${BUCKET}/product-assets`;
const TMPL  = `${BUCKET}/templates`;

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

export const TEMPLATE_CATEGORIES = [
    "Visiting Cards",
    "Letterheads",
    "Envelopes",
    "ID Cards",
    "Garment Tags",
];

export const TEMPLATES: Template[] = [
    {
        id: "t1",
        name: "Modern Business Card 01",
        category: "Visiting Cards",
        image: `${TMPL}/modern-business-card-01.jpg`,
    },
    {
        id: "t2",
        name: "Modern Business Card 02",
        category: "Visiting Cards",
        image: `${TMPL}/modern-business-card-02.jpg`,
    },
    {
        id: "t3",
        name: "Classic Business Card",
        category: "Visiting Cards",
        image: `${TMPL}/classic-business-card.jpg`,
    },
    {
        id: "t4",
        name: "Corporate Letterhead 01",
        category: "Letterheads",
        image: `${TMPL}/corporate-letterhead-01.jpg`,
    },
    {
        id: "t5",
        name: "Standard Envelope",
        category: "Envelopes",
        image: `${TMPL}/standard-envelope.jpg`,
    },
    {
        id: "t6",
        name: "Business Envelope",
        category: "Envelopes",
        image: `${TMPL}/business-envelope.jpg`,
    },
    {
        id: "t7",
        name: "Employee ID Card",
        category: "ID Cards",
        image: `${TMPL}/employee-id-card.jpg`,
    },
    {
        id: "t8",
        name: "Event ID Card",
        category: "ID Cards",
        image: `${TMPL}/event-id-card.jpg`,
    }
];

export const PAPER_TYPES = [
    "Matte",
    "Glossy",
    "Satin",
    "Recycled",
    "Bond",
    "Art Paper",
];

export const FINISHING_OPTIONS = [
    "Standard",
    "Lamination (Glossy)",
    "Lamination (Matte)",
    "UV Coating",
    "Embossing",
    "Spot UV",
];

export const MOCK_ORDERS: Order[] = [
    {
        id: "ORD001",
        orderName: "Visiting Cards Batch",
        service: "Visiting Cards",
        quantity: 2000,
        paperType: "Matte",
        finishingOption: "Lamination (Glossy)",
        designId: "D203",
        orderType: "STANDARD",
        status: "ORDER_DELIVERED",
        date: "2026-02-15",
    },
    {
        id: "ORD002",
        orderName: "Company Letterheads",
        service: "Letterheads",
        quantity: 500,
        paperType: "Bond",
        finishingOption: "Standard",
        orderType: "STANDARD",
        status: "ORDER_PROCESSING",
        date: "2026-03-01",
    },
    {
        id: "ORD003",
        orderName: "Event Pamphlets",
        service: "Pamphlets",
        quantity: 1000,
        paperType: "Glossy",
        finishingOption: "UV Coating",
        designId: "D301",
        orderType: "CUSTOM",
        status: "ORDER_ACCEPTED",
        date: "2026-03-04",
    },
    {
        id: "ORD004",
        orderName: "Staff ID Cards",
        service: "ID Cards",
        quantity: 50,
        paperType: "Art Paper",
        finishingOption: "Lamination (Matte)",
        orderType: "STANDARD",
        status: "ORDER_PLACED",
        date: "2026-03-05",
    },
    {
        id: "ORD005",
        orderName: "Brand Envelopes",
        service: "Envelopes",
        quantity: 300,
        paperType: "Bond",
        finishingOption: "Standard",
        orderType: "STANDARD",
        status: "ORDER_DISPATCHED",
        date: "2026-02-28",
    },
];
