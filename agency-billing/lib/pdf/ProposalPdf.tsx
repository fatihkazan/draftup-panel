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

interface ProposalItem {
  id: string;
  title: string;
  description?: string;
  quantity: number;
  unitPrice: number;
}

interface ProposalData {
  title: string;
  proposalNumber: string;
  date: string;
  validUntil: string | null;
  clientName: string;
  clientEmail: string | null;
  clientCompany: string | null;
  items: ProposalItem[];
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

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
    backgroundColor: "#ffffff",
  },
  header: {
    marginBottom: 30,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 5,
    color: "#1a1a1a",
  },
  subtitle: {
    fontSize: 11,
    color: "#666666",
  },
  row: {
    flexDirection: "row" as const,
    justifyContent: "space-between",
    marginBottom: 15,
  },
  column: {
    flex: 1,
  },
  label: {
    fontSize: 9,
    color: "#666666",
    marginBottom: 4,
    textTransform: "uppercase",
  },
  value: {
    fontSize: 11,
    color: "#1a1a1a",
    marginBottom: 2,
  },
  section: {
    marginBottom: 20,
  },
  table: {
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: "row" as const,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingBottom: 8,
    marginBottom: 8,
  },
  tableRow: {
    flexDirection: "row" as const,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  tableCol1: { width: "50%" },
  tableCol2: { width: "15%", textAlign: "right" as const },
  tableCol3: { width: "17.5%", textAlign: "right" as const },
  tableCol4: { width: "17.5%", textAlign: "right" as const },
  tableHeaderText: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#374151",
    textTransform: "uppercase",
  },
  tableCellText: { fontSize: 10, color: "#1a1a1a" },
  totals: {
    marginLeft: "auto",
    width: "40%",
    marginTop: 10,
  },
  totalRow: {
    flexDirection: "row" as const,
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  totalLabel: { fontSize: 10, color: "#666666" },
  totalValue: { fontSize: 10, color: "#1a1a1a", fontWeight: "bold" },
  grandTotal: {
    borderTopWidth: 2,
    borderTopColor: "#1a1a1a",
    paddingTop: 8,
    marginTop: 4,
  },
  grandTotalLabel: { fontSize: 12, fontWeight: "bold", color: "#1a1a1a" },
  grandTotalValue: { fontSize: 12, fontWeight: "bold", color: "#1a1a1a" },
  notes: {
    marginTop: 30,
    padding: 15,
    backgroundColor: "#f9fafb",
    borderRadius: 4,
  },
  notesLabel: {
    fontSize: 9,
    color: "#666666",
    marginBottom: 6,
    textTransform: "uppercase",
  },
  notesText: { fontSize: 10, color: "#1a1a1a", lineHeight: 1.5 },
});

function formatCurrency(amount: number, currency: string): string {
  const validCurrency = currency && currency.length === 3 ? currency : "USD";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: validCurrency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

const ProposalPdfDocument: React.FC<{ data: ProposalData }> = ({ data }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.title}>{data.title}</Text>
        <Text style={styles.subtitle}>
          Proposal #{data.proposalNumber} • {data.date}
          {data.validUntil ? ` • Valid until ${data.validUntil}` : ""}
        </Text>
      </View>

      <View style={styles.row}>
        <View style={styles.column}>
          {data.agencyLogo && (
            <Image
              src={data.agencyLogo}
              style={{ height: 40, marginBottom: 8, objectFit: "contain" }}
            />
          )}
          <Text style={styles.label}>From</Text>
          <Text style={styles.value}>{data.agencyName}</Text>
          {data.agencyEmail && <Text style={styles.value}>{data.agencyEmail}</Text>}
          {data.agencyPhone && <Text style={styles.value}>{data.agencyPhone}</Text>}
          {data.agencyAddress && <Text style={styles.value}>{data.agencyAddress}</Text>}
        </View>
        <View style={styles.column}>
          <Text style={styles.label}>Proposal details</Text>
          <Text style={styles.value}>Date: {data.date}</Text>
          {data.validUntil && (
            <Text style={styles.value}>Valid until: {data.validUntil}</Text>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Proposal To</Text>
        <Text style={styles.value}>{data.clientName}</Text>
        {data.clientCompany && <Text style={styles.value}>{data.clientCompany}</Text>}
        {data.clientEmail && <Text style={styles.value}>{data.clientEmail}</Text>}
      </View>

      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableCol1, styles.tableHeaderText]}>Description</Text>
          <Text style={[styles.tableCol2, styles.tableHeaderText]}>Qty</Text>
          <Text style={[styles.tableCol3, styles.tableHeaderText]}>Unit Price</Text>
          <Text style={[styles.tableCol4, styles.tableHeaderText]}>Amount</Text>
        </View>
        {data.items.map((item, index) => (
          <View key={item.id || index} style={styles.tableRow}>
            <View style={styles.tableCol1}>
              <Text style={styles.tableCellText}>{item.title}</Text>
              {item.description && (
                <Text style={[styles.tableCellText, { fontSize: 9, color: "#666" }]}>
                  {item.description}
                </Text>
              )}
            </View>
            <Text style={[styles.tableCol2, styles.tableCellText]}>{item.quantity}</Text>
            <Text style={[styles.tableCol3, styles.tableCellText]}>
              {formatCurrency(item.unitPrice, data.currency)}
            </Text>
            <Text style={[styles.tableCol4, styles.tableCellText]}>
              {formatCurrency(item.quantity * item.unitPrice, data.currency)}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.totals}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Subtotal</Text>
          <Text style={styles.totalValue}>
            {formatCurrency(data.subtotal, data.currency)}
          </Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Tax ({Math.round(data.taxRate * 100)}%)</Text>
          <Text style={styles.totalValue}>
            {formatCurrency(data.taxAmount, data.currency)}
          </Text>
        </View>
        <View style={[styles.totalRow, styles.grandTotal]}>
          <Text style={styles.grandTotalLabel}>Total</Text>
          <Text style={styles.grandTotalValue}>
            {formatCurrency(data.total, data.currency)}
          </Text>
        </View>
      </View>

      {data.notes && (
        <View style={styles.notes}>
          <Text style={styles.notesLabel}>Notes</Text>
          <Text style={styles.notesText}>{data.notes}</Text>
        </View>
      )}
    </Page>
  </Document>
);

export async function generateProposalPdfBuffer(
  data: ProposalData
): Promise<Buffer> {
  const buffer = await renderToBuffer(<ProposalPdfDocument data={data} />);
  return buffer;
}
