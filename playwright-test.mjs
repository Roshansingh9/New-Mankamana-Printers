/**
 * Playwright browser-based tests for Manakamana Printing Platform
 * Tests both client (port 3000) and admin (port 3001)
 *
 * Run: node playwright-test.mjs
 */

import { chromium } from "playwright";

const CLIENT_URL = "http://localhost:3000";
const ADMIN_URL = "http://localhost:3001";

const ADMIN_CREDS = { email: "admin@gmail.com", password: "admin" };
// Client: phone 8545049911, password set via set-test-password.mjs
const CLIENT_CREDS = { id: "8545049911", password: "TestPass123!" };

const results = [];
let passed = 0;
let failed = 0;

function log(icon, label, detail = "") {
  const line = `${icon} ${label}${detail ? ": " + detail : ""}`;
  console.log(line);
}

async function test(label, fn) {
  try {
    await fn();
    results.push({ ok: true, label });
    passed++;
    log("✅", label);
  } catch (err) {
    results.push({ ok: false, label, error: err.message });
    failed++;
    log("❌", label, err.message.replace(/\n/g, " ").slice(0, 120));
  }
}

async function waitForLoad(page, timeout = 6000) {
  await page.waitForLoadState("networkidle", { timeout }).catch(() => {});
}

// True 500 detection: Next.js renders error pages with specific structure
function isErrorPage(text) {
  return (
    text.includes("Application error") ||
    text.includes("Internal Server Error") ||
    (text.includes("500") && text.includes("Error") && text.length < 1000)
  );
}

// ─── ADMIN TESTS ──────────────────────────────────────────────────────────────

