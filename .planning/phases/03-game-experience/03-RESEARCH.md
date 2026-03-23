# Phase 3: Game Experience - Research

**Researched:** 2026-03-23
**Domain:** Game modes, HUD/UI, audio, visual polish (PixiJS v8 + Web Audio API)
**Confidence:** HIGH

## Summary

Phase 3 transforms TrenchWars from a multiplayer combat tech demo into a complete game experience. The phase covers three domains: (1) server-side game mode architecture (FFA deathmatch, team elimination rounds, spectator mode), (2) client-side UI/HUD overlay (health/energy bars, kill feed, scoreboard, radar/minimap), and (3) audiovisual polish (Web Audio API sound effects, PixiJS glow/bloom filters for neon style).

The existing architecture is well-suited for these additions. The server already tracks kills/deaths per player and broadcasts DEATH/SPAWN events. Game modes are a server-side concern layered on top of the existing tick loop. The client already uses PixiJS v8 with Graphics-based rendering and HTML overlays (ship select, debug panel), providing clear patterns for HUD elements. The protocol needs a few new message types (CHAT, GAME_STATE, SCORE_UPDATE) but the JSON-over-WebSocket approach scales easily.

**Primary recommendation:** Build game modes as a server-side `GameMode` strategy pattern (FFA, TeamArena) that hooks into the existing tick loop. Build HUD as an HTML/CSS overlay layer (not PixiJS) for text-heavy elements (scoreboard, chat, kill feed) and use PixiJS for the radar/minimap. Use `pixi-filters` v6.x for glow/bloom effects. Use Howler.js for audio with sprite-based pooling.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MODE-01 | Free-for-all deathmatch: all players fight, kills tracked on scoreboard | GameMode strategy pattern; FFA mode sorts by kills, broadcasts score updates |
| MODE-02 | Team arena: 2 teams compete in elimination rounds | TeamArena mode with team assignment, round lifecycle, lives per player, win conditions |
| MODE-03 | Players can spectate an active arena without participating | Spectator state on PlayerState; server sends snapshots but skips physics; client renders without local ship |
| UIEX-01 | Ship selection screen where player picks ship type | Already exists (ShipSelectOverlay); needs integration with game mode join flow |
| UIEX-02 | In-game HUD showing health, energy, and kill/death count | HTML/CSS overlay with energy bar, health indicator, K/D display; updated from game state |
| UIEX-03 | Scoreboard/leaderboard visible during gameplay | HTML overlay toggled by Tab key; reads player list from snapshots; sorted by kills (FFA) or team score |
| UIEX-04 | Minimap/radar showing player positions on the map | PixiJS Container with scaled-down map + colored dots for players; corner-anchored |
| UIEX-05 | Text chat between players in the same arena | New CHAT protocol message; HTML input field; message history overlay |
| UIEX-06 | Audio effects for engine thrust, weapon fire, and explosions | Howler.js with audio sprites; positional panning based on distance; user-gesture unlock |
| UIEX-07 | Modern 2D visual style with vector graphics and glow/neon effects | pixi-filters v6 GlowFilter on ships/projectiles; AdvancedBloomFilter on weapon effects |
| UIEX-08 | No account or registration required to start playing | Already satisfied by design -- prompt for name, no auth required |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pixi.js | 8.17.1 | 2D WebGL rendering (already in use) | Already the project renderer; v8 has built-in filter support |
| pixi-filters | 6.1.5 | GlowFilter, AdvancedBloomFilter for neon effects | Official PixiJS community filters; v6.x is the version compatible with PixiJS v8.x |
| howler.js | 2.2.4 | Audio playback with sprite support and pooling | De facto standard for browser game audio; handles autoplay policy, audio sprites, spatial panning |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none new) | - | - | All other needs (HTML/CSS overlays, Web Audio spatial) are native browser APIs |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| howler.js | Raw Web Audio API | More control but far more boilerplate for sprite pooling, autoplay unlock, format fallback |
| pixi-filters GlowFilter | Custom WebGL shader | More performant but significant dev time; GlowFilter is good enough |
| HTML overlays for HUD | PixiJS Text/BitmapText | PixiJS text is harder to style, layout, and scroll; HTML is better for scoreboard/chat |

