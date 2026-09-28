# Young Money — painel administrativo

Painel React/TypeScript com servidor Express e tRPC. A página **Recompensas** (`/rewards`) consulta os usuários reais via `appUsers.rewardsList`, busca nome ou e-mail em toda a base e abre o detalhe existente do usuário para gerenciar seus pontos. A consulta antiga `appUsers.list` e as outras telas permanecem disponíveis.

## Executar

1. Instale as dependências com `pnpm install --frozen-lockfile`.
2. Configure as variáveis de ambiente no serviço ou em um arquivo `.env` local, que não deve ser versionado:
   - `DATABASE_URL`: banco MySQL usado pelo login e pelas contas do painel.
   - `JWT_SECRET`: chave de assinatura das sessões.
   - `ADMIN_PANEL_BOOTSTRAP_KEY`: chave exigida apenas para a configuração inicial do administrador.
   - `RAILWAY_DB_URL` (opcional): banco de dados dos usuários do aplicativo, caso seja diferente de `DATABASE_URL`.
   - `DISCORD_WEBHOOK_URL` (opcional): notificações de saques pendentes no Discord.
3. Inicie com `pnpm dev`. Para produção, rode `pnpm build` e `pnpm start`.

O servidor não contém credenciais de banco no código. Para manter o login e os dados do painel ao implantar em outro serviço, configure as variáveis e o banco correspondentes antes de iniciar.

## Verificar

- `pnpm test`
- `pnpm check`
- `pnpm build`
