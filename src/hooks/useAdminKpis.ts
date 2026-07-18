import { useEffect, useState } from "react";
import {
  collection, query, where, getDocs, getCountFromServer,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface AdminKpis {
  activeUsers: number;
  pendingKyc: number;
  monthlyVolumeUsd: number;
  financingOpen: number;
  bourseOpen: number;
  totalDepositsUsd: number;
}

export function useAdminKpis(): AdminKpis {
  const [kpis, setKpis] = useState<AdminKpis>({
    activeUsers: 0, pendingKyc: 0, monthlyVolumeUsd: 0,
    financingOpen: 0, bourseOpen: 0, totalDepositsUsd: 0,
  });

  useEffect(() => {
    async function fetch() {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const [activeSnap, kycSnap, financingSnap, bourseSnap, txSnap, depositSnap] =
        await Promise.all([
          getCountFromServer(query(collection(db, "users"), where("disabled", "!=", true))),
          getCountFromServer(query(collection(db, "users"), where("kycStatus", "==", "pending"))),
          getCountFromServer(query(collection(db, "financing_applications"), where("status", "==", "active"))),
          getCountFromServer(query(collection(db, "bourse_opportunities"), where("status", "==", "open"))),
          getDocs(query(collection(db, "transactions"), where("createdAt", ">=", startOfMonth))),
          getDocs(query(collection(db, "deposits"), where("status", "==", "completed"))),
        ]);

      setKpis({
        activeUsers:      activeSnap.data().count,
        pendingKyc:       kycSnap.data().count,
        financingOpen:    financingSnap.data().count,
        bourseOpen:       bourseSnap.data().count,
        monthlyVolumeUsd: txSnap.docs.reduce((s, d) => s + (d.data().amountUsd ?? 0), 0),
        totalDepositsUsd: depositSnap.docs.reduce((s, d) => s + (d.data().amountUsd ?? 0), 0),
      });
    }

    fetch();
    const interval = setInterval(fetch, 60_000);
    return () => clearInterval(interval);
  }, []);

  return kpis;
}
