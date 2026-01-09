export const SubscriptionStatus = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  SUSPENDED: "Suspended",
  CANCELLED: "Cancelled",
} as const;

export type SubscriptionStatus =
  (typeof SubscriptionStatus)[keyof typeof SubscriptionStatus];

export const SubscriptionType = {
  RECURRING: "Recurring",
  ONE_TIME: "One-Time",
  TRIAL: "Trial",
} as const;

export type SubscriptionType =
  (typeof SubscriptionType)[keyof typeof SubscriptionType];

export const SubscriptionVisibility = {
  PUBLIC: "Public",
  PRIVATE: "Private",
} as const;

export type SubscriptionVisibility =
  (typeof SubscriptionVisibility)[keyof typeof SubscriptionVisibility];

export const BillingCycle = {
  DAILY: "Daily",
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  YEARLY: "Yearly",
} as const;

export type BillingCycle = (typeof BillingCycle)[keyof typeof BillingCycle];

export const RateUnit = {
  PER_SUBSCRIBER: "Per Subscriber",
  PER_ACCOUNT: "Per Account",
  PER_USER: "Per User",
  PER_MONTH: "Per Month",
} as const;

export type RateUnit = (typeof RateUnit)[keyof typeof RateUnit];

export const CapacityPeriodResizeMode = {
  DEFAULT: "default",
  DISTRIBUTE: "distribute",
} as const;

export type CapacityPeriodResizeMode =
  (typeof CapacityPeriodResizeMode)[keyof typeof CapacityPeriodResizeMode];
