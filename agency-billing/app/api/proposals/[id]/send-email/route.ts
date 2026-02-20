import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: proposalId } = await params;

    // 1. Require authentication
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const token = authHeader.replace("Bearer ", "");

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // 2. Get user's agency_id
    const { data: agencyData } = await supabase
      .from("agency_settings")
      .select("id")
      .eq("user_id", user.id)
      .single();
    if (!agencyData) {
      return NextResponse.json({ error: "Agency not found" }, { status: 404 });
    }

    // 3. Fetch proposal and verify ownership
    const { data: proposal, error: fetchError } = await supabase
      .from("proposals")
      .select(
        `
        *,
        client:clients(id, name, email, company),
        agency:agency_settings(agency_name, email)
      `
      )
      .eq("id", proposalId)
      .single();

    if (fetchError || !proposal) {
      console.error("Fetch error:", fetchError);
      return NextResponse.json(
        { error: "Proposal not found" },
        { status: 404 }
      );
    }
    if (proposal.agency_id !== agencyData.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!proposal.client?.email) {
      return NextResponse.json(
        { error: "Client has no email address" },
        { status: 400 }
      );
    }

    // Generate proposal URL
    const proposalUrl = `${request.nextUrl.origin}/p/${proposal.public_token}`;

    // Send email
    const { data: emailData, error: emailError } = await resend.emails.send({
      from: "draftup <invoices@resend.dev>", // Will change this to your domain
      to: process.env.TEST_EMAIL || proposal.client.email,
      subject: `New Proposal: ${proposal.title}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>New Proposal</title>
          </head>
          <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
              <tr>
                <td align="center">
                  <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                    
                    <!-- Header -->
                    <tr>
                      <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 40px 30px; text-align: center;">
                        <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">New Proposal</h1>
                      </td>
                    </tr>

                    <!-- Content -->
                    <tr>
                      <td style="padding: 40px;">
                        <p style="margin: 0 0 20px; color: #374151; font-size: 16px; line-height: 1.6;">
                          Hi <strong>${proposal.client.name}</strong>,
                        </p>
                        
                        <p style="margin: 0 0 20px; color: #374151; font-size: 16px; line-height: 1.6;">
                          ${proposal.agency?.agency_name || "We"} sent you a new proposal: <strong>${proposal.title}</strong>
                        </p>

                        <p style="margin: 0 0 30px; color: #6b7280; font-size: 15px; line-height: 1.6;">
                          Click the button below to review and respond to this proposal.
                        </p>

                        <!-- CTA Button -->
                        <table width="100%" cellpadding="0" cellspacing="0">
                          <tr>
                            <td align="center" style="padding: 20px 0;">
                              <a href="${proposalUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 6px rgba(102, 126, 234, 0.4);">
                                View Proposal
                              </a>
                            </td>
                          </tr>
                        </table>

                        <p style="margin: 30px 0 0; color: #9ca3af; font-size: 14px; line-height: 1.6;">
                          Or copy this link: <br>
                          <a href="${proposalUrl}" style="color: #667eea; word-break: break-all;">${proposalUrl}</a>
                        </p>
                      </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                      <td style="background-color: #f9fafb; padding: 30px 40px; border-top: 1px solid #e5e7eb;">
                        <p style="margin: 0; color: #6b7280; font-size: 13px; line-height: 1.6; text-align: center;">
                          This proposal was sent by ${proposal.agency?.agency_name || "your partner"}
                        </p>
                      </td>
                    </tr>

                  </table>
                </td>
              </tr>
            </table>
          </body>
        </html>
      `,
    });

    if (emailError) {
      console.error("Email error:", emailError);
      return NextResponse.json(
        { error: "Failed to send email", details: emailError.message },
        { status: 500 }
      );
    }

    // Update proposal status to 'sent'
    const { error: updateError } = await supabase
      .from("proposals")
      .update({ 
        status: "sent",
        sent_at: new Date().toISOString()
      })
      .eq("id", proposalId);

    if (updateError) {
      console.error("Status update error:", updateError);
    }

    return NextResponse.json({
      success: true,
      email_id: emailData?.id,
      message: "Proposal sent successfully",
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      {
        error: "Unexpected error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}