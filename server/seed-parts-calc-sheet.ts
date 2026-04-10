/**
 * Import parts from SAR Calculation Sheet — Supplier Pricing tab.
 *
 * Reads the .xlsm file and upserts all parts + customer prices into the database.
 * Matches by part_number (unique). Updates existing, inserts new.
 *
 * Usage:
 *   npx tsx server/seed-parts-calc-sheet.ts [path-to-xlsm]
 *
 * Default path: X:\3. Quotes\Calculation Worksheet\_Calculation_v2_52.1.xlsm
 */
import Database from "better-sqlite3";
import path from "path";
import ExcelJS from "exceljs";

const defaultXlsm = "X:/3. Quotes/Calculation Worksheet/_Calculation_v2_52.1.xlsm";
const xlsmPath = process.argv[2] || defaultXlsm;

const dbPath = path.resolve(import.meta.dirname, "..", "data", "sar-tools.db");
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// ── Column mapping (from Supplier Pricing tab) ──────────────
// Col A(1)=Part Number, B(2)=Description, C(3)=SAR Price (formula),
// D(4)=Unit of Measure, E(5)=Not Used, F(6)=Manufacturer, G(7)=Supplier,
// H(8)=Date of Price Update, I(9)=Comments, J(10)=unused,
// K(11)=min/m, L(12)=min/connection, M(13)=UoM2,
// N(14)=BMW, O(15)=GM, P(16)=Volvo, Q(17)=GENERAL,
// R(18)=Reserved1, S(19)=Reserved2, T(20)=Price Default,
// W(23)=Datasheet

const CUSTOMER_COLS: [number, string][] = [
  [14, "BMW"],
  [15, "GM"],
  [16, "Volvo"],
  [17, "GENERAL"],
  [18, "Reserved1"],
  [19, "Reserved2"],
  [20, "Default"],
];

/** Extract a cell value, handling ExcelJS formula objects */
function cellVal(cell: ExcelJS.Cell): any {
  const v = cell.value;
  if (v === null || v === undefined) return null;
  if (typeof v === "object" && "result" in v) return (v as any).result ?? null;
  if (typeof v === "object" && "text" in v) return (v as any).text ?? null;
  return v;
}

/** Convert dollars to cents */
function dollarsToCents(val: any): number | null {
  if (val === null || val === undefined || val === "" || val === 0) return null;
  const n = typeof val === "string" ? parseFloat(val) : Number(val);
  if (isNaN(n) || n === 0) return null;
  return Math.round(n * 100);
}

/** Extract manufacturer part number by stripping SAR prefix */
function extractMfrPartNumber(partNumber: string): string | null {
  const dotIdx = partNumber.indexOf(".");
  if (dotIdx > 0 && dotIdx <= 5) {
    return partNumber.substring(dotIdx + 1).trim();
  }
  return null;
}