**Installation:**
```bash
cd packages/client
npm install pixi-filters howler
npm install -D @types/howler
```

## Architecture Patterns

### Recommended Project Structure
```
packages/shared/src/
  types.ts              # Add: TeamId, GameModeType, ChatMessage, GameModeState
  protocol.ts           # Add: CHAT, GAME_STATE, SCORE_UPDATE, TEAM_ASSIGN messages
  game-modes.ts         # NEW: GameMode interface, FFA config, TeamArena config

packages/server/src/
  game-server.ts        # Extend: delegate to active GameMode per tick
  game-modes/
    game-mode.ts        # Interface: onTick, onKill, onJoin, onLeave, getState
    ffa-mode.ts         # FFA: track kills, sort leaderboard, no rounds
    team-arena-mode.ts  # TeamArena: team assignment, lives, rounds, win condition
  player-manager.ts     # Extend: team assignment, spectator state

packages/client/src/
  ui/
    hud.ts              # HTML overlay: energy bar, K/D counter, kill feed
    scoreboard.ts       # HTML overlay: toggled by Tab, shows all players
    chat.ts             # HTML input + message history
    radar.ts            # PixiJS Container: minimap with player dots
  audio/
    sound-manager.ts    # Howler.js wrapper: load sprites, play by event, spatial panning
  renderer.ts           # Extend: apply glow/bloom filters to ships and projectiles
  visual-effects.ts     # NEW: neon ship rendering, glow on energy state, trail effects
```

### Pattern 1: GameMode Strategy Pattern (Server)
**What:** Abstract game mode logic behind an interface so the game server delegates mode-specific behavior without conditionals scattered through the tick loop.
**When to use:** When you need FFA and TeamArena to coexist with different scoring, round lifecycle, and win conditions.
**Example:**
```typescript
// packages/shared/src/game-modes.ts
export type GameModeType = 'ffa' | 'team-arena';

export interface GameModeConfig {
  type: GameModeType;
  scoreLimit?: number;      // FFA: kills to win
  roundCount?: number;       // TeamArena: best of N
  livesPerRound?: number;    // TeamArena: lives per player per round
  timeLimit?: number;        // seconds per round
}

// packages/server/src/game-modes/game-mode.ts
export interface GameMode {
  readonly type: GameModeType;
  onPlayerJoin(playerId: string): void;
  onPlayerLeave(playerId: string): void;
  onKill(killerId: string, killedId: string, weaponType: string): void;
  onTick(tick: number): GameModeEvent[];  // round start, round end, game over
  getState(): GameModeState;              // broadcast to clients
  canRespawn(playerId: string): boolean;  // TeamArena blocks respawn when lives=0
}
```

### Pattern 2: HTML/CSS HUD Overlay
**What:** Use HTML elements positioned over the PixiJS canvas for text-heavy UI (HUD, scoreboard, chat). PixiJS canvas stays focused on game rendering.
**When to use:** Always for text, lists, inputs. The existing ship-select and debug panel already use this pattern.
**Example:**
```typescript
// HUD elements are absolutely positioned HTML divs over the canvas
// Updated each frame from game state, not from PixiJS rendering
export class HUD {
  private container: HTMLDivElement;
  private energyBar: HTMLDivElement;
  private killCount: HTMLSpanElement;

  update(energy: number, maxEnergy: number, kills: number, deaths: number): void {
    const pct = Math.max(0, energy / maxEnergy * 100);
    this.energyBar.style.width = `${pct}%`;
    this.killCount.textContent = `${kills} / ${deaths}`;
  }
}
```

