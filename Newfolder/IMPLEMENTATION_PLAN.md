# Ingram Micro Integration - Implementation Plan

## Overview

This plan addresses three client requirements:
1. Combine shipping costs for multiple products in cart
2. Admin configuration for shipping method visibility
3. Cart page estimate shipping integration

---

## Current State Analysis

### Ingram API Response Structure
When requesting rates for multiple products, Ingram returns:
- Multiple `distribution` blocks (one per warehouse/branch)
- Each distribution has a `carrierList[]` with available carriers
- Each carrier has: `carrierCode`, `shipVia`, `carrierMode`, `estimatedFreightCharge`, `daysInTransit`
- `lines[]` shows which warehouse each product ships from

Example from multi-product test:
```json
{
  "distribution": [
    {
      "shipFromBranchNumber": "40",
      "carrierList": [
        {"carrierCode": "UG", "shipVia": "UPS GROUND", "estimatedFreightCharge": "9.74"},
        {"carrierCode": "RG", "shipVia": "FEDEX GROUND", "estimatedFreightCharge": "10.38"}
      ]
    },
    {
      "shipFromBranchNumber": "70",
      "carrierList": [
        {"carrierCode": "UG", "shipVia": "UPS GROUND", "estimatedFreightCharge": "43.46"},
        {"carrierCode": "RG", "shipVia": "FEDEX GROUND", "estimatedFreightCharge": "75.76"}
      ]
    }
  ]
}
```

### Current Problem
- The app flattens all carriers from all distributions without combining
- Shopify only allows ONE set of shipping options per checkout
- Products may ship from different warehouses with different carrier options

---

## Implementation Plan

### Phase 1: Database Schema Update

**File: `prisma/schema.prisma`**

Add new model for carrier configuration:

```prisma
model CarrierConfiguration {
  id              String   @id @default(cuid())
  shopDomain      String
  carrierCode     String   // e.g., "UG", "RG", "U3"
  carrierName     String   // e.g., "UPS GROUND", "FEDEX GROUND"
  carrierMode     String   // e.g., "SML", "AIR", "LTL"
  displayName     String?  // Custom name for checkout (optional)
  enabled         Boolean  @default(true)
  sortOrder       Int      @default(0)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([shopDomain, carrierCode])
  @@index([shopDomain])
}
```

### Phase 2: Rate Combination Logic

**File: `app/services/rate-combiner.server.ts`** (new file)

Strategy for combining rates across distributions:

```typescript
type CombinedRate = {
  carrierCode: string;
  shipVia: string;
  carrierMode: string;
  totalCharge: number;
  maxDaysInTransit: number;
  distributions: Array<{
    branchNumber: string;
    charge: number;
  }>;
  isComplete: boolean; // true if carrier available in ALL distributions
};

function combineRates(distributions: Distribution[]): CombinedRate[] {
  // 1. Build map of carrier -> charges per distribution
  // 2. For each carrier, sum charges across all distributions
  // 3. Mark carriers as "complete" if available in ALL distributions
  // 4. For incomplete carriers, use fallback strategy (cheapest available)
  // 5. Return sorted by total charge
}
```

**Combination Rules:**
1. **Common Carriers**: Sum `estimatedFreightCharge` from all distributions
   - UPS GROUND from branch 40 ($9.74) + branch 70 ($43.46) = $53.20 total
2. **Missing Carriers**: If a carrier isn't available in a distribution:
   - Option A: Skip that carrier option entirely
   - Option B: Use cheapest available carrier from that distribution
3. **Transit Days**: Use the MAX `daysInTransit` across all distributions

### Phase 3: Update Rate Calculation Endpoint

**File: `app/routes/api.ingram.rates.ts`**

Modify the carrier service response to:
1. Import rate combiner
2. Get enabled carriers from database
3. Combine rates across distributions
4. Filter by enabled carriers
5. Return consolidated Shopify rates

```typescript
// After getting freightSummary from Ingram:
const distributions = freightSummary?.distribution ?? [];
const combinedRates = combineRates(distributions);

// Get enabled carriers from DB
const enabledCarriers = await getEnabledCarriers(shopDomain);
const enabledCodes = new Set(enabledCarriers.map(c => c.carrierCode));

// Filter and format for Shopify
const shopifyRates = combinedRates
  .filter(rate => enabledCodes.has(rate.carrierCode))
  .map(rate => ({
    service_name: rate.shipVia.trim(),
    service_code: `INGRAM_${rate.carrierCode}`,
    total_price: Math.round(rate.totalCharge * 100).toString(),
    currency,
    description: `Est. ${rate.maxDaysInTransit} day(s) delivery`,
  }));
```

### Phase 4: Admin UI for Carrier Configuration

**File: `app/routes/app._index.tsx`**

Add new section for carrier management:

