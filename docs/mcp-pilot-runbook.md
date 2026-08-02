# MCP pilot runbook

## Purpose

Prepare a limited pilot for the MCP endpoint after TASK-012 hardening.

## Preflight

- Confirm `MCP_ENABLED=true`.
- Confirm `DATABASE_URL` points to the pilot database.
- Confirm `MCP_ALLOWED_HOSTNAMES` and, if needed, `MCP_ALLOWED_ORIGINS` match the pilot host.
- Run:
  - `npm run check`
  - `npm test`
  - `npm run build`

## Staging smoke

1. Start the app with the pilot environment variables.
2. Log in through the regular REST auth flow and copy the JWT.
3. Call `/mcp` with `Authorization: Bearer <jwt>`.
4. Verify:
   - `resources/list` returns workflow resources for the owned workflow only;
   - `prompts/list` returns `execution_documentation_workflow`;
   - `set_workflow_input`, `approve_schedule`, `generate_acts`, `build_execution_package` emit `[mcp:audit]` log lines;
   - cross-site `Origin` headers are rejected with `FORBIDDEN`;
   - tool rate limiting returns `RATE_LIMITED` once the per-tool limit is exceeded.
   - request logs include `requestId`, `method`, `userId`, `status`, and `durationMs`, but never JWTs or tool arguments.

## Rollback

1. Disable the endpoint by setting `MCP_ENABLED=false`.
2. Redeploy the previous image or commit if the hardening change itself caused the issue.
3. Keep the existing REST routes running; rollback must not affect non-MCP traffic.
4. If a migration caused the issue, revert the migration only after confirming no production data depends on it.

## Restore / incident notes

- Capture the failing request ID from the MCP log line.
- Record the tool name, user ID, status, and duration from the audit/telemetry lines.
- Keep the problematic JWT out of incident notes and screenshots.

## Pilot checklist

- [ ] MCP transport enabled only for the pilot.
- [ ] Host/origin validation in place.
- [ ] Audit logs visible for write/final tools.
- [ ] Per-tool rate limit observed.
- [ ] Request IDs visible in MCP request logs.
- [ ] No secrets in logs.
- [ ] Rollback switch tested.
