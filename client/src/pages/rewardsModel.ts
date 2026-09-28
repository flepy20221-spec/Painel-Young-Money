export type RewardUser = {
  id: number;
  name?: string | null;
  username?: string | null;
  email?: string | null;
  points?: number | string | null;
  is_banned?: boolean | number | string | null;
  permanent_email_banned?: boolean | number | string | null;
  photo_url?: string | null;
  profile_picture?: string | null;
};

export function getRewardStatus(
  user: Pick<RewardUser, "is_banned" | "permanent_email_banned">
): "Ativo" | "Banido" {
  const banned = (value: RewardUser["is_banned"]) =>
    value === true || value === 1 || value === "1";
  return banned(user.is_banned) || banned(user.permanent_email_banned)
    ? "Banido"
    : "Ativo";
}

export function getRewardPage(total: number, page: number, pageSize = 8) {
  const size = Math.max(1, Math.floor(pageSize) || 8);
  const totalPages = Math.max(1, Math.ceil(total / size));
  const currentPage = Math.min(Math.max(1, Math.floor(page) || 1), totalPages);
  const start = (currentPage - 1) * size;

  return {
    page: currentPage,
    totalPages,
    first: total ? start + 1 : 0,
    last: Math.min(start + size, total),
  };
}
