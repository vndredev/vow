---
id: vow_settings
fulfills: emit form
nav: { label: Settings, icon: settings, group: Settings }
---

# Settings

The one user-editable place: a bound, validated form over the `config` entity —
the repo + Project the studio syncs its plan with. Saving it changes the GitHub
adapter's sync target, not the code.

## form

```yaml
of: config
submit: Save settings
```
