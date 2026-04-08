/**
 * qbXML request templates for QuickBooks Desktop.
 *
 * Each function returns a well-formed qbXML request string.
 * These are sent to QB via the Web Connector.
 *
 * Reference: https://developer-static.intuit.com/qbsdk-current/common/newosr/index.html
 */

/**
 * Query ALL Customer:Job records from QB.
 *
 * In QB Desktop, "Jobs" are sub-customers. The response includes:
 *   - FullName (e.g. "Acme Corp:12345.001")
 *   - ListID (immutable QB identifier)
 *   - Balance, JobStatus, JobStartDate, JobProjectedEndDate, etc.
 *
 * @param fromModifiedDate - Optional ISO date string (YYYY-MM-DD).
 *   If provided, only returns records modified after this date (incremental sync).
 */
export function buildCustomerQueryRq(fromModifiedDate?: string): string {
  const modFilter = fromModifiedDate
    ? `<FromModifiedDate>${fromModifiedDate}T00:00:00</FromModifiedDate>`
    : "";

  return `<?xml version="1.0" encoding="utf-8"?>
<?qbxml version="13.0"?>
<QBXML>
  <QBXMLMsgsRq onError="continueOnError">
    <CustomerQueryRq requestID="1">
      <ActiveStatus>All</ActiveStatus>
      ${modFilter}
      <OwnerID>0</OwnerID>
    </CustomerQueryRq>
  </QBXMLMsgsRq>
</QBXML>`;
}

// ══════════════════════════════════════════════════════════════
// FUTURE TEMPLATES — uncomment when ready for Phase 3+
// ══════════════════════════════════════════════════════════════

// /**
//  * Query Estimates by customer/job.
//  */
// export function buildEstimateQueryRq(): string {
//   return `<?xml version="1.0" encoding="utf-8"?>
// <?qbxml version="13.0"?>
// <QBXML>
//   <QBXMLMsgsRq onError="continueOnError">
//     <EstimateQueryRq requestID="2">
//       <ActiveStatus>All</ActiveStatus>
//     </EstimateQueryRq>
//   </QBXMLMsgsRq>
// </QBXML>`;
// }

// /**
//  * Create a Purchase Order in QB.
//  */
// export function buildPurchaseOrderAddRq(po: {
//   vendor: string;
//   refNumber: string;
//   lines: { itemName: string; quantity: number; rate: number; description: string }[];
// }): string {
//   const lineItems = po.lines.map(l => `
//       <PurchaseOrderLineAdd>
//         <ItemRef><FullName>${l.itemName}</FullName></ItemRef>
//         <Desc>${l.description}</Desc>
//         <Quantity>${l.quantity}</Quantity>
//         <Rate>${l.rate}</Rate>
//       </PurchaseOrderLineAdd>`).join("");
//
//   return `<?xml version="1.0" encoding="utf-8"?>
// <?qbxml version="13.0"?>
// <QBXML>
//   <QBXMLMsgsRq onError="stopOnError">
//     <PurchaseOrderAddRq requestID="10">
//       <PurchaseOrderAdd>
//         <VendorRef><FullName>${po.vendor}</FullName></VendorRef>
//         <RefNumber>${po.refNumber}</RefNumber>
//         ${lineItems}
//       </PurchaseOrderAdd>
//     </PurchaseOrderAddRq>
//   </QBXMLMsgsRq>
// </QBXML>`;
// }
