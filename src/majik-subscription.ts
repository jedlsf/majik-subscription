import {
  deserializeMoney,
  MajikMoney,
  serializeMoney,
} from "@thezelijah/majik-money";
import {
  COSItem,
  ISODateString,
  MonthlyCapacity,
  ObjectType,
  StartDateInput,
  SubscriptionID,
  SubscriptionMetadata,
  SubscriptionRate,
  SubscriptionSettings,
  YYYYMM,
} from "./types";
import {
  autogenerateID,
  createEmptySubscriptionFinance,
  monthsInPeriod,
  generateSlug,
  isValidYYYYMM,
  normalizeStartDate,
  offsetMonthsToYYYYMM,
  dateToYYYYMM,
} from "./utils";
import {
  CapacityPeriodResizeMode,
  RateUnit,
  SubscriptionStatus,
  SubscriptionType,
  SubscriptionVisibility,
} from "./enums";

/**
 * Represents a subscription in the Majik system.
 * Handles metadata, capacity, COS, and finance calculations (revenue, COS, profit, margins) for recurring subscriptions.
 */
export class MajikSubscription {
  readonly __type = "MajikSubscription";
  readonly __object: ObjectType = "class";
  id: SubscriptionID;
  slug: string;
  name: string;
  category: string;
  rate: SubscriptionRate;
  status: SubscriptionStatus;
  type: SubscriptionType;
  timestamp: ISODateString;
  last_update: ISODateString;
  metadata: SubscriptionMetadata;
  settings: SubscriptionSettings;
  private financeDirty = true;

  /**
   * Creates a new `MajikSubscription` instance.
   * @param {SubscriptionID | undefined} id - Optional subscription ID. Auto-generated if undefined.
   * @param {string | undefined} slug - Optional slug. Auto-generated from name if undefined.
   * @param {string} name - Name of the subscription.
   * @param {SubscriptionMetadata} metadata - Metadata including type, category, rate, description, COS, and capacity plan.
   * @param {SubscriptionSettings} settings - Settings including status, visibility, and system flags.
   * @param {ISODateString} [timestamp=new Date().toISOString()] - Optional creation timestamp.
   * @param {ISODateString} [last_update=new Date().toISOString()] - Optional last update timestamp.
   */
  constructor(
    id: SubscriptionID | undefined,
    slug: string | undefined,
    name: string,
    metadata: SubscriptionMetadata,
    settings: SubscriptionSettings,
    timestamp: ISODateString = new Date().toISOString(),
    last_update: ISODateString = new Date().toISOString()
  ) {
    this.id = id || autogenerateID("mjksub");
    this.slug = slug || generateSlug(name);
    this.name = name;
    this.metadata = metadata;
    this.settings = settings ?? {
      status: SubscriptionStatus.ACTIVE,
      visibility: SubscriptionVisibility.PRIVATE,
      system: { isRestricted: false },
    };
    this.type = this.metadata.type;
    this.category = this.metadata.category;
    this.rate = this.metadata.rate;
    this.status = this.settings.status;
    this.timestamp = timestamp;
    this.last_update = last_update;
  }

  /** Marks finance calculations as dirty for lazy recomputation */
  private markFinanceDirty(): void {
    this.financeDirty = true;
  }

  /**
   * Returns a zero-value MajikMoney object in the subscription currency.
   * @param {string} [currencyCode] - Optional currency code. Defaults to subscription rate currency or PHP.
   * @returns {MajikMoney} - A zero-value MajikMoney instance.
   */
  private DEFAULT_ZERO(currencyCode?: string): MajikMoney {
    const code = currencyCode || this.rate?.amount?.currency?.code || "PHP";
    return MajikMoney.fromMinor(0, code);
  }

  /**
   * Initializes and creates a new `MajikSubscription` with default and null values.
   * @param type - The type of service to initialize. Defaults to `TIME_BASED`. Use Enum `ServiceType`.
   * @returns A new `MajikSubscription` instance.
   */
  static initialize(
    name: string,
    type: SubscriptionType = SubscriptionType.RECURRING,
    rate: SubscriptionRate,
    category: string = "Other",
    descriptionText?: string,
    skuID?: string
  ): MajikSubscription {
    if (!name || typeof name !== "string" || name.trim() === "") {
      throw new Error("Name must be a valid non-empty string.");
    }

    if (!category || typeof category !== "string" || category.trim() === "") {
      throw new Error("Category must be a valid non-empty string.");
    }

    // Set default values for optional parameters
    const defaultMetadata: SubscriptionMetadata = {
      description: {
        text: descriptionText || "A new subscription.",
      },
      type: type,
      category: category,
      rate: rate,
      sku: skuID || undefined,
      cos: [],
      finance: createEmptySubscriptionFinance(rate.amount.currency.code),
    };

    const defaultSettings: SubscriptionSettings = {
      visibility: SubscriptionVisibility.PRIVATE,
      status: SubscriptionStatus.ACTIVE,
      system: {
        isRestricted: false,
      },
    };

    return new MajikSubscription(
      undefined,
      undefined,
      name || "My Subscription",
      defaultMetadata,
      defaultSettings,
      undefined,
      undefined
    );
  }

  /* ------------------ METADATA HELPERS ------------------ */

