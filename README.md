# Frontend Overview

The React frontend collects activity parameters, calls the FastAPI backend, and renders the structured TOON lessons without ad‑hoc parsing.

## Development

```bash
cd frontend
npm install
npm run dev
```

Set `API_BASE_URL` inside `src/components/ActivityForm.jsx` if the backend is hosted elsewhere.

## Rendering Flow

1. Submit the form to `/api/generate-activity`.
2. Backend now optimizes prompts using TOON but always returns the legacy markdown fields (`activity` / `activities`).
3. The component converts that markdown into styled HTML via `formatLessonPlan`, so the UI looks identical to the original design.

