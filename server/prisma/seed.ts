import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

const buildCombinationKey = (selectedOptions: Record<string, string>) => {
  const entries = Object.entries(selectedOptions).sort(([left], [right]) => left.localeCompare(right));
  return entries.length === 0
    ? "__NO_OPTIONS__"
    : JSON.stringify(Object.fromEntries(entries));
};

async function ensureRecord<T extends { id: string }>(
  findExisting: () => Promise<T | null>,
  createRecord: () => Promise<T>,
  updateRecord?: (existing: T) => Promise<T>
) {
  const existing = await findExisting();

  if (!existing) {
    return createRecord();
  }

  return updateRecord ? updateRecord(existing) : existing;
}

async function assertSeedSchema() {
  const [combinationKeyColumn] = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'variant_pricing'
        AND column_name = 'combination_key'
    ) AS "exists"
  `;

  if (!combinationKeyColumn?.exists) {
    throw new Error(
      "Database schema is missing variant_pricing.combination_key. Apply the pending Prisma migration `20260328130500_generic_variant_pricing_and_payment_method_text` and rerun `npm run seed`."
    );
  }
}

async function main() {
  console.log("Starting ultimate comprehensive database seeding...");
  await assertSeedSchema();
  const hashedClientPassword = await bcrypt.hash("password123", 10);

  // 1. Admin setup
  const adminEmail = process.env.ADMIN_EMAIL || "admin@manakamana.com";
  const adminPassword = process.env.ADMIN_PASSWORD || "admin@123";
  const admin = await prisma.adminUser.upsert({
    where: { email: adminEmail },
    update: {
      name: "Super Admin",
      password: adminPassword,
      role: "ADMIN"
    },
    create: {
      name: "Super Admin",
      email: adminEmail,
      password: adminPassword,
      role: "ADMIN"
    }
  });

  // 2. Company Payment Details
  const companyPayment = await ensureRecord(
    () => prisma.companyPaymentDetail.findFirst({ where: { accountNumber: "0010000000001" } }),
    () =>
      prisma.companyPaymentDetail.create({
        data: {
          companyName: "New Mankamana Printers",
          bankName: "Global IME Bank",
          accountName: "New Mankamana Printers",
          accountNumber: "0010000000001",
          branch: "Kathmandu Branch",
          note: "Primary Bank Account",
          isActive: true,
          createdById: admin.id
        }
      }),
    (existing) =>
      prisma.companyPaymentDetail.update({
        where: { id: existing.id },
        data: {
          companyName: "New Mankamana Printers",
          bankName: "Global IME Bank",
          accountName: "New Mankamana Printers",
          accountNumber: "0010000000001",
          branch: "Kathmandu Branch",
          note: "Primary Bank Account",
          isActive: true,
          createdById: admin.id
        }
      })
  );

  // 3. Client Registration Request (Pending)
  await prisma.registrationRequest.upsert({
    where: { phone_number: "9812345678" },
    update: {
      business_name: "Future Print Shop",
      owner_name: "Alice Smith",
      email: "alice@futureprint.com",
      business_address: "Pokhara, Nepal",
      notes: "Looking to become a partner",
      status: "PENDING",
      rejection_reason: null
    },
    create: {
      business_name: "Future Print Shop",
      owner_name: "Alice Smith",
      email: "alice@futureprint.com",
      phone_number: "9812345678",
      business_address: "Pokhara, Nepal",
      notes: "Looking to become a partner",
      status: "PENDING"
    }
  });

  // 4. Client & Wallet setup
  const client = await prisma.client.upsert({
    where: { phone_number: "9800000000" },
    update: {
      password: hashedClientPassword,
      business_name: "Demo Print Shop",
      owner_name: "Demo User",
      email: "demo@example.com",
      address: "Kathmandu",
      status: "active"
    },
    create: {
      phone_number: "9800000000",
      password: hashedClientPassword,
      business_name: "Demo Print Shop",
      owner_name: "Demo User",
      email: "demo@example.com",
      address: "Kathmandu",
      status: "active"
    }
  });

  const walletAccount = await prisma.walletAccount.upsert({
    where: { clientId: client.id },
    update: {
      currency: "NPR",
      availableBalance: 15000.0
    },
    create: {
      clientId: client.id,
      currency: "NPR",
      availableBalance: 15000.00
    }
  });

  const walletTransaction = await ensureRecord(
    () =>
      prisma.walletTransaction.findFirst({
        where: {
          clientId: client.id,
          source: "ADJUSTMENT",
          sourceId: "SEED-INIT"
        }
      }),
    () =>
      prisma.walletTransaction.create({
        data: {
          walletId: walletAccount.id,
          clientId: client.id,
          type: "CREDIT",
          source: "ADJUSTMENT",
          sourceId: "SEED-INIT",
          amount: 15000.0,
          balanceBefore: 0.0,
          balanceAfter: 15000.0,
          description: "Initial seed balance"
        }
      }),
    (existing) =>
      prisma.walletTransaction.update({
        where: { id: existing.id },
        data: {
          walletId: walletAccount.id,
          clientId: client.id,
          type: "CREDIT",
          source: "ADJUSTMENT",
          sourceId: "SEED-INIT",
          amount: 15000.0,
          balanceBefore: 0.0,
          balanceAfter: 15000.0,
          description: "Initial seed balance"
        }
      })
  );

  // 5. Wallet Topup Request
  const topupRequest = await ensureRecord(
    () =>
      prisma.walletTopupRequest.findFirst({
        where: {
          clientId: client.id,
          transferReference: "REF-987654321"
        }
      }),
    () =>
      prisma.walletTopupRequest.create({
        data: {
          walletId: walletAccount.id,
          clientId: client.id,
          submittedAmount: 5000.0,
          paymentMethod: "BANK_TRANSFER",
          transferReference: "REF-987654321",
          note: "Topup for upcoming orders",
          proofFilePath: "wallet-proofs/sample.jpg",
          proofFileName: "sample.jpg",
          proofMimeType: "image/jpeg",
          proofFileSize: 102400,
          status: "PENDING_REVIEW"
        }
      }),
    (existing) =>
      prisma.walletTopupRequest.update({
        where: { id: existing.id },
        data: {
          walletId: walletAccount.id,
          clientId: client.id,
          submittedAmount: 5000.0,
          approvedAmount: null,
          paymentMethod: "BANK_TRANSFER",
          transferReference: "REF-987654321",
          note: "Topup for upcoming orders",
          proofFilePath: "wallet-proofs/sample.jpg",
          proofFileName: "sample.jpg",
          proofMimeType: "image/jpeg",
          proofFileSize: 102400,
          status: "PENDING_REVIEW",
          rejectionReason: null,
          rejectionCode: null,
          reviewedById: null,
          reviewedAt: null
        }
      })
  );

  // 6. Template Category & Template
  const templateCat = await prisma.templateCategory.upsert({
    where: { slug: "business-cards-templates" },
    update: {
      name: "Business Card Templates"
    },
    create: {
      name: "Business Card Templates",
      slug: "business-cards-templates"
    }
  });

  const template = await ensureRecord(
    () =>
      prisma.template.findFirst({
        where: {
          categoryId: templateCat.id,
          title: "Corporate Blue Minimal"
        }
      }),
    () =>
      prisma.template.create({
        data: {
          title: "Corporate Blue Minimal",
          description: "A clean blue corporate template",
          categoryId: templateCat.id,
          fileUrl: "https://images.unsplash.com/photo-1589047913349-2e6fb543b593",
          isActive: true
        }
      }),
    (existing) =>
      prisma.template.update({
        where: { id: existing.id },
        data: {
          title: "Corporate Blue Minimal",
          description: "A clean blue corporate template",
          categoryId: templateCat.id,
          fileUrl: "https://images.unsplash.com/photo-1589047913349-2e6fb543b593",
          isActive: true
        }
      })
  );

  // 7. Product Category, Product & Variant
  const productCat = await prisma.productCategory.upsert({
    where: { slug: "business-cards" },
    update: {
      name: "Business Cards",
      description: "Premium quality custom business cards",
      image_url: "https://images.unsplash.com/photo-1589047913349-2e6fb543b593"
    },
    create: {
      name: "Business Cards",
      slug: "business-cards",
      description: "Premium quality custom business cards",
      image_url: "https://images.unsplash.com/photo-1589047913349-2e6fb543b593"
    }
  });

  const product = await prisma.product.upsert({
    where: { product_code: "PRD-BC-001" },
    update: {
      category_id: productCat.id,
      name: "Standard Business Card",
      description: "300gsm Standard paper Business card",
      production_days: 3,
      image_url: "https://images.unsplash.com/photo-1589047913349-2e6fb543b593"
    },
    create: {
      product_code: "PRD-BC-001",
      category_id: productCat.id,
      name: "Standard Business Card",
      description: "300gsm Standard paper Business card",
      production_days: 3,
      image_url: "https://images.unsplash.com/photo-1589047913349-2e6fb543b593"
    }
  });

  const variant = await prisma.productVariant.upsert({
    where: { variant_code: "VAR-BC-STD" },
    update: {
      product_id: product.id,
      variant_name: "Standard Size (3.5 x 2)",
      min_quantity: 100
    },
    create: {
      product_id: product.id,
      variant_code: "VAR-BC-STD",
      variant_name: "Standard Size (3.5 x 2)",
      min_quantity: 100
    }
  });

  // 8. Option Groups & Values
  const groupPaperQuality = await ensureRecord(
    () =>
      prisma.optionGroup.findFirst({
        where: {
          variant_id: variant.id,
          name: "paper_quality"
        }
      }),
    () =>
      prisma.optionGroup.create({
        data: {
          variant_id: variant.id,
          name: "paper_quality",
          label: "Paper Quality",
          display_order: 1,
          is_required: true
        }
      }),
    (existing) =>
      prisma.optionGroup.update({
        where: { id: existing.id },
        data: {
          variant_id: variant.id,
          name: "paper_quality",
          label: "Paper Quality",
          display_order: 1,
          is_required: true
        }
      })
  );

  await ensureRecord(
    () =>
      prisma.optionValue.findFirst({
        where: {
          group_id: groupPaperQuality.id,
          code: "300GSM"
        }
      }),
    () =>
      prisma.optionValue.create({
        data: { group_id: groupPaperQuality.id, code: "300GSM", label: "300 GSM Standard", display_order: 1 }
      }),
    (existing) =>
      prisma.optionValue.update({
        where: { id: existing.id },
        data: { group_id: groupPaperQuality.id, code: "300GSM", label: "300 GSM Standard", display_order: 1 }
      })
  );

  await ensureRecord(
    () =>
      prisma.optionValue.findFirst({
        where: {
          group_id: groupPaperQuality.id,
          code: "350GSM"
        }
      }),
    () =>
      prisma.optionValue.create({
        data: { group_id: groupPaperQuality.id, code: "350GSM", label: "350 GSM Premium", display_order: 2 }
      }),
    (existing) =>
      prisma.optionValue.update({
        where: { id: existing.id },
        data: { group_id: groupPaperQuality.id, code: "350GSM", label: "350 GSM Premium", display_order: 2 }
      })
  );

  // 9. Variant Pricing
  const standardPaperOptions = { paper_quality: "300GSM" };
  await ensureRecord(
    () =>
      prisma.variantPricing.findFirst({
        where: {
          variant_id: variant.id,
          combination_key: buildCombinationKey(standardPaperOptions)
        }
      }),
    () =>
      prisma.variantPricing.create({
        data: {
          variant_id: variant.id,
          combination_key: buildCombinationKey(standardPaperOptions),
          selected_options: standardPaperOptions,
          price: 15.0,
          is_active: true,
          discount_type: null,
          discount_value: 0
        }
      }),
    (existing) =>
      prisma.variantPricing.update({
        where: { id: existing.id },
        data: {
          variant_id: variant.id,
          combination_key: buildCombinationKey(standardPaperOptions),
          selected_options: standardPaperOptions,
          price: 15.0,
          is_active: true,
          discount_type: null,
          discount_value: 0
        }
      })
  );

  const premiumPaperOptions = { paper_quality: "350GSM" };
  await ensureRecord(
    () =>
      prisma.variantPricing.findFirst({
        where: {
          variant_id: variant.id,
          combination_key: buildCombinationKey(premiumPaperOptions)
        }
      }),
    () =>
      prisma.variantPricing.create({
        data: {
          variant_id: variant.id,
          combination_key: buildCombinationKey(premiumPaperOptions),
          selected_options: premiumPaperOptions,
          price: 20.0,
          is_active: true,
          discount_type: "fixed",
          discount_value: 2
        }
      }),
    (existing) =>
      prisma.variantPricing.update({
        where: { id: existing.id },
        data: {
          variant_id: variant.id,
          combination_key: buildCombinationKey(premiumPaperOptions),
          selected_options: premiumPaperOptions,
          price: 20.0,
          is_active: true,
          discount_type: "fixed",
          discount_value: 2
        }
      })
  );

  // 10. Design Submission & Approved Design
  const submission = await ensureRecord(
    () =>
      prisma.designSubmission.findFirst({
        where: {
          clientId: client.id,
          title: "My Custom Business Card"
        }
      }),
    () =>
      prisma.designSubmission.create({
        data: {
          clientId: client.id,
          templateId: template.id,
          title: "My Custom Business Card",
          notes: "Please make sure colors pop",
          fileUrl: "https://images.unsplash.com/photo-1589047913349-2e6fb543b593",
          fileType: "image/jpeg",
          fileSize: 500000,
          status: "APPROVED",
          reviewedBy_id: admin.id,
          reviewedAt: new Date()
        }
      }),
    (existing) =>
      prisma.designSubmission.update({
        where: { id: existing.id },
        data: {
          clientId: client.id,
          templateId: template.id,
          title: "My Custom Business Card",
          notes: "Please make sure colors pop",
          fileUrl: "https://images.unsplash.com/photo-1589047913349-2e6fb543b593",
          fileType: "image/jpeg",
          fileSize: 500000,
          status: "APPROVED",
          feedbackMessage: null,
          reviewedBy_id: admin.id,
          reviewedAt: new Date()
        }
      })
  );

  const approvedDesign = await prisma.approvedDesign.upsert({
    where: { designCode: "DSN-2026-000001" },
    update: {
      clientId: client.id,
      submissionId: submission.id,
      approvedFileUrl: submission.fileUrl,
      status: "ACTIVE",
      approvedBy_id: admin.id,
      archivedBy_id: null,
      archivedAt: null,
      archiveReason: null
    },
    create: {
      designCode: "DSN-2026-000001",
      clientId: client.id,
      submissionId: submission.id,
      approvedFileUrl: submission.fileUrl,
      status: "ACTIVE",
      approvedBy_id: admin.id
    }
  });

  // Update submission with approvedDesignId
  await prisma.designSubmission.update({
    where: { id: submission.id },
    data: { approvedDesignId: approvedDesign.id }
  });

  // 11. Order & Order Configuration
  const order = await ensureRecord(
    () =>
      prisma.order.findFirst({
        where: {
          user_id: client.id,
          variant_id: variant.id,
          designId: approvedDesign.id,
          notes: "Deliver by Monday"
        }
      }),
    () =>
      prisma.order.create({
        data: {
          user_id: client.id,
          variant_id: variant.id,
          quantity: 500,
          unit_price: 15.0,
          total_amount: 7500.0,
          discount_type: null,
          discount_value: 0,
          discount_amount: 0,
          final_amount: 7500.0,
          status: "ORDER_PLACED",
          payment_status: "PAID",
          notes: "Deliver by Monday",
          designId: approvedDesign.id,
          pricing_snapshot: { selectedOptions: standardPaperOptions },
          configurations: {
            create: [
              {
                group_name: "paper_quality",
                group_label: "Paper Quality",
                selected_code: "300GSM",
                selected_label: "300 GSM Standard"
              }
            ]
          }
        }
      }),
    (existing) =>
      prisma.order.update({
        where: { id: existing.id },
        data: {
          user_id: client.id,
          variant_id: variant.id,
          quantity: 500,
          unit_price: 15.0,
          total_amount: 7500.0,
          discount_type: null,
          discount_value: 0,
          discount_amount: 0,
          final_amount: 7500.0,
          status: "ORDER_PLACED",
          payment_status: "PAID",
          notes: "Deliver by Monday",
          designId: approvedDesign.id,
          pricing_snapshot: { selectedOptions: standardPaperOptions },
          configurations: {
            deleteMany: {},
            create: [
              {
                group_name: "paper_quality",
                group_label: "Paper Quality",
                selected_code: "300GSM",
                selected_label: "300 GSM Standard"
              }
            ]
          }
        }
      })
  );

  // Link Wallet Transaction for the Order
  const orderWalletTxn = await ensureRecord(
    () =>
      prisma.walletTransaction.findFirst({
        where: {
          clientId: client.id,
          source: "ORDER",
          sourceId: order.id
        }
      }),
    () =>
      prisma.walletTransaction.create({
        data: {
          walletId: walletAccount.id,
          clientId: client.id,
          type: "DEBIT",
          source: "ORDER",
          sourceId: order.id,
          amount: 7500.0,
          balanceBefore: 15000.0,
          balanceAfter: 7500.0,
          description: "Payment for Order " + order.id
        }
      }),
    (existing) =>
      prisma.walletTransaction.update({
        where: { id: existing.id },
        data: {
          walletId: walletAccount.id,
          clientId: client.id,
          type: "DEBIT",
          source: "ORDER",
          sourceId: order.id,
          amount: 7500.0,
          balanceBefore: 15000.0,
          balanceAfter: 7500.0,
          description: "Payment for Order " + order.id
        }
      })
  );

  await prisma.order.update({
    where: { id: order.id },
    data: { walletTransactionId: orderWalletTxn.id }
  });

  // Update client wallet balance
  await prisma.walletAccount.update({
    where: { id: walletAccount.id },
    data: { availableBalance: 7500.00 }
  });

  // 12. Notification
  await ensureRecord(
    () =>
      prisma.notification.findFirst({
        where: {
          recipientRole: "CLIENT",
          recipientId: client.id,
          type: "ORDER_PLACED",
          referenceId: order.id
        }
      }),
    () =>
      prisma.notification.create({
        data: {
          recipientRole: "CLIENT",
          recipientId: client.id,
          clientId: client.id,
          type: "ORDER_PLACED",
          title: "Order Placed Successfully",
          message: "Your order for Standard Business Card has been placed.",
          referenceId: order.id,
          isRead: false
        }
      }),
    (existing) =>
      prisma.notification.update({
        where: { id: existing.id },
        data: {
          recipientRole: "CLIENT",
          recipientId: client.id,
          clientId: client.id,
          type: "ORDER_PLACED",
          title: "Order Placed Successfully",
          message: "Your order for Standard Business Card has been placed.",
          referenceId: order.id,
          isRead: false,
          readAt: null
        }
      })
  );

  // 13. Printing Services
  await ensureRecord(
    () => prisma.printingService.findFirst({ where: { name: "A4 Normal Print" } }),
    () =>
      prisma.printingService.create({
        data: {
          name: "A4 Normal Print",
          description: "Standard copy paper print",
          basePrice: 5.0,
          isActive: true
        }
      }),
    (existing) =>
      prisma.printingService.update({
        where: { id: existing.id },
        data: {
          name: "A4 Normal Print",
          description: "Standard copy paper print",
          basePrice: 5.0,
          isActive: true
        }
      })
  );

  console.log("Database seeded successfully with ALL models populated!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
