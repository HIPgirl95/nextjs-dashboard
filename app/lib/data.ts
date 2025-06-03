import { supabase } from "./../../supabase";
import {
  CustomerField,
  CustomersTableType,
  InvoiceForm,
  InvoicesTable,
  LatestInvoice,
  Revenue,
} from "./definitions";
import { formatCurrency } from "./utils";

const ITEMS_PER_PAGE = 6;

export async function fetchRevenue() {
  const { data, error } = await supabase.from("revenue").select("*");
  if (error) throw new Error("Failed to fetch revenue data.");
  return data as Revenue[];
}

export async function fetchLatestInvoices() {
  const { data, error } = await supabase
    .from("invoices")
    .select("*")
    .order("date", { ascending: false })
    .limit(5);

  if (error) {
    console.error("Supabase fetchLatestInvoices error:", error);
    throw new Error("Failed to fetch the latest invoices.");
  }

  return (data || []).map((invoice) => {
    const customer = invoice.customers;
    return {
      id: invoice.id,
      name: customer?.name ?? "",
      email: customer?.email ?? "",
      image_url: customer?.image_url ?? "",
      amount: formatCurrency(invoice.amount),
    };
  }) as LatestInvoice[];
}

export async function fetchCardData() {
  const [invoiceCountRes, customerCountRes, invoiceDataRes] = await Promise.all(
    [
      supabase.from("invoices").select("*", { count: "exact", head: true }),
      supabase.from("customers").select("*", { count: "exact", head: true }),
      supabase.from("invoices").select("amount, status"),
    ]
  );

  if (invoiceCountRes.error || customerCountRes.error || invoiceDataRes.error) {
    throw new Error("Failed to fetch card data.");
  }

  const invoiceData = invoiceDataRes.data || [];

  const totalPaid = invoiceData
    .filter((i) => i.status === "paid")
    .reduce((sum, i) => sum + i.amount, 0);

  const totalPending = invoiceData
    .filter((i) => i.status === "pending")
    .reduce((sum, i) => sum + i.amount, 0);

  return {
    numberOfInvoices: invoiceCountRes.count || 0,
    numberOfCustomers: customerCountRes.count || 0,
    totalPaidInvoices: formatCurrency(totalPaid),
    totalPendingInvoices: formatCurrency(totalPending),
  };
}

export async function fetchFilteredInvoices(
  query: string,
  currentPage: number
) {
  const from = (currentPage - 1) * ITEMS_PER_PAGE;
  const to = from + ITEMS_PER_PAGE - 1;

  const { data, error } = await supabase
    .from("invoices")
    .select(`id, amount, date, status, customers(id, name, email, image_url)`)
    .ilike("customers.name", `%${query}%`)
    .order("date", { ascending: false })
    .range(from, to);

  if (error) throw new Error("Failed to fetch invoices.");
  return (data || []).map((invoice) => {
    const customer = Array.isArray(invoice.customers)
      ? invoice.customers[0]
      : invoice.customers;
    return {
      id: invoice.id,
      amount: invoice.amount,
      date: invoice.date,
      status: invoice.status,
      customer_id: customer?.id ?? "",
      name: customer?.name ?? "",
      email: customer?.email ?? "",
      image_url: customer?.image_url ?? "",
    };
  }) as InvoicesTable[];
}

export async function fetchInvoicesPages(query: string) {
  const { count, error } = await supabase
    .from("invoices")
    .select("*", { count: "exact", head: true })
    .ilike("customers.name", `%${query}%`);

  if (error) throw new Error("Failed to fetch total number of invoices.");
  return Math.ceil((count || 0) / ITEMS_PER_PAGE);
}

export async function fetchInvoiceById(id: string) {
  const { data, error } = await supabase
    .from("invoices")
    .select("id, customer_id, amount, status")
    .eq("id", id);

  if (error) throw new Error("Failed to fetch invoice.");

  return {
    ...data?.[0],
    amount: (data?.[0].amount || 0) / 100,
  } as InvoiceForm;
}

export async function fetchCustomers() {
  const { data, error } = await supabase
    .from("customers")
    .select("id, name")
    .order("name", { ascending: true });

  if (error) throw new Error("Failed to fetch all customers.");
  return data as CustomerField[];
}

export async function fetchFilteredCustomers(query: string) {
  const { data, error } = await supabase.rpc("fetch_filtered_customers", {
    search: query,
  });

  if (error) throw new Error("Failed to fetch customer table.");

  return (data || []).map((customer: any) => ({
    ...customer,
    total_pending: formatCurrency(customer.total_pending),
    total_paid: formatCurrency(customer.total_paid),
  })) as CustomersTableType[];
}
