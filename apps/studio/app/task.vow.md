---
id: vow_task
fulfills: emit entity
---

# A unit of work — planned, assigned, and proven

## fields

- title: text, required
- status: select(backlog|todo|doing|done|blocked)
- assignee: reference(user)
- priority: select(low|medium|high)
- notes: longtext

## seed

```yaml
- { title: "The component model + the primitive ladder", status: done, priority: high }
- { title: "Generation — entity, view, form, bind", status: done, priority: high }
- { title: "View patterns — list, cards, board, stats", status: done, priority: high }
- { title: "Slicing — sort, filter, group-by", status: done, priority: medium }
- { title: "The git-derived roadmap view", status: done, priority: medium }
- { title: "The shell-as-vow layout system", status: done, priority: medium }
- { title: "A local SQLite data layer", status: done, priority: high }
- { title: "The read-only studio", status: done, priority: high }
- { title: "serialize — a Vow back to vow.md", status: done, priority: high }
- { title: "Structure mutations in the core", status: done, priority: high }
- { title: "The MCP server — an agent operates vow", status: done, priority: high }
- {
    title: "Dogfood — plan vow in the studio",
    status: doing,
    priority: high,
    notes: "This very board — vow's plan, operated by the agent over the MCP.",
  }
- { title: "typed.build hosting — D1 in prod", status: backlog, priority: medium }
- { title: "The observability adapter — coverage + CI", status: backlog, priority: medium }
- { title: "The GitHub adapter — issues, PRs, CI", status: backlog, priority: low }
- { title: "Build and Design surfaces", status: todo, priority: medium }
- { title: "Standalone forms with inline fields", status: backlog, priority: low }
- { title: "Editor completion for vow.md props", status: backlog, priority: low }
```