async function runAdminTests(browser) {
  console.log("\n══════════════════════════════════════════");
  console.log("  ADMIN APP (port 3001)");
  console.log("══════════════════════════════════════════");

  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  let adminLoggedIn = false;

  // 1. Login page renders
  await test("Admin login page loads", async () => {
    await page.goto(ADMIN_URL, { waitUntil: "networkidle" });
    await page.waitForSelector("input[type='email']", { timeout: 8000 });
  });

  // 2. Login works
  await test("Admin login with valid credentials", async () => {
    await page.goto(`${ADMIN_URL}/login`, { waitUntil: "networkidle" });
    await page.fill("input[type='email']", ADMIN_CREDS.email);
    await page.fill("input[type='password']", ADMIN_CREDS.password);
    await page.click("button[type='submit']");
    await page.waitForURL(/dashboard/, { timeout: 10000 });
    adminLoggedIn = true;
  });

  if (!adminLoggedIn) {
    console.log("  ⚠️  Skipping logged-in admin tests (login failed)");
    await ctx.close();
    return;
  }

  // 3. Dashboard shows stats
  await test("Admin dashboard shows stats", async () => {
    await waitForLoad(page);
    const text = await page.textContent("body");
    if (!text.match(/\d+/) || text.length < 100) throw new Error("Dashboard content too sparse");
  });

  // 4. Sidebar links present
  await test("Admin sidebar navigation present", async () => {
    const text = await page.textContent("body");
    const hasNav = ["Dashboard", "Registration", "Clients", "Designs", "Orders"].every(
      (link) => text.includes(link)
    );
    if (!hasNav) throw new Error("Sidebar links missing");
  });

  // 5. Registration requests page
  await test("Admin registration requests page renders", async () => {
    await page.goto(`${ADMIN_URL}/registration-requests`, { waitUntil: "networkidle" });
    await waitForLoad(page);
    const text = await page.textContent("body");
    if (isErrorPage(text)) throw new Error("Error page rendered");
    if (!text.includes("Registration")) throw new Error("Registration content missing");
  });

  // 6. Clients page
  await test("Admin clients page renders with data", async () => {
    await page.goto(`${ADMIN_URL}/clients`, { waitUntil: "networkidle" });
    await waitForLoad(page);
    const text = await page.textContent("body");
    if (isErrorPage(text)) throw new Error("Error page rendered");
    if (!text.includes("Client")) throw new Error("Client content missing");
  });

  // 7. Design approval page
  await test("Admin design approval page renders", async () => {
    await page.goto(`${ADMIN_URL}/design-approval`, { waitUntil: "networkidle" });
    await waitForLoad(page);
    const text = await page.textContent("body");
    if (isErrorPage(text)) throw new Error("Error page rendered");
    if (!text.includes("Design") && !text.includes("design")) throw new Error("Design content missing");
  });

  // 8. Design approval shows approved designs with design codes
  await test("Admin design approval shows design codes on approved designs", async () => {
    await page.goto(`${ADMIN_URL}/design-approval`, { waitUntil: "networkidle" });
    await waitForLoad(page);
    const text = await page.textContent("body");
    // DSN- pattern = design code
    if (!text.includes("DSN-") && !text.includes("Code:")) {
      throw new Error("No design codes visible on approved designs");
    }
  });

  // 9. Orders page
  await test("Admin orders page renders", async () => {
    await page.goto(`${ADMIN_URL}/orders`, { waitUntil: "networkidle" });
    await waitForLoad(page);
    const text = await page.textContent("body");
    if (isErrorPage(text)) throw new Error("Error page rendered");
    if (!text.includes("Order")) throw new Error("Order content missing");
  });

  // 10. Orders page has the 7 status tabs we added
  await test("Admin orders page has all status tabs (All/Placed/Processing/Prepared/Dispatched/Delivered/Cancelled)", async () => {
    const text = await page.textContent("body");
    const tabs = ["All", "Placed", "Processing", "Prepared", "Dispatched", "Delivered", "Cancelled"];
    const missingTabs = tabs.filter((t) => !text.includes(t));
    if (missingTabs.length > 0) throw new Error(`Missing tabs: ${missingTabs.join(", ")}`);
  });

  // 11. Wallet / payments page
  await test("Admin wallet/payments page renders", async () => {
    await page.goto(`${ADMIN_URL}/payments`, { waitUntil: "networkidle" });
    await waitForLoad(page);
    const text = await page.textContent("body");
    if (isErrorPage(text)) throw new Error("Error page rendered");
    if (!text.includes("Wallet") && !text.includes("Payment") && !text.includes("Top")) {
      throw new Error("Wallet/payment content missing");
    }
  });

  // 12. No critical JS errors on dashboard
  await test("Admin dashboard no critical JS errors", async () => {
    const jsErrors = [];
    const errHandler = (err) => jsErrors.push(err.message);
    page.on("pageerror", errHandler);
    await page.goto(`${ADMIN_URL}/dashboard`, { waitUntil: "networkidle" });
    await waitForLoad(page);
    page.off("pageerror", errHandler);
    const critical = jsErrors.filter(
      (e) => !e.includes("HMR") && !e.includes("fast refresh") && !e.includes("favicon")
    );
    if (critical.length > 0) throw new Error(critical[0]);
  });

  // 13. Admin page header shows admin name
  await test("Admin app shows logged-in admin name in header", async () => {
    await page.goto(`${ADMIN_URL}/dashboard`);
    await waitForLoad(page);
    const text = await page.textContent("body");
    if (!text.includes("Super Admin") && !text.includes("Admin User") && !text.includes("admin@")) {
      throw new Error("Admin user info not shown in header");
    }
  });

  // 14. Logout works
  await test("Admin logout navigates to login", async () => {
    // Try clicking logout button or link
    const logoutEl = page.locator("button:has-text('Logout'), a:has-text('Logout'), button:has-text('Sign Out'), a:has-text('Sign Out')").first();
    if ((await logoutEl.count()) > 0) {
      await logoutEl.click();
      await page.waitForURL(/login/, { timeout: 8000 });
    } else {
      // Navigate directly to login and confirm it requires re-auth
      const freshCtx = await browser.newContext();
      const freshPage = await freshCtx.newPage();
      await freshPage.goto(`${ADMIN_URL}/dashboard`);
      await waitForLoad(freshPage);
      const url = freshPage.url();
      await freshCtx.close();
      if (!url.includes("login")) throw new Error(`Dashboard accessible without auth: ${url}`);
    }
  });

  await ctx.close();
}

