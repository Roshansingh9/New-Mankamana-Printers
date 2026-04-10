import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_PASSWORD,
  },
});

const FROM = `"New Mankamana Printers" <${process.env.SMTP_EMAIL}>`;

// sendClientCredentials: Sends login credentials to a newly approved client
export const sendClientCredentials = async (opts: {
  to: string;
  businessName: string;
  clientCode: string;
  phoneNumber: string;
  password: string;
}) => {
  const { to, businessName, clientCode, phoneNumber, password } = opts;

  await transporter.sendMail({
    from: FROM,
    to,
    subject: "Your New Mankamana Printers Account is Ready",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b;">
        <div style="background: #0061FF; padding: 32px 40px;">
          <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700;">New Mankamana Printers</h1>
        </div>
        <div style="padding: 40px; border: 1px solid #e2e8f0; border-top: none;">
          <h2 style="font-size: 20px; margin: 0 0 8px;">Welcome, ${businessName}</h2>
          <p style="color: #64748b; margin: 0 0 32px;">Your registration has been approved. Use the credentials below to log in to your account.</p>

          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px; margin-bottom: 32px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 13px; width: 140px;">Client Code</td>
                <td style="padding: 8px 0; font-weight: 600; font-size: 15px;">${clientCode}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 13px;">Login ID (Phone)</td>
                <td style="padding: 8px 0; font-weight: 600; font-size: 15px;">${phoneNumber}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 13px;">Password</td>
                <td style="padding: 8px 0; font-weight: 700; font-size: 18px; letter-spacing: 2px; color: #0061FF;">${password}</td>
              </tr>
            </table>
          </div>

          <p style="color: #94a3b8; font-size: 13px; margin: 0;">
            Please keep your credentials safe. If you have any issues logging in, contact us at
            <a href="mailto:${process.env.SMTP_EMAIL}" style="color: #0061FF;">${process.env.SMTP_EMAIL}</a>.
          </p>
        </div>
        <div style="padding: 20px 40px; background: #f8fafc; border: 1px solid #e2e8f0; border-top: none; text-align: center;">
          <p style="margin: 0; color: #94a3b8; font-size: 12px;">New Mankamana Printers &mdash; Professional Printing Services</p>
        </div>
      </div>
    `,
  });
};

// sendPasswordReset: Notifies a client that their password has been reset by the admin
export const sendPasswordReset = async (opts: {
  to: string;
  ownerName: string;
  businessName: string;
  phoneNumber: string;
  newPassword: string;
}) => {
  const { to, ownerName, businessName, phoneNumber, newPassword } = opts;

  await transporter.sendMail({
    from: FROM,
    to,
    subject: "Your New Mankamana Printers Password Has Been Reset",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b;">
        <div style="background: #0061FF; padding: 32px 40px;">
          <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700;">New Mankamana Printers</h1>
        </div>
        <div style="padding: 40px; border: 1px solid #e2e8f0; border-top: none;">
          <h2 style="font-size: 20px; margin: 0 0 8px;">Password Reset</h2>
          <p style="color: #64748b; margin: 0 0 8px;">Hi ${ownerName},</p>
          <p style="color: #64748b; margin: 0 0 32px;">
            The password for your <strong>${businessName}</strong> account has been reset by the admin.
            Use the new credentials below to log in.
          </p>

          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px; margin-bottom: 32px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 13px; width: 140px;">Login ID (Phone)</td>
                <td style="padding: 8px 0; font-weight: 600; font-size: 15px;">${phoneNumber}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 13px;">New Password</td>
                <td style="padding: 8px 0; font-weight: 700; font-size: 22px; letter-spacing: 4px; color: #0061FF;">${newPassword}</td>
              </tr>
            </table>
          </div>

          <p style="color: #64748b; margin: 0 0 8px;">Please log in and keep your new password safe.</p>
          <p style="color: #94a3b8; font-size: 13px; margin: 0;">
            If you did not request this reset, contact us immediately at
            <a href="mailto:${process.env.SMTP_EMAIL}" style="color: #0061FF;">${process.env.SMTP_EMAIL}</a>.
          </p>
        </div>
        <div style="padding: 20px 40px; background: #f8fafc; border: 1px solid #e2e8f0; border-top: none; text-align: center;">
          <p style="margin: 0; color: #94a3b8; font-size: 12px;">New Mankamana Printers &mdash; Professional Printing Services</p>
        </div>
      </div>
    `,
  });
};

