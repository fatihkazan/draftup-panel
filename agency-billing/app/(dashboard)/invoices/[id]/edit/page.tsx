"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "@/components/ui/Toast";

type InvoiceItem = {
  id?: string;
  title: string;
  description: string;
  quantity: number;
  unitPrice: number;
};

export default function EditInvoicePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [invoice, setInvoice] = useState<any>(null);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [taxRate, setTaxRate] = useState(0);

  useEffect(() => { loadInvoice(); }, [id]);

  async function loadInvoice() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: agency } = await supabase
      .from("agency_settings")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!agency) return;

    const { data } = await supabase
      .from("invoices")
      .select("*, invoice_items(*)")
      .eq("id", id)
      .eq("agency_id", agency.id)
      .maybeSingle();

    if (!data) { router.push("/invoices"); return; }
    if (data.status !== "draft") {
      toast("Only draft invoices can be edited", "error");
      router.push(`/invoices/${id}`);
      return;
    }

    setInvoice(data);
    setTitle(data.title || "");
    setDueDate(data.due_date || "");
    setNotes(data.notes || "");
    setTaxRate(Number(data.tax_rate || 0));
    setItems(
      (data.invoice_items || []).map((item: any) => ({
        id: item.id,
        title: item.title || "",
        description: item.description || "",
        quantity: Number(item.qty),
        unitPrice: Number(item.unit_price),
      }))
    );
    setLoading(false);
  }

  function addItem() {
    setItems([...items, { title: "", description: "", quantity: 1, unitPrice: 0 }]);
  }

  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index));
  }

  function updateItem(index: number, field: keyof InvoiceItem, value: any) {
    setItems(items.map((item, i) => i === index ? { ...item, [field]: value } : item));
  }

  const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const taxAmount = Math.round(subtotal * taxRate * 100) / 100;
  const total = subtotal + taxAmount;

  async function handleSave() {
    if (!title.trim()) { toast("Invoice title is required", "error"); return; }
    if (items.length === 0) { toast("Add at least one item", "error"); return; }

    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const res = await fetch(`/api/invoices/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          title,
          due_date: dueDate || null,
          notes,
          tax_rate: taxRate,
          total,
          items: items.map(item => ({
            id: item.id,
            title: item.title,
            description: item.description,
            qty: item.quantity,
            unit_price: item.unitPrice,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "Failed to save", "error");
        return;
      }

      toast("Invoice updated!", "success");
      router.push(`/invoices/${id}`);
    } catch {
      toast("Failed to save invoice", "error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-6 text-muted-foreground">Loading...</div>;

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/invoices/${id}`} className="p-2 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft size={18} className="text-muted-foreground" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Edit Invoice</h1>
          <p className="text-sm text-muted-foreground">{invoice?.invoice_number}</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Details */}
        <div className="rounded-2xl bg-card border border-border p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">Invoice Details</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs text-muted-foreground mb-1">Invoice Title *</label>
              <input value={title} onChange={e => setTitle(e.target.value)}
                className="w-full rounded-xl bg-secondary border border-border px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent transition-colors" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Due Date</label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                className="w-full rounded-xl bg-secondary border border-border px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent transition-colors" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Tax Rate (%)</label>
              <input type="number" value={taxRate} onChange={e => setTaxRate(Number(e.target.value))}
                className="w-full rounded-xl bg-secondary border border-border px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent transition-colors" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-muted-foreground mb-1">Notes</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
                className="w-full rounded-xl bg-secondary border border-border px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent transition-colors resize-none" />
            </div>
          </div>
        </div>

        {/* Items */}
        <div className="rounded-2xl bg-card border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground">Items</h3>
            <button onClick={addItem} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary border border-border text-xs font-medium text-foreground hover:bg-muted transition-colors">
              <Plus size={14} /> Add Item
            </button>
          </div>
          <div className="space-y-3">
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No items yet</p>
            ) : (
              items.map((item, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-start">
                  <div className="col-span-5">
                    <input placeholder="Item title" value={item.title} onChange={e => updateItem(index, "title", e.target.value)}
                      className="w-full rounded-lg bg-secondary border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent transition-colors" />
                  </div>
                  <div className="col-span-2">
                    <input type="number" placeholder="Qty" value={item.quantity} onChange={e => updateItem(index, "quantity", Number(e.target.value))}
                      className="w-full rounded-lg bg-secondary border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent transition-colors" />
                  </div>
                  <div className="col-span-3">
                    <input type="number" placeholder="Unit price" value={item.unitPrice} onChange={e => updateItem(index, "unitPrice", Number(e.target.value))}
                      className="w-full rounded-lg bg-secondary border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent transition-colors" />
                  </div>
                  <div className="col-span-1 flex items-center pt-2">
                    <span className="text-sm font-medium text-foreground">${(item.quantity * item.unitPrice).toLocaleString()}</span>
                  </div>
                  <div className="col-span-1 flex items-center justify-center pt-1">
                    <button onClick={() => removeItem(index)} className="text-muted-foreground hover:text-destructive transition-colors">
                      <X size={16} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
          {items.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border space-y-1 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span><span>${subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Tax ({taxRate}%)</span><span>${taxAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between font-semibold text-foreground text-base pt-1">
                <span>Total</span><span>${total.toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button onClick={handleSave} disabled={saving}
            className="rounded-xl bg-accent px-6 py-2.5 text-sm font-medium text-accent-foreground hover:bg-accent/90 disabled:opacity-50 transition-colors">
            {saving ? "Saving..." : "Save Changes"}
          </button>
          <Link href={`/invoices/${id}`}
            className="rounded-xl bg-secondary border border-border px-6 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors">
            Cancel
          </Link>
        </div>
      </div>
    </div>
  );
}
