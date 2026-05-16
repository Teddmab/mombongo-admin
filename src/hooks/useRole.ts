import { useAuth } from "@/hooks/useAuth";

export function useRole() {
  const { role } = useAuth();

  return {
    role,
    isAdmin: role === "admin",
  };
}
