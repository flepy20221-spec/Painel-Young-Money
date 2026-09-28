import { describe, expect, it } from "vitest";
import {
  getRewardPage,
  getRewardStatus,
} from "../client/src/pages/rewardsModel";

describe("lista de recompensas", () => {
  it("exibe intervalos corretos para a paginação recebida do servidor", () => {
    expect(getRewardPage(21, 2, 8)).toEqual({
      page: 2,
      totalPages: 3,
      first: 9,
      last: 16,
    });
    expect(getRewardPage(1, 4, 8)).toEqual({
      page: 1,
      totalPages: 1,
      first: 1,
      last: 1,
    });
    expect(getRewardPage(0, 1, 8)).toEqual({
      page: 1,
      totalPages: 1,
      first: 0,
      last: 0,
    });
  });

  it("identifica contas banidas pelos dois campos usados pelo painel", () => {
    expect(getRewardStatus({ is_banned: "1" })).toBe("Banido");
    expect(getRewardStatus({ permanent_email_banned: true })).toBe("Banido");
    expect(getRewardStatus({ is_banned: 0, permanent_email_banned: "0" })).toBe(
      "Ativo"
    );
  });
});
