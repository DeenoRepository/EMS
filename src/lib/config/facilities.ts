export interface EnterpriseFacility {
  id: string;
  company: string;
  plant: string;
  workshop: string;
}

const DEFAULT_COMPANY_NAME = process.env.NEXT_PUBLIC_COMPANY_NAME ?? "ПАО «ПРОМ-ТЕХ»";

export const DEFAULT_FACILITIES: EnterpriseFacility[] = [
  { id: "fac-1", company: DEFAULT_COMPANY_NAME, plant: "Завод «Западный»", workshop: "Цех №1 (Механообработка)" },
  { id: "fac-2", company: DEFAULT_COMPANY_NAME, plant: "Завод «Западный»", workshop: "Цех №2 (Сборка & Литье)" },
  { id: "fac-3", company: DEFAULT_COMPANY_NAME, plant: "Завод «Северный»", workshop: "Цех №4 (Энергокомплекс)" },
];
