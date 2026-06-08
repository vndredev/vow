---
id: vow_task
fulfills: emit entity
---

# A task someone must do

## fields

- title: text, required
- status: select(todo|doing|done)
- assignee: reference(user)
- notes: longtext
- done: boolean