### Pattern 3: PixiJS Radar/Minimap
**What:** A small PixiJS Container in the corner showing the full map at reduced scale, with colored dots for players.
**When to use:** For UIEX-04 (radar/minimap).
**Example:**
```typescript
// Separate Graphics object, added to stage at fixed screen position
// Scale factor: mapSize (200 tiles) -> minimap (150px) = 0.75 px/tile
export class Radar {
  private container: Container;
  private dots: Graphics;
  private mapScale: number;

  render(localPlayer: { x: number; y: number }, remotePlayers: Map<string, InterpolatedEntity>): void {
    this.dots.clear();
    // Local player: bright green dot
    this.dots.circle(localPlayer.x * this.mapScale, localPlayer.y * this.mapScale, 2);
    this.dots.fill({ color: 0x00ff00 });
    // Remote players: colored by team or neutral
    for (const [, player] of remotePlayers) {
      this.dots.circle(player.x * this.mapScale, player.y * this.mapScale, 1.5);
      this.dots.fill({ color: player.team === localTeam ? 0x4488ff : 0xff4444 });
    }
  }
}
```

### Pattern 4: Audio Manager with Howler.js Sprites
**What:** Single audio sprite file containing all game SFX, played via Howler.js with pooling.
**When to use:** For all game sound effects (thrust, fire, explosion, bounce).
**Example:**
```typescript
import { Howl } from 'howler';

export class SoundManager {
  private sfx: Howl;

  constructor() {
    this.sfx = new Howl({
      src: ['/audio/sfx.webm', '/audio/sfx.mp3'],
      sprite: {
        thrust:    [0, 200, true],    // [offset_ms, duration_ms, loop]
        bulletFire:[200, 150],
        bombFire:  [350, 300],
        explosion: [650, 500],
        bounce:    [1150, 100],
        death:     [1250, 400],
      },
      volume: 0.5,
    });
  }

  play(name: string, pan?: number): void {
    const id = this.sfx.play(name);
    if (pan !== undefined) {
      this.sfx.stereo(pan, id); // -1 (left) to 1 (right)
    }
  }
}
```

### Anti-Patterns to Avoid
- **Rendering HUD text with PixiJS Text:** PixiJS Text creates a canvas texture per string update, causing GC pressure. Use HTML elements for scoreboard/chat.
- **Per-sound Howl instances:** Creating separate Howl objects for each sound effect wastes resources. Use a single sprite-based Howl.
- **Filters on every object individually:** Applying GlowFilter per-ship per-frame is expensive. Apply filters to Container groups (all ships, all projectiles) for batching.
- **Game mode logic in GameServer.tick():** Scattering FFA/TeamArena conditionals through the tick loop. Use the strategy pattern to keep mode logic isolated.
- **Blocking on audio load:** Audio files should load asynchronously after the game starts. Never block game startup on audio availability.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Audio playback + pooling | Custom Web Audio context manager | Howler.js | Handles autoplay policy, format fallback, sprite pooling, volume/pan, mobile quirks |
| Glow/bloom shader | Custom WebGL fragment shader | pixi-filters GlowFilter / AdvancedBloomFilter | Already written, tested, GPU-optimized, compatible with PixiJS v8 |
| Audio sprite generation | Manual offset calculation | audiosprite CLI tool | Generates sprite JSON + combined audio file from individual WAV/MP3 inputs |
| Energy bar rendering | Canvas-based bar widget | HTML div with CSS width% | Simpler, GPU-composited, easy to animate with CSS transitions |

**Key insight:** This phase is UI/UX heavy. The temptation is to build everything inside PixiJS, but HTML/CSS is dramatically better for text, lists, and form inputs. PixiJS should only handle spatial rendering (minimap dots, glow effects).

## Common Pitfalls

### Pitfall 1: Browser Autoplay Policy Blocks Audio
**What goes wrong:** Sound effects fail silently on first load because browser blocks AudioContext creation without user gesture.
**Why it happens:** Chrome/Firefox/Safari all require a click/keydown before playing audio.
**How to avoid:** Howler.js handles this automatically when you create the Howl after a user interaction. The existing ship-select click/keypress is the ideal place to initialize audio.
**Warning signs:** No sound on first game entry; works after refreshing and clicking.

