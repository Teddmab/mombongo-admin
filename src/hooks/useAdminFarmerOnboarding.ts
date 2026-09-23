import { useMutation } from "@tanstack/react-query";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import type { ConsentMethod } from "@/hooks/useAssistedInvoice";

/* ─── Real data model ──────────────────────────────────────────────────────
   Exploitation: exploitations/{id} (farmerId, province, totalHectares, …).
   Culture: exploitations/{id}/cultures/{id} subcollection. Both written
   exclusively through adminSaveExploitation / adminSaveCulture (Cloud
   Functions) — see mombongo-functions/src/exploitation/. Never written
   directly from this frontend (firestore.ts intentionally does not export
   db/storage — see this repo's Architecture rule). */

export interface AdminSaveExploitationInput {
  farmerId: string;
  province: string;
  territory?: string;
  village?: string;
  totalHectares: number;
  type?: "familiale" | "cooperative" | "commerciale";
  waterAccess?: "pluie" | "irrigation" | "riviere" | "mixte";
  workerCount?: number;
  workerType?: "permanent" | "saisonnier" | "mixte";
  notes?: string;
  consentMethod: ConsentMethod;
  consentAt: string;
  note?: string;
  clientRequestId: string;
}

export interface AdminSaveExploitationResult {
  exploitationId: string;
}

export function useAdminSaveExploitation() {
  return useMutation({
    mutationFn: async (payload: AdminSaveExploitationInput) => {
      const fn = httpsCallable<AdminSaveExploitationInput, AdminSaveExploitationResult>(functions, "adminSaveExploitation");
      return (await fn(payload)).data;
    },
  });
}

export interface AdminSaveCultureInput {
  farmerId: string;
  exploitationId: string;
  commodity: string;
  icon?: string;
  surfaceHa: number;
  methode?: string;
  saison?: string;
  rendementEstimeKgHa: number;
  notes?: string;
  status?: string;
  consentMethod: ConsentMethod;
  consentAt: string;
  note?: string;
  clientRequestId: string;
}

export interface AdminSaveCultureResult {
  cultureId: string;
}

export function useAdminSaveCulture() {
  return useMutation({
    mutationFn: async (payload: AdminSaveCultureInput) => {
      const fn = httpsCallable<AdminSaveCultureInput, AdminSaveCultureResult>(functions, "adminSaveCulture");
      return (await fn(payload)).data;
    },
  });
}
