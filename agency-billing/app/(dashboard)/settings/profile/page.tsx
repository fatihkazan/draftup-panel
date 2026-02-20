"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "@/components/ui/Toast";

type AgencySettings = {
  id: string;
  user_id: string;
  agency_name: string;
  email: string;
  phone: string;
  address: string;
  currency: string;
  default_tax_rate: number;
  payment_label: string;
  iban: string;
  swift: string;
  payment_note: string;
  logo_url?: string;
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm text-muted-foreground mb-1.5">{label}</label>
      {children}
    </div>
  );
}

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [row, setRow] = useState<AgencySettings | null>(null);

  const [agencyName, setAgencyName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [defaultTaxRatePct, setDefaultTaxRatePct] = useState("0");
  const [paymentLabel, setPaymentLabel] = useState("Bank Transfer");
  const [iban, setIban] = useState("");
  const [swift, setSwift] = useState("");
  const [paymentNote, setPaymentNote] = useState("");

  const [stripeStatus, setStripeStatus] = useState<"loading" | "connected" | "not_connected">("loading");
  const [stripeConnecting, setStripeConnecting] = useState(false);

  const [logoUrl, setLogoUrl] = useState<string>("");
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const [fullName, setFullName] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    load().then(() => {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("stripe") === "success") {
        setStatusMsg("Stripe connected successfully!");
      }
      if (urlParams.get("stripe") === "refresh") {
        setStatusMsg("Stripe onboarding incomplete. Please try again.");
      }
    });
  }, []);

  async function load() {
    setLoading(true);
    setStatusMsg("Loading...");

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    const user = userData?.user;

    if (userErr || !user) {
      setStatusMsg("ERROR: Not authenticated");
      setLoading(false);
      return;
    }

    const { data: profileData } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();

    if (profileData?.full_name) setFullName(profileData.full_name);

    const { data, error } = await supabase
      .from("agency_settings")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      setStatusMsg("ERROR: " + error.message);
      setLoading(false);
      return;
    }

    if (data) {
      setRow(data as AgencySettings);
      setAgencyName((data as any).agency_name ?? "");
      setEmail((data as any).email ?? "");
      setPhone((data as any).phone ?? "");
      setAddress((data as any).address ?? "");
      setCurrency((data as any).currency ?? "USD");
      const dr = (data as any).default_tax_rate;
      setDefaultTaxRatePct(dr != null ? String(Math.round(Number(dr) * 100)) : "0");
      setPaymentLabel((data as any).payment_label ?? "Bank Transfer");
      setIban((data as any).iban ?? "");
      setSwift((data as any).swift ?? "");
      setPaymentNote((data as any).payment_note ?? "");
      if ((data as any).logo_url) setLogoUrl((data as any).logo_url);
      setStatusMsg("");
      if ((data as any).stripe_onboarding_completed) {
        setStripeStatus("connected");
      } else {
        setStripeStatus("not_connected");
      }
    } else {
      setRow(null);
      setStatusMsg("No settings yet. Fill and save.");
      setStripeStatus("not_connected");
    }

    setLoading(false);
  }

  async function handleSaveProfile() {
    setProfileLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("profiles")
        .upsert({ id: user.id, full_name: fullName, updated_at: new Date().toISOString() });

      if (error) {
        toast("Failed to save profile", "error");
      } else {
        toast("Profile saved!", "success");
      }
    } finally {
      setProfileLoading(false);
    }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setStatusMsg("ERROR: Please upload an image file");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setStatusMsg("ERROR: File size must be under 2MB");
      return;
    }
    setUploadingLogo(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const ext = file.name.split(".").pop();
      const filename = `${user.id}/logo.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("agency-logos")
        .upload(filename, file, { upsert: true });
      if (uploadError) {
        setStatusMsg("ERROR: " + uploadError.message);
        return;
      }
      const { data: urlData } = supabase.storage
        .from("agency-logos")
        .getPublicUrl(filename);
      const url = urlData.publicUrl;
      setLogoUrl(url);
      await supabase
        .from("agency_settings")
        .update({ logo_url: url })
        .eq("user_id", user.id);
      setStatusMsg("Logo uploaded successfully!");
    } catch (err) {
      setStatusMsg("ERROR: Failed to upload logo");
    } finally {
      setUploadingLogo(false);
    }
  }

  async function connectStripe() {
    setStripeConnecting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setStatusMsg("ERROR: Not authenticated");
        return;
      }
      const res = await fetch("/api/stripe/connect/onboard", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setStatusMsg("ERROR: " + (data.error || "Failed to connect Stripe"));
        return;
      }
      window.location.href = data.url;
    } catch (err) {
      setStatusMsg("ERROR: Failed to connect Stripe");
    } finally {
      setStripeConnecting(false);
    }
  }

  async function save() {
    setSaving(true);
    setStatusMsg("Saving...");

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    const user = userData?.user;

    if (userErr || !user) {
      setStatusMsg("ERROR: Not authenticated");
      setSaving(false);
      return;
    }

    const payload = {
      user_id: user.id,
      agency_name: agencyName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      address: address.trim(),
      currency: currency.trim() || "USD",
      default_tax_rate: Math.max(0, Math.min(100, parseFloat(defaultTaxRatePct) || 0)) / 100,
      payment_label: paymentLabel.trim(),
      iban: iban.trim(),
      swift: swift.trim(),
      payment_note: paymentNote.trim(),
    };

    if (!row) {
      const { error } = await supabase.from("agency_settings").insert(payload);
      if (error) {
        setStatusMsg("ERROR: " + error.message);
        setSaving(false);
        return;
      }
      setStatusMsg("Settings saved successfully!");
      setSaving(false);
      await load();
      return;
    }

    const { error } = await supabase
      .from("agency_settings")
      .update(payload)
      .eq("id", row.id);

    if (error) {
      setStatusMsg("ERROR: " + error.message);
      setSaving(false);
      return;
    }

    setStatusMsg("Settings saved successfully!");
    setSaving(false);
    await load();
  }

  const inputClasses = "w-full rounded-xl bg-secondary border border-border px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent transition-colors";

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Profile</h1>
          <p className="text-sm text-muted-foreground">
            Agency details used in public invoice/proposal pages
          </p>
        </div>

        <button
          type="button"
          onClick={save}
          disabled={loading || saving}
          className="rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground hover:bg-accent/90 disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>

      {statusMsg && (
        <div className={`mb-6 rounded-xl border p-4 text-sm ${
          statusMsg.includes("ERROR")
            ? "border-destructive/50 bg-destructive/10 text-destructive"
            : statusMsg.includes("successfully")
            ? "border-accent/50 bg-accent/10 text-accent"
            : "border-border bg-card text-muted-foreground"
        }`}>
          {statusMsg}
        </div>
      )}

      <div className="max-w-3xl space-y-6">
        <div className="rounded-2xl bg-card border border-border p-6">
          <h3 className="text-sm font-semibold text-foreground mb-1">User Profile</h3>
          <p className="text-sm text-muted-foreground mb-4">Your name will appear on proposals and invoices.</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs text-muted-foreground mb-1">Full Name</label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="John Doe"
                className="w-full rounded-xl bg-secondary border border-border px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent transition-colors"
              />
            </div>
          </div>
          <div className="mt-4">
            <button
              onClick={handleSaveProfile}
              disabled={profileLoading}
              className="rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground hover:bg-accent/90 disabled:opacity-50 transition-colors"
            >
              {profileLoading ? "Saving..." : "Save Profile"}
            </button>
          </div>
        </div>

        <div className="rounded-2xl bg-card border border-border p-6">
          <h3 className="text-sm font-semibold text-foreground mb-1">Agency Logo</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Your logo will appear on proposals and invoices.
          </p>
          <div className="flex items-center gap-4">
            {logoUrl ? (
              <div className="h-16 w-32 rounded-xl border border-border bg-secondary flex items-center justify-center overflow-hidden">
                <img src={logoUrl} alt="Agency logo" className="h-full w-full object-contain p-2" />
              </div>
            ) : (
              <div className="h-16 w-32 rounded-xl border border-dashed border-border bg-secondary flex items-center justify-center">
                <span className="text-xs text-muted-foreground">No logo</span>
              </div>
            )}
            <div>
              <label className="cursor-pointer inline-flex items-center gap-2 rounded-xl bg-secondary border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
                {uploadingLogo ? "Uploading..." : "Upload Logo"}
              </label>
              <p className="text-xs text-muted-foreground mt-2">PNG, JPG up to 2MB</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-card border border-border p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">Agency Information</h3>

          <div className="space-y-4">
            <Field label="Agency Name">
              <input
                className={inputClasses}
                value={agencyName}
                onChange={(e) => setAgencyName(e.target.value)}
                placeholder="Your Agency Name"
              />
            </Field>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Email">
                <input
                  className={inputClasses}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contact@agency.com"
                />
              </Field>
              <Field label="Phone">
                <input
                  className={inputClasses}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 234 567 8900"
                />
              </Field>
              <Field label="Default Tax Rate (%)">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  className={inputClasses}
                  value={defaultTaxRatePct}
                  onChange={(e) => setDefaultTaxRatePct(e.target.value)}
                  placeholder="0"
                />
              </Field>
              <Field label="Default Currency">
                <select
                  className={inputClasses}
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                >
                  <option value="USD">USD - US Dollar</option>
                  <option value="EUR">EUR - Euro</option>
                  <option value="GBP">GBP - British Pound</option>
                  <option value="TRY">TRY - Turkish Lira</option>
                </select>
              </Field>
            </div>

            <Field label="Address">
              <textarea
                className={`${inputClasses} resize-none`}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={3}
                placeholder="123 Business Street, City, Country"
              />
            </Field>
          </div>
        </div>

        <div className="rounded-2xl bg-card border border-border p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">Payment Information</h3>

          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Payment Label">
                <input
                  className={inputClasses}
                  value={paymentLabel}
                  onChange={(e) => setPaymentLabel(e.target.value)}
                  placeholder="Bank Transfer"
                />
              </Field>

              <Field label="Payment Note (optional)">
                <input
                  className={inputClasses}
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  placeholder="Additional payment instructions"
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="IBAN">
                <input
                  className={inputClasses}
                  value={iban}
                  onChange={(e) => setIban(e.target.value)}
                  placeholder="TR00 0000 0000 0000 0000 0000 00"
                />
              </Field>
              <Field label="SWIFT">
                <input
                  className={inputClasses}
                  value={swift}
                  onChange={(e) => setSwift(e.target.value)}
                  placeholder="BANKTRXX"
                />
              </Field>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-card border border-border p-6">
          <h3 className="text-sm font-semibold text-foreground mb-1">Stripe Connect</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Connect your Stripe account to accept online payments from clients.
          </p>

          {stripeStatus === "connected" ? (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-accent/10 border border-accent/20">
              <div className="h-8 w-8 rounded-full bg-accent/20 flex items-center justify-center">
                <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Stripe Connected</p>
                <p className="text-xs text-muted-foreground">Your account is ready to accept payments</p>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={connectStripe}
              disabled={stripeConnecting || loading}
              className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground hover:bg-accent/90 disabled:opacity-50 transition-colors"
            >
              {stripeConnecting ? "Connecting..." : "Connect Stripe Account"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