```tsx
<s-section heading="Shipping method configuration">
  <s-paragraph>
    Select which shipping methods to show at checkout. Uncheck carriers
    you don't want to offer customers.
  </s-paragraph>

  <Form method="post">
    <input type="hidden" name="_action" value="saveCarrierConfig" />
    {availableCarriers.map(carrier => (
      <div key={carrier.carrierCode}>
        <input
          type="checkbox"
          name={`carrier_${carrier.carrierCode}`}
          defaultChecked={carrier.enabled}
        />
        <label>{carrier.shipVia}</label>
        <span>({carrier.carrierMode})</span>
      </div>
    ))}
    <s-button type="submit">Save configuration</s-button>
  </Form>
</s-section>
```

**New action handlers:**
- `saveCarrierConfig`: Save enabled/disabled state to CarrierConfiguration table
- `syncCarriers`: Fetch available carriers from Ingram and populate table

### Phase 5: Cart Estimate Shipping

The theme already has a shipping calculator form (`<shipping-calculator>` in main-cart.liquid).
It uses Shopify's native `/cart/shipping_rates.json` endpoint.

**Option A: Use Shopify's Carrier Service (Recommended)**
- The carrier service is already registered
- Shopify's `/cart/shipping_rates.json` calls our carrier service automatically
- Theme JS just needs to parse the response correctly

**Option B: Direct API Integration**
- Create new endpoint: `app/routes/api.cart-estimate.ts`
- Theme JS calls this directly with cart items and address
- Returns rates in a custom format

**Implementation (Option A):**

The existing `<shipping-calculator>` component needs to be updated to:
1. Collect full address (street, city, state, zip, country)
2. Call Shopify's `/cart/shipping_rates.json`
3. Display combined rates from our carrier service

**File: Theme JS updates needed**
- `assets/cart.js` - Update shipping calculator to display rates properly

### Phase 6: New API Endpoint for Cart Estimates

**File: `app/routes/api.cart-estimate.ts`** (new file)

For direct cart page integration:

```typescript
export const action = async ({ request }: ActionFunctionArgs) => {
  const body = await request.json();
  const { shopDomain, address, items } = body;

  // Map SKUs to Ingram part numbers
  // Call Ingram freight estimate
  // Combine rates
  // Return formatted response
};
```

---

## File Changes Summary

### New Files
1. `app/services/rate-combiner.server.ts` - Rate combination logic
2. `app/routes/api.cart-estimate.ts` - Cart estimate endpoint

### Modified Files
1. `prisma/schema.prisma` - Add CarrierConfiguration model
2. `app/routes/api.ingram.rates.ts` - Integrate rate combiner, filter by config
3. `app/routes/app._index.tsx` - Add carrier config UI
4. `app/services/ingram.server.ts` - Add carrier config DB functions

### Theme Files (separate deployment)
1. `assets/cart.js` - Update shipping calculator display
2. `sections/main-cart.liquid` - Ensure address fields are complete
3. `sections/cart-drawer.liquid` - Same updates for drawer

---

## Implementation Order

1. **Database migration** - Add CarrierConfiguration model
2. **Rate combiner service** - Core logic for combining rates
3. **Update rates endpoint** - Integrate combiner with checkout
4. **Admin UI** - Carrier selection interface
5. **Cart estimate endpoint** - For theme integration
6. **Theme updates** - Cart shipping calculator

---

## Testing Checklist

- [ ] Single product cart shows correct rates
- [ ] Multi-product cart (same warehouse) shows combined rates
- [ ] Multi-product cart (different warehouses) shows combined rates
- [ ] Admin can enable/disable carriers
- [ ] Only enabled carriers appear at checkout
- [ ] Cart page estimate shows rates
- [ ] Cart drawer estimate shows rates
- [ ] International addresses handled gracefully (error message if no rates)

---

## Carrier Codes Reference (from API test)

| Code | Name | Mode | Description |
|------|------|------|-------------|
| UG | UPS GROUND | SML | Standard ground shipping |
| RG | FEDEX GROUND | SML | FedEx ground |
| U3 | UPS 3 DAY | AIR | 3-day air |
| UB | UPS 2DAY INT | AIR | 2-day air |
| F2 | FEDX 2 DAY | AIR | FedEx 2-day |
| FG | FEDEX EXPRES | AIR | FedEx Express 3-day |
| UO | UPS OVERNITE | AIR | Next day before 3pm |
| UR | UPS NXT DAY | AIR | Next day before 10:30am |
| FO | FEDX STD OVR | AIR | FedEx overnight |
| F1 | FEDX PRTY 1 | AIR | FedEx priority overnight |
| US | UPS AIR SAT | AIR | Saturday delivery |
| Z9 | SAIA | LTL | Less-than-truckload |
| RL | RL | LTL | R+L Carriers |
| 8E | FEDEX FRT LT | LTL | FedEx freight |
| X7 | BTX DOCK TO | LTL | Dock delivery |
| X6 | BTX RACK SER | LTL | White glove |
| 1W | AIT DOCK TO | AIH | Air freight |
| 3W | AIT THRESHOL | LTL | Threshold delivery |
| 3H | AIT WHITEGLO | LTL | White glove full service |
| 3F | FEDX HWA 3DA | AIH | FedEx heavy air |