  /**
   * Updates the subscription name and regenerates the slug.
   * @param {string} name - New subscription name.
   * @returns {MajikSubscription} - Returns self for chaining.
   */
  setName(name: string): this {
    this.name = name;
    this.slug = generateSlug(name);
    this.updateTimestamp();
    return this;
  }

  /**
   * Updates the subscription rate.
   * @param {SubscriptionRate} rate - New rate object.
   * @returns {MajikSubscription} - Returns self for chaining.
   */
  setRate(rate: SubscriptionRate): this {
    this.rate = rate;
    this.metadata.rate = rate;
    this.updateTimestamp();
    this.markFinanceDirty();
    return this;
  }

  /**
   * Updates the rate unit.
   * @param {RateUnit} unit - New rate unit (e.g., per subscriber, per month).
   * @returns {MajikSubscription} - Returns self for chaining.
   */
  setRateUnit(unit: RateUnit): this {
    this.rate.unit = unit;
    this.metadata.rate.unit = unit;
    this.updateTimestamp();
    this.markFinanceDirty();
    return this;
  }

  /**
   * Updates the numeric rate amount.
   * @param {number} amount - New rate amount (must be positive).
   * @returns {MajikSubscription} - Returns self for chaining.
   * @throws Will throw an error if amount is non-positive.
   */
  setRateAmount(amount: number): this {
    if (amount <= 0) throw new Error("Rate Amount must be positive");
    this.rate.amount = MajikMoney.fromMajor(
      amount,
      this.rate.amount.currency.code
    );
    this.metadata.rate.amount = MajikMoney.fromMajor(
      amount,
      this.metadata.rate.amount.currency.code
    );
    this.updateTimestamp();
    this.markFinanceDirty();
    return this;
  }

  /**
   * Updates the subscription category.
   * @param {string} category - New category name.
   * @returns {MajikSubscription} - Returns self for chaining.
   */
  setCategory(category: string): this {
    this.category = category;
    this.metadata.category = category;
    this.updateTimestamp();
    return this;
  }

  /**
   * Updates the HTML and plain text of the subscription description.
   * @param {string} html - The new HTML description.
   * @param {string} text - The new plain text description.
   * @returns {MajikSubscription} - Returns self for chaining.
   * @throws Will throw an error if either html or text is invalid.
   */
  setDescription(html: string, text: string): this {
    if (!html || typeof html !== "string" || html.trim() === "")
      throw new Error("HTML must be a valid non-empty string.");
    if (!text || typeof text !== "string" || text.trim() === "")
      throw new Error("Text must be a valid non-empty string.");
    this.metadata.description.html = html;
    this.metadata.description.text = text;
    this.updateTimestamp();
    return this;
  }

  /**
   * Updates only the plain text of the subscription description.
   * @param {string} text - The new plain text description.
   * @returns {MajikSubscription} - Returns self for chaining.
   * @throws Will throw an error if text is invalid.
   */
  setDescriptionText(text: string): this {
    if (!text || typeof text !== "string" || text.trim() === "")
      throw new Error("Description Text must be a valid non-empty string.");
    this.metadata.description.text = text;
    this.updateTimestamp();
    return this;
  }

  /**
   * Updates only the HTML of the subscription description.
   * @param {string} html - The new HTML description.
   * @returns {MajikSubscription} - Returns self for chaining.
   * @throws Will throw an error if html is invalid.
   */
  setDescriptionHTML(html: string): this {
    if (!html || typeof html !== "string" || html.trim() === "")
      throw new Error("Description HTML must be a valid non-empty string.");
    this.metadata.description.html = html;
    this.updateTimestamp();
    return this;
  }

  /**
   * Updates SEO-friendly text of the subscription description.
   * @param {string} text - SEO text.
   * @returns {MajikSubscription} - Returns self for chaining.
   */
  setDescriptionSEO(text: string): this {
    if (!text || typeof text !== "string" || text.trim() === "") {
      this.metadata.description.seo = undefined;
      this.updateTimestamp();
      return this;
    }
    this.metadata.description.seo = text;
    this.updateTimestamp();
    return this;
  }

  /**
   * Updates the Type of the Subscription.
   * @param type - The new Type of the Subscription. Use Enum `SubscriptionType`.
   * @throws Will throw an error if the `type` is not provided or is not a string.
   */
  setType(type: SubscriptionType): this {
    if (!Object.values(SubscriptionType).includes(type)) {
      throw new Error("Invalid Subscription type.");
    }

    this.metadata.type = type;
    this.type = type;
    this.updateTimestamp();
    return this;
  }

  /**
   * Returns SEO text if available; otherwise the plain text description.
   * @returns {string} - SEO or plain text description.
   */
  get seo(): string {
    if (!!this.metadata.description.seo?.trim())
      return this.metadata.description.seo;
    return this.metadata.description.text;
  }

  /* ------------------ COS MANAGEMENT ------------------ */

  /**
   * Returns true if the subscription has at least one COS (cost breakdown) item.
   */
  hasCostBreakdown(): boolean {
    return Array.isArray(this.metadata.cos) && this.metadata.cos.length > 0;
  }

