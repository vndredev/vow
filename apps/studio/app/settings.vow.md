---
id: vow_settings
fulfills: emit form
nav: { label: Settings, icon: settings, group: Settings }
---

# Settings

The one user-editable place: a bound, validated form over the `config` entity —
the repo + Project the studio syncs its plan with. Saving it changes the GitHub
adapter's sync target, not the code. `edit: true` makes it a singleton editor: it
pre-loads the seeded config row and updates it in place, so saving never adds a
duplicate.

## form

```yaml
of: config
submit: Save settings
edit: true
```
