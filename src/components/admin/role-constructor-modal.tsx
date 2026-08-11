"use client";

import { useState, useEffect } from "react";
import { Modal, ModalHeader, ModalFooter, Button, FormField, Input } from "@/components/ui";
import { ShieldCheck, Layers, CheckSquare, Square, Building2, Warehouse } from "lucide-react";
import { PermissionModuleGroup, PermissionDefinition } from "@/lib/auth/permissions-registry";

export interface RoleData {
  id?: string;
  key?: string;
  name: string;
  description: string;
  isSystem?: boolean;
  permissions: string[];
  scope: {
    allowedWarehouses: string[];
    allowedDepartments: string[];
    isGlobal: boolean;
  };
}

interface RoleConstructorModalProps {
  open: boolean;
  onClose: () => void;
  roleToEdit?: RoleData | null;
  onSave: (roleData: RoleData) => Promise<void>;
  groupedPermissions: PermissionModuleGroup[];
  warehousesList?: string[];
  departmentsList?: string[];
}

export function RoleConstructorModal({
  open,
  onClose,
  roleToEdit,
  onSave,
  groupedPermissions,
  warehousesList = ["Склад №1 (Главный хаб ЗИП)", "Склад №2 (Расходные материалы & СИЗ)", "Склад №3 (Инструментальный участок)"],
  departmentsList = ["Цех №1", "Цех №2", "Цех №3", "ОГМ", "ОГЭ"],
}: RoleConstructorModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());
  const [isGlobalScope, setIsGlobalScope] = useState(true);
  const [allowedWarehouses, setAllowedWarehouses] = useState<string[]>([]);
  const [allowedDepartments, setAllowedDepartments] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (roleToEdit) {
      setName(roleToEdit.name || "");
      setDescription(roleToEdit.description || "");
      setSelectedPermissions(new Set(roleToEdit.permissions || []));
      setIsGlobalScope(roleToEdit.scope?.isGlobal ?? true);
      setAllowedWarehouses(roleToEdit.scope?.allowedWarehouses || []);
      setAllowedDepartments(roleToEdit.scope?.allowedDepartments || []);
    } else {
      setName("");
      setDescription("");
      setSelectedPermissions(new Set());
      setIsGlobalScope(true);
      setAllowedWarehouses([]);
      setAllowedDepartments([]);
    }
  }, [roleToEdit, open]);

  const togglePermission = (code: string) => {
    setSelectedPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  };

  const toggleModulePermissions = (moduleGroup: PermissionModuleGroup) => {
    const allModuleCodes = moduleGroup.sections.flatMap((s) => s.permissions.map((p) => p.code));
    const allSelected = allModuleCodes.every((c) => selectedPermissions.has(c));

    setSelectedPermissions((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        allModuleCodes.forEach((c) => next.delete(c));
      } else {
        allModuleCodes.forEach((c) => next.add(c));
      }
      return next;
    });
  };

  const toggleWarehouse = (wh: string) => {
    setAllowedWarehouses((prev) =>
      prev.includes(wh) ? prev.filter((w) => w !== wh) : [...prev, wh]
    );
  };

  const toggleDepartment = (dept: string) => {
    setAllowedDepartments((prev) =>
      prev.includes(dept) ? prev.filter((d) => d !== dept) : [...prev, dept]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      await onSave({
        id: roleToEdit?.id,
        key: roleToEdit?.key,
        name: name.trim(),
        description: description.trim(),
        isSystem: roleToEdit?.isSystem || false,
        permissions: Array.from(selectedPermissions),
        scope: {
          isGlobal: isGlobalScope,
          allowedWarehouses,
          allowedDepartments,
        },
      });
      onClose();
    } catch (err) {
      console.error("Save role failed:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const actionBadgeColors: Record<string, string> = {
    READ: "bg-slate-100 text-slate-700 border-slate-200",
    CREATE: "bg-emerald-50 text-emerald-700 border-emerald-200",
    UPDATE: "bg-amber-50 text-amber-700 border-amber-200",
    DELETE: "bg-rose-50 text-rose-700 border-rose-200",
    APPROVE: "bg-purple-50 text-purple-700 border-purple-200",
    EXPORT: "bg-blue-50 text-blue-700 border-blue-200",
    EXECUTE: "bg-indigo-50 text-indigo-700 border-indigo-200",
  };

  return (
    <Modal open={open} onClose={onClose} size="lg">
      <ModalHeader
        title={roleToEdit ? `Редактирование роли: ${roleToEdit.name}` : "Конструктор новой роли RBAC"}
        subtitle="Скомпонуйте права доступа по модулям, разделам и очертите область видимости."
        icon={<ShieldCheck size={18} className="text-[#3473d4]" />}
        onClose={onClose}
      />

      <form onSubmit={handleSubmit} className="space-y-6 p-5 text-xs max-h-[75vh] overflow-y-auto">
        {/* Основные данные роли */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Наименование роли" required>
            <Input
              type="text"
              required
              placeholder="например: Инженер цеха №1 или Кладовщик СИЗ"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={roleToEdit?.isSystem}
            />
          </FormField>

          <FormField label="Описание и полномочия">
            <Input
              type="text"
              placeholder="Краткое описание функций данной роли"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </FormField>
        </div>

        {/* Настройка контекстных ограничений (Data Scope) */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers size={15} className="text-[#3473d4]" />
              <span className="font-bold text-slate-800 text-xs">Область видимости данных (Context Scope)</span>
            </div>
            <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-600 text-[11px]">
              <input
                type="checkbox"
                checked={isGlobalScope}
                onChange={(e) => setIsGlobalScope(e.target.checked)}
                className="rounded border-slate-300 text-[#3473d4] focus:ring-[#3473d4]"
              />
              <span>Глобальный доступ ко всем складам и цехам</span>
            </label>
          </div>

          {!isGlobalScope && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-200">
              {/* Склады */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 font-semibold text-slate-700 text-[11px]">
                  <Warehouse size={13} className="text-slate-500" />
                  <span>Доступные склады (WMS):</span>
                </div>
                <div className="space-y-1">
                  {warehousesList.map((wh) => (
                    <label key={wh} className="flex items-center gap-2 cursor-pointer text-[11px] text-slate-600 hover:text-slate-900">
                      <input
                        type="checkbox"
                        checked={allowedWarehouses.includes(wh)}
                        onChange={() => toggleWarehouse(wh)}
                        className="rounded border-slate-300 text-[#3473d4]"
                      />
                      <span>{wh}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Цеха / Подразделения */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 font-semibold text-slate-700 text-[11px]">
                  <Building2 size={13} className="text-slate-500" />
                  <span>Доступные подразделения (EPS):</span>
                </div>
                <div className="grid grid-cols-2 gap-1">
                  {departmentsList.map((dept) => (
                    <label key={dept} className="flex items-center gap-2 cursor-pointer text-[11px] text-slate-600 hover:text-slate-900">
                      <input
                        type="checkbox"
                        checked={allowedDepartments.includes(dept)}
                        onChange={() => toggleDepartment(dept)}
                        className="rounded border-slate-300 text-[#3473d4]"
                      />
                      <span>{dept}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Дерево матриц разрешений по модулям */}
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-slate-800 text-xs">Матрица функциональных разрешений:</h4>
            <span className="text-[11px] text-slate-500 font-semibold">
              Выбрано: <strong className="text-[#3473d4]">{selectedPermissions.size}</strong> разрешений
            </span>
          </div>

          <div className="space-y-4">
            {groupedPermissions.map((group) => {
              const allModuleCodes = group.sections.flatMap((s) => s.permissions.map((p) => p.code));
              const allSelected = allModuleCodes.length > 0 && allModuleCodes.every((c) => selectedPermissions.has(c));
              const someSelected = allModuleCodes.some((c) => selectedPermissions.has(c));

              return (
                <div key={group.moduleId} className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                  {/* Модуль Header */}
                  <div className="flex items-center justify-between bg-slate-50 px-4 py-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800 text-xs">{group.moduleName}</span>
                      <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[9px] font-semibold text-slate-600">
                        {allModuleCodes.filter((c) => selectedPermissions.has(c)).length} / {allModuleCodes.length}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleModulePermissions(group)}
                      className="flex items-center gap-1.5 text-[11px] font-semibold text-[#3473d4] hover:underline"
                    >
                      {allSelected ? (
                        <>
                          <CheckSquare size={14} /> Снять выбор в модуле
                        </>
                      ) : (
                        <>
                          <Square size={14} /> Выбрать всё в модуле
                        </>
                      )}
                    </button>
                  </div>

                  {/* Разделы Модуля */}
                  <div className="p-4 space-y-3">
                    {group.sections.map((section) => (
                      <div key={section.sectionId} className="space-y-2 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                        <span className="block font-semibold text-slate-700 text-[11px]">{section.sectionName}</span>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          {section.permissions.map((perm) => {
                            const isChecked = selectedPermissions.has(perm.code);
                            const badgeColor = actionBadgeColors[perm.action] || "bg-slate-100 text-slate-700 border-slate-200";

                            return (
                              <div
                                key={perm.code}
                                onClick={() => togglePermission(perm.code)}
                                className={`cursor-pointer rounded-lg border p-2.5 transition flex items-start gap-2.5 ${
                                  isChecked
                                    ? "border-[#3473d4] bg-[#f2f7ff] shadow-sm"
                                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {}} // handled by parent div
                                  className="mt-0.5 rounded border-slate-300 text-[#3473d4] focus:ring-[#3473d4]"
                                />
                                <div className="space-y-0.5 flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="font-semibold text-slate-800 text-[11px] truncate">{perm.name}</span>
                                    <span className={`rounded border px-1.5 py-0.2 text-[8px] font-bold uppercase shrink-0 ${badgeColor}`}>
                                      {perm.action}
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-slate-500 line-clamp-1">{perm.description}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <ModalFooter>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Отмена
          </Button>
          <Button type="submit" disabled={isSubmitting || !name.trim()}>
            <ShieldCheck size={14} />
            {isSubmitting ? "Сохранение..." : roleToEdit ? "Сохранить изменения" : "Создать роль"}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
