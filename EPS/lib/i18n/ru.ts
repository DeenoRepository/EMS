export const ru = {
  sidebar: {
    dashboard: "Панель управления",
    equipment: "Оборудование",
    documents: "Документы",
    myRequests: "Мои заявки",
    approvals: "Согласования",
    changeHistory: "История изменений",
    auditLog: "Журнал аудита",
    settings: "Настройки",
    equipmentCaption: "Паспортизация",
    systemStatus: "Статус системы",
    systemOk: "Все системы работают штатно"
  },
  topBar: {
    dashboard: "Панель управления",
    equipment: "Реестр оборудования",
    documents: "Документы",
    approvalQueue: "Очередь согласований",
    changeHistory: "История изменений",
    auditLog: "Журнал аудита",
    myRequests: "Мои заявки",
    settings: "Настройки",
    defaultTitle: "Система паспортизации оборудования"
  },
  status: {
    equipment: {
      DRAFT: "Черновик",
      ACTIVE: "В работе",
      INACTIVE: "На обслуживании",
      DECOMMISSIONED: "Списано"
    },
    document: {
      DRAFT: "Черновик",
      IN_REVIEW: "На проверке",
      APPROVED: "Согласован",
      REJECTED: "Отклонен",
      ARCHIVED: "Архив"
    },
    approval: {
      PENDING: "Ожидает",
      APPROVED: "Согласован",
      REJECTED: "Отклонен",
      CANCELED: "Отменен"
    }
  }
} as const;