// sendDesignApproved: Notifies client their design has been approved and provides the design ID
export const sendDesignApproved = async (opts: {
  to: string;
  businessName: string;
  designCode: string;
  designTitle?: string;
}) => {
  const { to, businessName, designCode, designTitle } = opts;

  await transporter.sendMail({
    from: FROM,
    to,
    subject: `Design Approved — Your Design ID: ${designCode}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b;">
        <div style="background: #0061FF; padding: 32px 40px;">
          <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700;">New Mankamana Printers</h1>
        </div>
        <div style="padding: 40px; border: 1px solid #e2e8f0; border-top: none;">
          <h2 style="font-size: 20px; margin: 0 0 8px;">Design Approved</h2>
          <p style="color: #64748b; margin: 0 0 8px;">Hi ${businessName},</p>
          <p style="color: #64748b; margin: 0 0 32px;">
            ${designTitle ? `Your design "<strong>${designTitle}</strong>" has been reviewed and approved.` : "Your design submission has been reviewed and approved."}
            Use the Design ID below when placing your print order.
          </p>

          <div style="background: #eff6ff; border: 2px solid #0061FF; border-radius: 8px; padding: 28px; text-align: center; margin-bottom: 32px;">
            <p style="margin: 0 0 8px; color: #64748b; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">Your Design ID</p>
            <p style="margin: 0; font-size: 28px; font-weight: 800; letter-spacing: 4px; color: #0061FF;">${designCode}</p>
          </div>

          <p style="color: #64748b; margin: 0 0 8px;">To use your design:</p>
          <ol style="color: #64748b; margin: 0 0 32px; padding-left: 20px; line-height: 1.8;">
            <li>Log in to your account</li>
            <li>Go to Place Order</li>
            <li>Enter your Design ID <strong>${designCode}</strong> in the checkout form</li>
          </ol>

          <p style="color: #94a3b8; font-size: 13px; margin: 0;">
            Questions? Contact us at
            <a href="mailto:${process.env.SMTP_EMAIL}" style="color: #0061FF;">${process.env.SMTP_EMAIL}</a>.
          </p>
        </div>
        <div style="padding: 20px 40px; background: #f8fafc; border: 1px solid #e2e8f0; border-top: none; text-align: center;">
          <p style="margin: 0; color: #94a3b8; font-size: 12px;">New Mankamana Printers &mdash; Professional Printing Services</p>
        </div>
      </div>
    `,
  });
};

// ── Order status helpers ──────────────────────────────────────────────────────

const ORDER_STATUS_META: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  ORDER_PLACED:     { label: "Order Placed",     color: "#475569", bg: "#f1f5f9", icon: "📋" },
  ORDER_PROCESSING: { label: "Order Processing", color: "#1d4ed8", bg: "#eff6ff", icon: "⚙️" },
  ORDER_PREPARED:   { label: "Order Prepared",   color: "#7c3aed", bg: "#f5f3ff", icon: "✅" },
  ORDER_DISPATCHED: { label: "Order Dispatched", color: "#b45309", bg: "#fffbeb", icon: "🚚" },
  ORDER_DELIVERED:  { label: "Order Delivered",  color: "#15803d", bg: "#f0fdf4", icon: "🎉" },
  ORDER_CANCELLED:  { label: "Order Cancelled",  color: "#b91c1c", bg: "#fef2f2", icon: "✕"  },
};

function statusBadge(status: string): string {
  const m = ORDER_STATUS_META[status] ?? { label: status, color: "#475569", bg: "#f1f5f9", icon: "•" };
  return `<span style="display:inline-block;background:${m.bg};color:${m.color};border-radius:50px;padding:4px 14px;font-size:13px;font-weight:700;">${m.icon} ${m.label}</span>`;
}

