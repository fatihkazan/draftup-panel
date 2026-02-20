import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export type SendInvoiceEmailParams = {
  to: string;
  invoiceNumber: string;
  agencyName: string;
};

/**
 * Sends a simple invoice notification email via Resend.
 * No PDF attachment or payment links.
 */
export async function sendInvoiceEmail({
  to,
  invoiceNumber,
  agencyName,
}: SendInvoiceEmailParams) {
  const subject = `Invoice ${invoiceNumber} from ${agencyName}`;
  const text = `Hello,

Please find your invoice ${invoiceNumber} attached.

Best regards,
${agencyName}`;

  const from = process.env.RESEND_FROM_EMAIL ?? "Invoices <invoices@resend.dev>";

  return resend.emails.send({
    from,
    to,
    subject,
    text,
  });
}
