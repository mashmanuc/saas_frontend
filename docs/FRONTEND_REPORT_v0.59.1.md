## Tutor dashboard relations

- Tutor relations API now returns an aggregated payload (`relations`, `counters`, `recent_actions`, `filters`).
- `frontend/src/stores/relationsStore.js` normalizes this response via an inline helper and keeps a warn-guard for unexpected shapes.
