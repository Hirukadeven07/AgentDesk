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
    mock/             The demo team
  connect/            Connecting a project (see below)
  world/floor.ts      The office layout: rooms, seats, furniture, walls
  sim/simulation.ts   Moves agents between stations as they work through steps
  render/             Canvas drawing, one file per layer (floor, skills, roster), and paging for big projects
  components/         React UI: side panel, detail window and its tabs, connect dialog, project strip
  App.tsx             One project on screen: layer toggle, selection, open window
  Root.tsx            Which project is shown: the demo team, a connected one, or a ?repo= link
```

The app only reads data through the `AgentsDeckData` type in `src/data/types.ts`, so the demo team and a connected project go through exactly the same screens.

## How connecting a project works

The words below are defined in [GLOSSARY.md](../GLOSSARY.md), and the design is in [ADR 0001](adr/0001-connect-projects-with-sources-and-adapters.md).

```
source ──▶ file tree ──▶ adapters (one per platform) ──▶ discoveries ──▶ merger ──▶ AgentsDeckData
```

```
src/connect/
  sources/local.ts    A picked folder, or a pasted manifest
  sources/github.ts   A public GitHub repo: one listing call, files fetched only when needed, symlinks followed
  fileTree.ts         The read-only view of a project every source produces
  frontmatter.ts      YAML frontmatter, shared by most agent and skill files
  adapters/           One file per platform, plus shared.ts with the helpers they reuse
  adapters/index.ts   ADAPTERS: every adapter, in the order their findings are merged
  merge.ts            Discoveries → AgentsDeckData: levels, one rack per distinct skill, unique names
  scan.ts             scan(tree): runs every adapter that recognises the tree, then merges
  connect.ts          connectProject(request): source + scan, with a message for every failure
  remember.ts         Keeping the project in this browser, and the ?repo= share link
```

Everything in `src/connect/` is plain TypeScript with no React, and the connect dialog loads it only when it opens.

### Adding a platform

1. **Add its name.** Add a `PlatformId` in `src/data/types.ts` and a label in `src/connect/platforms.ts`.
2. **Write the adapter.** Create `src/connect/adapters/<platform>.ts`. It exports an `Adapter`:
   - `detect(tree)`: true when the tree has any file the platform uses.
   - `parse(tree)`: returns a `Discovery` with agents, skills, MCP servers and warnings.

   Reuse `adapters/shared.ts`. `markdownAgent`, `markdownCommand`, `addMcpJson`, `readToml` and `readLenientMarkdown` cover the formats most platforms copy from each other.
3. **Let it be found.** Add the adapter to `ADAPTERS` in `src/connect/adapters/index.ts`.
4. **Keep skills with their tool.** If the platform keeps `SKILL.md` skills in a folder of its own, add that folder to `SKILL_FOLDERS` in `adapters/agentSkills.ts`.
5. **Test it with real files.** Write tests next to it, using `memoryTree({ path: text })`. Copy file layouts from real projects that use the platform, and scan a few of those projects before opening a pull request. Real files are where most bugs turn up: unquoted globs, symlinks, mode names that differ from YAML keys.

An adapter never throws. A file it can't use becomes a warning, which the strip at the top shows to the user.

### Live activity next

Today `src/sim/simulation.ts` replays the demo team's scripted steps, and a connected project's agents wait on the roster. The next step is to drive the same agent state from real events, such as one event per tool call.
