# Content App Preset

This scaffold is an opinionated starting point for a basic content-oriented Vertesia app.

It installs:

- app-owned content types: `guide`, `location`, `review_task`
- app-owned interactions: `guide_summarizer`, `field_suggester`, `review_checklist_builder`
- app-owned process: `guide-review`
- Store-backed UI screens for library, detail, review queue, process start, and ideas
- project setup and capability exercise scripts

Run after publishing or while using an authenticated preview token:

```bash
VERTESIA_TOKEN="$(vertesia auth token)" pnpm seed:content
VERTESIA_TOKEN="$(vertesia auth token)" pnpm exercise:content
```

If object creation fails for `app:<name>:<type>`, do not create API keys or use hand-written REST calls as a workaround.
Fix the app install, preview, token app scope, or app-owned type registration path first.
