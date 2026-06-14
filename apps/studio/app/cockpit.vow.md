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
- stack:
    gap: 5
    children:
      - card:
          children:
            - cardHeader: { children: [{ text: Agent loop }] }
            - cardBody:
                children:
                  - loop: { as: status }
                  - p: "Read-only — the loop is observed here, not driven. Start/stop control over the same surface arrives with #623 (it needs a cross-process stop signal)."
      - card:
          children:
            - cardHeader: { children: [{ text: Trace }] }
            - cardBody:
                children:
                  - p: Every run.started, phase, and pr.merged the loop and its agents emit, live — newest first.
                  - events: { as: trace }
      - card:
          children:
            - cardHeader: { children: [{ text: Health }] }
            - cardBody:
                children:
                  - mcp: { as: status }
```
