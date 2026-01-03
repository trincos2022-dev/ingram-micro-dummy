# Ingram Micro Shipping Integration for Shopify

A Shopify app that provides real-time shipping rates from Ingram Micro's Freight Estimate API at checkout. Built with React Router and deployed on Vercel.

## Features

- **Real-time Shipping Rates**: Fetches shipping rates from Ingram Micro when customers reach checkout
- **SKU Mapping**: Maps Shopify SKUs to Ingram Micro part numbers for accurate freight estimates
- **Fast Lookups**: Uses local Prisma/PostgreSQL database for sub-100ms SKU lookups during checkout
- **Automatic Sync**: Weekly auto-sync of SKU mappings from Supabase (every Monday at 3:00 AM UTC)
- **Manual Sync**: On-demand sync button in the admin dashboard
- **Configurable Fallback Rate**: Custom fallback shipping rate when Ingram can't provide rates
- **Carrier Configuration**: Enable/disable specific shipping carriers shown at checkout
- **Rate Request Logging**: Full history of rate requests for debugging
- **Theme Extension**: Shipping calculator widget for cart page estimates

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Shopify Store  │────▶│  Vercel (App)    │────▶│  Ingram Micro   │
│   (Checkout)    │     │                  │     │  Freight API    │
└─────────────────┘     └────────┬─────────┘     └─────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │                         │
              ┌─────▼─────┐           ┌───────▼───────┐
              │  Supabase │           │   Prisma DB   │
              │  (Source) │──sync────▶│ (Fast lookup) │
              └───────────┘           └───────────────┘
```

### Data Flow

1. **Supabase**: Source of truth for SKU → Ingram part number mappings (table: `merged_inventory_price_today`)
2. **Prisma/PostgreSQL**: Local cache of mappings for fast checkout lookups (~20,000+ SKUs)
3. **Sync Process**: Bulk sync from Supabase to Prisma (manual or weekly cron)
4. **Checkout**: SKU lookup in Prisma → Ingram API call → Return rates to Shopify

## Environment Variables

Create a `.env` file with the following: 

```bash
# Shopify App
SHOPIFY_API_KEY=your_api_key
SHOPIFY_API_SECRET=your_api_secret
SHOPIFY_APP_URL=https://your-app.vercel.app
SCOPES=write_shipping,read_shipping,read_products,write_products,...

# Database (Supabase PostgreSQL)
DATABASE_URL="postgres://postgres:password@db.xxx.supabase.co:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres:password@db.xxx.supabase.co:5432/postgres"

# Supabase (for SKU mapping source)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Optional
APP_BACKEND_TOKEN=optional-shared-secret-for-api-calls
CRON_SECRET=optional-secret-for-vercel-cron
```

### Vercel Environment Variables

Make sure to set these in your Vercel project dashboard (Settings → Environment Variables):
- All variables from `.env` above
- `NODE_ENV=production`

## Database Schema

The app uses these Prisma models (PostgreSQL via Supabase):

| Model | Purpose |
|-------|---------|
| `Session` | Shopify OAuth sessions |
| `IngramCredential` | Ingram API credentials per shop |
| `ProductMapping` | SKU → Ingram part number cache |
| `ProductSyncJob` | Sync job status tracking |
| `CarrierConfiguration` | Enabled/disabled carriers per shop |
| `RateRequestLog` | Rate request history for debugging |
| `FallbackRateSettings` | Custom fallback rate configuration |

## Setup & Installation

### 1. Prerequisites

- Node.js 18+
- Shopify Partner Account
- Shopify CLI (`npm install -g @shopify/cli@latest`)
- Supabase account with PostgreSQL database

### 2. Clone and Install

```bash
git clone https://github.com/abrarulhoque/ingram-mirco.git
cd ingram-micro-integration
npm install
```

### 3. Database Setup

```bash
# Generate Prisma client
npx prisma generate

# Push schema to database
npx prisma db push
```

### 4. Local Development

```bash
shopify app dev
```

### 5. Deploy to Vercel

```bash
# Deploy the app configuration to Shopify
shopify app deploy

# Push to GitHub (Vercel auto-deploys)
git push
```

## Admin Dashboard Features

### API Credentials
Enter your Ingram Micro OAuth credentials:
- Client ID & Secret
- Customer Number (IM-CustomerNumber)
- Country Code
- Contact Email
- Sandbox/Production mode

### SKU Mapping Sync
- **Manual Sync**: Click "Sync now" to pull latest mappings from Supabase
- **Auto Sync**: Runs every Monday at 3:00 AM UTC via Vercel Cron
- Shows progress bar and sync status

### Carrier Service
- Register/unregister the Shopify carrier service
- Callback URL: `/api/ingram/rates`

### Shipping Method Configuration
- Enable/disable specific carriers (UPS Ground, FedEx, etc.)
- Carriers are auto-discovered from Ingram API responses

### Fallback Shipping Rate
Configure what to show when Ingram can't provide rates:
- **Enable/Disable**: Toggle fallback rate on/off
- **Price**: Set a high price (e.g., $999) to prevent accidental orders
- **Title**: e.g., "Shipping Unavailable"
- **Description**: e.g., "Please contact support before placing this order"

### Rate Request History
View recent checkout rate requests with:
- Status (success, error, no_mapping, no_rates)
- SKUs requested
- Shipping destination
- Response times
- Full error details

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/ingram/rates` | POST | Shopify carrier service callback |
| `/api/cart-estimate` | POST | Cart page shipping estimates |
| `/api/sync-products` | POST | Trigger manual SKU sync |
| `/api/cron/sync-products` | GET | Weekly cron sync (Vercel) |

