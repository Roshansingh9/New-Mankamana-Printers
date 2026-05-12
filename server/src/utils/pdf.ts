import PDFDocument from "pdfkit";

export interface InvoiceData {
  orderId: string;
  businessName: string;
  clientCode: string;
  phone: string;
  productName: string;
  variantName: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  designSurcharge: number;
  finalAmount: number;
  configurations: Array<{ group_label: string; selected_label: string }>;
  designCode?: string | null;
  notes?: string | null;
  paymentMethod: string;
  acceptedAt: Date;
}

export function generateInvoicePdf(data: InvoiceData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const invoiceNumber = `INV-${data.orderId.slice(0, 8).toUpperCase()}`;
    const acceptedStr = data.acceptedAt.toLocaleDateString("en-NP", { dateStyle: "long" });
    const baseTotal = Number((data.unitPrice * data.quantity).toFixed(2));

    // ── Header ────────────────────────────────────────────────
    doc.rect(0, 0, doc.page.width, 80).fill("#0f172a");
    doc.fillColor("#ffffff").fontSize(18).font("Helvetica-Bold").text("New Mankamana Printers", 50, 25);
    doc.fillColor("#94a3b8").fontSize(10).font("Helvetica").text("Invoice", 50, 50);
    doc.fillColor("#fbbf24").fontSize(14).font("Helvetica-Bold").text(invoiceNumber, doc.page.width - 180, 25, { width: 130, align: "right" });
    doc.fillColor("#94a3b8").fontSize(9).font("Helvetica").text(`Accepted: ${acceptedStr}`, doc.page.width - 180, 48, { width: 130, align: "right" });

    let y = 100;

    // ── Bill To / Invoice Details ─────────────────────────────
    doc.fillColor("#94a3b8").fontSize(8).font("Helvetica-Bold").text("BILL TO", 50, y);
    doc.fillColor("#94a3b8").fontSize(8).font("Helvetica-Bold").text("INVOICE DETAILS", 320, y);
    y += 14;
    doc.fillColor("#1e293b").fontSize(12).font("Helvetica-Bold").text(data.businessName, 50, y);
    doc.fillColor("#64748b").fontSize(9).font("Helvetica").text(`Client Code: ${data.clientCode}`, 50, y + 16);
    doc.fillColor("#64748b").fontSize(9).text(`Phone: ${data.phone}`, 50, y + 28);
    doc.fillColor("#64748b").fontSize(9).font("Helvetica").text(`Order: #${data.orderId.slice(0, 8).toUpperCase()}`, 320, y);
    doc.fillColor("#64748b").fontSize(9).text(`Payment: ${data.paymentMethod}`, 320, y + 14);
    y += 55;

    // ── Table header ──────────────────────────────────────────
    doc.rect(50, y, doc.page.width - 100, 22).fill("#f8fafc");
    doc.strokeColor("#e2e8f0").lineWidth(1).rect(50, y, doc.page.width - 100, 22).stroke();
    doc.fillColor("#94a3b8").fontSize(8).font("Helvetica-Bold");
    doc.text("DESCRIPTION", 58, y + 7);
    doc.text("UNIT PRICE", 300, y + 7);
    doc.text("QTY", 390, y + 7);
    doc.text("AMOUNT", doc.page.width - 120, y + 7, { width: 70, align: "right" });
    y += 22;

    // ── Product row ───────────────────────────────────────────
    doc.strokeColor("#f1f5f9").lineWidth(0.5).moveTo(50, y).lineTo(doc.page.width - 50, y).stroke();
    doc.fillColor("#1e293b").fontSize(10).font("Helvetica-Bold").text(data.productName, 58, y + 8);
    doc.fillColor("#64748b").fontSize(9).font("Helvetica").text(data.variantName, 58, y + 20);
    doc.fillColor("#1e293b").fontSize(10).font("Helvetica").text(`NPR ${data.unitPrice.toLocaleString("en-NP", { minimumFractionDigits: 2 })}`, 300, y + 8);
    doc.text(String(data.quantity.toLocaleString()), 390, y + 8);
    doc.font("Helvetica-Bold").text(`NPR ${baseTotal.toLocaleString("en-NP", { minimumFractionDigits: 2 })}`, doc.page.width - 120, y + 8, { width: 70, align: "right" });
    y += 36;

    // ── Discount row ──────────────────────────────────────────
    if (data.discountAmount > 0) {
      doc.strokeColor("#f1f5f9").lineWidth(0.5).moveTo(50, y).lineTo(doc.page.width - 50, y).stroke();
      doc.fillColor("#15803d").fontSize(10).font("Helvetica").text("Discount", 58, y + 8);
      doc.text(`− NPR ${data.discountAmount.toLocaleString("en-NP", { minimumFractionDigits: 2 })}`, doc.page.width - 120, y + 8, { width: 70, align: "right" });
      y += 28;
    }

    // ── Design surcharge row ──────────────────────────────────
    if (data.designSurcharge > 0) {
      doc.strokeColor("#f1f5f9").lineWidth(0.5).moveTo(50, y).lineTo(doc.page.width - 50, y).stroke();
      doc.fillColor("#6366f1").fontSize(10).font("Helvetica").text(`Design Surcharge${data.designCode ? ` (${data.designCode})` : ""}`, 58, y + 8);
      doc.text(`+ NPR ${data.designSurcharge.toLocaleString("en-NP", { minimumFractionDigits: 2 })}`, doc.page.width - 120, y + 8, { width: 70, align: "right" });
      y += 28;
    }

    // ── Total row ─────────────────────────────────────────────
    doc.rect(50, y, doc.page.width - 100, 30).fill("#0f172a");
    doc.fillColor("#e2e8f0").fontSize(10).font("Helvetica-Bold").text("TOTAL AMOUNT", 58, y + 9);
    doc.fillColor("#fbbf24").fontSize(14).font("Helvetica-Bold").text(`NPR ${data.finalAmount.toLocaleString("en-NP", { minimumFractionDigits: 2 })}`, doc.page.width - 120, y + 8, { width: 70, align: "right" });
    y += 45;

    // ── Print specs ───────────────────────────────────────────
    if (data.configurations.length > 0) {
      doc.rect(50, y, doc.page.width - 100, 18).fill("#f8fafc");
      doc.strokeColor("#e2e8f0").lineWidth(0.5).rect(50, y, doc.page.width - 100, 18).stroke();
      doc.fillColor("#94a3b8").fontSize(8).font("Helvetica-Bold").text("PRINT SPECIFICATIONS", 58, y + 5);
      y += 18;
      for (const c of data.configurations) {
        doc.strokeColor("#f1f5f9").lineWidth(0.3).moveTo(50, y).lineTo(doc.page.width - 50, y).stroke();
        doc.fillColor("#64748b").fontSize(9).font("Helvetica").text(c.group_label, 58, y + 5);
        doc.fillColor("#1e293b").font("Helvetica-Bold").text(c.selected_label, 250, y + 5);
        y += 20;
      }
      y += 5;
    }

    // ── Notes ─────────────────────────────────────────────────
    if (data.notes) {
      doc.rect(50, y, doc.page.width - 100, 40).fill("#fffbeb").stroke();
      doc.fillColor("#d97706").fontSize(8).font("Helvetica-Bold").text("REMARKS", 58, y + 5);
      doc.fillColor("#78350f").fontSize(9).font("Helvetica").text(data.notes, 58, y + 17, { width: doc.page.width - 120 });
      y += 50;
    }

    // ── Terms & Conditions ────────────────────────────────────
    y += 8;
    doc.rect(50, y, doc.page.width - 100, 16).fill("#f8fafc");
    doc.strokeColor("#e2e8f0").lineWidth(0.5).rect(50, y, doc.page.width - 100, 16).stroke();
    doc.fillColor("#94a3b8").fontSize(7).font("Helvetica-Bold").text("TERMS & CONDITIONS", 58, y + 4.5);
    y += 16;
    const tcLines = [
      "1. B2B only — orders accepted from registered printing presses and trade partners. Full legal responsibility for content rests with the submitting party.",
      "2. Exact colour matching between separate print runs is not guaranteed without a saved Job Profile.",
      "3. Liability ceases upon dispatch. Risk of loss or damage transfers to the Client or nominated delivery agent once the order leaves our premises.",
      "4. Maximum liability shall not exceed the invoice value of the disputed order. No liability for indirect losses or consequential damages.",
      "5. All disputes are subject to the exclusive jurisdiction of the competent courts of Rupandehi District, Nepal.",
    ];
    doc.fillColor("#94a3b8").fontSize(7).font("Helvetica");
    for (const line of tcLines) {
      doc.text(line, 58, y, { width: doc.page.width - 116 });
      y += doc.currentLineHeight() + 2;
    }
    y += 6;

    // ── Footer ────────────────────────────────────────────────
    doc.fillColor("#94a3b8").fontSize(9).font("Helvetica").text("New Mankamana Printers — Professional Printing Services", 50, y + 10, { align: "center", width: doc.page.width - 100 });

    doc.end();
  });
}
