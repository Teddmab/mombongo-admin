import { useQuery } from "@tanstack/react-query";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";

export interface AdminKpis {
  activeUsers: number;
  pendingKyc: number;
  monthlyVolumeUsd: number;
  financingOpen: number;
  bourseOpen: number;
  totalDepositsUsd: number;
  platformRevenueUsd: number;
  activeInvestments: number;
}

const FALLBACK: AdminKpis = {
  activeUsers: 0, pendingKyc: 0, monthlyVolumeUsd: 0,
  financingOpen: 0, bourseOpen: 0, totalDepositsUsd: 0,
  platformRevenueUsd: 0, activeInvestments: 0,
};

export function useAdminKpis(): AdminKpis {
  const { data } = useQuery<AdminKpis>({
    queryKey: ["adminKpis"],
    queryFn: async () => {
      const fn = httpsCallable<unknown, AdminKpis>(functions, "getDashboardKpis");
      const res = await fn({});
      return res.data;
    },
    refetchInterval: 60_000,
    placeholderData: FALLBACK,
  });
  return data ?? FALLBACK;
}
