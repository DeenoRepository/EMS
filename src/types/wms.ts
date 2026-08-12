/**
 * WMS (Warehouse Management System) Unified Types & Interfaces
 * EMS System
 */

export type WmsItemStatus = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" | "OVERSTOCKED";

export type WmsItemType = "ZIP" | "CONSUMABLE" | "TOOL" | "EQUIPMENT_PART" | "PPE";

export type WmsMovementType =
  | "INCOMING"
  | "OUTGOING"
  | "TRANSFER"
  | "RESERVE"
  | "ADJUSTMENT"
  | "PERSONAL_CARD";

export type WmsTransferStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

export type WmsRequisitionStatus =
  | "DRAFT"
  | "REQUESTED"
  | "APPROVED"
  | "IN_TRANSIT"
  | "COMPLETED"
  | "REJECTED"
  | "CANCELLED";

export type WmsWriteOffReason =
  | "EQUIPMENT_REPAIR"
  | "SCRAP"
  | "NON_LIQUID"
  | "EXPIRED"
  | "DAMAGE"
  | "OTHER";

export interface StorageCell {
  id: string;
  warehouseId?: string;
  zoneId?: string | null;
  code: string;
  description?: string | null;
  capacity?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface WmsZone {
  id: string;
  warehouseId: string;
  code: string;
  name: string;
  description?: string | null;
  createdAt?: string;
  updatedAt?: string;
  cells?: StorageCell[];
}

export interface Warehouse {
  id: string;
  name: string;
  code?: string | null;
  location?: string | null;
  responsibleUser: string;
  responsibleUsername?: string | null;
  createdAt?: string;
  updatedAt?: string;
  zones?: WmsZone[];
  storageCells?: StorageCell[];
}

export interface WmsItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  type: WmsItemType | string;
  unit: string;
  warehouse: string;
  zone?: string | null;
  cell?: string | null;
  warehouseId?: string | null;
  zoneId?: string | null;
  cellId?: string | null;
  batchNumber?: string | null;
  serialNumber?: string | null;
  quantity: number;
  minQuantity: number;
  maxQuantity: number;
  reservedQuantity: number;
  unitPrice: number;
  currency: string;
  status: WmsItemStatus;
  isEps: boolean;
  supplier?: string | null;
  compatibleEquipment?: any;
  equipmentId?: string | null;
  lastIncomingDate?: string | null;
  lastOutgoingDate?: string | null;
  responsibleUser?: string | null;
  description?: string | null;
  techSpecs?: any;
  barcode?: string | null;
  createdAt?: string;
  updatedAt?: string;
  warehouseRef?: Warehouse;
  zoneRef?: WmsZone;
  cellRef?: StorageCell;
}

export interface WmsMovement {
  id: string;
  itemId: string;
  itemSku: string;
  itemName: string;
  type: WmsMovementType;
  quantity: number;
  fromLocation?: string | null;
  toLocation?: string | null;
  performedBy: string;
  recipientUser?: string | null;
  reason?: string | null;
  relatedOrderOrEq?: string | null;
  workOrderId?: string | null;
  createdAt: string;
}

export interface WmsTransferRequest {
  id: string;
  itemId: string;
  itemSku: string;
  itemName: string;
  quantity: number;
  fromWarehouse: string;
  toWarehouse: string;
  requestedBy: string;
  requestedByUsername?: string | null;
  targetMolUser: string;
  targetMolUsername?: string | null;
  reason?: string | null;
  status: WmsTransferStatus;
  comment?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface RequisitionItem {
  id?: string;
  requisitionId?: string;
  itemId: string;
  itemSku: string;
  itemName: string;
  quantity: number;
}

export interface WmsRequisition {
  id: string;
  requisitionNumber: string;
  fromWarehouse: string;
  toWarehouse: string;
  requestedBy: string;
  status: WmsRequisitionStatus;
  note?: string | null;
  createdAt: string;
  updatedAt?: string;
  items: RequisitionItem[];
}

export interface WmsReservation {
  id: string;
  itemId: string;
  equipmentId?: string | null;
  equipmentName?: string | null;
  maintenancePlanDate?: string | null;
  reservedQuantity: number;
  reservedBy: string;
  reason?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
  item?: WmsItem;
}

export interface WmsWriteOff {
  id: string;
  itemId: string;
  itemSku: string;
  itemName: string;
  quantity: number;
  reason: WmsWriteOffReason;
  equipmentId?: string | null;
  equipmentName?: string | null;
  performedBy: string;
  comments?: string | null;
  createdAt: string;
}

export interface WmsPersonalCard {
  id: string;
  itemId: string;
  itemSku: string;
  itemName: string;
  employeeName: string;
  employeePosition?: string | null;
  employeeNumber?: string | null;
  department?: string | null;
  issuedQuantity: number;
  issuedAt: string;
  returnedAt?: string | null;
  returnCondition?: "GOOD" | "REPAIR" | "SCRAPPED" | string | null;
  notes?: string | null;
  createdById?: string | null;
}

export interface WmsEmployee {
  id: string;
  name: string;
  employeeNumber: string;
  position?: string | null;
  department?: string | null;
  warehouse?: string | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface EquipmentOption {
  id: string;
  equipmentCode: string;
  name: string;
}

// Form payloads
export interface CreateWmsItemPayload {
  name: string;
  sku: string;
  category: string;
  type: string;
  warehouse: string;
  zone?: string;
  cell?: string;
  batchNumber?: string;
  serialNumber?: string;
  quantity: number;
  minQuantity: number;
  maxQuantity: number;
  unit: string;
  unitPrice: number;
  isEps: boolean;
  supplier?: string;
  description?: string;
}

export interface WriteOffPayload {
  itemId: string;
  quantity: number;
  reason: WmsWriteOffReason | string;
  equipmentName?: string;
  performedBy: string;
  comments?: string;
}

export interface RequisitionRowPayload {
  id: string;
  selectedItemId: string;
  quantity: number;
  isPreselected?: boolean;
}

export interface RequisitionHeaderPayload {
  fromWarehouse: string;
  toWarehouse: string;
  requestedBy: string;
  note?: string;
}

export interface TransferRowPayload {
  id: string;
  itemId: string;
  quantity: number;
}

export interface TransferHeaderPayload {
  fromWarehouse: string;
  toWarehouse: string;
  reason?: string;
}