  /**
   * Adds a new COS (Cost of Subscription) item.
   * @param {string} name - COS item name.
   * @param {MajikMoney} unitCost - Cost per unit.
   * @param {number} [quantity=1] - Number of units.
   * @param {string} [unit] - Optional unit (e.g., "subscriber", "month").
   * @returns {MajikSubscription} - Returns self for chaining.
   */
  addCOS(
    name: string,
    unitCost: MajikMoney,
    quantity: number = 1,
    unit?: string
  ): this {
    if (!name.trim()) throw new Error("COS name cannot be empty");
    if (quantity <= 0)
      throw new Error("COS quantity must be greater than zero");
    this.assertCurrency(unitCost);

    const newItem: COSItem = {
      id: autogenerateID("mjksubcost"),
      item: name,
      quantity,
      unitCost,
      unit,
      subtotal: unitCost.multiply(quantity),
    };

    this.metadata.cos.push(newItem);
    this.updateTimestamp();
    this.markFinanceDirty();
    return this;
  }

  /**
   * Pushes an existing COSItem into the metadata.
   * @param {COSItem} item - COSItem to add.
   * @returns {MajikSubscription} - Returns self for chaining.
   * @throws Will throw an error if item is missing required properties or has currency mismatch.
   */
  pushCOS(item: COSItem): this {
    if (!item.id) throw new Error("COS item must have an id");
    if (!item.item?.trim()) throw new Error("COS item must have a name");
    if (item.quantity <= 0)
      throw new Error("COS quantity must be greater than zero");
    this.assertCurrency(item.unitCost);
    item.subtotal = item.unitCost.multiply(item.quantity);

    this.metadata.cos.push(item);
    this.updateTimestamp();
    this.markFinanceDirty();
    return this;
  }

  /**
   * Updates an existing COS item by ID.
   * @param {string} id - COS item ID.
   * @param {Partial<Pick<COSItem, "quantity" | "unitCost" | "unit">>} updates - Fields to update.
   * @returns {MajikSubscription} - Returns self for chaining.
   * @throws Will throw an error if the COS item does not exist or has invalid updates.
   */
  updateCOS(
    id: string,
    updates: Partial<Pick<COSItem, "quantity" | "unitCost" | "unit" | "item">>
  ): this {
    const item = this.metadata.cos.find((c) => c.id === id);
    if (!item) throw new Error(`COS item ${id} not found`);

    if (updates.quantity !== undefined) {
      if (updates.quantity <= 0) throw new Error("Quantity must be positive");
      item.quantity = updates.quantity;
    }

    if (updates.unitCost) {
      this.assertCurrency(updates.unitCost);
      item.unitCost = updates.unitCost;
    }

    if (!!updates?.item?.trim()) {
      item.item = updates.item;
    }

    item.unit = updates.unit ?? item.unit;
    item.subtotal = item.unitCost.multiply(item.quantity);

    this.updateTimestamp();
    this.markFinanceDirty();
    return this;
  }

  /**
   * Replaces all COS items with a new array.
   * @param {COSItem[]} items - Array of COS items.
   * @returns {MajikSubscription} - Returns self for chaining.
   * @throws Will throw an error if items are missing required properties or have currency mismatch.
   */
  setCOS(items: COSItem[]): this {
    items.forEach((item) => {
      if (
        !item.id ||
        !item.item ||
        !item.unitCost ||
        item.quantity == null ||
        !item.subtotal
      ) {
        throw new Error(
          "Each COSItem must have id, item, unitCost, quantity, and subtotal"
        );
      }
      this.assertCurrency(item.unitCost);
    });
    this.metadata.cos = [...items];
    this.updateTimestamp();
    this.markFinanceDirty();
    return this;
  }

  /**
   * Removes a COS item by ID.
   * @param {string} id - COS item ID.
   * @returns {MajikSubscription} - Returns self for chaining.
   * @throws Will throw an error if the COS item does not exist.
   */
  removeCOS(id: string): this {
    const index = this.metadata.cos.findIndex((c) => c.id === id);
    if (index === -1) throw new Error(`COS item with id ${id} not found`);
    this.metadata.cos.splice(index, 1);
    this.updateTimestamp();
    this.markFinanceDirty();
    return this;
  }

  /** Clears all COS items. */
  clearCostBreakdown(): this {
    this.metadata.cos.length = 0;
    this.updateTimestamp();
    this.markFinanceDirty();
    return this;
  }

  /* ------------------ CAPACITY MANAGEMENT ------------------ */

  /**
   * Returns true if the subscription has at least one Capacity Plan item.
   */
  hasCapacity(): boolean {
    return (
      Array.isArray(this.metadata.capacityPlan) &&
      this.metadata.capacityPlan.length > 0
    );
  }

  /**
   * Returns the earliest (initial) YYYYMM from the capacity plan.
   */
  get earliestCapacityMonth(): YYYYMM | null {
    if (!this.hasCapacity()) return null;

    const supply = this.metadata.capacityPlan!;

    return supply.reduce(
      (earliest, current) =>
        current.month < earliest ? current.month : earliest,
      supply[0].month
    );
  }

  /**
   * Returns the most recent (latest) YYYYMM from the capacity plan.
   */
  get latestCapacityMonth(): YYYYMM | null {
    if (!this.hasCapacity()) return null;

    const supply = this.metadata.capacityPlan!;

    return supply.reduce(
      (latest, current) => (current.month > latest ? current.month : latest),
      supply[0].month
    );
  }

  get capacity(): MonthlyCapacity[] {
    return this.metadata?.capacityPlan || [];
  }

  /**
   * Returns the total capacity units across all months.
   */
  get totalCapacity(): number {
    const capacity = this.metadata.capacityPlan ?? [];
    return capacity.reduce(
      (sum, c) => sum + c.capacity + (c.adjustment ?? 0),
      0
    );
  }

