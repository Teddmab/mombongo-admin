export interface TestAccount { uid: string; email: string; password: string; role: string; fullName: string }
export const TEST_ACCOUNTS: { admin: TestAccount; nonAdmin: TestAccount };
export const FARMERS: { uid: string; fullName: string; kycStatus: string; exploitation: { id: string } | null }[];
export function assertSafeTarget(target: { projectId: string; host: string }): void;
export function seedFixtures(opts: { projectId: string; host?: string; authPort: number; firestorePort: number }): Promise<{
  accounts: Record<string, { uid: string; email: string; role: string }>;
  farmers: { uid: string; fullName: string; kycStatus: string }[];
}>;
