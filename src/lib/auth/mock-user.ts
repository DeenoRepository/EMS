export interface User {
  id: string;
  username: string;
  displayName: string;
  email: string;
  roles: string[];
}

export const mockCurrentUser: User = {
  id: "user-admin-01",
  username: "admin",
  displayName: "Администратор EMS",
  email: "admin@ems.local",
  roles: ["ADMIN", "EDITOR", "APPROVER"]
};
