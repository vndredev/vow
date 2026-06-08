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
- { title: Design the board layout, status: done, priority: high }
- { title: Wire drag-and-drop, status: doing, priority: high }
- { title: Seed sample data, status: doing, priority: medium }
- { title: Group-by, sort and filter, status: todo, priority: medium }
- { title: An in-studio roadmap view, status: backlog, priority: low }
- { title: Cloudflare D1 persistence, status: backlog, priority: low }
- { title: Chase a flaky CI test, status: blocked, priority: high }
```