## Troubleshooting

### 401 "Invalid API key or access token" Error

This happens when moving to a new Vercel deployment or changing app URLs. The shop's OAuth session becomes invalid.

**Solution**: Clear the old session and re-authenticate:

```sql
-- Run in Supabase SQL editor
DELETE FROM "Session" WHERE shop = 'your-shop.myshopify.com';
```

Then revisit the app in Shopify Admin to re-authenticate.

### Sync Only Getting 1,000 SKUs

Supabase has a default row limit of 1,000.

**Solution**: Increase the limit in Supabase Dashboard:
1. Go to Settings → API
2. Scroll to "Max Rows"
3. Increase to 10,000 or higher (max 1,000,000)

The sync code uses pagination, but each page is limited by this setting.

### "Shipping Unavailable" Showing at Checkout

This is the fallback rate appearing, which means:
1. SKU mapping is missing for the product
2. Ingram API returned an error
3. No common carriers available

Check the Rate Request History in the admin to see the specific error.

### Carrier Service Not Working After URL Change

When changing the app URL (e.g., new Vercel deployment):

1. Update `SHOPIFY_APP_URL` in Vercel environment variables
2. Update URLs in `shopify.app.toml` and `shopify.app.ingram-micro.toml`
3. Run `shopify app deploy`
4. Clear old sessions from database (see 401 error above)
5. Re-authenticate the shop
6. Re-register the carrier service in the admin dashboard

### Database Tables Don't Exist

```bash
npx prisma generate
npx prisma db push
```

Or run SQL directly in Supabase SQL editor.

## Vercel Cron Configuration

The `vercel.json` file configures automatic weekly sync:

```json
{
  "crons": [
    {
      "path": "/api/cron/sync-products",
      "schedule": "0 3 * * 1"
    }
  ]
}
```

This runs every Monday at 3:00 AM UTC.

## Shopify Backup Rates

Shopify has built-in backup shipping rates that appear when carrier services return no rates. These **cannot be disabled** when using carrier-calculated shipping.

**Recommendation**: Set Shopify's backup rate to a high price ($999) in:
Shopify Admin → Settings → Shipping and delivery → Edit backup rate

This prevents customers from accidentally paying incorrect shipping when the integration has issues.

## Theme Extension: Shipping Calculator

The app includes a theme app extension (`shipping-calculator`) that adds a shipping estimate widget to the cart page. This calls `/api/cart-estimate` to show rates before checkout.

To enable:
1. Go to Online Store → Themes → Customize
2. Add the "Shipping Calculator" block to your cart template

## File Structure

```
├── app/
│   ├── routes/
│   │   ├── app._index.tsx      # Admin dashboard
│   │   ├── api.ingram.rates.ts # Carrier service endpoint
│   │   ├── api.cart-estimate.ts # Cart estimate endpoint
│   │   ├── api.sync-products.ts # Manual sync endpoint
│   │   └── api.cron.sync-products.ts # Cron sync endpoint
│   ├── services/
│   │   ├── ingram.server.ts    # Ingram API client
│   │   ├── product-sync.server.ts # Sync logic
│   │   ├── product-mapping.server.ts # SKU lookup
│   │   ├── fallback-rate.server.ts # Fallback rate logic
│   │   └── supabase.server.ts  # Supabase client
│   └── db.server.ts            # Prisma client
├── prisma/
│   └── schema.prisma           # Database schema
├── extensions/
│   └── shipping-calculator/    # Theme app extension
├── vercel.json                 # Cron configuration
└── shopify.app.toml            # App configuration
```

## Development Commands

```bash
# Start local development
shopify app dev

# Deploy app configuration
shopify app deploy

# Generate Prisma client after schema changes
npx prisma generate

# Push schema to database
npx prisma db push

# Type check
npx tsc --noEmit

# Build for production
npm run build
```

## Resources

- [Ingram Micro Freight Estimate API](https://developer.ingrammicro.com/reseller/api-documentation/United_States#tag/Freight-Estimate)
- [Shopify Carrier Service API](https://shopify.dev/docs/api/admin-rest/current/resources/carrierservice)
- [Shopify App React Router](https://shopify.dev/docs/api/shopify-app-react-router)
- [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs)
- [Prisma Documentation](https://www.prisma.io/docs)
