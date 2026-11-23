'use client';

import { Printer } from 'lucide-react';

export function ProposalPrintButton() {
  return <button type="button" onClick={() => window.print()} className="btn btn-primary print-hide">
    <Printer size={16} /> حفظ العرض PDF
  </button>;
}
