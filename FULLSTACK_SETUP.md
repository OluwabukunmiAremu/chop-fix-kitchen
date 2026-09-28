# Chop Fix Full-Stack v1

This branch upgrades Chop Fix from a static WhatsApp site to a full-stack ordering platform.

## Included

- Dynamic products stored in Cloudflare D1
- Real orders + order items
- Cart and checkout
- Paystack transaction initialization + verification
- Paystack webhook verification
- Admin login using an HttpOnly signed session cookie
- Product add/edit/delete
- Order dashboard
- Order status updates
- Paid revenue summary
- Static assets served by Cloudflare Workers

## Important

Do **not** commit real secrets. Keep these in Cloudflare Worker secrets or local `.dev.vars`:

- `ADMIN_PASSWORD`
- `SESSION_SECRET`
- `PAYSTACK_SECRET_KEY`

## Local preview

1. Install Node.js.
2. Clone the repo and switch to this branch:

```bash
git clone https://github.com/OluwabukunmiAremu/chop-fix-kitchen.git
cd chop-fix-kitchen
git checkout fullstack-v1
npm install
```

3. Create a local `.dev.vars` from `.dev.vars.example` and use Paystack **test** secret key.

4. Initialize the local D1 database:

```bash
npm run db:init
```

5. Start the app:

```bash
npm run dev
```

Wrangler will print the local preview address, usually `http://localhost:8787`.

Storefront:
`http://localhost:8787`

Admin:
`http://localhost:8787/admin/`

## Cloudflare production setup

1. Create a D1 database named `chop-fix-db`.
2. Copy its database ID into `wrangler.toml`.
3. Add Worker secrets:

```bash
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put SESSION_SECRET
npx wrangler secret put PAYSTACK_SECRET_KEY
```

4. Initialize production database:

```bash
npm run db:prod
```

5. Deploy:

```bash
npm run deploy
```

6. In Paystack, set the webhook URL to:

`https://thechopfix.com/api/payments/webhook`

Use test keys first. Switch to a live secret key only after testing checkout, callbacks and webhook updates.

## Order statuses

- pending_payment
- confirmed
- preparing
- out_for_delivery
- delivered
- cancelled
