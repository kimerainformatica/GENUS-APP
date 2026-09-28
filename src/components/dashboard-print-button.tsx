"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DashboardPrintButton() {
  return (
    <Button variant="outline" onClick={() => window.print()}>
      <Printer size={17} aria-hidden="true" />
      Exportar / Imprimir PDF
    </Button>
  );
}
