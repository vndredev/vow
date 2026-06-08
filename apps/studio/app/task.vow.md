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