  /**
   * Returns the average capacity per month.
   * Includes adjustments.
   */
  get averageMonthlyCapacity(): number {
    const capacity = this.metadata.capacityPlan ?? [];
    if (capacity.length === 0) return 0;

    return this.totalCapacity / capacity.length;
  }

  /**
   * Returns the MonthlyCapacity entry with the highest supply.
   * Includes adjustments.
   */
  get maxSupplyMonth(): MonthlyCapacity | null {
    const supply = this.metadata.capacityPlan ?? [];
    if (supply.length === 0) return null;

    return supply.reduce((max, current) => {
      const maxUnits = max.capacity + (max.adjustment ?? 0);
      const currUnits = current.capacity + (current.adjustment ?? 0);
      return currUnits > maxUnits ? current : max;
    });
  }

  /**
   * Returns the MonthlyCapacity entry with the lowest supply.
   * Includes adjustments.
   */
  get minSupplyMonth(): MonthlyCapacity | null {
    const supply = this.metadata.capacityPlan ?? [];
    if (supply.length === 0) return null;

    return supply.reduce((min, current) => {
      const minUnits = min.capacity + (min.adjustment ?? 0);
      const currUnits = current.capacity + (current.adjustment ?? 0);
      return currUnits < minUnits ? current : min;
    });
  }

  /**
   * Generates and replaces the capacity plan automatically.
   *
   * @param months - Number of months to generate from the start date.
   * @param amount - Base units for the first month.
   * @param growthRate - Optional growth rate per month (e.g. 0.03 = +3%).
   * @param startDate - Date | ISO date | YYYYMM. Defaults to current month.
   * @returns {this} Updated subscription instance.
   */
  generateCapacityPlan(
    months: number,
    amount: number,
    growthRate: number = 0,
    startDate?: StartDateInput
  ): this {
    if (!Number.isInteger(months) || months <= 0) {
      throw new Error("Months must be a positive integer");
    }

    if (!Number.isFinite(amount) || amount < 0) {
      throw new Error("Amount must be a non-negative number");
    }

    if (growthRate < 0) {
      throw new Error("Growth rate cannot be negative");
    }

    const start = normalizeStartDate(startDate);
    const supplyPlan: MonthlyCapacity[] = [];

    let currentUnits = amount;

    for (let i = 0; i < months; i++) {
      const date = new Date(start.getFullYear(), start.getMonth() + i, 1);

      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, "0");
      const month = `${yyyy}-${mm}` as YYYYMM;

      supplyPlan.push({
        month,
        capacity: Math.round(currentUnits),
      });

      if (growthRate > 0) {
        currentUnits *= 1 + growthRate;
      }
    }

