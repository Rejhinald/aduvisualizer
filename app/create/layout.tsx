"use client";

import { WizardProvider } from "@/lib/context/wizard-context";

export default function CreateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <WizardProvider>{children}</WizardProvider>;
}
