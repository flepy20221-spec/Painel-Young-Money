import { describe, expect, it } from "vitest";
import { buildRewardSearch } from "./rewardsSearch";

describe("busca de recompensas no banco", () => {
  it("filtra nome, usuário e e-mail com parâmetros sem interpolar texto no SQL", () => {
    const search = buildRewardSearch("  O'Neil_%!  ");
    expect(search.where).toContain("u.name");
    expect(search.where).toContain("u.username");
    expect(search.where).toContain("u.email");
    expect(search.where.match(/\?/g)).toHaveLength(3);
    expect(search.where).not.toContain("O'Neil");
    expect(search.params).toEqual([
      "%O'Neil!_!%!!%",
      "%O'Neil!_!%!!%",
      "%O'Neil!_!%!!%",
    ]);
  });

  it("retorna todos os usuários quando a busca está vazia", () => {
    expect(buildRewardSearch("   ")).toEqual({ where: "", params: [] });
  });
});
