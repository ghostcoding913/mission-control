# GhostClaw Mission Control (Android-first)

A mobile-first control surface for OpenClaw Gateway with a cleaner UX than the default dashboard.

## ✅ Current Status

### Implemented now
- Android-first dark UI + bottom navigation
- First-launch onboarding (Gateway URL + token)
- Local persistence for URL/token (`AsyncStorage`)
- Dashboard, Jobs queue, Sessions, Channels, Settings
- Advanced Mode safety gate for risky channel actions
- Mock/live switch support in Settings
- Gateway API adapter scaffold with fallback endpoint paths:
  - `/status` and `/api/status`
  - `/jobs` and `/api/jobs`
  - `/sessions` and `/api/sessions`
  - `/channels` and `/api/channels`

### In progress
- Exact endpoint payload mapping to your live gateway response shapes
- Safe config write flow (diff preview + rollback)

## Run locally

```bash
cd mission-control
npm install
npm run android
```

## Build APK (EAS cloud)

```bash
cd mission-control
npx eas-cli login
npx eas-cli build -p android --profile preview
```

This project is configured with `eas.json` for APK preview builds.
