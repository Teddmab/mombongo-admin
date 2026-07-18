import { useQuery } from "@tanstack/react-query";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface MonthPoint { month: string; volumeUsd: number }

export function useMonthlyVolume() {
  return useQuery<MonthPoint[]>({
    queryKey: ["admin-monthly-volume"],
    queryFn: async () => {
      const months: MonthPoint[] = [];
      for (let i = 5; i >= 0; i--) {
        const start = new Date();
        start.setMonth(start.getMonth() - i);
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setMonth(end.getMonth() + 1);

        const snap = await getDocs(query(
          collection(db, "transactions"),
          where("createdAt", ">=", start),
          where("createdAt", "<", end),
        ));
        const volumeUsd = snap.docs.reduce((s, d) => s + (d.data().amountUsd ?? 0), 0);
        months.push({
          month: start.toLocaleDateString("fr-FR", { month: "short" }),
          volumeUsd,
        });
      }
      return months;
    },
    staleTime: 300_000,
  });
}
