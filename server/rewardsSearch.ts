// The value remains a SQL parameter. Escaping LIKE metacharacters keeps a
// search for a literal percent, underscore or exclamation mark predictable.
export function buildRewardSearch(search: string) {
  const term = search.trim();
  if (!term) return { where: "", params: [] as string[] };

  const pattern = `%${term.replace(/[!%_]/g, char => `!${char}`)}%`;
  return {
    where:
      " WHERE (LOWER(u.name) LIKE LOWER(?) ESCAPE '!' OR LOWER(u.username) LIKE LOWER(?) ESCAPE '!' OR LOWER(u.email) LIKE LOWER(?) ESCAPE '!')",
    params: [pattern, pattern, pattern],
  };
}
