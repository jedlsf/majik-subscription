export enum SubscriptionStatus {
    ACTIVE = "Active",
    INACTIVE = "Inactive",
    SUSPENDED = "Suspended",
    CANCELLED = "Cancelled"
}

export enum SubscriptionType {
    RECURRING = "Recurring",
    ONE_TIME = "One-Time",
    TRIAL = "Trial"
}

export enum SubscriptionVisibility {
    PUBLIC = "Public",
    PRIVATE = "Private"
}

export enum BillingCycle {
    DAILY = "Daily",
    WEEKLY = "Weekly",
    MONTHLY = "Monthly",
    QUARTERLY = "Quarterly",
    YEARLY = "Yearly",
}

export enum RateUnit {
    PER_SUBSCRIBER = "Per Subscriber",
    PER_ACCOUNT = "Per Account",
    PER_USER = "Per User",
    PER_MONTH = "Per Month"
}

export enum CapacityPeriodResizeMode {
  DEFAULT = "default", // trim or pad, keep per-month units
  DISTRIBUTE = "distribute", // preserve total capacity, redistribute evenly
}
