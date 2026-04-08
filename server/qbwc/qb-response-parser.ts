/**
 * Parses qbXML response strings into typed JavaScript objects.
 *
 * QB Desktop returns XML like:
 *   <CustomerQueryRs statusCode="0" statusMessage="Status OK">
 *     <CustomerRet>
 *       <ListID>80000001-1234567890</ListID>
 *       <FullName>Acme Corp:12345.001</FullName>
 *       <Balance>15000.00</Balance>
 *       ...
 *     </CustomerRet>
 *     ...
 *   </CustomerQueryRs>
 */
import { XMLParser } from "fast-xml-parser";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  // Force arrays for elements that could be single or multiple
  isArray: (name) => name === "CustomerRet",
});

// ── Types ─────────────────────────────────────────────────────

export interface QBCustomerJob {
  listId: string;
  fullName: string;         // "CustomerName:ProjectNumber"
  name: string;             // Just the last segment (the job name)
  customer: string | null;  // Parent customer name
  number: string;           // Extracted project number
  isJob: boolean;           // true if this is a sub-customer (job)
  description: string | null;
  rep: string | null;
  balance: number | null;    // dollars (we convert to cents when storing)
  totalBalance: number | null;
  jobStatus: string | null;  // "In progress", "Awarded", "Closed", "Not awarded", "Pending", "None"
  jobType: string | null;
  customerType: string | null;
  startDate: string | null;  // YYYY-MM-DD
  projectedEnd: string | null;
  endDate: string | null;
  isActive: boolean;
}

// ── Parser ────────────────────────────────────────────────────

/**
 * Parse a CustomerQueryRs response into an array of QBCustomerJob objects.
 */
export function parseCustomerQueryResponse(xmlString: string): {
  jobs: QBCustomerJob[];
  statusCode: string;
  statusMessage: string;
} {
  const parsed = parser.parse(xmlString);

  // Navigate: QBXML > QBXMLMsgsRs > CustomerQueryRs
  const qbxml = parsed?.QBXML;
  const msgsRs = qbxml?.QBXMLMsgsRs;
  const queryRs = msgsRs?.CustomerQueryRs;

  if (!queryRs) {
    return { jobs: [], statusCode: "-1", statusMessage: "No CustomerQueryRs found in response" };
  }

  const statusCode = queryRs["@_statusCode"] || "0";
  const statusMessage = queryRs["@_statusMessage"] || "";

  if (statusCode !== "0") {
    return { jobs: [], statusCode, statusMessage };
  }

  const customerRets: any[] = queryRs.CustomerRet || [];
  const jobs: QBCustomerJob[] = [];

  for (const ret of customerRets) {
    const fullName = ret.FullName || "";
    const listId = ret.ListID || "";
    const isJob = fullName.includes(":");

    // Parse "CustomerName:ProjectNumber"
    let customer: string | null = null;
    let number = fullName;
    if (isJob) {
      const colonIdx = fullName.lastIndexOf(":");
      customer = fullName.substring(0, colonIdx).trim();
      number = fullName.substring(colonIdx + 1).trim();
    }

    // Extract date fields (QB returns YYYY-MM-DD)
    const startDate = ret.JobStartDate || null;
    const projectedEnd = ret.JobProjectedEndDate || null;
    const endDate = ret.JobEndDate || null;

    // Extract rep from SalesRepRef
    const rep = ret.SalesRepRef?.FullName || null;

    // Extract job type from JobTypeRef
    const jobType = ret.JobTypeRef?.FullName || null;

    // Extract customer type from CustomerTypeRef
    const customerType = ret.CustomerTypeRef?.FullName || null;

    jobs.push({
      listId,
      fullName,
      name: ret.Name || number,
      customer,
      number,
      isJob,
      description: ret.JobDesc || null,
      rep,
      balance: ret.Balance != null ? parseFloat(ret.Balance) : null,
      totalBalance: ret.TotalBalance != null ? parseFloat(ret.TotalBalance) : null,
      jobStatus: ret.JobStatus || null,
      jobType,
      customerType,
      startDate,
      projectedEnd,
      endDate,
      isActive: ret.IsActive === "true" || ret.IsActive === true,
    });
  }

  return { jobs, statusCode, statusMessage };
}
