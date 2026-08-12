/**
 * SEC-15: CSV Formula Injection Prevention
 * Sanitizes input text before export to CSV to prevent Excel/Spreadsheet formula execution.
 */
export function sanitizeCsvValue(val: any): string {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
}
