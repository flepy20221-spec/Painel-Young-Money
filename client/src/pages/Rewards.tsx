import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { trpc } from "@/lib/trpc";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Gift,
  MoreHorizontal,
  RefreshCw,
  Search,
  Users,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  getRewardStatus,
  getRewardPage,
  type RewardUser,
} from "./rewardsModel";
import "./rewards.css";

const numberFormatter = new Intl.NumberFormat("pt-BR");
const PAGE_SIZE = 8;

function UserAvatar({ user }: { user: RewardUser }) {
  const name = user.name || user.username || "Usuário";
  const initials = name
    .trim()
    .split(/\s+/)
    .map(part => part[0])
    .filter(Boolean);
  const label = (
    initials.length > 1 ? initials[0] + initials.at(-1) : name.slice(0, 2)
  ).toUpperCase();
  const photo = user.photo_url || user.profile_picture;

  return (
    <span className="rewards-avatar" aria-hidden="true">
      {photo ? <img src={photo} alt="" /> : label}
    </span>
  );
}

function UserActions({
  user,
  onDetails,
}: {
  user: RewardUser;
  onDetails: (id: number) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="rewards-action"
          aria-label={`Ações de ${user.name || user.username || "usuário"}`}
        >
          <MoreHorizontal size={19} aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="border-[#254462] bg-[#0b1627] text-[#e7f1ff]"
      >
        <DropdownMenuItem
          onSelect={() => onDetails(user.id)}
          className="focus:bg-[#17304a] focus:text-white"
        >
          <Eye size={16} aria-hidden="true" />
          Ver usuário e recompensas
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function RewardBadge({ user }: { user: RewardUser }) {
  const points = Number(user.points ?? 0);
  return (
    <span className="rewards-points">
      <Gift size={16} aria-hidden="true" />
      {numberFormatter.format(Number.isFinite(points) ? points : 0)}{" "}
      <span className="rewards-points-unit">pts</span>
    </span>
  );
}

function StatusBadge({ user }: { user: RewardUser }) {
  const status = getRewardStatus(user);
  return (
    <span
      className={`rewards-status ${status === "Banido" ? "rewards-status-banned" : ""}`}
    >
      <i />
      {status}
    </span>
  );
}

export default function Rewards() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  const { data, isLoading, isFetching, isError, refetch } =
    trpc.appUsers.rewardsList.useQuery({
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
      search: query,
    });
  const rows = (data?.users ?? []) as RewardUser[];
  const total = data?.total ?? 0;
  const {
    page: currentPage,
    totalPages,
    first,
    last,
  } = getRewardPage(total, page, PAGE_SIZE);
  const searchPending = search.trim() !== query;
  useEffect(() => {
    if (data && page > totalPages) setPage(totalPages);
  }, [data, page, totalPages]);
  const openDetails = (id: number) => setLocation(`/users/${id}`);

  return (
    <div className="rewards-page">
      <div className="rewards-heading">
        <div>
          <p className="rewards-eyebrow">
            <span /> Recompensas / Usuários
          </p>
          <h1>Recompensas</h1>
          <p>
            Gerencie os usuários e acompanhe os pontos de cada conta Young
            Money.
          </p>
        </div>
        <span className="rewards-heading-mark" aria-hidden="true">
          <Gift size={25} />
        </span>
      </div>

      <section
        className="rewards-panel"
        aria-label="Lista de usuários e recompensas"
        aria-busy={isLoading || isFetching || searchPending}
      >
        <div className="rewards-panel-top">
          <div className="rewards-panel-title">
            <span className="rewards-panel-icon">
              <Users size={20} aria-hidden="true" />
            </span>
            <div>
              <h2>Todos os usuários</h2>
              <p>Lista de usuários cadastrados e suas recompensas.</p>
            </div>
          </div>
          <button
            type="button"
            className="rewards-refresh"
            onClick={() => refetch()}
            disabled={isFetching}
            aria-label="Atualizar usuários"
          >
            <RefreshCw
              size={17}
              className={isFetching ? "animate-spin" : ""}
              aria-hidden="true"
            />
          </button>
        </div>

        <div className="rewards-toolbar">
          <div className="rewards-search">
            <Search size={19} aria-hidden="true" />
            <label className="sr-only" htmlFor="rewards-search">
              Buscar por nome ou e-mail
            </label>
            <input
              id="rewards-search"
              type="search"
              placeholder="Buscar por nome ou e-mail..."
              maxLength={320}
              value={search}
              onChange={event => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setPage(1);
                }}
                aria-label="Limpar busca"
              >
                <X size={17} />
              </button>
            )}
          </div>
          <span className="rewards-result-count" aria-live="polite">
            {searchPending
              ? "Buscando..."
              : `${numberFormatter.format(total)} usuários`}
          </span>
        </div>

        {isError && !searchPending ? (
          <div className="rewards-state" role="alert">
            <p>Não foi possível carregar os usuários.</p>
            <button type="button" onClick={() => refetch()}>
              Tentar novamente
            </button>
          </div>
        ) : isLoading || searchPending ? (
          <div className="rewards-state" role="status">
            Carregando usuários...
          </div>
        ) : total === 0 ? (
          <div className="rewards-state" role="status">
            <Search size={25} aria-hidden="true" />
            <p>
              {search
                ? "Nenhum usuário encontrado para essa busca."
                : "Ainda não há usuários cadastrados."}
            </p>
          </div>
        ) : (
          <>
            <div className="rewards-table-scroll">
              <table className="rewards-table">
                <thead>
                  <tr>
                    <th>Usuário</th>
                    <th>E-mail</th>
                    <th>Recompensas</th>
                    <th>Status</th>
                    <th className="rewards-actions-heading">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(user => (
                    <tr key={user.id}>
                      <td>
                        <div className="rewards-person">
                          <UserAvatar user={user} />
                          <span>
                            <strong>
                              {user.name || user.username || "Sem nome"}
                            </strong>
                            <small>#{user.id}</small>
                          </span>
                        </div>
                      </td>
                      <td className="rewards-email">
                        {user.email || "E-mail não informado"}
                      </td>
                      <td>
                        <RewardBadge user={user} />
                      </td>
                      <td>
                        <StatusBadge user={user} />
                      </td>
                      <td className="rewards-actions-cell">
                        <UserActions user={user} onDetails={openDetails} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="rewards-mobile-list">
              {rows.map(user => (
                <article key={user.id} className="rewards-mobile-card">
                  <div className="rewards-mobile-person">
                    <UserAvatar user={user} />
                    <div>
                      <strong>
                        {user.name || user.username || "Sem nome"}
                      </strong>
                      <small>#{user.id}</small>
                    </div>
                    <UserActions user={user} onDetails={openDetails} />
                  </div>
                  <div className="rewards-mobile-field">
                    <span>E-mail</span>
                    <span className="rewards-email">
                      {user.email || "E-mail não informado"}
                    </span>
                  </div>
                  <div className="rewards-mobile-meta">
                    <div>
                      <span>Recompensas</span>
                      <RewardBadge user={user} />
                    </div>
                    <div>
                      <span>Status</span>
                      <StatusBadge user={user} />
                    </div>
                  </div>
                </article>
              ))}
            </div>
            <div className="rewards-footer">
              <p aria-live="polite">
                Mostrando {numberFormatter.format(first)} a{" "}
                {numberFormatter.format(last)} de{" "}
                {numberFormatter.format(total)} usuários
              </p>
              <div className="rewards-pagination">
                <button
                  type="button"
                  onClick={() => setPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  aria-label="Página anterior"
                >
                  <ChevronLeft size={18} />
                </button>
                <span aria-label={`Página ${currentPage} de ${totalPages}`}>
                  {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  aria-label="Próxima página"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
