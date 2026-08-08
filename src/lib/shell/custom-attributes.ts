export type CustomAttributeType = "TEXT" | "NUMBER" | "BOOLEAN" | "DATE" | "SELECT";

export interface CustomAttributeDefinition {
  key: string;
  label: string;
  type: CustomAttributeType;
  required?: boolean;
  options?: string[];
  description?: string;
}

export interface CustomAttributeValueValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
  sanitizedValues: Record<string, unknown>;
}

export class CustomAttributeEngine {
  /**
   * Валидация кастомных полей EAV для сущности на основе списка определений
   */
  public static validateAndSanitize(
    definitions: CustomAttributeDefinition[],
    inputValues: Record<string, unknown>
  ): CustomAttributeValueValidationResult {
    const errors: Record<string, string> = {};
    const sanitizedValues: Record<string, unknown> = {};

    definitions.forEach((def) => {
      const val = inputValues[def.key];

      if (def.required && (val === undefined || val === null || val === "")) {
        errors[def.key] = `Поле "${def.label}" обязательно для заполнения`;
        return;
      }

      if (val === undefined || val === null || val === "") {
        return;
      }

      switch (def.type) {
        case "NUMBER": {
          const num = Number(val);
          if (isNaN(num)) {
            errors[def.key] = `Поле "${def.label}" должно быть числом`;
          } else {
            sanitizedValues[def.key] = num;
          }
          break;
        }

        case "BOOLEAN": {
          sanitizedValues[def.key] = Boolean(val);
          break;
        }

        case "SELECT": {
          if (def.options && def.options.length > 0) {
            if (!def.options.includes(String(val))) {
              errors[def.key] = `Поле "${def.label}" имеет недопустимое значение`;
            } else {
              sanitizedValues[def.key] = String(val);
            }
          } else {
            sanitizedValues[def.key] = String(val);
          }
          break;
        }

        case "DATE": {
          const date = new Date(String(val));
          if (isNaN(date.getTime())) {
            errors[def.key] = `Поле "${def.label}" должно содержать корректную дату`;
          } else {
            sanitizedValues[def.key] = date.toISOString();
          }
          break;
        }

        case "TEXT":
        default: {
          sanitizedValues[def.key] = String(val).trim();
          break;
        }
      }
    });

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
      sanitizedValues,
    };
  }
}
