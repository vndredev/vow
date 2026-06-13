---
id: vow_cockpit
fulfills: emit view
nav: { label: Cockpit, icon: monitor, group: Operations, order: 0 }
---

# Cockpit

## view

```yaml
- h1: Cockpit
- p: The single pane of glass over the autonomous system — whether autonomy is running, what the current round is working through, and the live agent-run trace as it happens.
- h2: Agent loop
- loop: { as: status }
- p: Read-only — the loop is observed here, not driven. Start/stop control over the same surface arrives with #623 (it needs a cross-process stop signal).
- h2: Trace
- p: Every run.started, phase, and pr.merged the loop and its agents emit, live.
- events: { as: trace }
- h2: Health
- p: An MCP/channel health indicator (connected · tool count · last event) is the next element — tracked as #636.
```
