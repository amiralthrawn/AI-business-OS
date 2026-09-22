import type {
  AskAIResponse,
  BusinessContextRead,
  BusinessContextUpdate,
  CompanyNarrativeItem,
  CompanyRead,
  CompanyUpdate,
  ConfigurationSuggestionRead,
  ConnectorStatus,
  ContactListItem,
  CustomerDetail,
  CustomerListItem,
  FinanceOverview,
  HomeResponse,
  OpportunityRead,
  OSActivityItem,
  ProcurementOverview,
  ProductDetail,
  ProductListItem,
  RiskRead,
  SalesOverview,
  SupplierDetail,
  SupplierListItem,
  TaskCreate,
  TaskRead,
  TaskStatus,
  TransactionRead,
} from "@/lib/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function getJSON<T>(path: string, notFoundMessage: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(res.status === 404 ? notFoundMessage : `Request failed (${res.status})`);
  }
  return res.json();
}

async function patchJSON<T>(path: string, body: object, failureMessage: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.detail ?? `${failureMessage} (${res.status})`);
  }
  return res.json();
}

export async function getHomeView(): Promise<HomeResponse> {
  const res = await fetch(`${API_URL}/home`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to load Home view (${res.status})`);
  }
  return res.json();
}

export const getRisks = () => getJSON<RiskRead[]>("/intelligence/risks", "Risks not found");
export const getRisk = (id: string) => getJSON<RiskRead>(`/intelligence/risks/${id}`, "Risk not found");
export const getOpportunities = () => getJSON<OpportunityRead[]>("/intelligence/opportunities", "Opportunities not found");
export const getOpportunity = (id: string) =>
  getJSON<OpportunityRead>(`/intelligence/opportunities/${id}`, "Opportunity not found");
export const getTasks = () => getJSON<TaskRead[]>("/actions/tasks", "Tasks not found");

export async function askAI(question: string): Promise<AskAIResponse> {
  const res = await fetch(`${API_URL}/ai/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `Ask AI request failed (${res.status})`);
  }
  return res.json();
}

async function decideOnTask(taskId: string, decision: "approve" | "reject"): Promise<TaskRead> {
  const res = await fetch(`${API_URL}/actions/tasks/${taskId}/${decision}`, {
    method: "POST",
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `Failed to ${decision} the task (${res.status})`);
  }
  return res.json();
}

export const approveTask = (taskId: string) => decideOnTask(taskId, "approve");
export const rejectTask = (taskId: string) => decideOnTask(taskId, "reject");

export async function updateTaskStatus(taskId: string, status: TaskStatus): Promise<TaskRead> {
  const res = await fetch(`${API_URL}/actions/tasks/${taskId}/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `Failed to update the task (${res.status})`);
  }
  return res.json();
}

export async function submitTaskForValidation(taskId: string): Promise<TaskRead> {
  const res = await fetch(`${API_URL}/actions/tasks/${taskId}/submit`, { method: "POST", cache: "no-store" });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `Failed to submit the task (${res.status})`);
  }
  return res.json();
}

export async function createTask(payload: TaskCreate): Promise<TaskRead> {
  const res = await fetch(`${API_URL}/actions/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `Failed to create the task (${res.status})`);
  }
  return res.json();
}

// --- "Vie de l'entreprise" (Step 27) -----------------------------------------

export const getOSActivity = (domain?: string, limit = 30) =>
  getJSON<OSActivityItem[]>(`/home/activity?limit=${limit}${domain ? `&domain=${domain}` : ""}`, "Activity not found");
export const getCompanyNarrative = (limit = 30) =>
  getJSON<CompanyNarrativeItem[]>(`/home/narrative?limit=${limit}`, "Narrative not found");

// --- Business Domain read APIs (Step 23B) -----------------------------------

export const getSuppliers = () => getJSON<SupplierListItem[]>("/suppliers", "Suppliers not found");
export const getSupplier = (id: string) => getJSON<SupplierDetail>(`/suppliers/${id}`, "Supplier not found");
export const getCustomers = () => getJSON<CustomerListItem[]>("/customers", "Customers not found");
export const getCustomer = (id: string) => getJSON<CustomerDetail>(`/customers/${id}`, "Customer not found");
export const getProducts = () => getJSON<ProductListItem[]>("/products", "Products not found");
export const getProduct = (id: string) => getJSON<ProductDetail>(`/products/${id}`, "Product not found");
export const getTransactions = () => getJSON<TransactionRead[]>("/transactions", "Transactions not found");
export const getTransaction = (id: string) => getJSON<TransactionRead>(`/transactions/${id}`, "Transaction not found");
export const getContacts = () => getJSON<ContactListItem[]>("/contacts", "Contacts not found");

// --- Connectors (real connection status, Step 28's Contacts page) -----------

export const getConnectors = () => getJSON<{ connectors: ConnectorStatus[] }>("/connectors", "Connectors not found");

// --- Business Domain overviews (Step 23B) -----------------------------------

export const getFinanceOverview = () => getJSON<FinanceOverview>("/finance/overview", "Finance overview not found");
export const getProcurementOverview = () =>
  getJSON<ProcurementOverview>("/procurement/overview", "Procurement overview not found");
export const getSalesOverview = () => getJSON<SalesOverview>("/sales/overview", "Sales overview not found");

// --- Company & Business Context (Step 26) -----------------------------------

export const getCompany = () => getJSON<CompanyRead>("/company", "Company not configured yet");
export const updateCompany = (payload: CompanyUpdate) =>
  patchJSON<CompanyRead>("/company", payload, "Failed to update company");

export const getBusinessContext = () =>
  getJSON<BusinessContextRead>("/business-context", "Business context not found");
export const updateBusinessContext = (payload: BusinessContextUpdate) =>
  patchJSON<BusinessContextRead>("/business-context", payload, "Failed to update business context");
export const getConfigurationSuggestions = () =>
  getJSON<ConfigurationSuggestionRead[]>("/business-context/suggestions", "No suggestions found");
