// VAT MTD API Types
// Based on HMRC VAT (MTD) API v1.0

// ============================================================================
// VAT Registration & Connection
// ============================================================================

export interface VATConnection {
  id: string;
  entityId: string;
  vrn: string;
  status: "connected" | "expired" | "not-connected";
  connectedAt?: string;
  expiresAt?: string;
  scopes: string[];
}

// ============================================================================
// VAT Obligations
// ============================================================================

export type ObligationStatus = "O" | "F"; // Open | Fulfilled

export interface VATObligation {
  periodKey: string;
  start: string;
  end: string;
  due: string;
  status: ObligationStatus;
  received?: string;
}

export interface VATObligationsResponse {
  obligations: VATObligation[];
}

// ============================================================================
// VAT Return
// ============================================================================

export interface VATReturnData {
  periodKey: string;
  vatDueSales: number;          // Box 1: VAT due on sales
  vatDueAcquisitions: number;   // Box 2: VAT due on acquisitions from EU
  totalVatDue: number;          // Box 3: Total VAT due (Box 1 + Box 2)
  vatReclaimedCurrPeriod: number; // Box 4: VAT reclaimed on purchases
  netVatDue: number;            // Box 5: Net VAT (Box 3 - Box 4)
  totalValueSalesExVAT: number; // Box 6: Total sales ex VAT (whole pounds)
  totalValuePurchasesExVAT: number; // Box 7: Total purchases ex VAT (whole pounds)
  totalValueGoodsSuppliedExVAT: number; // Box 8: Total supplies to EU (whole pounds)
  totalAcquisitionsExVAT: number; // Box 9: Total acquisitions from EU (whole pounds)
  finalised: boolean;
}

export interface VATReturnSubmission extends VATReturnData {
  // Additional fields for form state
  id?: string;
  status: "draft" | "ready" | "submitted" | "accepted" | "rejected";
  createdAt?: string;
  updatedAt?: string;
}

export interface VATReturnResponse {
  processingDate: string;
  paymentIndicator?: "DD" | "BANK" | "CARD";
  formBundleNumber: string;
  chargeRefNumber?: string;
}

// ============================================================================
// VAT Liabilities
// ============================================================================

export interface VATLiability {
  taxPeriod: {
    from: string;
    to: string;
  };
  type: string;
  originalAmount: number;
  outstandingAmount: number;
  due: string;
}

export interface VATLiabilitiesResponse {
  liabilities: VATLiability[];
}

// ============================================================================
// VAT Payments
// ============================================================================

export interface VATPayment {
  amount: number;
  received: string;
}

export interface VATPaymentsResponse {
  payments: VATPayment[];
}

// ============================================================================
// VAT Penalties
// ============================================================================

export interface VATLateSubmissionPenalty {
  taxPeriodStartDate: string;
  taxPeriodEndDate: string;
  taxPeriodDueDate: string;
  returnReceiptDate: string;
  penaltyStatus: "ACTIVE" | "INACTIVE";
  penaltyRaisedDate?: string;
  penaltyAmountPosted?: number;
  penaltyAmountOutstanding?: number;
}

export interface VATPenaltySummary {
  totalPoints: number;
  threshold: number;
  financialPenalties: number;
  lateSubmissionPenalties: VATLateSubmissionPenalty[];
}

// ============================================================================
// Form State
// ============================================================================

export interface VATReturnFormState {
  // Section: Sales and Output VAT
  box1: string; // VAT due on sales
  box2: string; // VAT due on acquisitions from EU

  // Section: Purchases and Input VAT
  box4: string; // VAT reclaimed on purchases

  // Section: Sales totals
  box6: string; // Total value of sales ex VAT
  box8: string; // Total value of supplies to EU

  // Section: Purchase totals
  box7: string; // Total value of purchases ex VAT
  box9: string; // Total acquisitions from EU

  // Computed (read-only in form)
  box3: number; // Total VAT due
  box5: number; // Net VAT

  // Declaration
  finalised: boolean;
}

export interface VATReturnValidationError {
  field: keyof VATReturnFormState;
  message: string;
}

// ============================================================================
// Dashboard Types
// ============================================================================

export interface VATDashboardData {
  connection: VATConnection | null;
  obligations: VATObligation[];
  recentSubmissions: VATReturnSubmission[];
  outstandingLiabilities: VATLiability[];
  penaltySummary: VATPenaltySummary | null;
}

// ============================================================================
// API Error Types
// ============================================================================

export interface HMRCAPIError {
  code: string;
  message: string;
  path?: string;
}

export type VATAPIErrorCode =
  | "INVALID_VRN"
  | "INVALID_DATE_RANGE"
  | "INVALID_PERIODKEY"
  | "VRN_NOT_FOUND"
  | "NOT_FOUND"
  | "DUPLICATE_SUBMISSION"
  | "TAX_PERIOD_NOT_ENDED"
  | "INVALID_MONETARY_AMOUNT"
  | "INVALID_NUMERIC_VALUE"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "TOO_MANY_REQUESTS"
  | "INTERNAL_SERVER_ERROR";

// ============================================================================
// Fraud Prevention Headers — the full 16-header WEB_APP_VIA_SERVER set
// (regs/research/fraud-headers.md §1, lines 56-71). No `Gov-Client-Local-IPs`,
// `Gov-Client-Browser-Plugins` or `Gov-Client-Browser-Do-Not-Track` — all
// three were dropped from this connection method's required list (research
// lines 76-82) and are not collected.
// ============================================================================

export interface FraudPreventionHeaders {
  "Gov-Client-Connection-Method": string;
  "Gov-Client-Browser-JS-User-Agent"?: string;
  "Gov-Client-Device-ID": string;
  /** Cannot-collect today (no MFA) — omit, never empty, never fabricated. */
  "Gov-Client-Multi-Factor"?: string;
  "Gov-Client-Public-IP"?: string;
  "Gov-Client-Public-IP-Timestamp"?: string;
  /** Cannot-collect today — unobtainable behind Fly's proxy (see RUNBOOK). */
  "Gov-Client-Public-Port"?: string;
  "Gov-Client-Screens"?: string;
  "Gov-Client-Timezone": string;
  "Gov-Client-User-IDs": string;
  "Gov-Client-Window-Size"?: string;
  "Gov-Vendor-Forwarded"?: string;
  /** Cannot-collect today (no licensed software) — omit, never empty. */
  "Gov-Vendor-License-IDs"?: string;
  "Gov-Vendor-Product-Name": string;
  "Gov-Vendor-Public-IP"?: string;
  "Gov-Vendor-Version": string;
}
