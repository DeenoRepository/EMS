/**
 * Экранирует управляющие символы и формулы в CSV значениях (SEC-15)
 * Защищает от уязвимости CSV Formula Injection / Macro Execution в Excel и LibreOffice
 */
export function sanitizeCsvValue(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }

  const str = String(value);
  const trimmed = str.trim();

  // Если строка начинается с =, +, -, @, \t, \r — дополняем её одиночной кавычкой '
  if (/^[=+\-@\t\r]/.test(trimmed)) {
    return `'${str}`;
  }

  return str;
}
