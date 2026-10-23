/** Deep link into the assisted-invoice workflow (CreateAssistedInvoiceModal, hosted by AdminPartnerInvoices):
 * the page opens the modal when it sees `create=1`, with the given farmer pre-selected if eligible. */
export function assistedInvoicePath(farmerId?: string): string {
  const params = new URLSearchParams({ create: "1" });
  if (farmerId) params.set("farmerId", farmerId);
  return `/admin/partner-invoices?${params.toString()}`;
}
