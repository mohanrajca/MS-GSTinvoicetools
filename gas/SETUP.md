# GST Invoice Pro Multi-Tenant — Setup Guide

## Step 1: Create Master Google Sheet

1. Go to [sheets.new](https://sheets.new)
2. Name it: **GST Invoice Pro — Master**
3. Create these **5 tabs** exactly (names are case-sensitive):

---

### Tab: CLIENTS
Row 1 headers (exact):
```
client_id | client_name | script_url | invoice_type | gst_registered | active | created_date
```

---

### Tab: USERS
Row 1 headers:
```
user_id | client_id | username | password_hash | role | active
```

---

### Tab: ADMIN
Row 1 headers:
```
username | password_hash | secret
```
Row 2 — your admin credentials:
```
mohan | <SHA-256 of your password — see Step 2> | <random 32-char string>
```

---

### Tab: TOKENS
Row 1 headers:
```
token | client_id | username | expires_at
```

---

### Tab: LOCKOUTS
Row 1 headers:
```
username | failed_count | locked_until
```

---

## Step 2: Generate your admin password hash

Open any browser console (F12 → Console) and paste:

```javascript
async function h(p){
  const e=new TextEncoder();
  const d=await crypto.subtle.digest('SHA-256',e.encode(p));
  return Array.from(new Uint8Array(d)).map(b=>b.toString(16).padStart(2,'0')).join('');
}
h('YourPasswordHere').then(console.log);
```

Copy the 64-character hex string → paste into ADMIN tab row 2, column B.

For the **secret** (column C): generate any random 32-character string, e.g.:
```
msa2026xK9pQrLnT7vBwJdUeHcFiZgYo
```

---

## Step 3: Deploy Master Apps Script

1. Open the Master Google Sheet
2. Click **Extensions → Apps Script**
3. Delete the default code
4. Paste the full contents of `gas/MasterScript.js`
5. Click **Save** (Ctrl+S)
6. Click **Deploy → New deployment**
7. Settings:
   - Type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
8. Click **Deploy** → copy the **Web app URL** (looks like `https://script.google.com/macros/s/AKfyc…/exec`)
9. Open `js/config.js` and paste the URL as `MASTER_SCRIPT_URL`

---

## Step 4: Push to GitHub Pages

```bash
git add .
git commit -m "deploy: initial multi-tenant setup"
git push origin main
```

Enable GitHub Pages: Settings → Pages → Source: main branch → root folder.
Your app URL: `https://<your-username>.github.io/<repo-name>/`

---

## Step 5: Add your first client

1. Create the client's Google Sheet (copy the SR Consultancy template)
2. Deploy their Apps Script
3. Open your app URL → sign in as admin
4. Admin Panel → Clients → **+ Add Client**
   - Client Name: e.g. SR Consultancy
   - Script URL: paste client's Apps Script URL
   - Invoice Type: Commission (for SR Consultancy) or Standard
   - GST Registered: Yes or No
5. Admin Panel → Users → Select the new client → **+ Add User**
   - Add at least 2 users (owner + accountant)
   - Passwords are hashed in the browser — never stored in plaintext

---

## Client Sheet Structure (minimum required tabs)

Each client's Apps Script must handle these actions via `doPost(e)`:

| Action | Input | Output |
|--------|-------|--------|
| `get_dashboard` | `{fy}` | `{data: {...}}` |
| `get_customers` | `{}` | `{customers: [...]}` |
| `save_customer` | `{customer}` | `{ok}` |
| `get_products`  | `{}` | `{products: [...]}` |
| `save_product`  | `{product}` | `{ok}` |
| `get_invoices`  | `{fy}` | `{invoices: [...]}` |
| `save_invoice`  | `{invoice}` | `{ok}` |
| `get_receivables` | `{}` | `{receivables: [...]}` |
| `get_expenses`  | `{fy}` | `{expenses: [...]}` |
| `save_expense`  | `{expense}` | `{ok}` |
| `get_receipts`  | `{fy}` | `{receipts: [...]}` |
| `save_receipt`  | `{receipt}` | `{ok}` |
| `get_payments`  | `{fy}` | `{payments: [...]}` |
| `save_payment`  | `{payment}` | `{ok}` |
| `get_commission_summary` | `{fy}` | `{commission: [...]}` |
| `get_invoice_config` | `{}` | `{ok, optionalColumns: {...}}` |
| `save_invoice_config` | `{columns}` | `{ok}` |
| `get_firm_details` | `{}` | `{ok, firm: {...}}` |
| `save_firm_details` | `{firm}` | `{ok}` |
| `sync` | `{}` | `{ok}` |

> The SR Consultancy v6 Apps Script already handles most of these.
> Copy it as the template for all new clients.

---

## Security checklist before going live

- [ ] Admin password is at least 12 characters
- [ ] Secret in ADMIN tab is at least 32 random characters
- [ ] Master Sheet sharing is set to **Restricted** (only you can open it)
- [ ] Each client's Sheet is shared only with that client
- [ ] `config.js` contains the Master Script URL — this is safe (Apps Script exec URLs are public by design; they enforce auth internally)
- [ ] GitHub repo is public (GitHub Pages requirement) but no sensitive data is in the HTML/JS code

---

## Future: Upgrade to hosted domain

When ready to move off GitHub Pages:
1. Deploy a Node.js/Express or Supabase backend
2. Implement the same POST endpoints as `MasterScript.js`
3. Update `MASTER_SCRIPT_URL` in `js/config.js` to your new backend URL
4. All other JS files remain unchanged
5. Host on Vercel / Netlify / VPS
