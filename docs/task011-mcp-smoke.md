# TASK-011 Manual MCP smoke

This is the minimal manual check for a real MCP client after the server registers prompts and resources.

1. Start the app with `MCP_ENABLED=true` and a valid database.
2. Sign in through the regular REST login endpoint and copy the JWT.
3. Add the MCP server to your client with:

```json
{
  "mcpServers": {
    "idgenerator": {
      "url": "http://localhost:5000/mcp",
      "headers": {
        "Authorization": "Bearer <jwt>"
      }
    }
  }
}
```

4. In the client, open the prompt `execution_documentation_workflow` for a real `workflowId`.
5. Check that the prompt text says:
   - ask only about `missingInputs`
   - show assumptions explicitly
   - do not invent facts
   - ask for confirmation before approval or final actions
   - continue from the current stage
6. List resources and confirm these URIs are visible for the workflow:
   - `idgenerator://workflow/<workflowId>/status`
   - `idgenerator://workflow/<workflowId>/schedule-draft`
   - `idgenerator://workflow/<workflowId>/material-readiness`
   - `idgenerator://workflow/<workflowId>/acts-readiness`
7. Read the `status` resource and verify it matches the workflow stage you see in REST.
8. Read `schedule-draft`, `material-readiness`, and `acts-readiness` and confirm each returns JSON rather than an opaque LLM summary.

