import { describe, it, expect } from "vitest";
import { txTypeMeta, txAmount, txProviderRef, formatAmount } from "../transactionDisplay";

describe("txTypeMeta", () => {
  it("maps known types to a French label and direction", () => {
    expect(txTypeMeta("deposit")).toEqual({ label: "Dépôt", direction: "in" });
    expect(txTypeMeta("withdrawal")).toEqual({ label: "Retrait", direction: "out" });
    expect(txTypeMeta("bourse_sale")).toEqual({ label: "Vente bourse", direction: "transfer" });
  });

  it("falls back to a humanized raw value for unknown types instead of crashing", () => {
    expect(txTypeMeta("some_future_type")).toEqual({ label: "some future type", direction: "transfer" });
    expect(txTypeMeta(undefined)).toEqual({ label: "—", direction: "transfer" });
  });
});

describe("txAmount", () => {
  it("prefers amountUsd when present", () => {
    expect(txAmount({ amountUsd: 100 })).toEqual({ amount: 100, currency: "USD" });
  });

  it("falls back to amountCdf for bourse-style docs that never set amountUsd", () => {
    expect(txAmount({ amountCdf: 50000 })).toEqual({ amount: 50000, currency: "CDF" });
  });

  it("respects an explicit currency field when both would otherwise default", () => {
    expect(txAmount({ amountUsd: 100, currency: "USD" })).toEqual({ amount: 100, currency: "USD" });
  });
});

describe("txProviderRef", () => {
  it("picks whichever provider reference field is present, in priority order", () => {
    expect(txProviderRef("docid", { pawapayDepositId: "dep1" })).toBe("dep1");
    expect(txProviderRef("docid", { pawapayPayoutId: "pay1" })).toBe("pay1");
    expect(txProviderRef("docid", { externalInvoiceDocId: "inv1" })).toBe("inv1");
  });

  it("falls back to the document id when no provider reference exists", () => {
    expect(txProviderRef("docid", {})).toBe("docid");
  });
});

describe("formatAmount", () => {
  it("formats USD with a dollar sign", () => {
    expect(formatAmount(250, "USD")).toBe("250,00 $");
  });

  it("formats CDF with FC suffix", () => {
    expect(formatAmount(500, "CDF")).toBe("500,00 FC");
  });

  it("always renders a positive magnitude — sign is the caller's job", () => {
    expect(formatAmount(-320, "USD")).toBe("320,00 $");
  });

  it("uses fr-FR grouping for larger amounts", () => {
    // fr-FR groups with a narrow no-break space, not a regular space
    expect(formatAmount(1250, "USD")).toMatch(/^1.250,00 \$$/u);
  });
});