    return this.setCapacity(supplyPlan);
  }

  /**
   * Normalizes all supply plan entries to have the same unit amount.
   *
   * - Throws if supply plan is empty
   * - If only one entry exists, does nothing
   * - If multiple entries exist, sets all units to the provided amount
   *
   * @param amount - Unit amount to apply to all months
   * @returns {this} Updated subscription instance
   */
  normalizeCapacityUnits(amount: number): this {
    if (!Number.isFinite(amount) || amount < 0) {
      throw new Error("Amount must be a non-negative number");
    }

    const supply = this.metadata.capacityPlan;

    if (!supply || supply.length === 0) {
      throw new Error("Supply plan is empty");
    }

    if (supply.length === 1) {
      return this;
    }

    supply.forEach((s) => {
      s.capacity = amount;
    });

    this.updateTimestamp();
    this.markFinanceDirty();

    return this;
  }

  recomputeCapacityPeriod(
    start: YYYYMM,
    end: YYYYMM,
    mode: CapacityPeriodResizeMode = CapacityPeriodResizeMode.DEFAULT
  ): this {
    if (!isValidYYYYMM(start) || !isValidYYYYMM(end)) {
      throw new Error("Invalid YYYYMM period");
    }

    if (!this.hasCapacity()) {
      throw new Error("No existing capacity plan to recompute");
    }

    if (start > end) {
      throw new Error("Start month must be <= end month");
    }

    const newLength = monthsInPeriod(start, end);
    const oldPlan = [...this.metadata.capacityPlan!];
    const oldLength = oldPlan.length;

    const newPlan: MonthlyCapacity[] = [];

    if (mode === CapacityPeriodResizeMode.DEFAULT) {
      for (let i = 0; i < newLength; i++) {
        const source = i < oldLength ? oldPlan[i] : oldPlan[oldLength - 1]; // extend using last known value

        newPlan.push({
          month: offsetMonthsToYYYYMM(start, i),
          capacity: source.capacity,
          adjustment: source.adjustment,
        });
      }
    }

    if (mode === CapacityPeriodResizeMode.DISTRIBUTE) {
      const total = this.totalCapacity;
      const base = Math.floor(total / newLength);
      let remainder = total % newLength;

      for (let i = 0; i < newLength; i++) {
        const extra = remainder > 0 ? 1 : 0;
        remainder--;

        newPlan.push({
          month: offsetMonthsToYYYYMM(start, i),
          capacity: base + extra,
        });
      }
    }

    this.metadata.capacityPlan = newPlan;
    this.updateTimestamp();
    this.markFinanceDirty();

    return this;
  }

  /**
   * Sets the entire monthly capacity plan.
   * @param {MonthlyCapacity[]} capacityPlan - Array of MonthlyCapacity.
   * @returns {MajikSubscription} - Returns self for chaining.
   * @throws Will throw an error if month format or capacity is invalid.
   */
  setCapacity(capacityPlan: MonthlyCapacity[]): this {
    capacityPlan.forEach((s) => {
      if (!isValidYYYYMM(s.month)) throw new Error(`Invalid month: ${s.month}`);
      if (typeof s.capacity !== "number")
        throw new Error("Capacity must be a number");
    });
    this.metadata.capacityPlan = [...capacityPlan];
    this.updateTimestamp();
    this.markFinanceDirty();
    return this;
  }

  /**
   * Adds capacity for a specific month.
   * @param {YYYYMM} month - YYYY-MM string.
   * @param {number} units - Number of subscription units for the month.
   * @param {number} [adjustment] - Optional adjustment to capacity.
   * @returns {MajikSubscription} - Returns self for chaining.
   * @throws Will throw an error if month already exists.
   */
  addCapacity(month: YYYYMM, units: number, adjustment?: number): this {
    if (!isValidYYYYMM(month)) throw new Error("Invalid month");
    this.metadata.capacityPlan ??= [];
    if (this.metadata.capacityPlan.some((s) => s.month === month)) {
      throw new Error(
        `Month ${month} already exists. Use updateCapacityUnits or updateCapacityAdjustment`
      );
    }
    this.metadata.capacityPlan.push({ month, capacity: units, adjustment });
    this.updateTimestamp();
    this.markFinanceDirty();
    return this;
  }

  /**
   * Updates capacity units for a month.
   * @param {YYYYMM} month - YYYY-MM string.
   * @param {number} units - New subscription units.
   * @returns {MajikSubscription} - Returns self for chaining.
   * @throws Will throw an error if month does not exist.
   */
  updateCapacityUnits(month: YYYYMM, units: number): this {
    if (!isValidYYYYMM(month)) throw new Error("Invalid month");
    const plan = this.metadata.capacityPlan?.find((s) => s.month === month);
    if (!plan) throw new Error(`Month ${month} not found`);
    plan.capacity = units;
    this.updateTimestamp();
    this.markFinanceDirty();
    return this;
  }

  /**
   * Updates capacity adjustment for a month.
   * @param {YYYYMM} month - YYYY-MM string.
   * @param {number} [adjustment] - Optional adjustment value.
   * @returns {MajikSubscription} - Returns self for chaining.
   * @throws Will throw an error if month does not exist.
   */
  updateCapacityAdjustment(month: YYYYMM, adjustment?: number): this {
    if (!isValidYYYYMM(month)) throw new Error("Invalid month");
    const plan = this.metadata.capacityPlan?.find((s) => s.month === month);
    if (!plan) throw new Error(`Month ${month} not found`);
    plan.adjustment = adjustment;
    this.updateTimestamp();
    this.markFinanceDirty();
    return this;
  }

  /**
   * Removes a month from the capacity plan.
   * @param {YYYYMM} month - YYYY-MM string.
   * @returns {MajikSubscription} - Returns self for chaining.
   * @throws Will throw an error if month does not exist.
   */
  removeCapacity(month: YYYYMM): this {
    if (!isValidYYYYMM(month)) throw new Error("Invalid month");
    const index = this.metadata.capacityPlan?.findIndex(
      (s) => s.month === month
    );
    if (index === undefined || index === -1)
      throw new Error(`Month ${month} not found`);
    this.metadata.capacityPlan!.splice(index, 1);
    this.updateTimestamp();
    this.markFinanceDirty();
    return this;
  }

  /** Clears the entire capacity plan. */
  clearCapacity(): this {
    this.metadata.capacityPlan = [];
    this.updateTimestamp();
    this.markFinanceDirty();
    return this;
  }

  /* ------------------ FINANCE HELPERS ------------------ */

  /** Computes gross revenue across all months. */
  private computeGrossRevenue(): MajikMoney {
    const plan = this.metadata.capacityPlan ?? [];
    return plan.reduce(
      (acc, s) =>
        acc.add(this.rate.amount.multiply(s.capacity + (s.adjustment ?? 0))),
      this.DEFAULT_ZERO()
    );
  }

  /** Computes gross COS across all months. */
  private computeGrossCOS(): MajikMoney {
    const plan = this.metadata.capacityPlan ?? [];
    const unitCOS = this.metadata.cos.reduce(
      (acc, c) => acc.add(c.subtotal),
      this.DEFAULT_ZERO()
    );
    return plan.reduce(
      (acc, s) => acc.add(unitCOS.multiply(s.capacity + (s.adjustment ?? 0))),
      this.DEFAULT_ZERO()
    );
  }

  /** Computes gross profit (revenue - COS). */
  private computeGrossProfit(): MajikMoney {
    return this.computeGrossRevenue().subtract(this.computeGrossCOS());
  }

  /** Recomputes and stores aggregate finance info. */
  private recomputeFinance(): void {
    if (!this.financeDirty) return;

    const grossRevenue = this.computeGrossRevenue();
    const grossCOS = this.computeGrossCOS();
    const grossProfit = this.computeGrossProfit();
    const grossIncome = grossProfit;

    const revenueMargin = grossRevenue.isZero()
      ? 0
      : grossProfit.ratio(grossRevenue);
    const cosMargin = grossRevenue.isZero() ? 0 : grossCOS.ratio(grossRevenue);

    this.metadata.finance = {
      revenue: {
        gross: { value: grossRevenue, marginRatio: 1 },
        net: { value: grossRevenue, marginRatio: 1 },
      },
      cos: {
        gross: { value: grossCOS, marginRatio: cosMargin },
        net: { value: grossCOS, marginRatio: cosMargin },
      },
      profit: {
        gross: { value: grossProfit, marginRatio: revenueMargin },
        net: { value: grossProfit, marginRatio: revenueMargin },
      },
      income: {
        gross: { value: grossIncome, marginRatio: revenueMargin },
        net: { value: grossIncome, marginRatio: revenueMargin },
      },
    };

    this.financeDirty = false;
  }

  /* ------------------ AGGREGATE FINANCE GETTERS ------------------ */

  get averageMonthlyRevenue(): MajikMoney {
    const months = this.metadata.capacityPlan?.length ?? 0;
    if (months === 0) return this.DEFAULT_ZERO();
    return this.grossRevenue.divide(months);
  }

  get averageMonthlyProfit(): MajikMoney {
    const months = this.metadata.capacityPlan?.length ?? 0;
    if (months === 0) return this.DEFAULT_ZERO();
    return this.grossProfit.divide(months);
  }

  /**
   * Returns total gross revenue across all months.
   * @returns {MajikMoney} - Gross revenue.
   */
  get grossRevenue(): MajikMoney {
    this.recomputeFinance();
    return this.metadata.finance.revenue.gross.value;
  }

  /**
   * Returns total gross cost of subscription (COS) across all months.
   * @returns {MajikMoney} - Gross COS.
   */
  get grossCost(): MajikMoney {
    this.recomputeFinance();
    return this.metadata.finance.cos.gross.value;
  }

  /**
   * Returns total gross profit across all months.
   * @returns {MajikMoney} - Gross profit.
   */
  get grossProfit(): MajikMoney {
    this.recomputeFinance();
    return this.metadata.finance.profit.gross.value;
  }

  /**
   * Returns net revenue (same as gross in this model).
   * @returns {MajikMoney} - Net revenue.
   */
  get netRevenue(): MajikMoney {
    this.recomputeFinance();
    return this.metadata.finance.revenue.net.value;
  }

  /**
   * Returns net profit (same as gross in this model).
   * @returns {MajikMoney} - Net profit.
   */
  get netProfit(): MajikMoney {
    this.recomputeFinance();
    return this.metadata.finance.profit.net.value;
  }

  get unitCost(): MajikMoney {
    return this.metadata.cos.reduce(
      (acc, c) => acc.add(c.subtotal),
      this.DEFAULT_ZERO()
    );
  }

  get unitProfit(): MajikMoney {
    return this.rate.amount.subtract(this.unitCost);
  }

  get unitMargin(): number {
    return this.rate.amount.isZero()
      ? 0
      : this.unitProfit.ratio(this.rate.amount);
  }

  get price(): MajikMoney {
    return this.rate.amount.isZero() ? this.DEFAULT_ZERO() : this.rate.amount;
  }

  getMonthlySnapshot(month: YYYYMM) {
    return {
      month,
      revenue: this.getRevenue(month),
      cogs: this.getCOS(month),
      profit: this.getProfit(month),
      margin: this.getMargin(month),
      netRevenue: this.getNetRevenue(month),
      netIncome: this.getNetIncome(month),
    };
  }

  /**
   * Calculates Net Revenue for a given month.
   * @param month - YYYYMM
   * @param discounts - Total discounts for the month (optional)
   * @param returns - Total returns for the month (optional)
   * @param allowances - Total allowances for the month (optional)
   * @returns {MajikMoney} Net Revenue
   */
  getNetRevenue(
    month: YYYYMM,
    discounts?: MajikMoney,
    returns?: MajikMoney,
    allowances?: MajikMoney
  ): MajikMoney {
    if (!isValidYYYYMM(month)) throw new Error("Invalid month");
    let net = this.getRevenue(month);
    if (discounts) net = net.subtract(discounts);
    if (returns) net = net.subtract(returns);
    if (allowances) net = net.subtract(allowances);
    return net;
  }

  /**
   * Calculates Net Profit for a given month.
   * @param month - YYYYMM
   * @param operatingExpenses - Total operating expenses (optional)
   * @param taxes - Total taxes (optional)
   * @param discounts - Total discounts for the month (optional)
   * @param returns - Total returns for the month (optional)
   * @param allowances - Total allowances for the month (optional)
   * @returns {MajikMoney} Net Profit
   */
  getNetProfit(
    month: YYYYMM,
    operatingExpenses?: MajikMoney,
    taxes?: MajikMoney,
    discounts?: MajikMoney,
    returns?: MajikMoney,
    allowances?: MajikMoney
  ): MajikMoney {
    if (!isValidYYYYMM(month)) throw new Error("Invalid month");
    let netRev = this.getNetRevenue(month, discounts, returns, allowances);
    if (operatingExpenses) netRev = netRev.subtract(operatingExpenses);
    if (taxes) netRev = netRev.subtract(taxes);
    return netRev;
  }

  /**
   * Alias for getNetProfit, same as Net Income
   */
  getNetIncome(
    month: YYYYMM,
    operatingExpenses?: MajikMoney,
    taxes?: MajikMoney,
    discounts?: MajikMoney,
    returns?: MajikMoney,
    allowances?: MajikMoney
  ): MajikMoney {
    if (!isValidYYYYMM(month)) throw new Error("Invalid month");
    return this.getNetProfit(
      month,
      operatingExpenses,
      taxes,
      discounts,
      returns,
      allowances
    );
  }

  /* ------------------ MONTHLY FINANCE ------------------ */

  /**
   * Returns revenue for a specific month.
   * @param {YYYYMM} month - Month in YYYY-MM format.
   * @returns {MajikMoney} - Monthly revenue.
   */
  getRevenue(month: YYYYMM): MajikMoney {
    if (!isValidYYYYMM(month)) throw new Error("Invalid month");
    const plan = this.metadata.capacityPlan?.find((s) => s.month === month);
    if (!plan) return this.DEFAULT_ZERO();
    return this.rate.amount.multiply(plan.capacity + (plan.adjustment ?? 0));
  }

  /**
   * Returns all COS items.
   * @returns {readonly COSItem[]} - Array of COS items.
   */
  get cos(): readonly COSItem[] {
    return this.metadata.cos;
  }

  /**
   * Returns COS for a specific month.
   * @param {YYYYMM} month - Month in YYYY-MM format.
   * @returns {MajikMoney} - Monthly COS.
   */
  getCOS(month: YYYYMM): MajikMoney {
    if (!isValidYYYYMM(month)) throw new Error("Invalid month");
    const plan = this.metadata.capacityPlan?.find((s) => s.month === month);
    if (!plan) return this.DEFAULT_ZERO();
    const perUnitCOS = this.metadata.cos.reduce(
      (acc, c) => acc.add(c.subtotal),
      this.DEFAULT_ZERO()
    );
    return perUnitCOS.multiply(plan.capacity + (plan.adjustment ?? 0));
  }

  /**
   * Alias for Get COS. Retrieves COS for a given month.
   * @param month - YYYYMM month.
   * @returns {MajikMoney} COS for the month.
   */
  getCost(month: YYYYMM): MajikMoney {
    return this.getCOS(month);
  }

  /**
   * Returns profit for a specific month.
   * @param {YYYYMM} month - Month in YYYY-MM format.
   * @returns {MajikMoney} - Monthly profit.
   */
  getProfit(month: YYYYMM): MajikMoney {
    if (!isValidYYYYMM(month)) throw new Error("Invalid month");
    return this.getRevenue(month).subtract(this.getCOS(month));
  }

  /**
   * Returns profit margin (as a decimal) for a specific month.
   * @param {YYYYMM} month - Month in YYYY-MM format.
   * @returns {number} - Profit margin (0–1).
   */
  getMargin(month: YYYYMM): number {
    if (!isValidYYYYMM(month)) throw new Error("Invalid month");
    const revenue = this.getRevenue(month);
    return revenue.isZero()
      ? 0
      : this.getProfit(month)
          .divideDecimal(revenue.toMajorDecimal())
          .toNumber();
  }

  /* ------------------ SUBSCRIPTION-SPECIFIC METHODS ------------------ */

  /**
   * Applies a trial period to the subscription by reducing the capacity or revenue for the given number of months.
   * @param {number} months - Number of months for the trial period.
   * @returns {MajikSubscription} - Returns self for chaining.
   * @throws {Error} - Throws if months is not a positive integer.
   */
  applyTrial(months: number): this {
    if (!Number.isInteger(months) || months <= 0)
      throw new Error("Trial months must be a positive integer");
    if (!this.metadata.capacityPlan) return this;

    // Reduce the capacity for the first N months to 0
    const sortedPlan = [...this.metadata.capacityPlan].sort((a, b) =>
      a.month.localeCompare(b.month)
    );
    for (let i = 0; i < months && i < sortedPlan.length; i++) {
      sortedPlan[i].adjustment =
        (sortedPlan[i].adjustment ?? 0) - sortedPlan[i].capacity;
    }
    this.metadata.capacityPlan = sortedPlan;
    this.updateTimestamp();
    this.markFinanceDirty();
    return this;
  }

  /**
   * Computes the next billing date for the subscription.
   * Assumes subscription billing is monthly and starts at the first month in the capacity plan.
   * @returns {ISODateString | null} - Next billing date in ISO format, or null if no capacity plan exists.
   */
  nextBillingDate(): ISODateString | null {
    if (!this.metadata.capacityPlan || this.metadata.capacityPlan.length === 0)
      return null;

    // Find the next month after current date
    const now = new Date();
    const sortedMonths = [...this.metadata.capacityPlan].sort((a, b) =>
      a.month.localeCompare(b.month)
    );
    for (const monthEntry of sortedMonths) {
      const [year, month] = monthEntry.month.split("-").map(Number);
      const firstOfMonth = new Date(year, month - 1, 1);
      if (firstOfMonth > now) return firstOfMonth.toISOString();
    }

    // If all months are in the past, return first month of next year
    const lastMonth = sortedMonths[sortedMonths.length - 1];
    const [lastYear, lastMonthNum] = lastMonth.month.split("-").map(Number);
    const nextMonthDate = new Date(lastYear, lastMonthNum, 1);
    return nextMonthDate.toISOString();
  }

  /**
   * Forecasts revenue for the next N months based on current rate and capacity plan.
   * @param {number} nextNMonths - Number of future months to forecast.
   * @returns {MajikMoney} - Forecasted revenue as MajikMoney.
   * @throws {Error} - Throws if nextNMonths is not a positive integer.
   */
  forecastRevenue(nextNMonths: number): MajikMoney {
    if (!Number.isInteger(nextNMonths) || nextNMonths <= 0)
      throw new Error("nextNMonths must be a positive integer");
    if (!this.metadata.capacityPlan || this.metadata.capacityPlan.length === 0)
      return this.DEFAULT_ZERO();

    const sortedPlan = [...this.metadata.capacityPlan].sort((a, b) =>
      a.month.localeCompare(b.month)
    );
    let forecast = this.DEFAULT_ZERO();

    for (let i = 0; i < nextNMonths; i++) {
      const monthEntry = sortedPlan[i % sortedPlan.length]; // loop over plan if nextNMonths > plan length
      const capacity = monthEntry.capacity + (monthEntry.adjustment ?? 0);
      forecast = forecast.add(this.rate.amount.multiply(capacity));
    }

    return forecast;
  }

  /** Monthly Recurring Revenue (MRR) for a specific month or current month if not provided */
  getMRR(month?: YYYYMM): MajikMoney {
    if (!month) {
      month = dateToYYYYMM(new Date());
    }
    return this.getRevenue(month);
  }

  /** Annual Recurring Revenue (ARR) based on sum of next 12 months revenue
   *
   * Forecasts revenue for the next N months based on current rate and capacity plan.
   * @param {number} months - Number of future months to forecast. Defaults to 12.
   */

  getARR(months: number = 12): MajikMoney {
    return this.forecastRevenue(months);
  }

  /* ------------------ UTILITIES ------------------ */

  /**
   * Validates the subscription instance.
   * @param {boolean} [throwError=false] - Whether to throw an error on first invalid property.
   * @returns {boolean} - True if valid, false if invalid and throwError is false.
   * @throws {Error} - Throws error if throwError is true and a required field is missing/invalid.
   */
  validateSelf(throwError: boolean = false): boolean {
    const requiredFields = [
      { field: this.id, name: "ID" },
      { field: this.timestamp, name: "Timestamp" },
      { field: this.name, name: "Subscription Name" },
      { field: this.metadata.description.text, name: "Description" },
      { field: this.metadata.rate.amount.toMajor(), name: "Rate Amount" },
      { field: this.metadata.rate.unit, name: "Rate Unit" },
    ];

    for (const { field, name } of requiredFields) {
      if (field === null || field === undefined || field === "") {
        if (throwError)
          throw new Error(
            `Validation failed: Missing or invalid property - ${name}`
          );
        return false;
      }
    }

    return true;
  }

  /**
   * Converts the subscription to a plain object and generates a new ID.
   * @returns {object} - Serialized subscription.
   */
  finalize(): object {
    return { ...this.toJSON(), id: autogenerateID("mjksub") };
  }

  /**
   * Converts the subscription instance to a plain JSON object.
   * @returns {object} - Plain object representation.
   */
  toJSON(): object {
    const preJSON = {
      __type: "MajikSubscription",
      __object: "json",
      id: this.id,
      slug: this.slug,
      name: this.name,
      category: this.category,
      rate: this.rate,
      status: this.status,
      type: this.type,
      timestamp: this.timestamp,
      last_update: this.last_update,
      metadata: this.metadata,
      settings: this.settings,
    };
    return serializeMoney(preJSON);
  }

  /**
   * Parses a plain object or JSON string into a MajikSubscription instance.
   * @param {string | object} json - JSON string or object.
   * @returns {MajikSubscription} - Parsed subscription instance.
   * @throws {Error} - Throws if required properties are missing.
   */
  static parseFromJSON(json: string | object): MajikSubscription {
    const rawParse =
      typeof json === "string" ? JSON.parse(json) : structuredClone(json);
    const parsedData = deserializeMoney(rawParse);

    if (!parsedData.id) throw new Error("Missing required property: 'id'");
    if (!parsedData.timestamp)
      throw new Error("Missing required property: 'timestamp'");
    if (!parsedData.metadata)
      throw new Error("Missing required property: 'metadata'");
    if (!parsedData.settings)
      throw new Error("Missing required property: 'settings'");

    return new MajikSubscription(
      parsedData.id,
      parsedData.slug,
      parsedData.name,
      parsedData.metadata,
      parsedData.settings,
      parsedData.timestamp,
      parsedData.last_update
    );
  }

  /**
   * Updates the last_update timestamp to current time.
   * Should be called whenever a property is modified.
   * @private
   */
  private updateTimestamp(): void {
    this.last_update = new Date().toISOString();
  }

  /**
   * Ensures the given MajikMoney object matches the subscription currency.
   * @param {MajikMoney} money - Money object to validate.
   * @private
   * @throws {Error} - Throws if currency does not match subscription rate.
   */
  private assertCurrency(money: MajikMoney): void {
    if (money.currency.code !== this.rate.amount.currency.code) {
      throw new Error("Currency mismatch with subscription rate");
    }
  }
}

export function isMajikSubscriptionClass(item: MajikSubscription): boolean {
  return item.__object === "class";
}

export function isMajikSubscriptionJSON(item: MajikSubscription): boolean {
  return item.__object === "json";
}
