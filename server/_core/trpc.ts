import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { timingSafeEqual } from "node:crypto";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || (ctx.user.role !== 'admin' && ctx.user.role !== 'superadmin')) {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);

// A configuração de recompensas exige autorização mesmo no painel legado,
// cujas demais rotas ainda usam procedimentos públicos.
export const taskAdminProcedure = t.procedure.use(
  t.middleware(async ({ ctx, next }) => {
    const role = ctx.user?.role;
    const configured = process.env.TASKS_ADMIN_KEY;
    const supplied = ctx.req.headers["x-task-admin-key"];
    const key = typeof supplied === "string" ? supplied : "";
    const match = Boolean(configured && key &&
      Buffer.byteLength(configured) === Buffer.byteLength(key) &&
      timingSafeEqual(Buffer.from(configured), Buffer.from(key)));
    if (role !== "admin" && role !== "superadmin" && !match) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Informe a chave de missões ou entre como administrador." });
    }
    return next({ ctx });
  }),
);
