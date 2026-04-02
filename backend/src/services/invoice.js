// dealiq/backend/src/services/invoice.js
// GST invoice generation — saves PDF URL to DB
// In production: use a PDF service like PDFMonkey or html-pdf-node

export async function generateGSTInvoice(invoice, org) {
  // In production, call a PDF API here.
  // For MVP: mark as generated and skip PDF
  console.log(`📄 Invoice ${invoice.invoice_number} generated for ${org.name}`)
  // TODO: integrate PDFMonkey or similar for real PDF
}
