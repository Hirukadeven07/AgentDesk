# AgentsDeck

<p align="center">
  <img src="assets/agentsdeck-banner.webp" alt="AgentsDeck" width="100%">
</p>

AgentsDeck lets you watch AI agents work. Instead of a dashboard, you see an architectural model of an office. Agents walk to stations to do their tasks, and you can look into the skills they use and the team they belong to.

**Open it: [agentsdeck.vercel.app](https://agentsdeck.vercel.app)**

There's nothing to install or sign up for. It works in any modern browser, on a computer or a phone.

> **This is a preview.** You can't connect your own project or agents yet. Everything you see is a demo team of agents running on sample data.

## What you'll see

The toggle at the top switches between three layers:

- **Agent floor**: the office seen from above at an angle, with the roof off. Agents walk the corridor to whichever station their next tool call needs.
- **Skills layer**: the level below, with two rooms of GPU racks, one skill per rack. Stateless skills are on the left, stateful skills (they keep memory between calls) are on the right. A rack lights up while an agent uses it.
- **Agent roster**: every agent lined up on steps by level, like a group photo (L3 orchestrators, L2 specialists, L1 workers).

## How to use it

- **Tap anything** (an agent, a room, a rack or a step) to open a detail window with tabs. On a computer it sits in the bottom-right corner of the model. On a phone it slides up from the bottom; drag it down to close it.
- **Follow an agent** by tapping it in the *Agents on the floor* list beside the model.
- **Change the speed** with **Pause**, **1×** and **3×** next to the clock.
- **Share a layer**: the address changes as you switch layers, so a link like [agentsdeck.vercel.app/#skills](https://agentsdeck.vercel.app/#skills) opens straight on that layer.

## Coming later

Connecting your own project so you can watch your real agents work. Until then, AgentsDeck only shows the demo team.

---

Working on the code? See [docs/development.md](docs/development.md).
