# Invoice PDF Lifecycle System

## Overview

This document describes the invoice PDF lifecycle system implementation for the Agency Billing app.

## State Machine

```
┌─────────────────────────────────────────────────────────────────┐
│                         INVOICE STATES                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌──────────┐    Generate PDF    ┌──────────────┐              │
│   │  DRAFT   │ ─────────────────► │ DRAFT + PDF  │              │
│   │ (no PDF) │                    │  (pdf_url)   │              │
│   └──────────┘                    └──────┬───────┘              │
│        │                                 │                      │
│        │                     Mark as Invoice                    │
│        │                                 │                      │
│        │                                 ▼                      │
│        │                          ┌──────────┐                  │
│        └─────── (blocked) ───────►│   SENT   │                  │
│                                   │(finalized)│                  │
│                                   └──────────┘                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Database Fields

| Field | Type | Description |
|-------|------|-------------|
| `status` | enum | 'draft', 'sent', 'paid', 'overdue', 'void' |
| `pdf_url` | text (nullable) | URL to generated PDF in Supabase Storage |
| `sent_at` | timestamp (nullable) | When invoice was finalized |
| `public_token` | uuid | Unique token for public invoice link |

## Button State Logic

### State: Draft (no PDF)
- **Shows:** `Generate PDF` button only
- **Actions available:** Generate PDF

### State: Draft (has PDF)
- **Shows:** `Mark as Invoice` + `Download PDF` buttons
- **Actions available:**
  - Mark as Invoice (finalizes invoice)
  - Download PDF (no state change)

### State: Sent
- **Shows:** `Download PDF` + `Send to Customer` buttons
- **Actions available:**
  - Download PDF (no state change)
  - Send to Customer (sends email, no state change)

## Action Details

### 1. Generate PDF
- **Trigger:** "Generate PDF" button click
- **Process:**
  1. Client captures `/i/[token]?print=true` in hidden iframe
  2. Uses html2canvas to convert to image
  3. Uses jsPDF to create PDF
  4. Sends base64 PDF to API
  5. API uploads to Supabase Storage
  6. API updates `invoices.pdf_url`
- **Status change:** None (remains `draft`)
- **DB updates:** `pdf_url = <storage_url>`

### 2. Download PDF
- **Trigger:** "Download PDF" button click
- **Process:** Downloads file from `pdf_url`
- **Status change:** None
- **DB updates:** None

### 3. Mark as Invoice
- **Trigger:** "Mark as Invoice" button click
- **Requirements:** `pdf_url` must exist
- **Process:** API call to `/api/invoices/[id]/mark-sent`
- **Status change:** `draft` → `sent`
- **DB updates:** `status = 'sent'`, `sent_at = now()`

### 4. Send to Customer
- **Trigger:** "Send to Customer" button click
- **Requirements:**
  - Status must be `sent`
  - Client must have email
- **Process:** API call to `/api/invoices/[id]/send-email`
- **Status change:** None
- **DB updates:** None

## Setup Instructions

### 1. Database Migration

Run the SQL migrations in your Supabase project:

```bash
# Option A: Via Supabase CLI
supabase db push

# Option B: Via Supabase Dashboard
# Go to SQL Editor and run the contents of:
# - supabase/migrations/001_invoice_pdf_lifecycle.sql
# - supabase/migrations/002_storage_setup.sql
```

### 2. Environment Variables

Add to your `.env.local`:

```env
# Required for API routes
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Optional: Used for email links
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

Get your service role key from:
**Supabase Dashboard → Settings → API → Service Role Key**

### 3. Storage Bucket Setup

The migration creates a `documents` bucket automatically. If you need to create it manually:

1. Go to **Supabase Dashboard → Storage**
2. Click **New Bucket**
3. Name: `documents`
4. Public: `true`
5. Apply the storage policies from `002_storage_setup.sql`

## API Routes

### POST `/api/invoices/[id]/generate-pdf`
Uploads PDF and updates `pdf_url`.

**Request:**
```json
{
  "pdfBase64": "base64-encoded-pdf-content"
}
```

**Response:**
```json
{
  "success": true,
  "pdf_url": "https://storage.supabase.co/..."
}
```

### POST `/api/invoices/[id]/mark-sent`
Finalizes invoice (draft → sent).

**Response:**
```json
{
  "success": true,
  "message": "Invoice marked as sent"
}
```

### POST `/api/invoices/[id]/send-email`
Sends invoice to customer via email.

**Response:**
```json
{
  "success": true,
  "message": "Email queued for customer@example.com",
  "emailData": {
    "to": "customer@example.com",
    "subject": "Invoice: Project Name",
    "viewUrl": "https://app.com/i/token"
  }
}
```

## File Structure

```
app/
├── api/invoices/[id]/
│   ├── generate-pdf/route.ts  # PDF upload endpoint
│   ├── mark-sent/route.ts     # Finalize invoice endpoint
│   └── send-email/route.ts    # Email sending endpoint
├── (dashboard)/invoices/[id]/
│   └── page.tsx               # Invoice detail with lifecycle buttons
└── i/[token]/
    └── page.tsx               # Public invoice page (PDF source)

lib/
├── pdfGenerator.ts            # Client-side PDF generation utils
├── supabaseClient.ts          # Client-side Supabase client
└── supabaseServer.ts          # Server-side Supabase client

supabase/migrations/
├── 001_invoice_pdf_lifecycle.sql  # Database schema changes
└── 002_storage_setup.sql          # Storage bucket setup
```

## Email Integration (TODO)

The `/api/invoices/[id]/send-email` endpoint currently logs email data but doesn't actually send emails. To enable email sending:

1. Install an email library (Resend, SendGrid, etc.)
2. Update the endpoint to call your email service
3. Add the required API keys to environment variables

Example with Resend:

```typescript
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

await resend.emails.send({
  from: 'invoices@yourdomain.com',
  to: client.email,
  subject: `Invoice: ${invoice.title}`,
  html: emailTemplate,
  attachments: [{ path: invoice.pdf_url }],
});
```

## Security Considerations

1. **Service Role Key:** Never expose to client. Only use in API routes.
2. **PDF Access:** PDFs are publicly readable but require the URL. Consider signed URLs for sensitive invoices.
3. **Public Token:** UUIDs are hard to guess but not secret. Add authentication if needed.
4. **Rate Limiting:** Consider adding rate limits to API endpoints.
