/**
 * Версия приложения (DOC-01)
 *
 * Единый источник версии — package.json.
 * Используется во всех местах где требуется версия приложения.
 */
import pkg from "../../package.json";

export const APP_VERSION: string = pkg.version;
export const APP_NAME: string = pkg.name;
