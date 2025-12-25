# Majik Subscription

**Majik Subscription** is a fully-featured class representing a subscription-based offering in the **Majik system**, designed for recurring revenue modeling, cost tracking, and subscriber capacity planning. It provides utilities for computing **MRR, ARR, revenue, profit, margins, Cost of Subscription (COS), and net income** on a per-period basis. Chainable setter methods make it easy to construct and update subscriptions fluently.

### Live Demo

[![Majik Runway Thumbnail](https://www.thezelijah.world/_next/static/media/WA_Tools_Finance_MajikRunway.c4d2034e.webp)](https://www.thezelijah.world/tools/finance-majik-runway)

> Click the image to try Majik Subscription inside Majik Runway's revenue stream.

[![Price Genie Thumbnail](https://www.thezelijah.world/_next/static/media/WA_Tools_Business_PriceGenie.dfab6d40.webp)](https://www.thezelijah.world/tools/business-price-genie)

> Click the image to try Majik Subscription inside Price Genie.

---

## Table of Contents

- [Overview](#-overview)
- [Installation](#-installation)
- [Usage](#usage)
  - [Create a Subscription Instance](#create-a-subscription-instance)
  - [Metadata Helpers](#metadata-helpers)
  - [COS Management](#cos-management)
  - [Capacity Management](#capacity-management)
  - [Finance Computation](#finance-computation)
  - [Utilities](#utilities)
- [Use Cases](#use-cases)
- [Best Practices](#best-practices)
- [Contributing](#contributing)
- [License](#license)
- [Author](#author)
- [Contact](#contact)

---

## ✨ Overview

MajikSubscription manages:

- **Metadata:** name, category, type, description, SKU, photos, rate.
- **Settings:** status, visibility, system restrictions.
- **Finance:** revenue, income, profit, COS (gross & net).
- **Capacity Plan:** Monthly subscriber or seat limits with adjustments.
- **Cost of Subscription:** Infrastructure, licensing, support, and scaling costs.
- **Recurring Billing:** Billing cycles, rate units, trials, and forecasting.
- **Serialization/Deserialization:** Convert to/from JSON with full monetary safety via [MajikMoney](https://www.npmjs.com/package/@thezelijah/majik-money).

---

## [Full API Docs](https://www.thezelijah.world/tools/finance-majik-subscription/docs)

---

## 📦 Installation

```bash
npm i @thezelijah/majik-subscription @thezelijah/majik-money@latest
```

---

## Usage

### Create a Subscription Instance

```ts
import { MajikSubscription } from "@thezelijah/majik-subscription";
import { MajikMoney } from "@thezelijah/majik-money";
import {
  SubscriptionType,
  RateUnit,
  BillingCycle,
} from "@thezelijah/majik-subscription/enums";

const subscription = MajikSubscription.initialize(
  "Pro SaaS Plan",
  SubscriptionType.RECURRING,
  {
    amount: MajikMoney.fromMajor(499, "PHP"),
    unit: RateUnit.PER_USER,
    billingCycle: BillingCycle.MONTHLY,
  },
  "Professional subscription tier",
  "SAAS-PRO-001"
);
```

Defaults:
status → ACTIVE
visibility → PRIVATE
Empty COS
Empty capacity plan
Zeroed finance snapshot

### Example Usage

```ts
import {
  SubscriptionType,
  RateUnit,
  BillingCycle,
  CapacityPeriodResizeMode,
} from "@thezelijah/majik-subscription/enums";

const proPlan = MajikSubscription.initialize(
  "Pro Plan",
  SubscriptionType.RECURRING,
  {
    amount: MajikMoney.fromMajor(29, "PHP"),
    unit: RateUnit.PER_USER,
    billingCycle: BillingCycle.MONTHLY,
  },
  "Advanced SaaS plan",
  "PRO-PLAN-001"
)
  .setDescriptionHTML("<p>Best plan for growing teams.</p>")
  .setDescriptionSEO("Pro SaaS subscription plan")
  .addCOS("Cloud Hosting", MajikMoney.fromMajor(300, "PHP"), 1, "per user")
  .addCOS("Customer Support", MajikMoney.fromMajor(100, "PHP"), 1, "per user")
  .generateCapacityPlan(12, 500) // 12 months, 500 subscribers
  .recomputeCapacityPeriod(
    "2025-01",
    "2025-12",
    CapacityPeriodResizeMode.DISTRIBUTE
  );

// Capacity insights
console.log("Total Capacity:", proPlan.totalCapacity);

// Monthly finance
const month = "2025-06";
console.log(`${month} Revenue:`, proPlan.getRevenue(month).value.toFormat());
console.log(`${month} COS:`, proPlan.getCOS(month).value.toFormat());
console.log(`${month} Profit:`, proPlan.getProfit(month).value.toFormat());
console.log(`${month} Margin:`, proPlan.getMargin(month).toFixed(2) + "%");

// Serialization
const json = proPlan.toJSON();
const restored = MajikSubscription.parseFromJSON(json);

console.log("Restored Subscription:", restored.metadata.description.text);
```

### Metadata Helpers

Chainable methods to update Subscription metadata:

| Method                             | Description                        |
| ---------------------------------- | ---------------------------------- |
| `setName(name: string)`            | Updates subscription name and slug |
| `setCategory(category: string)`    | Updates subscription category      |
| `setType(type: SubscriptionType)`  | Updates subscription type          |
| `setRate(rate: SubscriptionRate)`  | Updates pricing & billing cycle    |
| `setDescriptionText(text: string)` | Updates plain text description     |
| `setDescriptionHTML(html: string)` | Updates HTML description           |
| `setDescriptionSEO(text: string)`  | Updates SEO text                   |
| `setPhotos(urls: string[])`        | Sets subscription photo URLs       |

### COS Management

Manage the Cost of Subscription per item:

| Method                                     | Description                      |
| ------------------------------------------ | -------------------------------- |
| `addCOS(name, unitCost, quantity?, unit?)` | Add a new COS item               |
| `pushCOS(item: COSItem)`                   | Push externally created COS item |
| `updateCOS(id, updates)`                   | Update COS item                  |
| `removeCOS(id)`                            | Remove COS item                  |
| `setCOS(items: COSItem[])`                 | Replace COS list                 |
| `clearCOS()`                               | Remove all COS items             |

### Capacity Management

> Capacity adjustments are useful for modeling churn, promotions, temporary expansions, or trials.

Manage monthly capacity and Subscription plan:

| Method                                                          | Description                      |
| --------------------------------------------------------------- | -------------------------------- |
| `addCapacity(month: YYYYMM, capacity, adjustment?)`             | Add monthly capacity             |
| `updateCapacityUnits(month, units)`                             | Update capacity                  |
| `updateCapacityAdjustment(month, adjustment?)`                  | Adjust capacity                  |
| `removeCapacity(month)`                                         | Remove month                     |
| `clearCapacity()`                                               | Remove all capacity              |
| `generateCapacityPlan(months, amount, growthRate?, startDate?)` | Auto-generate capacity plan      |
| `normalizeCapacityUnits(amount)`                                | Normalize capacity across months |
| `recomputeCapacityPeriod(start, end, mode?)`                    | Resize / redistribute capacity   |

Capacity plan queries:

- `totalCapacity` → total units across all months
- `averageMonthlyCapacity` → average per month
- `maxCapacityMonth` / `minCapacityMonth` → highest/lowest monthly capacity

---

### Finance Computation

> All finance computations are normalized to monthly periods internally, regardless of billing cycle.

| Method              | Description                                   |
| ------------------- | --------------------------------------------- |
| `getRevenue(month)` | Returns gross revenue for the specified month |
| `getProfit(month)`  | Returns profit for the specified month        |
| `getCOS(month)`     | Returns total cost of Subscription for month  |
| `getMargin(month)`  | Returns margin ratio                          |

> Calculates revenue, costs, and profits per month or across all months.

- `MRR`, `ARR`
- `grossRevenue`, `grossCost`, `grossProfit` → totals across capacity plan
- `netRevenue`(month, discounts?, returns?, allowances?) → net per month
- `netProfit`(month, operatingExpenses?, taxes?, discounts?, returns?, allowances?) → net profit per month
- `getRevenue`(month), getCOS(month), getProfit(month), getMargin(month) → month-specific
- `averageMonthlyRevenue`, `averageMonthlyProfit` → averages

> All computations use **MajikMoney** and respect currency.

---

### Utilities

- `validateSelf`(throwError?: boolean) → validates all required fields
- `finalize`() → converts to JSON with auto-generated ID
- `toJSON`() → serialize with proper `MajikMoney` handling
- `parseFromJSON`(json: string | object) → reconstruct a `MajikSubscription` instance

---

## Use Cases

**MajikSubscription** is designed for recurring-revenue businesses:

1. SaaS & Software Products

- MRR / ARR tracking
- Unit economics
- Subscriber forecasting

2. Membership Platforms

- Tiered plans
- Seat-based pricing
- Capacity enforcement

3. Financial Forecasting

- Revenue projections
- Cost scaling
- Margin analysis

4. Data Integration

- API serialization
- Persistent finance models
- Dashboard analytics

---

## Best Practices

To maximize reliability, maintainability, and performance:

1. Use Chainable Setters

- Always modify subscriptions via setter methods (`setRate`, `addCOS`, `setCapacity`) to ensure timestamps and finance recalculations are handled automatically.

2. Validate Before Finalization

- Call `validateSelf`(true) before exporting or persisting the subscription to ensure all required fields are properly set.

3. Maintain Currency Consistency

- All monetary operations use MajikMoney. Avoid mixing currencies; setter methods validate against subscription  Rate currency.

4. Leverage Supply Plan Utilities

- Use `generateCapacityPlan`, `normalizeCapacityUnits`, or `recomputeCapacityPeriod` to programmatically manage monthly supply rather than manually modifying arrays.

5. Keep COS Accurate

- Always ensure unitCost and subtotal calculations are correct. Prefer addCOS or pushCOS instead of direct array mutation.

6. Minimize Finance Recomputations for Bulk Updates

- When performing bulk updates to COS or supply, consider batching changes and calling recomputeFinance once at the end to avoid repeated expensive calculations.

7. Use Snapshots for Reporting

- Use `getMonthlySnapshot`(month) for consistent monthly financial reporting and dashboards.

8. Error Handling

- All setters throw on invalid input. Wrap critical updates in try/catch to handle edge cases gracefully.

9. Serialization & Deserialization

- Use `toJSON` / finalize for exporting, and parseFromJSON for reconstruction. Avoid manually modifying the serialized object to prevent integrity issues.

---

## Conclusion

**MajikSubscription** provides a robust, financial-first approach to modeling subscriptions and recurring revenue, suitable for SaaS, memberships, and enterprise-grade forecasting systems.

## Contributing

Contributions, bug reports, and suggestions are welcome! Feel free to fork and open a pull request.

---

## License

[ISC](LICENSE) — free for personal and commercial use.

---

## Author

Made with 💙 by [@thezelijah](https://github.com/jedlsf)

## About the Developer

- **Developer**: Josef Elijah Fabian
- **GitHub**: [https://github.com/jedlsf](https://github.com/jedlsf)
- **Project Repository**: [https://github.com/jedlsf/majik-subscription](https://github.com/jedlsf/majik-subscription)

---

## Contact

- **Business Email**: [business@thezelijah.world](mailto:business@thezelijah.world)
- **Official Website**: [https://www.thezelijah.world](https://www.thezelijah.world)

---