/** Build search keywords for fuzzy matching */
function buildSearchKeywords(partNumber: string, name: string, manufacturer: string | null, supplier: string | null): string {
  return [partNumber, name, manufacturer, supplier, extractMfrPartNumber(partNumber)]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/** Format date from ExcelJS */
function formatDate(val: any): string | null {
  if (!val) return null;
  if (val instanceof Date) {
    return val.toISOString().split("T")[0];
  }
  if (typeof val === "string") {
    // Try ISO parse
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
    return val.slice(0, 10);
  }
  return null;
}

/** Extract URL from hyperlink cell */
function extractUrl(cell: ExcelJS.Cell): string | null {
  const v = cell.value;
  if (!v) return null;
  if (typeof v === "object" && "hyperlink" in v) return (v as any).hyperlink;
  if (typeof v === "object" && "text" in v) {
    const text = (v as any).text;
    if (typeof text === "string" && text.startsWith("http")) return text;
  }
  if (typeof v === "string" && v.startsWith("http")) return v;
  return null;
}

async function main() {
  console.log(`Reading: ${xlsmPath}`);

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(xlsmPath);

  const ws = wb.getWorksheet("1. Supplier Pricing");
  if (!ws) {
    console.error("Sheet '1. Supplier Pricing' not found!");
    console.log("Available sheets:", wb.worksheets.map((s) => s.name).join(", "));
    process.exit(1);
  }

  console.log(`Found ${ws.rowCount} rows in Supplier Pricing`);

  // Prepare statements
  const upsertPart = db.prepare(`
    INSERT INTO parts (
      part_number, name, description, category, unit_of_measure,
      preferred_vendor, manufacturer, manufacturer_part_number,
      cost, install_min_per_meter, install_min_per_connection,
      price_updated_at, datasheet_url, comments,
      source, active, search_keywords, created_at, updated_at
    ) VALUES (
      @partNumber, @name, @description, @category, @unitOfMeasure,
      @preferredVendor, @manufacturer, @manufacturerPartNumber,
      @cost, @installMinPerMeter, @installMinPerConnection,
      @priceUpdatedAt, @datasheetUrl, @comments,
      'calc_sheet', 1, @searchKeywords, datetime('now'), datetime('now')
    )
    ON CONFLICT(part_number) DO UPDATE SET
      name = @name,
      description = @description,
      unit_of_measure = @unitOfMeasure,
      preferred_vendor = @preferredVendor,
      manufacturer = @manufacturer,
      manufacturer_part_number = @manufacturerPartNumber,
      cost = @cost,
      install_min_per_meter = @installMinPerMeter,
      install_min_per_connection = @installMinPerConnection,
      price_updated_at = @priceUpdatedAt,
      datasheet_url = @datasheetUrl,
      comments = @comments,
      source = 'calc_sheet',
      search_keywords = @searchKeywords,
      updated_at = datetime('now')
  `);

  const getPartId = db.prepare("SELECT id FROM parts WHERE part_number = ?");

  const upsertPrice = db.prepare(`
    INSERT INTO part_prices (part_id, customer_name, price, updated_at)
    VALUES (@partId, @customerName, @price, datetime('now'))
    ON CONFLICT(part_id, customer_name) DO UPDATE SET
      price = @price,
      updated_at = datetime('now')
  `);

  let imported = 0;
  let skipped = 0;
  let pricesAdded = 0;

  const importAll = db.transaction(() => {
    for (let r = 2; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const partNumber = String(cellVal(row.getCell(1)) || "").trim();
      if (!partNumber) {
        skipped++;
        continue;
      }

      const name = String(cellVal(row.getCell(2)) || "").trim();
      if (!name) {
        skipped++;
        continue;
      }

      const manufacturer = String(cellVal(row.getCell(6)) || "").trim() || null;
      const supplier = String(cellVal(row.getCell(7)) || "").trim() || null;
      const uom = String(cellVal(row.getCell(4)) || "").trim() || null;
      const defaultPrice = dollarsToCents(cellVal(row.getCell(20)));
      const installM = cellVal(row.getCell(11));
      const installC = cellVal(row.getCell(12));
      const priceDate = formatDate(cellVal(row.getCell(8)));
      const comments = String(cellVal(row.getCell(9)) || "").trim() || null;
      const datasheetUrl = extractUrl(row.getCell(23));
      const mfrPartNumber = extractMfrPartNumber(partNumber);

      // Upsert the part
      upsertPart.run({
        partNumber,
        name,
        description: null,
        category: null, // Will be populated later from Main tab sections
        unitOfMeasure: uom,
        preferredVendor: supplier,
        manufacturer,
        manufacturerPartNumber: mfrPartNumber,
        cost: defaultPrice,
        installMinPerMeter: installM && !isNaN(Number(installM)) ? Number(installM) : null,
        installMinPerConnection: installC && !isNaN(Number(installC)) ? Number(installC) : null,
        priceUpdatedAt: priceDate,
        datasheetUrl,
        comments,
        searchKeywords: buildSearchKeywords(partNumber, name, manufacturer, supplier),
      });

      imported++;

      // Get the part's ID for price rows
      const partRow = getPartId.get(partNumber) as { id: number } | undefined;
      if (!partRow) continue;
      const partId = partRow.id;

      // Upsert customer-specific prices
      for (const [colNum, customerName] of CUSTOMER_COLS) {
        const price = dollarsToCents(cellVal(row.getCell(colNum)));
        if (price !== null) {
          upsertPrice.run({ partId, customerName, price });
          pricesAdded++;
        }
      }
    }
  });

  importAll();

  console.log(`\nImport complete:`);
  console.log(`  Parts imported/updated: ${imported}`);
  console.log(`  Rows skipped (no part# or name): ${skipped}`);
  console.log(`  Customer prices added: ${pricesAdded}`);

  // Quick stats
  const totalParts = (db.prepare("SELECT COUNT(*) as c FROM parts").get() as any).c;
  const totalPrices = (db.prepare("SELECT COUNT(*) as c FROM part_prices").get() as any).c;
  const withPrices = (db.prepare("SELECT COUNT(DISTINCT part_id) as c FROM part_prices").get() as any).c;
  console.log(`\nDatabase totals:`);
  console.log(`  Parts: ${totalParts}`);
  console.log(`  Price entries: ${totalPrices}`);
  console.log(`  Parts with customer pricing: ${withPrices}`);

  db.close();
}

main().catch((err) => {
  console.error("Import failed:", err);
  process.exit(1);
});
