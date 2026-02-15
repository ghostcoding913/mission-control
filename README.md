# GhostClaw Mission Control

Mobile-first **OpenClaw Gateway operations UI** built with Expo + React Native.

- Android-first UX (clean tab navigation, dark mode)
- First-launch gateway onboarding (URL + token)
- Live mode + mock mode
- Tabs for Dashboard, Jobs, Sessions, Channels, Settings

## Screens/Features

### ✅ Implemented
- Bottom-tab mobile layout
- Gateway URL/token onboarding + local persistence (`AsyncStorage`)
- Health dashboard card + quick actions
- Jobs queue view
- Sessions view
- Channels view with **Advanced Mode** safety gate for risky actions
- WebSocket-based live gateway RPC calls (`status`, `health`, `sessions.list`, `cron.list`, `channels.status`)
- Mock fallback data when live mode is unavailable

### 🚧 Planned / Next
- Full endpoint shape hardening for every gateway variant
- Safer config write workflow (confirm/diff/rollback)
- Better error surfaces + retry UX

## Tech Stack

- Expo SDK 54
- React Native 0.81
- TypeScript
- AsyncStorage

## Project Structure

```text
.
├─ App.tsx
├─ src/
│  ├─ mock/
│  ├─ services/
│  │  ├─ gatewayApi.ts
│  │  └─ gatewayWs.ts
│  └─ types/
├─ eas.json
└─ app.json
```

## Local Development

```bash
cd /home/liam/.openclaw/workspace/mission-control
npm install
npm run start
```

Run on device/simulator:

```bash
npm run android
npm run ios
npm run web
```

## Build Android APK (EAS)

```bash
npx eas-cli login
npx eas-cli build -p android --profile preview
```

## Export Web Build

```bash
npm run build:web
```

This outputs static files to `dist/`.

## Deploy to Vercel

```bash
npx vercel --prod dist
```

## Repository

- Org: `ghostcoding913`
- Repo: `mission-control`
- URL: https://github.com/ghostcoding913/mission-control