// sendOrderPlaced: Sends order confirmation immediately after a client places an order
export const sendOrderPlaced = async (opts: {
  to: string;
  businessName: string;
  orderId: string;
  productName: string;
  variantName: string;
  quantity: number;
  finalAmount: number;
}) => {
  const { to, businessName, orderId, productName, variantName, quantity, finalAmount } = opts;

  await transporter.sendMail({
    from: FROM,
    to,
    subject: `Order Confirmed — #${orderId.slice(0, 8).toUpperCase()}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1e293b;">
        <div style="background:#0061FF;padding:32px 40px;">
          <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700;">New Mankamana Printers</h1>
        </div>
        <div style="padding:40px;border:1px solid #e2e8f0;border-top:none;">
          <h2 style="font-size:20px;margin:0 0 6px;">Order Confirmed 📋</h2>
          <p style="color:#64748b;margin:0 0 28px;">Hi ${businessName}, your order has been received and will begin processing shortly.</p>

          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:24px;margin-bottom:28px;">
            <table style="width:100%;border-collapse:collapse;">
              <tr><td style="padding:7px 0;color:#64748b;font-size:13px;width:150px;">Order ID</td><td style="padding:7px 0;font-weight:700;font-family:monospace;">#${orderId.slice(0, 8).toUpperCase()}</td></tr>
              <tr><td style="padding:7px 0;color:#64748b;font-size:13px;">Product</td><td style="padding:7px 0;font-weight:600;">${productName} — ${variantName}</td></tr>
              <tr><td style="padding:7px 0;color:#64748b;font-size:13px;">Quantity</td><td style="padding:7px 0;font-weight:600;">${quantity.toLocaleString()}</td></tr>
              <tr><td style="padding:7px 0;color:#64748b;font-size:13px;">Total Amount</td><td style="padding:7px 0;font-weight:700;font-size:16px;color:#0061FF;">NPR ${Number(finalAmount).toLocaleString("en-NP", { minimumFractionDigits: 2 })}</td></tr>
              <tr><td style="padding:7px 0;color:#64748b;font-size:13px;">Status</td><td style="padding:8px 0;">${statusBadge("ORDER_PLACED")}</td></tr>
            </table>
          </div>

          <p style="color:#64748b;margin:0 0 8px;">You will receive email updates as your order status changes. Track your order anytime by logging into your account.</p>
          <p style="color:#94a3b8;font-size:13px;margin:0;">Questions? Contact us at <a href="mailto:${process.env.SMTP_EMAIL}" style="color:#0061FF;">${process.env.SMTP_EMAIL}</a>.</p>
        </div>
        <div style="padding:20px 40px;background:#f8fafc;border:1px solid #e2e8f0;border-top:none;text-align:center;">
          <p style="margin:0;color:#94a3b8;font-size:12px;">New Mankamana Printers &mdash; Professional Printing Services</p>
        </div>
      </div>
    `,
  });
};

