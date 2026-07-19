export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface Shop {
  id: string;
  code: string;
  name: string;
  platform?: string | null;
  brand?: string | null;
  isSalesChannel: boolean;
}

export interface Product {
  id: string;
  sku: string;
  name?: string | null;
  brand?: string | null;
  category?: string | null;
}

export interface Customer {
  id: string;
  fullName?: string | null;
  chatName?: string | null;
  phone?: string | null;
  address?: string | null;
  serviceCases?: ServiceCase[];
}

export interface CaseFollowup {
  id: string;
  followupDate?: string | null;
  usageResult?: string | null;
  productQualityNote?: string | null;
  serviceNote?: string | null;
  adviceNote?: string | null;
  satisfaction5?: number | null;
  satisfaction10?: number | null;
  productScore10?: number | null;
  npsScore?: number | null;
  feedback?: string | null;
}

export interface SmsLog {
  id: string;
  trackingNo: string;
  msisdn?: string | null;
}

export interface ServiceCase {
  id: string;
  caseCode?: string | null;
  caseDate?: string | null;
  orderNo?: string | null;
  serialNo?: string | null;
  problemGroup: string;
  productRaw?: string | null;
  problem?: string | null;
  solution?: string | null;
  reviewGroup?: string | null;
  status: string;
  defectReceived: boolean;
  defectReceivedDate?: string | null;
  sentReplacementFirst: boolean;
  claimDeptReceived: boolean;
  returnedToCustomer: boolean;
  returnedDate?: string | null;
  returnTrackingNo?: string | null;
  smsNotified: boolean;
  shippingCost?: string | null;
  sourceSheet: string;
  dataQualityFlags: string[];
  shop?: Shop | null;
  customer?: Customer | null;
  product?: Product | null;
  followups?: CaseFollowup[];
  smsLogs?: SmsLog[];
}

export interface Overview {
  totalCases: number;
  byProblemGroup: Record<string, number>;
  pendingCases: number;
  followupCount: number;
  avgSatisfaction10?: number | null;
  avgSatisfaction5?: number | null;
  avgProductScore10?: number | null;
  avgNps?: number | null;
}

export interface TrendPoint {
  month: string;
  problemGroup: string;
  count: number;
}

export interface ChatVolumePoint {
  month: string;
  shopId: string | null;
  presale: number;
  postsale: number;
}

export interface ChatDailyMetric {
  id: string;
  metricDate: string;
  shop?: Shop | null;
  qOrderPayment: number;
  qProductInfo: number;
  qOrderStatus: number;
  qUsageProblem: number;
  presaleTotal: number;
  postsaleTotal: number;
}

export interface UsageIssue {
  id: string;
  reportedAt?: string | null;
  customerName?: string | null;
  orderNo?: string | null;
  problem?: string | null;
  solution?: string | null;
  scoreInitial?: number | null;
  followupResult?: string | null;
  shop?: Shop | null;
  product?: Product | null;
}

export interface FaqEntry {
  id: string;
  brand?: string | null;
  sku?: string | null;
  question: string;
  answer?: string | null;
  manualUrl?: string | null;
}

export interface SyncSourceStatus {
  id: string;
  sheetName: string;
  targetTable: string;
  enabled: boolean;
  lastSyncedAt?: string | null;
  lastRun?: {
    id: string;
    status: 'running' | 'success' | 'partial' | 'failed';
    startedAt: string;
    finishedAt?: string | null;
    rowsRead?: number | null;
    rowsUpserted?: number | null;
    rowsRejected?: number | null;
    error?: string | null;
  } | null;
}

export interface SyncEvent {
  type: 'started' | 'progress' | 'finished' | 'failed';
  sheetName: string;
  runId?: string;
  rowsRead?: number;
  rowsUpserted?: number;
  rowsRejected?: number;
  error?: string;
  at: string;
}

export interface SearchResult {
  customers: Customer[];
  cases: ServiceCase[];
  products: Product[];
}

export interface AuditLog {
  id: string;
  actor: string;
  action: string;
  entity?: string | null;
  at: string;
}

export interface SparePartRequest {
  id: string;
  requestDate?: string | null;
  model?: string | null;
  gvSerialNo?: string | null;
  partName?: string | null;
  photoUrls: string[];
}

export interface ChairClaim {
  id: string;
  submittedAt?: string | null;
  model?: string | null;
  orderNo?: string | null;
  serialNo?: string | null;
  brokenPart?: string | null;
  symptom?: string | null;
  photoUrl?: string | null;
}

export interface TopProduct {
  product?: Product | null;
  cases: number;
}

export interface ShopCases {
  shop?: Shop | null;
  cases: number;
}
