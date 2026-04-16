import { Request, Response } from "express";
import { createPaymentDetailsService, getActivePaymentDetailsService } from "../../services/wallet/payment-details.service";
import { createPaymentDetailsSchema } from "../../validators/wallet.validator";
import { uploadToSupabasePath, deleteFromSupabase, getPublicUrlForPath, downloadFromSupabase } from "../../utils/file-upload";

// getPaymentDetails: Returns the currently active bank and QR payment information for clients to perform top-ups
export const getPaymentDetails = async (req: Request, res: Response) => {
  try {
    const details = await getActivePaymentDetailsService();
    if (!details) {
      return res.status(404).json({ success: false, message: "No active payment details found" });
    }

    // Generate QR URL dynamically from stored path.
    // getPublicUrlForPath auto-resolves the correct bucket from the path prefix
    // (e.g. "qr-codes/..." → product-assets bucket).
    // Legacy rows that already store a full URL are passed through unchanged.
    let qrImageUrl: string | null = details.qrImageUrl ?? null;
    if (qrImageUrl && !qrImageUrl.startsWith("http")) {
      qrImageUrl = getPublicUrlForPath(qrImageUrl);
    }

    res.setHeader("Cache-Control", "private, max-age=60");
    res.status(200).json({
      success: true,
      data: {
        companyName: details.companyName,
        bankName: details.bankName,
        accountName: details.accountName,
        accountNumber: details.accountNumber,
        branch: details.branch,
        paymentId: details.paymentId,
        qrImageUrl,
        note: details.note,
      },
    });
  } catch (error) {
    console.error("Error fetching payment details:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// getQrImage: Public proxy that downloads the active QR image from Supabase and streams it to the browser.
// This prevents browsers that cannot reach supabase.co directly (e.g. behind a local proxy) from failing.
export const getQrImage = async (req: Request, res: Response) => {
  try {
    const details = await getActivePaymentDetailsService();
    if (!details?.qrImageUrl) {
      return res.status(404).end();
    }

    const qrPath = details.qrImageUrl;

    // Legacy rows that stored a full URL: redirect (server-to-server fetch isn't blocked)
    if (qrPath.startsWith("http")) {
      return res.redirect(302, qrPath);
    }

    const { buffer, mimeType } = await downloadFromSupabase(qrPath);
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Cache-Control", "public, max-age=300, s-maxage=300");
    return res.send(buffer);
  } catch (error) {
    console.error("Error proxying QR image:", error);
    return res.status(500).end();
  }
};

// createPaymentDetails: Admin-only function to update the platform's official payment collection details
export const createPaymentDetails = async (req: Request, res: Response) => {
  try {
    const body = { ...req.body };

    // Fetch existing active record upfront — used both for QR deletion and preserving unchanged fields
    const existing = await getActivePaymentDetailsService();

    // If a QR image file was uploaded, store path (not full URL) so the URL can be generated dynamically
    if (req.file) {
      try {
        // Delete old QR if it's a stored path (not a legacy full URL)
        if (existing?.qrImageUrl && !existing.qrImageUrl.startsWith("http")) {
          await deleteFromSupabase(existing.qrImageUrl).catch(() => {});
        }
        const { path: qrPath } = await uploadToSupabasePath(req.file, "qr-codes");
        body.qrImageUrl = qrPath;
      } catch (uploadError: any) {
        return res.status(500).json({ success: false, message: "QR image upload failed", error: uploadError.message });
      }
    } else if (!body.qrImageUrl && existing?.qrImageUrl) {
      // No new QR uploaded — carry forward the existing QR path so it isn't lost
      body.qrImageUrl = existing.qrImageUrl;
    }

    // Merge missing required fields from the existing active record so partial saves work
    if (existing) {
      if (!body.companyName) body.companyName = existing.companyName;
      if (!body.bankName) body.bankName = existing.bankName;
      if (!body.accountName) body.accountName = existing.accountName;
      if (!body.accountNumber) body.accountNumber = existing.accountNumber;
      if (body.branch === undefined) body.branch = existing.branch;
      if (body.paymentId === undefined) body.paymentId = existing.paymentId;
      if (body.note === undefined) body.note = existing.note;
    }

    const validated = createPaymentDetailsSchema.safeParse(body);
    if (!validated.success) {
      const fieldErrors = validated.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      return res.status(400).json({ success: false, message: `Validation failed: ${fieldErrors}`, errors: validated.error.issues });
    }

    const adminId = (req as any).user.id;
    const details = await createPaymentDetailsService({ ...validated.data, adminId });

    res.status(201).json({
      success: true,
      message: "Payment details saved successfully",
      data: details,
    });
  } catch (error) {
    console.error("Error creating payment details:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