// sendOrderStatusUpdate: Notifies a client whenever their order status changes
export const sendOrderStatusUpdate = async (opts: {
  to: string;
  businessName: string;
  orderId: string;
  productName: string;
  variantName: string;
  newStatus: string;
  expectedDeliveryDate?: Date | null;
}) => {
  const { to, businessName, orderId, productName, variantName, newStatus, expectedDeliveryDate } = opts;
  const meta = ORDER_STATUS_META[newStatus] ?? { label: newStatus, icon: "•" };

  const deliveryRow = expectedDeliveryDate
    ? `<tr><td style="padding:7px 0;color:#64748b;font-size:13px;">Est. Delivery</td><td style="padding:7px 0;font-weight:700;color:#15803d;">${new Date(expectedDeliveryDate).toLocaleDateString("en-NP", { day: "numeric", month: "long", year: "numeric" })}</td></tr>`
    : "";

  const statusMessage: Record<string, string> = {
    ORDER_PROCESSING: "Our team has started working on your order.",
    ORDER_PREPARED:   "Your order is fully prepared and ready for dispatch.",
    ORDER_DISPATCHED: "Your order is on its way! Delivery expected soon.",
    ORDER_DELIVERED:  "Your order has been delivered. Thank you for your business!",
    ORDER_CANCELLED:  "Your order has been cancelled. Please contact us if you have questions.",
  };

  await transporter.sendMail({
    from: FROM,
    to,
    subject: `Order Update: ${meta.icon} ${meta.label} — #${orderId.slice(0, 8).toUpperCase()}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1e293b;">
        <div style="background:#0061FF;padding:32px 40px;">
          <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700;">New Mankamana Printers</h1>
        </div>
        <div style="padding:40px;border:1px solid #e2e8f0;border-top:none;">
          <h2 style="font-size:20px;margin:0 0 6px;">Order Status Update</h2>
          <p style="color:#64748b;margin:0 0 28px;">Hi ${businessName}, your order status has been updated.</p>

          <div style="text-align:center;margin-bottom:28px;padding:20px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;">
            ${statusBadge(newStatus)}
            ${statusMessage[newStatus] ? `<p style="margin:12px 0 0;color:#475569;font-size:14px;">${statusMessage[newStatus]}</p>` : ""}
          </div>

          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:24px;margin-bottom:28px;">
            <table style="width:100%;border-collapse:collapse;">
              <tr><td style="padding:7px 0;color:#64748b;font-size:13px;width:150px;">Order ID</td><td style="padding:7px 0;font-weight:700;font-family:monospace;">#${orderId.slice(0, 8).toUpperCase()}</td></tr>
              <tr><td style="padding:7px 0;color:#64748b;font-size:13px;">Product</td><td style="padding:7px 0;font-weight:600;">${productName} — ${variantName}</td></tr>
              ${deliveryRow}
            </table>
          </div>

          <p style="color:#94a3b8;font-size:13px;margin:0;">Questions? Contact us at <a href="mailto:${process.env.SMTP_EMAIL}" style="color:#0061FF;">${process.env.SMTP_EMAIL}</a>.</p>
        </div>
        <div style="padding:20px 40px;background:#f8fafc;border:1px solid #e2e8f0;border-top:none;text-align:center;">
          <p style="margin:0;color:#94a3b8;font-size:12px;">New Mankamana Printers &mdash; Professional Printing Services</p>
        </div>
      </div>
    `,
  });
};

// sendDesignRejected: Notifies client their design was rejected and provides admin feedback
export const sendDesignRejected = async (opts: {
  to: string;
  businessName: string;
  designTitle?: string;
  feedbackMessage?: string;
}) => {
  const { to, businessName, designTitle, feedbackMessage } = opts;

  await transporter.sendMail({
    from: FROM,
    to,
    subject: "Design Submission Update — Action Required",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b;">
        <div style="background: #0061FF; padding: 32px 40px;">
          <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700;">New Mankamana Printers</h1>
        </div>
        <div style="padding: 40px; border: 1px solid #e2e8f0; border-top: none;">
          <h2 style="font-size: 20px; margin: 0 0 8px;">Design Needs Revision</h2>
          <p style="color: #64748b; margin: 0 0 8px;">Hi ${businessName},</p>
          <p style="color: #64748b; margin: 0 0 32px;">
            ${designTitle ? `Your design "<strong>${designTitle}</strong>" could not be approved at this time.` : "Your recent design submission could not be approved at this time."}
          </p>

          ${feedbackMessage ? `
          <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 20px; margin-bottom: 32px;">
            <p style="margin: 0 0 6px; font-size: 12px; color: #ef4444; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Feedback</p>
            <p style="margin: 0; color: #1e293b;">${feedbackMessage}</p>
          </div>
          ` : ""}

          <p style="color: #64748b; margin: 0 0 32px;">
            Please revise your design based on the feedback above and resubmit through your account.
          </p>

          <p style="color: #94a3b8; font-size: 13px; margin: 0;">
            Need help? Contact us at
            <a href="mailto:${process.env.SMTP_EMAIL}" style="color: #0061FF;">${process.env.SMTP_EMAIL}</a>.
          </p>
        </div>
        <div style="padding: 20px 40px; background: #f8fafc; border: 1px solid #e2e8f0; border-top: none; text-align: center;">
          <p style="margin: 0; color: #94a3b8; font-size: 12px;">New Mankamana Printers &mdash; Professional Printing Services</p>
        </div>
      </div>
    `,
  });
};
