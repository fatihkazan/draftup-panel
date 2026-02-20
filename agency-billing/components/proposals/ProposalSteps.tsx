"use client";

import { Check } from "lucide-react";

type Step = {
  number: number;
  title: string;
  status: "completed" | "active" | "upcoming";
};

export default function ProposalSteps({
  currentStep,
  hasInvoice,
}: {
  currentStep: 1 | 2 | 3 | 4;
  hasInvoice?: boolean;
}) {
  const steps: Step[] = [
    { number: 1, title: "Create Proposal", status: currentStep > 1 ? "completed" : currentStep === 1 ? "active" : "upcoming" },
    { number: 2, title: "Share with Customer", status: currentStep > 2 ? "completed" : currentStep === 2 ? "active" : "upcoming" },
    { number: 3, title: "Customer Approval", status: currentStep > 3 ? "completed" : currentStep === 3 ? "active" : "upcoming" },
    { number: 4, title: "Create Invoice", status: hasInvoice ? "completed" : currentStep === 4 ? "active" : "upcoming" },
  ];

  return (
    <div className="bg-card border border-border rounded-2xl p-6 mb-6">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => (
          <div key={step.number} className="flex items-center flex-1">
            {/* Step circle */}
            <div className="flex flex-col items-center">
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all ${
                  step.status === "completed"
                    ? "bg-accent border-accent text-accent-foreground"
                    : step.status === "active"
                    ? "bg-accent/10 border-accent text-accent"
                    : "bg-secondary border-border text-muted-foreground"
                }`}
              >
                {step.status === "completed" ? <Check size={20} /> : <span className="font-semibold">{step.number}</span>}
              </div>
              <p
                className={`text-xs mt-2 font-medium text-center ${
                  step.status === "active" ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {step.title}
              </p>
            </div>

            {/* Connecting line */}
            {index < steps.length - 1 && (
              <div className="flex-1 h-0.5 mx-4 -mt-6">
                <div
                  className={`h-full transition-all ${
                    step.status === "completed" ? "bg-accent" : "bg-border"
                  }`}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