### Pitfall 2: GlowFilter Performance on Many Objects
**What goes wrong:** Applying GlowFilter to each ship individually causes frame rate drops with 20+ players.
**Why it happens:** Each filter application requires a separate render pass (render to texture, apply shader, composite).
**How to avoid:** Apply GlowFilter once to a Container holding all ship graphics, not per-ship. Alternatively, use a single AdvancedBloomFilter on the entire stage for a global neon effect.
**Warning signs:** FPS drops proportional to player count.

### Pitfall 3: Scoreboard Tab Key Conflicts
**What goes wrong:** Pressing Tab to show scoreboard also moves browser focus or triggers the bomb fire (Tab is currently mapped to fireBomb).
**Why it happens:** Tab has browser default behavior (focus next element) and is already bound as fireBomb input.
**How to avoid:** Use a different key for scoreboard (e.g., F1 or backtick) OR remap bomb to a different key. The current input system uses Tab for fireBomb, so this must be resolved during planning.
**Warning signs:** Scoreboard opens and simultaneously fires a bomb.

### Pitfall 4: Chat Input Captures Game Keys
**What goes wrong:** When chat input is focused, arrow keys type in the input instead of moving the ship.
**Why it happens:** HTML input elements capture keyboard events naturally.
**How to avoid:** When chat is active, disable InputManager polling. Toggle a `chatActive` flag. Use Enter to open/close chat (classic game pattern). Stop propagation on the chat input.
**Warning signs:** Ship stops responding when chat is open.

### Pitfall 5: Minimap Scale Math Errors
**What goes wrong:** Player dots appear at wrong positions on the minimap.
**Why it happens:** Confusing tile coordinates vs pixel coordinates, or not accounting for the minimap's position offset on screen.
**How to avoid:** Minimap coordinate = (playerTilePos / mapTileSize) * minimapPixelSize. Keep it in tile space, scale once.
**Warning signs:** Dots clustered in one corner or outside minimap bounds.

### Pitfall 6: Round State Desync in Team Arena
**What goes wrong:** Client shows "Round 2" while server is still in Round 1 transition.
**Why it happens:** Game mode state changes (round transitions) sent as events can arrive out of order or be missed.
**How to avoid:** Include current round number and phase in every GAME_STATE message (not just on transitions). Client reads authoritative state, not derived from events.
**Warning signs:** Scoreboard shows wrong round; players respawn in wrong phase.

## Code Examples

### Adding Protocol Messages for Phase 3
```typescript
// packages/shared/src/protocol.ts - additions
export enum ClientMsg {
  // ... existing
  CHAT = 0x05,          // { message: string }
}

export enum ServerMsg {
  // ... existing
  CHAT = 0x08,          // { playerId: string, name: string, message: string }
  GAME_STATE = 0x09,    // GameModeState (mode type, scores, round, phase)
  SCORE_UPDATE = 0x0A,  // { players: { id, kills, deaths, team }[] }
  TEAM_ASSIGN = 0x0B,   // { playerId: string, team: number }
}
```

### FFA Deathmatch Mode (Server)
```typescript
export class FFAMode implements GameMode {
  readonly type = 'ffa' as const;
  private scoreLimit: number;

  onKill(killerId: string, killedId: string): void {
    // Kills already tracked by PlayerManager
    // Check win condition
    const killer = this.playerManager.getPlayer(killerId);
    if (killer && killer.kills >= this.scoreLimit) {
      // Emit game-over event
    }
  }

  canRespawn(_playerId: string): boolean {
    return true; // FFA always allows respawn
  }

  getState(): GameModeState {
    return {
      type: 'ffa',
      leaderboard: this.getSortedPlayers(),
      scoreLimit: this.scoreLimit,
    };
  }
}
```

