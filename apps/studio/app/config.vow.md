---
id: vow_config
fulfills: emit entity
---

# The studio's connection — which repo + Project the plan lives in

The one user-editable model: where the studio syncs its plan. The GitHub adapter
reads its sync target from here, so connecting a different repo or Project is a
setting, not a code change.

## fields

- repo: text, required
- project: text, required
- syncInterval: number, required
- planStatus: select(Todo|In Progress|Done), required
- planLabel: text, required

## seed

```yaml
- {
    repo: vndredev/vow,
    project: https://github.com/users/vndredev/projects/3,
    syncInterval: 300,
    planStatus: Todo,
    planLabel: "enhancement",
  }
```
