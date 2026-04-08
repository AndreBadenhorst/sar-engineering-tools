/**
 * QBWC SOAP Server — starts alongside the main Express server.
 *
 * Listens on port 8108 (configurable via QB_SOAP_PORT env var).
 * The QB Web Connector app connects to http://localhost:8108/wsdl
 *
 * This file uses the quickbooks-js package which handles all SOAP
 * protocol details. We just provide our qbXML handler.
 */
import { createRequire } from "module";
import { log } from "../index";
import { qbxmlHandler } from "./qbxml-handler";

const require = createRequire(import.meta.url);

// Set port before requiring quickbooks-js (it reads process.env.QB_SOAP_PORT at require time)
const SOAP_PORT = process.env.QB_SOAP_PORT || "8108";
process.env.QB_SOAP_PORT = SOAP_PORT;

// Set credentials (QBWC sends these to authenticate)
// Change these to something secure for production!
process.env.QB_USERNAME = process.env.QB_USERNAME || "sar-tools";
process.env.QB_PASSWORD = process.env.QB_PASSWORD || "sar-tools-2026";

/**
 * Start the QBWC SOAP server.
 * Call this from server/index.ts after the main Express server starts.
 */
export function startQBWebConnectorServer() {
  try {
    // quickbooks-js is CommonJS, so we use require
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const QBWebService = require("quickbooks-js");

    const qbws = new QBWebService();
    qbws.setQBXMLHandler(qbxmlHandler);
    qbws.run();

    log(`QB Web Connector SOAP server listening on port ${SOAP_PORT}`, "qb-sync");
    log(`QBWC endpoint: http://localhost:${SOAP_PORT}/wsdl`, "qb-sync");
    log(`QBWC username: ${process.env.QB_USERNAME}`, "qb-sync");
  } catch (err: any) {
    log(`Failed to start QBWC server: ${err.message}`, "qb-sync");
    console.error(err);
  }
}