### Team Arena Mode (Server)
```typescript
export class TeamArenaMode implements GameMode {
  readonly type = 'team-arena' as const;
  private teams: Map<string, 0 | 1> = new Map(); // playerId -> team index
  private lives: Map<string, number> = new Map();
  private roundScores = [0, 0]; // team 0, team 1
  private currentRound = 1;
  private roundActive = false;

  onPlayerJoin(playerId: string): void {
    // Auto-balance: assign to team with fewer players
    const team0Count = [...this.teams.values()].filter(t => t === 0).length;
    const team1Count = [...this.teams.values()].filter(t => t === 1).length;
    this.teams.set(playerId, team0Count <= team1Count ? 0 : 1);
  }

  onKill(killerId: string, killedId: string): void {
    const lives = this.lives.get(killedId) ?? 0;
    this.lives.set(killedId, Math.max(0, lives - 1));

    // Check if team is eliminated
    const killedTeam = this.teams.get(killedId)!;
    const teamAlive = [...this.teams.entries()]
      .filter(([, t]) => t === killedTeam)
      .some(([id]) => (this.lives.get(id) ?? 0) > 0);

    if (!teamAlive) {
      // Other team wins this round
      const winningTeam = killedTeam === 0 ? 1 : 0;
      this.roundScores[winningTeam]++;
      this.startNextRound();
    }
  }

  canRespawn(playerId: string): boolean {
    return (this.lives.get(playerId) ?? 0) > 0;
  }
}
```

### Applying Glow Filters
```typescript
import { GlowFilter } from 'pixi-filters/glow';
import { AdvancedBloomFilter } from 'pixi-filters/advanced-bloom';

// Apply glow to ship container (not individual ships)
const shipGlow = new GlowFilter({
  distance: 10,
  outerStrength: 2,
  innerStrength: 0,
  color: 0x00ff88,
  quality: 0.3, // lower = faster, less precise
});
shipContainer.filters = [shipGlow];

// Global bloom on the whole stage for neon aesthetic
const bloom = new AdvancedBloomFilter({
  threshold: 0.4,
  bloomScale: 0.8,
  brightness: 1.1,
  blur: 4,
  quality: 4,
});
app.stage.filters = [bloom];
```

### Spectator Mode
```typescript
// Server: spectator joins without a ship
// In game-server.ts handleJoin:
if (msg.spectate) {
  player.spectating = true;
  player.alive = false;
  // Still receives snapshots, no physics processing
}

// Client: spectator cycles through players to follow
// Camera follows a selected player instead of local ship
// No InputManager polling for movement, only camera controls
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| @pixi/filter-glow (individual packages) | pixi-filters v6 (unified package) | 2024 (PixiJS v8) | Import from `pixi-filters/glow` not `@pixi/filter-glow` |
| Separate audio elements per sound | Audio sprite + Howler.js pooling | Ongoing best practice | Single HTTP request, instant playback, memory efficient |
| PixiJS Text for UI | HTML/CSS overlay for text-heavy UI | PixiJS v7+ community consensus | Better performance, styling, accessibility |

**Deprecated/outdated:**
- `@pixi/filter-glow` (v5.x): Not maintained for PixiJS v8; use `pixi-filters` v6 instead
- `createjs/SoundJS`: Unmaintained; Howler.js is the standard replacement

## Open Questions

1. **Tab key conflict: scoreboard vs bomb fire**
   - What we know: Tab is currently mapped to fireBomb in InputManager
   - What's unclear: Whether to remap bomb or use a different scoreboard key
   - Recommendation: Remap bomb to F key only (Tab already has F as alternative), use Tab for scoreboard. This matches arena shooter conventions.

2. **Team colors: how many and which**
   - What we know: Need 2 teams for team arena mode
   - What's unclear: Exact color palette
   - Recommendation: Team 0 = blue (#4488ff), Team 1 = red (#ff4444). Classic arena shooter convention.

3. **Audio asset creation pipeline**
   - What we know: Need thrust, bullet, bomb, explosion, bounce, death sounds
   - What's unclear: Whether to generate procedurally or use free SFX
   - Recommendation: Use free CC0/public domain SFX from freesound.org, processed into an audio sprite with the `audiosprite` CLI tool. Procedural synthesis is a v2 concern.

4. **Kill feed duration and capacity**
   - What we know: Kill events already broadcast via DEATH messages
   - What's unclear: How many entries to show, how long to display
   - Recommendation: Show last 5 kills, each visible for 5 seconds, fading out. Standard for arena shooters.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1 |
| Config file | packages/server/vitest.config.ts (or package.json scripts) |
| Quick run command | `cd packages/server && npx vitest run` |
| Full suite command | `cd packages/server && npx vitest run && cd ../shared && npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MODE-01 | FFA mode tracks kills, sorts leaderboard, respawn allowed | unit | `cd packages/server && npx vitest run src/__tests__/ffa-mode.test.ts -x` | No - Wave 0 |
| MODE-02 | TeamArena: team assignment, lives, round lifecycle, win | unit | `cd packages/server && npx vitest run src/__tests__/team-arena-mode.test.ts -x` | No - Wave 0 |
| MODE-03 | Spectator receives snapshots, no physics, no respawn | unit | `cd packages/server && npx vitest run src/__tests__/spectator.test.ts -x` | No - Wave 0 |
| UIEX-01 | Ship selection resolves with ship type index | manual-only | N/A (existing UI, browser-only) | Exists (ship-select.ts) |
| UIEX-02 | HUD displays energy/health/K-D values | manual-only | N/A (HTML overlay, visual verification) | No |
| UIEX-03 | Scoreboard shows sorted player list | manual-only | N/A (HTML overlay) | No |
| UIEX-04 | Radar dots match player tile positions | unit | `cd packages/client && npx vitest run src/__tests__/radar.test.ts -x` | No - Wave 0 |
| UIEX-05 | Chat messages broadcast to all players | unit | `cd packages/server && npx vitest run src/__tests__/chat.test.ts -x` | No - Wave 0 |
| UIEX-06 | Sound manager plays named sprites | unit | `cd packages/client && npx vitest run src/__tests__/sound-manager.test.ts -x` | No - Wave 0 |
| UIEX-07 | Glow filter applied to ship container | manual-only | N/A (visual verification) | No |
| UIEX-08 | No auth required (existing behavior) | manual-only | N/A | Already satisfied |

