import { MajikMoney } from "@thezelijah/majik-money";
import {
  BillingCycle,
  RateUnit,
  SubscriptionStatus,
  SubscriptionType,
  SubscriptionVisibility,
} from "./enums";


export type ObjectType = "class" | "json";
export type SubscriptionID = string;
export type SubscriptionSKU = string;

export type ISODateString = string;
export type YYYYMM = `${number}${number}${number}${number}-${number}${number}`;
export type StartDateInput = Date | ISODateString | YYYYMM;

/**
 * Represents a Cost of Subscription (COS) item.
 * E.g., infrastructure, hosting, support, software licenses.
 */
export interface COSItem {
  id: string;
  item: string;
  unitCost: MajikMoney;
  quantity: number; // number of subscribers/accounts
  subtotal: MajikMoney;
  unit?: string; // e.g., "per user", "per account"
}

/**
 * Optional monthly subscription capacity plan entry.
 * Could represent max allowed subscribers or seats per month.
 */
export interface MonthlyCapacity {
  month: YYYYMM;
  capacity: number; // max number of subscribers
  adjustment?: number; // optional increase/decrease
}

/**
 * Value with margin ratio for finance snapshots.
 */
export interface ValueRatio {
  value: MajikMoney;
  marginRatio: number;
}

/**
 * Subscription finance information.
 */
export interface SubscriptionFinance {
  profit: {
    gross: ValueRatio;
    net: ValueRatio;
  };

  revenue: {
    gross: ValueRatio;
    net: ValueRatio;
  };

  income: {
    gross: ValueRatio;
    net: ValueRatio;
  };

  cos: {
    gross: ValueRatio;
    net: ValueRatio;
  };
}

/**
 * Subscription rate object: amount + billing unit.
 */
export interface SubscriptionRate {
  amount: MajikMoney;
  unit: RateUnit;
  billingCycle: BillingCycle; // monthly, quarterly, yearly
}

/**
 * Metadata of a subscription.
 */
export interface SubscriptionMetadata {
  sku?: SubscriptionSKU;
  description: {
    text: string;
    html?: string;
    seo?: string;
  };
  photos?: string[];
  type: SubscriptionType;
  category: string;
  rate: SubscriptionRate;
  cos: COSItem[];
  capacityPlan?: MonthlyCapacity[];

  /** Cached finance snapshot */
  finance: SubscriptionFinance;
}

/**
 * Subscription settings including visibility and status.
 */
export interface SubscriptionSettings {
  status: SubscriptionStatus;
  visibility: SubscriptionVisibility;
  system?: { isRestricted: boolean; restrictedUntil?: ISODateString };
}
