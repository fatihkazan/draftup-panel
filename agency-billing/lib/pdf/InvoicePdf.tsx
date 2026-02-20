import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";
import { renderToBuffer } from "@react-pdf/renderer";

interface InvoiceItem {
  id: string;
  title: string;
  description?: string;
  quantity: number;
  unitPrice: number;
}

interface InvoiceData {
  title: string;
  invoiceNumber: string;
  date: string;
  dueDate: string | null;
  clientName: string;
  clientEmail: string | null;
  clientCompany: string | null;
  clientAddress: string | null;
  items: InvoiceItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  currency: string;
  notes: string | null;
  agencyName: string;
  agencyEmail: string | null;
  agencyPhone: string | null;
  agencyAddress: string | null;
  agencyLogo?: string | null;
}

function formatCurrency(amount: number, currency: string): string {
  const validCurrency = currency && currency.length === 3 ? currency : "USD";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: validCurrency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function sanitizeText(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .replace(/ı/g, "i")
    .replace(/İ/g, "I")
    .replace(/ş/g, "s")
    .replace(/Ş/g, "S")
    .replace(/ğ/g, "g")
    .replace(/Ğ/g, "G")
    .replace(/ü/g, "u")
    .replace(/Ü/g, "U")
    .replace(/ö/g, "o")
    .replace(/Ö/g, "O")
    .replace(/ç/g, "c")
    .replace(/Ç/g, "C");
}

const styles = StyleSheet.create({
  page: {
    padding: 48,
    fontSize: 10,
    fontFamily: "Helvetica",
    backgroundColor: "#ffffff",
    color: "#1a1a1a",
  },
  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 36,
  },
  logoContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  logoImage: {
    height: 36,
    width: 120,
    objectFit: "contain",
  },
  agencyNameFallback: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: "#1a1a1a",
  },
  invoiceTitle: {
    fontSize: 28,
    fontFamily: "Helvetica-Bold",
    color: "#1a1a1a",
    letterSpacing: 2,
  },
  // Bill section
  billSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 32,
  },
  billBlock: {
    width: "45%",
  },
  billLabel: {
    fontSize: 9,
    color: "#888888",
    marginBottom: 4,
    textTransform: "uppercase",
  },
  billName: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: "#1a1a1a",
    marginBottom: 2,
  },
  billSub: {
    fontSize: 9,
    color: "#555555",
    marginBottom: 1,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
    marginBottom: 24,
  },
  // Meta row
  metaRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 32,
    marginBottom: 24,
  },
  metaBlock: {
    alignItems: "flex-end",
  },
  metaLabel: {
    fontSize: 9,
    color: "#888888",
    marginBottom: 2,
    textTransform: "uppercase",
  },
  metaValue: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#1a1a1a",
  },
  // Table
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f5f5f5",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 4,
    marginBottom: 4,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  tableRowAlt: {
    backgroundColor: "#fafafa",
  },
  colNum: { width: "6%", fontSize: 9, color: "#888888" },
  colItem: { width: "44%", fontSize: 9, fontFamily: "Helvetica-Bold" },
  colPrice: { width: "17%", textAlign: "right", fontSize: 9, fontFamily: "Helvetica-Bold" },
  colQty: { width: "16%", textAlign: "center", fontSize: 9, fontFamily: "Helvetica-Bold" },
  colAmount: { width: "17%", textAlign: "right", fontSize: 9, fontFamily: "Helvetica-Bold" },
  colNumVal: { width: "6%", fontSize: 9, color: "#888888" },
  colItemVal: { width: "44%", fontSize: 9 },
  colPriceVal: { width: "17%", textAlign: "right", fontSize: 9 },
  colQtyVal: { width: "16%", textAlign: "center", fontSize: 9 },
  colAmountVal: { width: "17%", textAlign: "right", fontSize: 9 },
  // Totals
  totalsSection: {
    marginTop: 16,
    alignItems: "flex-end",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 4,
    gap: 32,
  },
  totalLabel: {
    fontSize: 9,
    color: "#888888",
    width: 100,
    textAlign: "right",
  },
  totalValue: {
    fontSize: 9,
    color: "#1a1a1a",
    width: 80,
    textAlign: "right",
  },
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1.5,
    borderTopColor: "#1a1a1a",
    gap: 32,
  },
  grandTotalLabel: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: "#1a1a1a",
    width: 100,
    textAlign: "right",
  },
  grandTotalValue: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: "#1a1a1a",
    width: 80,
    textAlign: "right",
  },
  // Notes
  notesSection: {
    marginTop: 32,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#e5e5e5",
  },
  notesLabel: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#1a1a1a",
    marginBottom: 4,
    textTransform: "uppercase",
  },
  notesText: {
    fontSize: 9,
    color: "#555555",
    lineHeight: 1.5,
  },
  // Footer
  footer: {
    marginTop: 40,
    alignItems: "center",
  },
  footerText: {
    fontSize: 9,
    color: "#aaaaaa",
  },
});

