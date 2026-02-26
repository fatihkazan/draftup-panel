import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const DEFAULT_FROM = "noreply@draftup.co";

type SendMailParams = {
  to: string;
  subject: string;
  text: string;
};

export async function sendMail({ to, subject, text }: SendMailParams) {
  return resend.emails.send({
    from: DEFAULT_FROM,
    to,
    subject,
    text,
  });
}