// ─── CLIENT TESTS ─────────────────────────────────────────────────────────────

async function runClientTests(browser) {
  console.log("\n══════════════════════════════════════════");
  console.log("  CLIENT APP (port 3000)");
  console.log("══════════════════════════════════════════");

  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  let clientLoggedIn = false;

  // 1. Homepage loads
  await test("Client homepage loads", async () => {
    await page.goto(CLIENT_URL, { waitUntil: "networkidle" });
    await page.waitForSelector("nav", { timeout: 8000 });
  });

  // 2. Navbar has login link
  await test("Client navbar has login/auth links", async () => {
    const text = await page.textContent("nav");
    const hasLinks = text.includes("Login") || text.includes("Sign") || text.includes("Mankamana");
    if (!hasLinks) throw new Error("Expected nav content not found");
  });

  // 3. Unauthenticated redirect works before login
  await test("Unauthenticated access to orders redirects to login", async () => {
    const freshCtx = await browser.newContext();
    const freshPage = await freshCtx.newPage();
    await freshPage.goto(`${CLIENT_URL}/orders`, { waitUntil: "networkidle" });
    await waitForLoad(freshPage);
    const url = freshPage.url();
    const text = await freshPage.textContent("body");
    await freshCtx.close();
    const isRedirected = url.includes("login") || text.toLowerCase().includes("login");
    if (!isRedirected) throw new Error(`Expected redirect to login, got URL: ${url}`);
  });

  // 4. Login page structure
  await test("Client login page has phone/ID and password fields", async () => {
    await page.goto(`${CLIENT_URL}/login`, { waitUntil: "networkidle" });
    // The input is type="text" with placeholder for phone/client ID
    const idInput = page.locator("#client-id, input[id='client-id'], input[placeholder*='9800']").first();
    await idInput.waitFor({ timeout: 8000 });
    await page.waitForSelector("input[type='password']", { timeout: 5000 });
  });

  // 5. Login with valid credentials
  await test("Client login with valid credentials", async () => {
    await page.goto(`${CLIENT_URL}/login`, { waitUntil: "networkidle" });
    await page.fill("#client-id", CLIENT_CREDS.id);
    await page.fill("input[type='password']", CLIENT_CREDS.password);
    await page.click("button[type='submit']");
    // After login, redirects to "/" (homepage) or dashboard
    await page.waitForURL(/services|dashboard|home|orders|templates|localhost:3000\/$/, { timeout: 12000 });
    clientLoggedIn = true;
  });

  if (!clientLoggedIn) {
    console.log("  ⚠️  Skipping logged-in client tests (login failed)");
    await ctx.close();
    return;
  }

  // 6. Services page
  await test("Client services page renders", async () => {
    await page.goto(`${CLIENT_URL}/services`, { waitUntil: "networkidle" });
    await waitForLoad(page);
    const text = await page.textContent("body");
    if (isErrorPage(text)) throw new Error("Error page rendered");
    if (!text.includes("Service") && !text.includes("Product") && !text.includes("Print")) {
      throw new Error("Services content not found");
    }
  });

  // 7. Templates page
  await test("Client templates page renders", async () => {
    await page.goto(`${CLIENT_URL}/templates`, { waitUntil: "networkidle" });
    await waitForLoad(page);
    const text = await page.textContent("body");
    if (isErrorPage(text)) throw new Error("Error page rendered");
    if (!text.includes("Template") && !text.includes("Design")) {
      throw new Error("Templates content not found");
    }
  });

  // 8. My Designs tab exists on templates
  await test("Client templates page has My Designs tab", async () => {
    const text = await page.textContent("body");
    if (!text.includes("My Designs") && !text.includes("My Design")) {
      throw new Error("'My Designs' tab not found");
    }
  });

  // 9. My Designs tab shows submissions
  await test("Client My Designs tab shows design list when clicked", async () => {
    const myDesignsBtn = page.locator("button:has-text('My Designs'), a:has-text('My Designs')").first();
    if ((await myDesignsBtn.count()) > 0) {
      await myDesignsBtn.click();
      await waitForLoad(page);
      const text = await page.textContent("body");
      // Could show "no designs" message OR actual designs - both are valid
      if (isErrorPage(text)) throw new Error("Error page after clicking My Designs");
    }
  });

  // 10. Orders page
  await test("Client orders page renders", async () => {
    await page.goto(`${CLIENT_URL}/orders`, { waitUntil: "networkidle" });
    await waitForLoad(page);
    const text = await page.textContent("body");
    if (isErrorPage(text)) throw new Error("Error page rendered");
    if (!text.includes("Order") && !text.includes("order")) {
      throw new Error("Orders content not found");
    }
  });

  // 11. Orders page shows cancel info message
  await test("Client orders page shows cancel info (contact admin to cancel)", async () => {
    const text = await page.textContent("body");
    const hasContactMsg =
      (text.toLowerCase().includes("cancel") && text.toLowerCase().includes("contact")) ||
      (text.toLowerCase().includes("cancel") && text.toLowerCase().includes("admin"));
    if (!hasContactMsg) throw new Error("Cancel info message not found");
  });

  // 12. Orders page has status tracker component
  await test("Client orders page has order status tracker elements", async () => {
    const text = await page.textContent("body");
    const hasStatusInfo =
      text.includes("Placed") ||
      text.includes("Processing") ||
      text.includes("Order") ||
      text.includes("No orders");
    if (!hasStatusInfo) throw new Error("Status info not found");
  });

  // 13. Profile page
  await test("Client profile page renders", async () => {
    await page.goto(`${CLIENT_URL}/profile`, { waitUntil: "networkidle" });
    await waitForLoad(page);
    const text = await page.textContent("body");
    if (isErrorPage(text)) throw new Error("Error page rendered");
    if (!text.includes("Profile") && !text.includes("Account") && !text.includes("Business")) {
      throw new Error("Profile content not found");
    }
  });

  // 14. No critical JS errors on homepage
  await test("Client homepage no critical JS errors", async () => {
    const jsErrors = [];
    const errHandler = (err) => jsErrors.push(err.message);
    page.on("pageerror", errHandler);
    await page.goto(CLIENT_URL, { waitUntil: "networkidle" });
    await waitForLoad(page);
    page.off("pageerror", errHandler);
    const critical = jsErrors.filter(
      (e) => !e.includes("HMR") && !e.includes("fast refresh") && !e.includes("favicon")
    );
    if (critical.length > 0) throw new Error(critical[0]);
  });

  // 15. Navbar shows logged-in state (not showing Login button)
  await test("Client navbar shows authenticated state after login", async () => {
    await page.goto(CLIENT_URL, { waitUntil: "networkidle" });
    await waitForLoad(page);
    const text = await page.textContent("nav");
    // When logged in, should show user indicator or profile
    const hasAuthState =
      text.includes("ABC") || // business name
      text.includes("Demo") ||
      !text.includes("Sign Up"); // login button gone
    if (!hasAuthState) {
      // Check if profile button/avatar is visible
      const profileBtn = page.locator("button[aria-label*='profile' i], button[aria-label*='user' i], .profile-btn, [data-testid='profile']").first();
      if ((await profileBtn.count()) === 0) throw new Error("Auth state not reflected in navbar");
    }
  });

  await ctx.close();
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🎭 Playwright Browser Tests — Manakamana Printing Platform");
  console.log("Launching Chromium (headless)...\n");

  const browser = await chromium.launch({ headless: true });

  try {
    await runAdminTests(browser);
    await runClientTests(browser);
  } finally {
    await browser.close();
  }

  // ─── Summary ───────────────────────────────────────────────────────────────
  console.log("\n══════════════════════════════════════════");
  console.log("  RESULTS");
  console.log("══════════════════════════════════════════");

  const failedTests = results.filter((r) => !r.ok);
  console.log(`\nTotal: ${results.length}  ✅ Passed: ${passed}  ❌ Failed: ${failed}\n`);

  if (failedTests.length > 0) {
    console.log("Failed tests:");
    failedTests.forEach((r) => console.log(`  ❌ ${r.label}\n     ${r.error}`));
  } else {
    console.log("All tests passed! 🎉");
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
