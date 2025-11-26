import PDFDocument from "pdfkit";
import path from "path";

/**
 * MaxTech BD Report Template Utility
 * Provides consistent branding, headers, and footers for all system reports
 */

export interface ReportConfig {
  title: string;
  subtitle?: string;
  doc: typeof PDFDocument.prototype;
  includeDate?: boolean;
}

export const BRAND_COLORS = {
  primary: "#E11D26",    // MaxTech Red
  black: "#1E1E1E",      // Dark Black
  gray: "#444444",       // Medium Gray
  lightGray: "#F8F9FA",  // Light background
  white: "#FFFFFF",
  border: "#E5E7EB",
};

export const COMPANY_INFO = {
  name: "MaxTech BD",
  address1: "522, SK Mujib Road (4th Floor)",
  address2: "Agrabad, Double Mooring",
  city: "Chattogram, Bangladesh",
  phone: "+8801843180008",
  email: "info@maxtechbd.com",
};

/**
 * Add MaxTech BD header to PDF report
 */
export function addReportHeader(config: ReportConfig): number {
  const { doc, title, subtitle, includeDate = true } = config;
  
  // Background color bar for header
  doc.save();
  doc.rect(0, 0, 595, 120).fill(BRAND_COLORS.lightGray);
  doc.restore();
  
  // Company Logo
  try {
    const logoPath = path.join(__dirname, "../../attached_assets/Untitled design (1)_1763794635122.png");
    doc.image(logoPath, 40, 30, { width: 80, height: 80 });
  } catch (error) {
    console.warn("Logo not found, skipping logo in PDF");
  }
  
  // Company Information (right side of header)
  doc.fontSize(14).font("Helvetica-Bold").fillColor(BRAND_COLORS.primary);
  doc.text(COMPANY_INFO.name, 350, 35, { width: 200, align: "right" });
  
  doc.fontSize(9).font("Helvetica").fillColor(BRAND_COLORS.black);
  doc.text(COMPANY_INFO.address1, 350, 52, { width: 200, align: "right" });
  doc.text(`${COMPANY_INFO.address2}, ${COMPANY_INFO.city}`, 350, 64, { width: 200, align: "right" });
  doc.text(`Phone: ${COMPANY_INFO.phone}`, 350, 76, { width: 200, align: "right" });
  doc.text(`Email: ${COMPANY_INFO.email}`, 350, 88, { width: 200, align: "right" });
  
  // Report Title
  doc.fontSize(20).font("Helvetica-Bold").fillColor(BRAND_COLORS.black);
  doc.text(title, 40, 140, { width: 515, align: "center" });
  
  let currentY = 165;
  
  // Optional Subtitle
  if (subtitle) {
    doc.fontSize(12).font("Helvetica").fillColor(BRAND_COLORS.gray);
    doc.text(subtitle, 40, currentY, { width: 515, align: "center" });
    currentY += 25;
  }
  
  // Optional Date
  if (includeDate) {
    doc.fontSize(10).font("Helvetica").fillColor(BRAND_COLORS.gray);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 40, currentY, { width: 515, align: "center" });
    currentY += 30;
  } else {
    currentY += 20;
  }
  
  return currentY;
}

/**
 * Add MaxTech BD footer to PDF report
 */
export function addReportFooter(doc: typeof PDFDocument.prototype, pageNumber?: number): void {
  const bottomY = 750;
  
  // Footer separator line
  doc.save();
  doc.moveTo(40, bottomY)
     .lineTo(555, bottomY)
     .strokeColor(BRAND_COLORS.border)
     .lineWidth(1)
     .stroke();
  doc.restore();
  
  // Footer text
  doc.fontSize(8).font("Helvetica").fillColor(BRAND_COLORS.gray);
  doc.text(
    `${COMPANY_INFO.name} | ${COMPANY_INFO.address1}, ${COMPANY_INFO.address2}, ${COMPANY_INFO.city}`,
    40,
    bottomY + 10,
    { width: 515, align: "center" }
  );
  doc.text(
    `Phone: ${COMPANY_INFO.phone} | Email: ${COMPANY_INFO.email}`,
    40,
    bottomY + 22,
    { width: 515, align: "center" }
  );
  
  // Optional page number
  if (pageNumber) {
    doc.text(`Page ${pageNumber}`, 500, bottomY + 10, { width: 55, align: "right" });
  }
}

/**
 * Create a professional table header
 */
export function createTableHeader(
  doc: typeof PDFDocument.prototype,
  y: number,
  columns: Array<{ label: string; width: number; align?: "left" | "center" | "right" }>
): number {
  const tableX = 40;
  const totalWidth = columns.reduce((sum, col) => sum + col.width, 0);
  const rowHeight = 35;
  
  // Header background
  doc.save();
  doc.rect(tableX, y, totalWidth, rowHeight).fillAndStroke(BRAND_COLORS.primary, BRAND_COLORS.primary);
  doc.restore();
  
  // Header text
  doc.fontSize(11).font("Helvetica-Bold").fillColor(BRAND_COLORS.white);
  let currentX = tableX + 10;
  
  columns.forEach(col => {
    doc.text(col.label, currentX, y + 11, { 
      width: col.width - 20, 
      align: col.align || "left" 
    });
    currentX += col.width;
  });
  
  return y + rowHeight;
}

/**
 * Create a table row with alternating colors
 */
export function createTableRow(
  doc: typeof PDFDocument.prototype,
  y: number,
  columns: Array<{ text: string; width: number; align?: "left" | "center" | "right"; bold?: boolean }>,
  isEven: boolean = false
): number {
  const tableX = 40;
  const totalWidth = columns.reduce((sum, col) => sum + col.width, 0);
  const rowHeight = 30;
  
  const bgColor = isEven ? BRAND_COLORS.lightGray : BRAND_COLORS.white;
  
  // Row background
  doc.save();
  doc.rect(tableX, y, totalWidth, rowHeight).fillAndStroke(bgColor, BRAND_COLORS.border);
  doc.restore();
  
  // Row text
  doc.fontSize(10).fillColor(BRAND_COLORS.black);
  let currentX = tableX + 10;
  
  columns.forEach(col => {
    if (col.bold) {
      doc.font("Helvetica-Bold");
    } else {
      doc.font("Helvetica");
    }
    doc.text(col.text, currentX, y + 8, { 
      width: col.width - 20, 
      align: col.align || "left" 
    });
    currentX += col.width;
  });
  
  return y + rowHeight;
}

/**
 * Add a summary section with key-value pairs
 */
export function addSummarySection(
  doc: typeof PDFDocument.prototype,
  y: number,
  items: Array<{ label: string; value: string; highlight?: boolean }>
): number {
  const labelX = 350;
  const valueX = 480;
  const lineHeight = 25;
  let currentY = y;
  
  items.forEach(item => {
    doc.fontSize(10).font("Helvetica").fillColor(BRAND_COLORS.gray);
    doc.text(item.label, labelX, currentY, { width: 120, align: "right" });
    
    if (item.highlight) {
      doc.fontSize(12).font("Helvetica-Bold").fillColor(BRAND_COLORS.primary);
    } else {
      doc.fontSize(11).font("Helvetica-Bold").fillColor(BRAND_COLORS.black);
    }
    doc.text(item.value, valueX, currentY, { width: 75, align: "right" });
    
    currentY += lineHeight;
  });
  
  return currentY;
}