const InvoicePdfDocument: React.FC<{ data: InvoiceData }> = ({ data }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          {data.agencyLogo ? (
            <Image src={data.agencyLogo} style={styles.logoImage} />
          ) : (
            <Text style={styles.agencyNameFallback}>{sanitizeText(data.agencyName)}</Text>
          )}
        </View>
        <Text style={styles.invoiceTitle}>INVOICE</Text>
      </View>

      {/* Bill To / Bill From */}
      <View style={styles.billSection}>
        <View style={styles.billBlock}>
          <Text style={styles.billLabel}>Invoice to</Text>
          <Text style={styles.billName}>{sanitizeText(data.clientName)}</Text>
          {data.clientCompany && <Text style={styles.billSub}>{sanitizeText(data.clientCompany)}</Text>}
          {data.clientEmail && <Text style={styles.billSub}>{sanitizeText(data.clientEmail)}</Text>}
          {data.clientAddress && <Text style={styles.billSub}>{sanitizeText(data.clientAddress)}</Text>}
        </View>
        <View style={styles.billBlock}>
          <Text style={styles.billLabel}>Invoice from</Text>
          <Text style={styles.billName}>{sanitizeText(data.agencyName)}</Text>
          {data.agencyEmail && <Text style={styles.billSub}>{sanitizeText(data.agencyEmail)}</Text>}
          {data.agencyPhone && <Text style={styles.billSub}>{sanitizeText(data.agencyPhone)}</Text>}
          {data.agencyAddress && <Text style={styles.billSub}>{sanitizeText(data.agencyAddress)}</Text>}
        </View>
      </View>

      {/* Meta: Invoice number + dates */}
      <View style={styles.metaRow}>
        <View style={styles.metaBlock}>
          <Text style={styles.metaLabel}>Invoice No</Text>
          <Text style={styles.metaValue}>{sanitizeText(data.invoiceNumber)}</Text>
        </View>
        <View style={styles.metaBlock}>
          <Text style={styles.metaLabel}>Date</Text>
          <Text style={styles.metaValue}>{data.date}</Text>
        </View>
        {data.dueDate && (
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>Due Date</Text>
            <Text style={styles.metaValue}>{data.dueDate}</Text>
          </View>
        )}
      </View>

      <View style={styles.divider} />

      {/* Table Header */}
      <View style={styles.tableHeader}>
        <Text style={styles.colNum}>#</Text>
        <Text style={styles.colItem}>ITEM</Text>
        <Text style={styles.colPrice}>PRICE</Text>
        <Text style={styles.colQty}>QUANTITY</Text>
        <Text style={styles.colAmount}>AMOUNT</Text>
      </View>

      {/* Table Rows */}
      {data.items.map((item, index) => (
        <View key={item.id || index} style={[styles.tableRow, index % 2 === 1 ? styles.tableRowAlt : {}]}>
          <Text style={styles.colNumVal}>{String(index + 1).padStart(2, "0")}</Text>
          <Text style={styles.colItemVal}>{sanitizeText(item.title)}</Text>
          <Text style={styles.colPriceVal}>{formatCurrency(item.unitPrice, data.currency)}</Text>
          <Text style={styles.colQtyVal}>{item.quantity}</Text>
          <Text style={styles.colAmountVal}>{formatCurrency(item.unitPrice * item.quantity, data.currency)}</Text>
        </View>
      ))}

      {/* Totals */}
      <View style={styles.totalsSection}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Sub Total</Text>
          <Text style={styles.totalValue}>{formatCurrency(data.subtotal, data.currency)}</Text>
        </View>
        {data.taxRate > 0 && (
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Tax ({Math.round(data.taxRate * 100)}%)</Text>
            <Text style={styles.totalValue}>{formatCurrency(data.taxAmount, data.currency)}</Text>
          </View>
        )}
        <View style={styles.grandTotalRow}>
          <Text style={styles.grandTotalLabel}>GRAND TOTAL</Text>
          <Text style={styles.grandTotalValue}>{formatCurrency(data.total, data.currency)}</Text>
        </View>
      </View>

      {/* Notes */}
      {data.notes && (
        <View style={styles.notesSection}>
          <Text style={styles.notesLabel}>Notes</Text>
          <Text style={styles.notesText}>{sanitizeText(data.notes)}</Text>
        </View>
      )}

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>Thank you for your business.</Text>
      </View>
    </Page>
  </Document>
);

export async function generateInvoicePdfBuffer(data: InvoiceData): Promise<Buffer> {
  const buffer = await renderToBuffer(<InvoicePdfDocument data={data} />);
  return buffer;
}
