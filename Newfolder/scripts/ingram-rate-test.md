# Ingram Micro Rate Testing Commands

## Step 1: Map Shopify SKU to Ingram Part Number

```bash
curl -s "https://fjpdegogqyjncmkevzhn.supabase.co/rest/v1/merged_inventory_price_today?select=ingram_part_number&price_vendor_part=eq.YOUR_SKU_HERE" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqcGRlZ29ncXlqbmNta2V2emhuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNTk1MTQzNiwiZXhwIjoyMDUxNTI3NDM2fQ.d2VvNJt-3XN-y7v9TJT4J9aSlWdJCdkRU8n27Mz_wuw" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqcGRlZ29ncXlqbmNta2V2emhuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNTk1MTQzNiwiZXhwIjoyMDUxNTI3NDM2fQ.d2VvNJt-3XN-y7v9TJT4J9aSlWdJCdkRU8n27Mz_wuw" | jq .
```

Replace `YOUR_SKU_HERE` with the Shopify SKU (e.g., `40B10135US`, `VP3256-4K`).

---

## Step 2: Get OAuth Token

```bash
TOKEN=$(curl -s -X POST https://api.ingrammicro.com:443/oauth/oauth30/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials&client_id=PtbeLvNtft2yJiXiJ6UviJQOu2EON6Lc&client_secret=h1jZhUsAfHtgjk2H" \
  | jq -r .access_token)

echo "Token: $TOKEN"
```

---

## Step 3: Request Freight Estimate (Single Product)

```bash
curl -s -X POST https://api.ingrammicro.com:443/resellers/v6/freightestimate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "IM-CustomerNumber: 50-979132" \
  -H "IM-CountryCode: US" \
  -H "IM-CorrelationID: cli-test-$(date +%s)" \
  -H "IM-CustomerContact: abrarulhoque07@gmail.com" \
  -d '{
    "billToAddressId": "000",
    "shipToAddressId": "200",
    "shipToAddress": {
      "companyName": "ABC TECH",
      "addressLine1": "17501 W 98TH ST SPC 1833",
      "addressLine2": "string",
      "city": "LENEXA",
      "state": "KS",
      "postalCode": "662191736",
      "countryCode": "US"
    },
    "lines": [
      {
        "customerLineNumber": "001",
        "ingramPartNumber": "00FL60",
        "quantity": "1",
        "carrierCode": ""
      }
    ]
  }' | jq .
```

Replace `00FL60` with the Ingram part number from Step 1.

---

## Step 4: Request Freight Estimate (Multiple Products)

```bash
curl -s -X POST https://api.ingrammicro.com:443/resellers/v6/freightestimate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "IM-CustomerNumber: 50-979132" \
  -H "IM-CountryCode: US" \
  -H "IM-CorrelationID: cli-test-multi-$(date +%s)" \
  -H "IM-CustomerContact: abrarulhoque07@gmail.com" \
  -d '{
    "billToAddressId": "000",
    "shipToAddressId": "200",
    "shipToAddress": {
      "companyName": "ABC TECH",
      "addressLine1": "17501 W 98TH ST SPC 1833",
      "addressLine2": "string",
      "city": "LENEXA",
      "state": "KS",
      "postalCode": "662191736",
      "countryCode": "US"
    },
    "lines": [
      {"customerLineNumber": "001", "ingramPartNumber": "001346", "quantity": "1", "carrierCode": ""},
      {"customerLineNumber": "002", "ingramPartNumber": "006984", "quantity": "1", "carrierCode": ""},
      {"customerLineNumber": "003", "ingramPartNumber": "00FL60", "quantity": "1", "carrierCode": ""},
      {"customerLineNumber": "004", "ingramPartNumber": "00FV31", "quantity": "1", "carrierCode": ""},
      {"customerLineNumber": "005", "ingramPartNumber": "00HA60", "quantity": "1", "carrierCode": ""}
    ]
  }' | jq .
```

---

## Step 5: Test with Custom Address

```bash
curl -s -X POST https://api.ingrammicro.com:443/resellers/v6/freightestimate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "IM-CustomerNumber: 50-979132" \
  -H "IM-CountryCode: US" \
  -H "IM-CorrelationID: cli-test-custom-$(date +%s)" \
  -H "IM-CustomerContact: abrarulhoque07@gmail.com" \
  -d '{
    "billToAddressId": "000",
    "shipToAddressId": "200",
    "shipToAddress": {
      "companyName": "Test Company",
      "addressLine1": "YOUR_ADDRESS_LINE_1",
      "addressLine2": "",
      "city": "YOUR_CITY",
      "state": "YOUR_STATE",
      "postalCode": "YOUR_ZIP",
      "countryCode": "US"
    },
    "lines": [
      {"customerLineNumber": "001", "ingramPartNumber": "00FL60", "quantity": "1", "carrierCode": ""}
    ]
  }' | jq .
```

---

## Important Notes

### Request Format Requirements
- **MUST use** `billToAddressId` and `shipToAddressId` fields (set to "000" and "200")
- **MUST use** `ingramPartNumber` field (NOT `itemNumber`)
- **MUST include** `customerLineNumber` for each line item
- **Quantity** should be a string, not a number

### Common Errors
- `"Unable to get Freight Details for this SKU"` - Part number not in Ingram system or freight not enabled
- `401 Unauthorized` - Token expired, get a new one
- No response - Check address format, must be valid US address

### Carrier Codes Reference
| Code | Name | Mode |
|------|------|------|
| UG | UPS GROUND | SML |
| RG | FEDEX GROUND | SML |
| U3 | UPS 3 DAY | AIR |
| UB | UPS 2DAY INT | AIR |
| F2 | FEDX 2 DAY | AIR |
| UO | UPS OVERNITE | AIR |
| UR | UPS NXT DAY | AIR |
| FO | FEDX STD OVR | AIR |
| Z9 | SAIA | LTL |
| RL | RL | LTL |

---

## All-in-One Script

Save this as `test-ingram-rates.sh`:

```bash
#!/bin/bash

# Get token
TOKEN=$(curl -s -X POST https://api.ingrammicro.com:443/oauth/oauth30/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials&client_id=PtbeLvNtft2yJiXiJ6UviJQOu2EON6Lc&client_secret=h1jZhUsAfHtgjk2H" \
  | jq -r .access_token)

echo "Got token: ${TOKEN:0:20}..."

# Test with multiple parts
curl -s -X POST https://api.ingrammicro.com:443/resellers/v6/freightestimate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "IM-CustomerNumber: 50-979132" \
  -H "IM-CountryCode: US" \
  -H "IM-CorrelationID: cli-test-$(date +%s)" \
  -H "IM-CustomerContact: abrarulhoque07@gmail.com" \
  -d '{
    "billToAddressId": "000",
    "shipToAddressId": "200",
    "shipToAddress": {
      "companyName": "ABC TECH",
      "addressLine1": "17501 W 98TH ST SPC 1833",
      "city": "LENEXA",
      "state": "KS",
      "postalCode": "662191736",
      "countryCode": "US"
    },
    "lines": [
      {"customerLineNumber": "001", "ingramPartNumber": "00FL60", "quantity": "1", "carrierCode": ""},
      {"customerLineNumber": "002", "ingramPartNumber": "00FW12", "quantity": "1", "carrierCode": ""}
    ]
  }' | jq .
```

Make executable: `chmod +x test-ingram-rates.sh`
