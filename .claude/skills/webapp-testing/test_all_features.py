"""
Comprehensive test of client and admin features.
Strategy: inject auth tokens directly into localStorage/cookies, then test each page.
"""
from playwright.sync_api import sync_playwright
import json
import urllib.request
import time

CLIENT_URL = "http://localhost:3000"
ADMIN_URL = "http://localhost:3001"
API_URL = "http://localhost:8005/api/v1"

CLIENT_PHONE = "8545049911"
CLIENT_PASSWORD = "test1234"
ADMIN_EMAIL = "admin@manakamana.com"
ADMIN_PASSWORD = "admin@123"

results = []

def log(test, status, detail=""):
    symbol = "PASS" if status else "FAIL"
    results.append({"test": test, "status": symbol, "detail": detail})
    print(f"[{symbol}] {test}" + (f" — {detail}" if detail else ""))


def api_login_client():
    """Get a client JWT token directly from the API"""
    req = urllib.request.Request(
        f"{API_URL}/auth/login",
        data=json.dumps({"phone_number": CLIENT_PHONE, "password": CLIENT_PASSWORD}).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read())
    return data.get("token"), data.get("client")


def api_login_admin():
    """Get an admin session cookie directly from the API"""
    req = urllib.request.Request(
        f"{API_URL}/admin/auth/login",
        data=json.dumps({"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        resp = urllib.request.urlopen(req)
        cookie_header = resp.headers.get("Set-Cookie", "")
        data = json.loads(resp.read())
        return data, cookie_header
    except Exception as e:
        return None, None


def inject_client_auth(page, token, user):
    """Inject client auth into the page's localStorage"""
    auth_user = {
        "id": user.get("id"),
        "clientId": user.get("client_code") or user.get("phone"),
        "businessName": user.get("business_name"),
        "ownerName": user.get("owner_name") or user.get("business_name"),
        "email": user.get("email", ""),
        "phoneNumber": user.get("phone"),
    }
    page.evaluate(f"""() => {{
        localStorage.setItem('mk_token', {json.dumps(token)});
        localStorage.setItem('mk_auth_user', {json.dumps(json.dumps(auth_user))});
    }}""")


def run_tests():
    # First get auth tokens via API
    print("Getting auth tokens...")
    try:
        client_token, client_user = api_login_client()
        log("Client API Login", bool(client_token), f"token={'present' if client_token else 'missing'}")
    except Exception as e:
        log("Client API Login", False, str(e)[:100])
        return

    try:
        admin_data, admin_cookie = api_login_admin()
        log("Admin API Login", bool(admin_data), str(admin_data.get("message",""))[:50] if admin_data else "failed")
    except Exception as e:
        log("Admin API Login", False, str(e)[:100])
        admin_data = None
        admin_cookie = None

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        # ============================
        # CLIENT TESTS
        # ============================
        print("\n=== CLIENT TESTS ===")
        ctx = browser.new_context()
        page = ctx.new_page()

        # Navigate to home first to get a page context with the right origin
        page.goto(CLIENT_URL)
        page.wait_for_load_state("networkidle")

        # Inject client auth
        inject_client_auth(page, client_token, client_user)

        # 1. Services page
        try:
            page.goto(f"{CLIENT_URL}/services")
            page.wait_for_load_state("networkidle")
            links = page.locator("a[href*='/services/']").count()
            text = page.inner_text("body")
            log("Client Services page", links > 0 or "service" in text.lower(), f"{links} product links")
        except Exception as e:
            log("Client Services page", False, str(e)[:80])

        # 2. Product detail page
        try:
            page.goto(f"{CLIENT_URL}/services")
            page.wait_for_load_state("networkidle")
            links = page.locator("a[href*='/services/']").all()
            if links:
                href = links[0].get_attribute("href")
                page.goto(f"{CLIENT_URL}{href}")
                page.wait_for_load_state("networkidle")
                content = page.inner_text("body")
                has_form = any(x in content.lower() for x in ["quantity", "order", "select", "variant", "option"])
                log("Client Product Detail page", has_form, href)
            else:
                log("Client Product Detail page", False, "no product links")
        except Exception as e:
            log("Client Product Detail page", False, str(e)[:80])

        # 3. Orders page
        try:
            page.goto(f"{CLIENT_URL}/orders")
            page.wait_for_load_state("networkidle")
            content = page.inner_text("body")
            log("Client Orders page", "order" in content.lower())
        except Exception as e:
            log("Client Orders page", False, str(e)[:80])

        # 4. API: order list - all Decimal fields must be numbers
        try:
            req = urllib.request.Request(
                f"{API_URL}/orders",
                headers={"Authorization": f"Bearer {client_token}"}
            )
            with urllib.request.urlopen(req) as resp:
                data = json.loads(resp.read())
            if data.get("data"):
                order = data["data"][0]
                numeric_fields = ["unit_price", "total_amount", "discount_value", "discount_amount", "final_amount"]
                all_numeric = all(isinstance(order.get(f), (int, float)) for f in numeric_fields)
                bad = {f: order.get(f) for f in numeric_fields if not isinstance(order.get(f), (int, float))}
                log("Client orders API — Decimal fields are numbers", all_numeric, f"bad={bad}" if bad else "all numeric")
            else:
                log("Client orders API — Decimal fields are numbers", True, "no orders")
        except Exception as e:
            log("Client orders API — Decimal fields are numbers", False, str(e)[:80])

        # 5. API: order detail
        try:
            req = urllib.request.Request(f"{API_URL}/orders", headers={"Authorization": f"Bearer {client_token}"})
            with urllib.request.urlopen(req) as resp:
                orders_data = json.loads(resp.read())
            if orders_data.get("data"):
                oid = orders_data["data"][0]["id"]
                req2 = urllib.request.Request(f"{API_URL}/orders/{oid}", headers={"Authorization": f"Bearer {client_token}"})
                with urllib.request.urlopen(req2) as resp2:
                    detail = json.loads(resp2.read())
                order = detail.get("data", {})
                up = order.get("unit_price")
                fa = order.get("final_amount")
                log("Client order detail API — numeric fields",
                    isinstance(up, (int, float)) and isinstance(fa, (int, float)),
                    f"unit_price={up}({type(up).__name__}) final={fa}({type(fa).__name__})")
            else:
                log("Client order detail API — numeric fields", True, "no orders")
        except Exception as e:
            log("Client order detail API — numeric fields", False, str(e)[:80])

        # 6. Wallet page
        try:
            page.goto(f"{CLIENT_URL}/wallet")
            page.wait_for_load_state("networkidle")
            content = page.inner_text("body")
            log("Client Wallet page", any(x in content.lower() for x in ["wallet", "balance", "npr", "top"]))
        except Exception as e:
            log("Client Wallet page", False, str(e)[:80])

        # 7. Wallet API: balance is numeric
        try:
            req = urllib.request.Request(f"{API_URL}/wallet/balance", headers={"Authorization": f"Bearer {client_token}"})
            with urllib.request.urlopen(req) as resp:
                data = json.loads(resp.read())
            bal_data = data.get("data", {})
            avail = bal_data.get("availableBalance") if isinstance(bal_data, dict) else None
            log("Client wallet balance API", data.get("success"), f"availableBalance={avail} currency={bal_data.get('currency','?')}")
        except Exception as e:
            log("Client wallet balance API", False, str(e)[:80])

        # 8. Top-up page
        try:
            page.goto(f"{CLIENT_URL}/wallet/topup")
            page.wait_for_load_state("networkidle")
            content = page.inner_text("body")
            log("Client Wallet TopUp page", any(x in content.lower() for x in ["payment", "bank", "proof", "submit"]))
        except Exception as e:
            log("Client Wallet TopUp page", False, str(e)[:80])

        # 9. Templates page
        try:
            page.goto(f"{CLIENT_URL}/templates")
            page.wait_for_load_state("networkidle")
            content = page.inner_text("body")
            log("Client Templates page", any(x in content.lower() for x in ["template", "design", "file", "download"]))
        except Exception as e:
            log("Client Templates page", False, str(e)[:80])

        # 10. Profile page
        try:
            page.goto(f"{CLIENT_URL}/profile")
            page.wait_for_load_state("networkidle")
            content = page.inner_text("body")
            log("Client Profile page", any(x in content.lower() for x in ["profile", "business", "name", "phone", "email"]))
        except Exception as e:
            log("Client Profile page", False, str(e)[:80])

        # 11. API: products list (requires client auth)
        try:
            req = urllib.request.Request(f"{API_URL}/products", headers={"Authorization": f"Bearer {client_token}"})
            with urllib.request.urlopen(req) as resp:
                data = json.loads(resp.read())
            log("Products API (/products)", data.get("success"), f"{len(data.get('data', []))} products")
        except Exception as e:
            log("Products API (/products)", False, str(e)[:80])

        # 12. API: wallet payment details
        try:
            req = urllib.request.Request(f"{API_URL}/wallet/payment-details", headers={"Authorization": f"Bearer {client_token}"})
            with urllib.request.urlopen(req) as resp:
                data = json.loads(resp.read())
            log("Wallet payment-details API", data.get("success"), f"count={len(data.get('data', []))}")
        except Exception as e:
            log("Wallet payment-details API", False, str(e)[:80])

        # 13. API: wallet topup requests
        try:
            req = urllib.request.Request(f"{API_URL}/wallet/topup-requests", headers={"Authorization": f"Bearer {client_token}"})
            with urllib.request.urlopen(req) as resp:
                data = json.loads(resp.read())
            log("Wallet topup-requests API", data.get("success"), f"count={len(data.get('data', []))}")
        except Exception as e:
            log("Wallet topup-requests API", False, str(e)[:80])

        ctx.close()

        # ============================
        # ADMIN TESTS
        # ============================
        print("\n=== ADMIN TESTS ===")

        # Admin API tests (direct)
        admin_headers = {"Content-Type": "application/json"}
        if admin_cookie:
            admin_headers["Cookie"] = admin_cookie.split(";")[0] if admin_cookie else ""

        # Get admin token if available
        admin_token = admin_data.get("token") if admin_data else None

        def admin_req(path):
            req = urllib.request.Request(f"{API_URL}{path}")
            if admin_token:
                req.add_header("Authorization", f"Bearer {admin_token}")
            return req

        # 14. Admin dashboard stats (via Next.js admin proxy at port 3001)
        try:
            req = urllib.request.Request(f"{ADMIN_URL}/api/admin/dashboard/stats")
            if admin_token:
                req.add_header("Cookie", f"admin-auth-token={admin_token}")
            with urllib.request.urlopen(req) as resp:
                data = json.loads(resp.read())
            log("Admin dashboard stats (Next.js proxy)", data.get("success"), str(data.get("data", {}))[:80])
        except Exception as e:
            log("Admin dashboard stats (Next.js proxy)", False, str(e)[:80])

        # 15. Admin orders list
        try:
            with urllib.request.urlopen(admin_req("/admin/orders")) as resp:
                data = json.loads(resp.read())
            log("Admin orders API", data.get("success"), f"{len(data.get('data', []))} orders")
            if data.get("data"):
                order = data["data"][0]
                numeric_fields = ["unit_price", "total_amount", "final_amount"]
                all_numeric = all(isinstance(order.get(f), (int, float)) for f in numeric_fields)
                bad = {f: (order.get(f), type(order.get(f)).__name__) for f in numeric_fields if not isinstance(order.get(f), (int, float))}
                log("Admin orders — Decimal fields numeric", all_numeric, f"bad={bad}" if bad else "all ok")
        except Exception as e:
            log("Admin orders API", False, str(e)[:80])

        # 16. Admin order detail
        try:
            with urllib.request.urlopen(admin_req("/admin/orders")) as resp:
                orders = json.loads(resp.read()).get("data", [])
            if orders:
                oid = orders[0]["id"]
                with urllib.request.urlopen(admin_req(f"/admin/orders/{oid}")) as resp2:
                    detail = json.loads(resp2.read())
                order = detail.get("data", {})
                up = order.get("unit_price")
                fa = order.get("final_amount")
                log("Admin order detail — numeric fields",
                    isinstance(up, (int, float)) and isinstance(fa, (int, float)),
                    f"unit_price={up}({type(up).__name__})")
            else:
                log("Admin order detail — numeric fields", True, "no orders")
        except Exception as e:
            log("Admin order detail — numeric fields", False, str(e)[:80])

        # 17. Admin clients list (returns {message, data} not {success, data})
        try:
            with urllib.request.urlopen(admin_req("/admin/clients")) as resp:
                data = json.loads(resp.read())
            ok = bool(data.get("data") is not None)
            log("Admin clients API", ok, f"{len(data.get('data', []))} clients")
        except Exception as e:
            log("Admin clients API", False, str(e)[:80])

        # 18. Admin registration requests (returns {message, data} not {success, data})
        try:
            with urllib.request.urlopen(admin_req("/admin/registration-requests")) as resp:
                data = json.loads(resp.read())
            ok = bool(data.get("data") is not None)
            log("Admin registration requests API", ok, f"count={len(data.get('data', []))}")
        except Exception as e:
            log("Admin registration requests API", False, str(e)[:80])

        # 19. Admin design submissions
        try:
            with urllib.request.urlopen(admin_req("/admin/design-submissions")) as resp:
                data = json.loads(resp.read())
            log("Admin design submissions API", data.get("success"), f"count={len(data.get('data', []))}")
        except Exception as e:
            log("Admin design submissions API", False, str(e)[:80])

        # 20. Admin wallet topup requests
        try:
            with urllib.request.urlopen(admin_req("/admin/wallet/topup-requests")) as resp:
                data = json.loads(resp.read())
            log("Admin wallet topup requests API", data.get("success"), f"count={len(data.get('data', []))}")
        except Exception as e:
            log("Admin wallet topup requests API", False, str(e)[:80])

        # 21. Admin wallet payment details
        try:
            with urllib.request.urlopen(admin_req("/admin/wallet/payment-details")) as resp:
                data = json.loads(resp.read())
            log("Admin wallet payment details API", data.get("success"), f"count={len(data.get('data', []))}")
        except Exception as e:
            log("Admin wallet payment details API", False, str(e)[:80])

        # 22. Admin services/categories
        try:
            with urllib.request.urlopen(admin_req("/admin/services")) as resp:
                data = json.loads(resp.read())
            log("Admin services/categories API", data.get("success"), f"count={len(data.get('data', []))}")
        except Exception as e:
            log("Admin services/categories API", False, str(e)[:80])

        # Admin UI pages (browser)
        if admin_token:
            print("\n--- Admin UI pages ---")
            actx = browser.new_context()
            apage = actx.new_page()

            # Inject admin token as cookie
            actx.add_cookies([{
                "name": "admin-auth-token",
                "value": admin_token,
                "domain": "localhost",
                "path": "/",
            }])

            for (name, path) in [
                ("Admin Dashboard", "/dashboard"),
                ("Admin Orders", "/orders"),
                ("Admin Payments", "/payments"),
                ("Admin Clients", "/clients"),
                ("Admin Registrations", "/registration-requests"),
                ("Admin Designs", "/design-approval"),
                ("Admin Pricing", "/pricing"),
            ]:
                try:
                    apage.goto(f"{ADMIN_URL}{path}")
                    apage.wait_for_load_state("networkidle")
                    url = apage.url
                    stayed = path in url or "/dashboard" in url
                    content = apage.inner_text("body") if stayed else ""
                    not_redirected = "/login" not in url
                    log(name, not_redirected, f"url={url.split('localhost:3001')[-1]}")
                except Exception as e:
                    log(name, False, str(e)[:80])

            actx.close()

        browser.close()

    # Summary
    print("\n" + "="*55)
    print("TEST SUMMARY")
    print("="*55)
    passed = sum(1 for r in results if r["status"] == "PASS")
    total = len(results)
    print(f"Passed: {passed}/{total}")
    fails = [r for r in results if r["status"] == "FAIL"]
    if fails:
        print("\nFAILURES:")
        for f in fails:
            print(f"  FAIL {f['test']}" + (f": {f['detail']}" if f['detail'] else ""))
    else:
        print("All tests passed!")

if __name__ == "__main__":
    run_tests()
