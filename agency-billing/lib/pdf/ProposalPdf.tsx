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
    paddingTop: 36,
    paddingHorizontal: 36,
    paddingBottom: 30,
    fontSize: 10,
    fontFamily: "Helvetica",
    backgroundColor: "#ffffff",
  },
  header: {
    flexDirection: "row" as const,
    justifyContent: "space-between",
    alignItems: "stretch",
    marginBottom: 28,
    gap: 16,
  },
  logoBox: {
    width: "36%",
    minHeight: 78,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ececec",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  logoImage: {
    width: "100%",
    maxHeight: 58,
    objectFit: "contain",
  },
  logoFallbackText: {
    color: "#6b7280",
    fontSize: 11,
    letterSpacing: 0.4,
  },
  headerRight: {
    width: "62%",
    justifyContent: "flex-start",
    alignItems: "flex-end",
    textAlign: "right" as const,
  },
  proposalTitle: {
    fontSize: 30,
    fontWeight: "bold",
    letterSpacing: 0.8,
    color: "#1a1a1a",
  },
  proposalMeta: {
    marginTop: 6,
    fontSize: 10,
    color: "#52525b",
    lineHeight: 1.5,
  },
  fromToRow: {
    flexDirection: "row" as const,
    justifyContent: "space-between",
    marginBottom: 22,
    gap: 18,
  },
  infoColumn: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ececec",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  sectionLabel: {
    fontSize: 8,
    color: "#9ca3af",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  infoValue: {
    fontSize: 11,
    color: "#1a1a1a",
    marginBottom: 3,
    lineHeight: 1.35,
  },
  section: {
    marginBottom: 0,
  },
  table: {
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "#ececec",
    borderRadius: 8,
    overflow: "hidden",
  },
  tableHeader: {
    flexDirection: "row" as const,
    backgroundColor: "#f5f5f5",
    borderBottomWidth: 1,
    borderBottomColor: "#ececec",
    paddingVertical: 9,
    paddingHorizontal: 10,
  },
  tableRow: {
    flexDirection: "row" as const,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f1f1",
  },
  tableRowAlt: {
    backgroundColor: "#fcfcfc",
  },
  tableCol1: { width: "50%" },
  tableCol2: { width: "12%", textAlign: "right" as const },
  tableCol3: { width: "17.5%", textAlign: "right" as const },
  tableCol4: { width: "20.5%", textAlign: "right" as const },
  tableHeaderText: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#4b5563",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tableCellText: { fontSize: 10, color: "#1a1a1a" },
  tableDescriptionSubtext: {
    fontSize: 9,
    color: "#6b7280",
    marginTop: 2,
  },
  totals: {
    marginLeft: "auto",
    width: "44%",
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: "#ececec",
    paddingTop: 10,
  },
  totalRow: {
    flexDirection: "row" as const,
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  totalLabel: { fontSize: 10, color: "#71717a" },
  totalValue: { fontSize: 10, color: "#1a1a1a" },
  grandTotal: {
    borderTopWidth: 1,
    borderTopColor: "#d4d4d8",
    paddingTop: 7,
    marginTop: 5,
  },
  grandTotalLabel: { fontSize: 12, fontWeight: "bold", color: "#111827" },
  grandTotalValue: { fontSize: 13, fontWeight: "bold", color: "#111827" },
  notes: {
    marginTop: 24,
    padding: 13,
    backgroundColor: "#f9fafb",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ececec",
  },
  notesLabel: {
    fontSize: 9,
    color: "#6b7280",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.9,
  },
  notesText: { fontSize: 10, color: "#1a1a1a", lineHeight: 1.5 },
  footer: {
    marginTop: 24,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingTop: 9,
  },
  footerText: {
    textAlign: "center" as const,
    fontSize: 8.5,
    color: "#9ca3af",
  },
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
        <View style={styles.logoBox}>
          {data.agencyLogo ? (
            <Image src={data.agencyLogo} style={styles.logoImage} />
          ) : (
            <Text style={styles.logoFallbackText}>{data.agencyName}</Text>
          )}
        </View>

        <View style={styles.headerRight}>
          <Text style={styles.proposalTitle}>PROPOSAL</Text>
          <Text style={styles.proposalMeta}>
            Proposal #{data.proposalNumber}
            {"\n"}
            Date: {data.date}
            {data.validUntil ? `\nValid Until: ${data.validUntil}` : ""}
          </Text>
        </View>
      </View>

      <View style={styles.fromToRow}>
        <View style={styles.infoColumn}>
          <Text style={styles.sectionLabel}>From</Text>
          <Text style={styles.infoValue}>{data.agencyName}</Text>
          {data.agencyEmail && <Text style={styles.infoValue}>{data.agencyEmail}</Text>}
          {data.agencyPhone && <Text style={styles.infoValue}>{data.agencyPhone}</Text>}
          {data.agencyAddress && <Text style={styles.infoValue}>{data.agencyAddress}</Text>}
        </View>

        <View style={styles.infoColumn}>
          <Text style={styles.sectionLabel}>To</Text>
          <Text style={styles.infoValue}>{data.clientName}</Text>
          {data.clientCompany && <Text style={styles.infoValue}>{data.clientCompany}</Text>}
          {data.clientEmail && <Text style={styles.infoValue}>{data.clientEmail}</Text>}
        </View>
      </View>

      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableCol1, styles.tableHeaderText]}>Description</Text>
          <Text style={[styles.tableCol2, styles.tableHeaderText]}>Qty</Text>
          <Text style={[styles.tableCol3, styles.tableHeaderText]}>Unit Price</Text>
          <Text style={[styles.tableCol4, styles.tableHeaderText]}>Amount</Text>
        </View>
        {data.items.map((item, index) => (
          <View
            key={item.id || index}
            style={[
              styles.tableRow,
              index % 2 === 1 ? styles.tableRowAlt : {},
              index === data.items.length - 1 ? { borderBottomWidth: 0 } : {},
            ]}
          >
            <View style={styles.tableCol1}>
              <Text style={styles.tableCellText}>{item.description?.trim() || item.title}</Text>
              {item.description?.trim() && item.title !== item.description && (
                <Text style={styles.tableDescriptionSubtext}>
                  {item.title}
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

      <View style={styles.footer}>
        <Text style={styles.footerText}>Generated by Draftup</Text>
      </View>
    </Page>
  </Document>
);

export async function generateProposalPdfBuffer(
  data: ProposalData
): Promise<Buffer> {
  const buffer = await renderToBuffer(<ProposalPdfDocument data={data} />);
  return buffer;
}
