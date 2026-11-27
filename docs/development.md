# Developing AgentsDeck

Notes for people working on the code. The [README](../README.md) is for people using the app.

## Run it on your computer

You need [Node.js](https://nodejs.org) version 20.19 or newer. Check with `node -v`.

```bash
git clone https://github.com/Hirukadeven07/AgentsDeck.git
cd AgentsDeck
npm install
npm run dev
```

Then open **http://localhost:5173** in your browser. The page reloads by itself when you save a file. Press `Ctrl + C` in the terminal to stop it.

### Try it on your phone

Your phone and computer need to be on the same Wi-Fi.

```bash
npm run dev:phone
```

The terminal prints a `Network:` address such as `http://192.168.1.20:5173`. Open that address on your phone.

### Other commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts the app at http://localhost:5173 |
| `npm run dev:phone` | Same, but also reachable from other devices on your Wi-Fi |
| `npm run build` | Checks the types and builds a production copy into `dist/` |
| `npm run preview` | Serves the `dist/` build at http://localhost:4173 |
| `npm run typecheck` | Checks the TypeScript types only |
| `npm test` | Runs the unit tests once (Vitest) |
| `npm run test:watch` | Runs the tests again every time you save |

## Host it on Vercel

The repo includes a `vercel.json`, so Vercel builds it with `npm run build` and serves the `dist/` folder. Files in `dist/assets/` have a hash in their name, so they are cached for a year. `index.html` is never cached, so a new deploy shows up straight away.

The app switches layers with the `#` part of the URL, such as `/#skills`. Every page is `index.html`, so it needs no rewrite rules.

**Set it up once:**

1. Sign in at [vercel.com](https://vercel.com) with GitHub.
2. Click **Add New → Project** and import `Hirukadeven07/AgentsDeck`.
3. Keep the settings it fills in from `vercel.json` and click **Deploy**.

After that, every push to `main` updates the live site at https://agentsdeck.vercel.app. Every pull request gets its own preview link.

**Or deploy from the terminal:**

```bash
npx vercel login
npx vercel          # preview deploy, and links the folder to a Vercel project
npx vercel --prod   # deploy to the live site
```

## How the code is organised

Built with Vite, React and TypeScript. The model is drawn on a `<canvas>`, and the panels around it are React components.

```
src/
  data/
    types.ts          The shape of all data (agents, skills, rooms, levels)
    mock/             Mock data. Replace this to show real agents
  world/floor.ts      The office layout: rooms, seats, furniture, walls
  sim/simulation.ts   Moves agents between stations as they work through steps
  render/             Canvas drawing, one file per layer (floor, skills, roster)
  components/         React UI: side panel, detail window and its tabs
  App.tsx             Puts it together: layer toggle, selection, open window
```

### Plugging in real data later

The app only reads data through the `AgentsDeckData` type in `src/data/types.ts`. To show real agents:

1. Build an `AgentsDeckData` object from your own source (an API, a log file, an event stream).
2. Pass it to `<App data={...} />` in `src/main.tsx` instead of `mockData`.

Today the simulation in `src/sim/simulation.ts` replays scripted steps. For live data, the next step is to drive the same agent state from real events, such as one event per tool call.
