import { useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { CheckCircle2, Clock3, ExternalLink, Gift, Pencil, Plus, Save, Trophy, UsersRound } from "lucide-react";

type Mission = {
  id: string;
  title: string;
  description: string;
  icon: string;
  points_reward: number;
  frequency: "daily" | "once";
  action_type: "builtin" | "link";
  target_url: string | null;
  wait_seconds: number;
  is_active: number | boolean;
};

const blank: Mission = {
  id: "", title: "", description: "", icon: "star", points_reward: 20000,
  frequency: "once", action_type: "link", target_url: "", wait_seconds: 20, is_active: 1,
};
const iconOptions = ["star", "store", "gift", "game", "spin", "calendar", "video", "people", "trophy", "link"];
const apiBase = (import.meta.env.VITE_API_BASE_URL || "https://youngmoney-api-railway-production-5bf3.up.railway.app").replace(/\/$/, "");
const panelBaseUrl = (typeof window === "undefined"
  ? "https://painel-adminstrador-production-da58.up.railway.app/"
  : `${window.location.origin}${import.meta.env.BASE_URL}`).replace(/\/$/, "");
const rouletteIconUrl = `${panelBaseUrl}/mission-icons/roulette.png`;
const appIcons = [
  { id: "candy_level", label: "Planet Crush" },
  { id: "spin", label: "Roleta" },
  { id: "checkin", label: "Check-in" },
  { id: "video", label: "Vídeo" },
  { id: "community", label: "Comunidade" },
].map(({ id, label }) => ({ id, label, url: id === "spin" ? rouletteIconUrl : `${apiBase}/assets/mission-icons/${id}.png` }));
const defaultIcons: Record<string, string> = {
  candy_level: "game", spin: "spin", checkin: "calendar", video: "video",
  invite: "people", community: "people", ranking: "trophy",
};

function MissionIcon({ icon, id }: { icon: string; id?: string }) {
  const original = id && icon === defaultIcons[id] ? appIcons.find(item => item.id === id) : undefined;
  const image = icon.startsWith("https://") || icon.startsWith("data:image/") ? icon : original?.url;
  if (image) {
    return <img src={image} alt="" className="h-11 w-11 rounded-xl object-contain" />;
  }
  if (icon === "spin") {
    return <img src={rouletteIconUrl} alt="" className="h-11 w-11 rounded-xl object-contain" />;
  }
  if (id === "invite" && icon === "people") {
    return <span className="flex h-11 w-11 items-center justify-center text-sky-400"><UsersRound size={30} /></span>;
  }
  if (id === "ranking" && icon === "trophy") {
    return <span className="flex h-11 w-11 items-center justify-center text-yellow-400"><Trophy size={30} /></span>;
  }
  return <span aria-hidden="true" className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#ef3943]/15 text-2xl text-[#ef3943]">
    {({ store: "🛍️", gift: "🎁", game: "🎮", spin: "🎡", calendar: "📅", video: "▶️", people: "👥", trophy: "🏆", link: "🔗", star: "⭐" } as Record<string, string>)[icon] ?? "⭐"}
  </span>;
}

export default function DailyMissions() {
  const { data, isLoading, error, refetch } = trpc.tasks.list.useQuery();
  const create = trpc.tasks.create.useMutation();
  const update = trpc.tasks.update.useMutation();
  const uploadIcon = trpc.tasks.uploadIcon.useMutation();
  const missions = (data ?? []) as unknown as Mission[];
  const [editing, setEditing] = useState<Mission | null>(null);
  const [pendingImage, setPendingImage] = useState<{ dataUrl: string; name: string } | null>(null);
  const [readingImage, setReadingImage] = useState(false);
  const [taskAdminKey, setTaskAdminKey] = useState(() =>
    typeof window === "undefined" ? "" : window.sessionStorage.getItem("task_admin_key") ?? ""
  );
  const imagePick = useRef(0);
  const busy = create.isPending || update.isPending || uploadIcon.isPending;

  function changeTaskAdminKey(value: string) {
    setTaskAdminKey(value);
    if (typeof window === "undefined") return;
    if (value.trim()) window.sessionStorage.setItem("task_admin_key", value.trim());
    else window.sessionStorage.removeItem("task_admin_key");
  }

  function clearImage() {
    imagePick.current++;
    setPendingImage(null);
    setReadingImage(false);
  }

  function editMission(mission: Mission) {
    clearImage();
    setEditing({ ...mission });
  }

  function chooseImage(file?: File) {
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 2 * 1024 * 1024) {
      clearImage();
      toast.error("Escolha uma imagem PNG, JPG ou WebP de até 2 MB.");
      return;
    }
    const pick = ++imagePick.current;
    setPendingImage(null);
    setReadingImage(true);
    const reader = new FileReader();
    reader.onload = () => {
      if (pick !== imagePick.current) return;
      if (typeof reader.result === "string") setPendingImage({ dataUrl: reader.result, name: file.name });
      setReadingImage(false);
    };
    reader.onerror = () => {
      if (pick !== imagePick.current) return;
      setReadingImage(false);
      toast.error("Não foi possível ler a imagem.");
    };
    reader.readAsDataURL(file);
  }

  function setField<K extends keyof Mission>(name: K, value: Mission[K]) {
    setEditing(current => current ? { ...current, [name]: value } : current);
  }

  async function save() {
    if (!editing) return;
    try {
      const icon = pendingImage
        ? (await uploadIcon.mutateAsync({ dataUrl: pendingImage.dataUrl })).url
        : editing.icon.trim();
      const input = {
        title: editing.title.trim(), description: editing.description.trim(), icon,
        pointsReward: Number(editing.points_reward), frequency: editing.frequency,
        targetUrl: editing.action_type === "link" ? editing.target_url?.trim() || "" : undefined,
        waitSeconds: Number(editing.wait_seconds), isActive: Boolean(editing.is_active),
      };
      if (editing.id) await update.mutateAsync({ id: editing.id, ...input });
      else await create.mutateAsync({ ...input, targetUrl: input.targetUrl ?? "" });
      toast.success("Missão salva com sucesso.");
      setEditing(null);
      clearImage();
      await refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar a missão.");
    }
  }

  return <div className="mx-auto max-w-6xl space-y-6 p-5 pb-14 text-[#f5f7fb] md:p-8">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#ef3943]">Recompensas</p>
        <h1 className="mt-1 text-3xl font-bold">Missões diárias</h1>
        <p className="mt-2 text-sm text-[#9aa4b5]">Edite títulos, ícones e pontos. Missões únicas desaparecem depois do resgate por usuário.</p>
      </div>
      <button onClick={() => editMission(blank)} className="inline-flex items-center gap-2 rounded-xl bg-[#ef3943] px-4 py-3 text-sm font-bold text-white hover:bg-[#d92e38]">
        <Plus size={17} /> Nova missão
      </button>
    </div>

    <div className="rounded-xl border border-[#313540] bg-[#12161d] p-4">
      <label htmlFor="task-admin-key" className="block text-sm font-semibold">Chave de edição das missões</label>
      <input
        id="task-admin-key"
        type="password"
        autoComplete="off"
        value={taskAdminKey}
        onChange={event => changeTaskAdminKey(event.target.value)}
        placeholder="Cole a chave TASKS_ADMIN_KEY do painel"
        className="mt-2 w-full max-w-xl rounded-lg border border-[#383d48] bg-[#0b0e13] p-2.5"
      />
      <p className="mt-2 text-xs text-[#9aa4b5]">A chave fica somente nesta sessão do navegador. Administradores autenticados podem deixar o campo vazio.</p>
    </div>

    {error && <p className="rounded-xl border border-red-800 bg-red-950/50 p-4 text-sm">Erro ao carregar missões: {error.message}</p>}
    {isLoading && <p className="text-sm text-[#9aa4b5]">Carregando missões...</p>}
    <div className="grid gap-3 md:grid-cols-2">
      {missions.map(mission => <div key={mission.id} className="rounded-2xl border border-[#313540] bg-[#12161d] p-5">
        <div className="flex items-start gap-3">
          <MissionIcon icon={mission.icon} id={mission.id} />
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold">{mission.title}</h2>
            <p className="mt-1 text-xs text-[#9aa4b5]">{mission.description || mission.id}</p>
          </div>
          <button onClick={() => editMission(mission)} aria-label={`Editar ${mission.title}`}
            className="rounded-lg p-2 text-[#c8d0df] hover:bg-white/10"><Pencil size={18} /></button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <span className="inline-flex items-center gap-1 rounded-lg bg-[#ef3943]/15 px-2.5 py-1.5 text-[#ff8690]"><Gift size={13} /> {Number(mission.points_reward).toLocaleString("pt-BR")} pontos</span>
          <span className="inline-flex items-center gap-1 rounded-lg bg-white/5 px-2.5 py-1.5"><Clock3 size={13} /> {mission.frequency === "once" ? "Uma vez por conta" : "Todos os dias"}</span>
          <span className="inline-flex items-center gap-1 rounded-lg bg-white/5 px-2.5 py-1.5"><CheckCircle2 size={13} /> {mission.is_active ? "Ativa" : "Pausada"}</span>
          {mission.action_type === "link" && <span className="inline-flex items-center gap-1 rounded-lg bg-white/5 px-2.5 py-1.5"><ExternalLink size={13} /> {mission.wait_seconds}s na página</span>}
        </div>
      </div>)}
    </div>

    {editing && <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/80 p-4" role="dialog" aria-modal="true" aria-labelledby="mission-title">
      <div className="my-auto w-full max-w-xl space-y-4 rounded-2xl border border-[#343944] bg-[#12161d] p-6 shadow-2xl">
        <h2 id="mission-title" className="text-xl font-bold">{editing.id ? "Editar missão" : "Nova missão"}</h2>
        <label className="block text-sm">Título
          <input maxLength={120} value={editing.title} onChange={e => setField("title", e.target.value)} className="mt-1 w-full rounded-lg border border-[#383d48] bg-[#0b0e13] p-2.5" />
        </label>
        <label className="block text-sm">Descrição
          <input maxLength={255} value={editing.description} onChange={e => setField("description", e.target.value)} className="mt-1 w-full rounded-lg border border-[#383d48] bg-[#0b0e13] p-2.5" />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">Pontos
            <input type="number" min={1} max={1000000} value={editing.points_reward} onChange={e => setField("points_reward", Number(e.target.value))} className="mt-1 w-full rounded-lg border border-[#383d48] bg-[#0b0e13] p-2.5" />
          </label>
          <label className="block text-sm">Frequência
            <select value={editing.frequency} onChange={e => setField("frequency", e.target.value as Mission["frequency"])} className="mt-1 w-full rounded-lg border border-[#383d48] bg-[#0b0e13] p-2.5">
              <option value="once">Uma vez por conta</option><option value="daily">Todos os dias</option>
            </select>
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">Ícone
            <select value={pendingImage ? "image" : iconOptions.includes(editing.icon) ? editing.icon : "image"}
              onChange={e => { clearImage(); setField("icon", e.target.value === "image" ? "https://" : e.target.value); }}
              className="mt-1 w-full rounded-lg border border-[#383d48] bg-[#0b0e13] p-2.5">
              {iconOptions.map(icon => <option key={icon} value={icon}>{icon}</option>)}<option value="image">Imagem enviada / URL</option>
            </select>
          </label>
          <label className="block text-sm">Status
            <select value={editing.is_active ? "1" : "0"} onChange={e => setField("is_active", e.target.value === "1" ? 1 : 0)} className="mt-1 w-full rounded-lg border border-[#383d48] bg-[#0b0e13] p-2.5">
              <option value="1">Ativa</option><option value="0">Pausada</option>
            </select>
          </label>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-[#383d48] p-3 text-sm text-[#c8d0df]">
          <MissionIcon icon={pendingImage?.dataUrl ?? editing.icon} id={editing.id} />
          <span>{pendingImage ? `Arquivo: ${pendingImage.name}` : "Prévia do ícone no app"}</span>
        </div>
        <div className="space-y-2">
          <p className="text-sm">Ícones atuais do app</p>
          <div className="flex flex-wrap gap-2">
            {appIcons.map(item => <button type="button" key={item.id} title={item.label}
              onClick={() => { clearImage(); setField("icon", item.url); }}
              className="rounded-xl border border-[#383d48] bg-[#0b0e13] p-2 hover:border-[#ef3943]">
              <img src={item.url} alt={item.label} className="h-10 w-10 object-contain" />
            </button>)}
          </div>
        </div>
        <label className="block text-sm">Enviar ícone (PNG, JPG ou WebP, até 2 MB)
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => chooseImage(e.target.files?.[0])}
            className="mt-1 block w-full rounded-lg border border-[#383d48] bg-[#0b0e13] p-2.5 text-sm" />
        </label>
        {!iconOptions.includes(editing.icon) && !pendingImage && <label className="block text-sm">URL da imagem do ícone (HTTPS)
          <input type="url" value={editing.icon} onChange={e => setField("icon", e.target.value)} className="mt-1 w-full rounded-lg border border-[#383d48] bg-[#0b0e13] p-2.5" />
        </label>}
        {editing.action_type === "link" && <>
          <label className="block text-sm">Link da missão (HTTPS)
            <input type="url" value={editing.target_url ?? ""} onChange={e => setField("target_url", e.target.value)} className="mt-1 w-full rounded-lg border border-[#383d48] bg-[#0b0e13] p-2.5" />
          </label>
          <label className="block text-sm">Tempo de espera (segundos)
            <input type="number" min={0} max={300} value={editing.wait_seconds} onChange={e => setField("wait_seconds", Number(e.target.value))} className="mt-1 w-full rounded-lg border border-[#383d48] bg-[#0b0e13] p-2.5" />
          </label>
        </>}
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={() => { setEditing(null); clearImage(); }} disabled={busy} className="rounded-xl border border-[#3a3e47] px-4 py-2.5 disabled:opacity-50">Cancelar</button>
          <button onClick={save} disabled={busy || readingImage} className="inline-flex items-center gap-2 rounded-xl bg-[#ef3943] px-5 py-2.5 font-semibold disabled:opacity-50"><Save size={16} /> {readingImage ? "Lendo imagem..." : busy ? "Salvando..." : "Salvar"}</button>
        </div>
      </div>
    </div>}
  </div>;
}
