export type CurrencyCode = 'AED' | 'NGN' | 'USD' | 'GHS' | 'KES' | 'TZS' | 'UGX';

export type StaffRole =
  | 'ceo'
  | 'manager'
  | 'marketing'
  | 'sales'
  | 'warehouse'
  | 'accountant'
  | 'customer';

export type ModuleId =
  | 'dashboard'
  | 'storefront'
  | 'products'
  | 'orders'
  | 'crm'
  | 'ai-marketing'
  | 'ai-sales'
  | 'campaigns'
  | 'messaging'
  | 'finance'
  | 'ai-bi'
  | 'regional'
  | 'admin';

export interface UserProfile {
  id?: string;
  uid: string;
  email: string;
  displayName: string;
  role: StaffRole;
  department?: string;
  active: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  subtitle?: string;
  category: 'Perfume' | 'Diffuser' | 'Candle' | 'Car Fragrance' | 'Gift Set';
  gender: 'Women' | 'Unisex' | 'Men' | 'Home';
  sizeMl: number;
  variants?: string[];
  fragranceNotes?: {
    top: string;
    heart: string;
    base: string;
  };
  description?: string;
  costUsd: number;
  priceUsd: number;
  regionalPrices?: Partial<Record<CurrencyCode, number>>;
  imageUrl?: string;
  stockByWarehouse?: Record<string, number>;
  totalStock: number;
  reorderPoint: number;
  supplier?: string;
  batchNumber?: string;
  active: boolean;
  isDemo: boolean;
  ownerUid: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface StockMovement {
  id: string;
  productId: string;
  sku: string;
  productName: string;
  type: 'restock' | 'transfer' | 'sale' | 'adjustment';
  fromWarehouse?: string;
  toWarehouse?: string;
  quantity: number;
  batchNumber?: string;
  notes?: string;
  ownerUid: string;
  isDemo: boolean;
  createdAt?: unknown;
}

export interface Customer {
  id: string;
  ownerUid: string;
  fullName: string;
  email: string;
  phone?: string;
  country: string;
  city?: string;
  preferredScentFamily?: string;
  birthday?: string;
  consentEmail: boolean;
  consentWhatsapp: boolean;
  loyaltyPoints: number;
  segment: 'VIP' | 'Repeat' | 'New' | 'Lead' | 'At Risk';
  pipelineStage: 'Lead' | 'Qualified' | 'Proposal' | 'Customer' | 'Repeat Advocate';
  totalSpentUsd: number;
  ordersCount: number;
  ltvUsd: number;
  notes?: string;
  nextFollowUpDate?: string;
  isDemo: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface OrderItem {
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  unitPriceLocal: number;
  unitCostUsd: number;
  lineTotalLocal: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  ownerUid: string;
  customerId?: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  shippingAddress?: string;
  country: string;
  currency: CurrencyCode;
  exchangeRateToUsd?: number;
  items: OrderItem[];
  subtotalLocal?: number;
  discountCode?: string;
  discountLocal?: number;
  taxLocal?: number;
  shippingLocal?: number;
  totalLocal: number;
  totalUsd: number;
  cogsUsd: number;
  channel:
    | 'Online Storefront'
    | 'WhatsApp Concierge'
    | 'Instagram DM'
    | 'Boutique Wholesale'
    | 'Marketplace';
  campaignId?: string;
  paymentGateway?: string;
  paymentStatus: 'Pending' | 'Authorized' | 'Paid' | 'Refunded';
  status:
    | 'Pending'
    | 'Confirmed'
    | 'Processing'
    | 'Shipped'
    | 'Delivered'
    | 'Cancelled'
    | 'Refunded';
  trackingNumber?: string;
  isDemo: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Campaign {
  id: string;
  name: string;
  objective: string;
  channel: 'Instagram' | 'TikTok' | 'Facebook' | 'Google Ads' | 'WhatsApp' | 'Email' | 'Influencer';
  targetCountry: string;
  targetAudience?: string;
  productId?: string;
  productName?: string;
  budgetUsd: number;
  spendUsd: number;
  impressions?: number;
  clicks?: number;
  conversions?: number;
  attributedRevenueUsd?: number;
  abVariantA?: string;
  abVariantB?: string;
  abWinner?: string;
  startDate?: string;
  endDate?: string;
  status: 'Draft' | 'Scheduled' | 'Active' | 'Paused' | 'Completed';
  ownerUid: string;
  isDemo: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AiContent {
  id: string;
  productName: string;
  platform: string;
  targetCountry: string;
  targetAudience?: string;
  objective?: string;
  tone?: string;
  language?: string;
  title: string;
  variations: string[];
  hashtags?: string[];
  cta?: string;
  creativeBrief?: string;
  postingSchedule?: string;
  scheduledDate?: string;
  approvalStatus: 'Draft' | 'Pending Review' | 'Approved' | 'Rejected' | 'Scheduled';
  ownerUid: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface MessagingCampaign {
  id: string;
  name: string;
  channel: 'WhatsApp Business' | 'Email';
  templateName?: string;
  segment: string;
  subject?: string;
  body: string;
  scheduledAt?: string;
  status: 'Draft' | 'Requires Provider Credentials' | 'Scheduled' | 'Sent' | 'Paused';
  recipientCount?: number;
  deliveredCount?: number;
  openedCount?: number;
  clickedCount?: number;
  unsubscribedCount?: number;
  providerConfigured: boolean;
  ownerUid: string;
  isDemo: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Expense {
  id: string;
  category:
    | 'Marketing'
    | 'Logistics'
    | 'Packaging'
    | 'Salaries'
    | 'Rent & Boutique'
    | 'Customs & Duty'
    | 'Other';
  description: string;
  country: string;
  currency: CurrencyCode;
  amountLocal: number;
  amountUsd: number;
  expenseDate: string;
  ownerUid: string;
  isDemo: boolean;
  createdAt?: unknown;
}

export interface RegionalConfig {
  id: string;
  countryCode: string;
  countryName: string;
  region: 'UAE' | 'Africa' | 'International';
  currency: CurrencyCode;
  currencySymbol?: string;
  exchangeRatePerUsd: number;
  rateSource?: string;
  rateUpdatedAt?: string;
  vatPercent: number;
  shippingFlatUsd: number;
  freeShippingThresholdUsd?: number;
  storefrontActive: boolean;
  audienceNotes?: string;
  ownerUid: string;
  updatedAt?: unknown;
}

export interface IntegrationSetting {
  id: string;
  providerName: string;
  category: 'WhatsApp' | 'Email' | 'Payment';
  accountIdentifier?: string;
  endpointOrSender?: string;
  mode: 'unconfigured' | 'sandbox' | 'live';
  configured: boolean;
  lastTestedAt?: string;
  testStatus?: string;
  ownerUid: string;
  updatedAt?: unknown;
}

export interface AuditLog {
  id: string;
  ownerUid: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  module: string;
  targetId?: string;
  details: string;
  createdAt?: unknown;
}
