export interface MCPToolParameter {
  type: "string" | "number" | "boolean" | "object" | "array";
  description: string;
  enum?: string[];
  required?: boolean;
}

export interface MCPToolDeclaration {
  name: string; // E.g., 'eps_query_equipment', 'wms_reserve_stock'
  module: string;
  description: string;
  parameters: Record<string, MCPToolParameter>;
  handlerEndpoint: string; // Internal API endpoint
}

class ShellMCPRegistryManager {
  private declarations: Map<string, MCPToolDeclaration> = new Map();

  constructor() {
    this.registerDefaultModuleTools();
  }

  private registerDefaultModuleTools() {
    // 1. Инструмент EPS для будущей работы AI-агента с оборудованием
    this.registerTool({
      name: "eps_get_equipment_passport",
      module: "eps",
      description: "Получение полного паспорта оборудования и его динамических атрибутов по коду или ID",
      parameters: {
        equipmentCode: { type: "string", description: "Уникальный код оборудования (например, EQ-2026-001)", required: true },
      },
      handlerEndpoint: "/api/modules/eps/equipment",
    });

    // 2. Инструмент WMS для будущего контроля остатков ТМЦ ИИ-агентом
    this.registerTool({
      name: "wms_check_stock_balance",
      module: "wms",
      description: "Проверка наличия и доступного остатка ТМЦ на складе с учетом резервов",
      parameters: {
        itemSku: { type: "string", description: "Артикул или наименование ТМЦ", required: true },
        warehouseId: { type: "string", description: "Идентификатор склада", required: false },
      },
      handlerEndpoint: "/api/modules/wms/movements",
    });
  }

  public registerTool(tool: MCPToolDeclaration) {
    this.declarations.set(tool.name, tool);
  }

  /**
   * Возвращает спецификацию всех экспортруемых инструментов в формате JSON Schema (Model Context Protocol)
   */
  public exportMCPToolSchemas() {
    return Array.from(this.declarations.values()).map((tool) => ({
      name: tool.name,
      description: `[Module: ${tool.module.toUpperCase()}] ${tool.description}`,
      inputSchema: {
        type: "object",
        properties: Object.entries(tool.parameters).reduce((acc, [key, param]) => {
          acc[key] = {
            type: param.type,
            description: param.description,
            ...(param.enum ? { enum: param.enum } : {}),
          };
          return acc;
        }, {} as Record<string, unknown>),
        required: Object.entries(tool.parameters)
          .filter(([, param]) => param.required)
          .map(([key]) => key),
      },
      meta: {
        module: tool.module,
        handlerEndpoint: tool.handlerEndpoint,
      },
    }));
  }
}

export const ShellMCPRegistry = new ShellMCPRegistryManager();