### Sampling Rate
- **Per task commit:** `cd packages/server && npx vitest run`
- **Per wave merge:** `cd packages/server && npx vitest run && cd ../shared && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/server/src/__tests__/ffa-mode.test.ts` -- covers MODE-01
- [ ] `packages/server/src/__tests__/team-arena-mode.test.ts` -- covers MODE-02
- [ ] `packages/server/src/__tests__/spectator.test.ts` -- covers MODE-03
- [ ] `packages/server/src/__tests__/chat.test.ts` -- covers UIEX-05

## Sources

### Primary (HIGH confidence)
- PixiJS v8 official docs: filters guide (https://pixijs.com/8.x/guides/components/filters)
- pixijs/filters GitHub repo: v6.x compatibility with PixiJS v8, import syntax (https://github.com/pixijs/filters)
- Howler.js docs and examples: sprite API, pooling, autoplay handling (https://howlerjs.com/)
- MDN Web Audio API best practices (https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices)
- Existing codebase: types.ts, protocol.ts, game-server.ts, renderer.ts, ship-select.ts, debug.ts

### Secondary (MEDIUM confidence)
- pixi-filters npm: v6.1.5 confirmed latest, last published 2025-11-29 (https://www.npmjs.com/package/pixi-filters)
- Deep research report: TW game mode details (TWDD, TWJD, TWBD formats, scoring systems)
- Howler.js npm: v2.2.4 confirmed latest (https://www.npmjs.com/package/howler)

### Tertiary (LOW confidence)
- Audio sprite generation workflow (audiosprite CLI) -- not verified hands-on, based on documentation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - PixiJS v8 already in use, pixi-filters v6 confirmed compatible, Howler.js is industry standard
- Architecture: HIGH - Existing patterns (HTML overlays, strategy-like server design) directly inform the approach
- Game modes: HIGH - Deep research report provides detailed TW mode specifications (TWDD elimination format with lives/rounds)
- Pitfalls: HIGH - Based on established PixiJS filter performance characteristics and browser audio policy
- Audio: MEDIUM - Howler.js API is well-documented but audio asset pipeline (sprite generation) needs validation during implementation

**Research date:** 2026-03-23
**Valid until:** 2026-04-23 (stable domain, 30 days)
