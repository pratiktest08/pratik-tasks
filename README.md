# Pratik — Task Report | PL India

Personal task report dashboard for Pratik (UI/UX Designer), connected live to Google Sheets.

## Setup

```bash
npm install
npm run dev       # local dev
npm run build     # production build
```

## Deploy to Vercel

1. Push to GitHub → connect to Vercel, or
2. Run `npx vercel` from this folder

**Required:** Google Sheet must be shared as "Anyone with the link can view"

## Data Source

- **Pratik tab** → pending/active tasks
- **Status-Complete tab** → completed tasks (filtered to Owner = Pratik)
- Auto-refreshes every 5 minutes

## Tech

React 18 · Vite 5 · Recharts · Lucide Icons · Figtree font
