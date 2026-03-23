# Asset Reference from Original Continuum Client

Source: `E:\SteamLibrary\steamapps\common\Continuum\`

## Graphics (graphics/*.bm2)

### Ships & Combat
- `ships.bm2` — Ship rotation sprites (36 frames × 8 ships in spritesheet)
- `bullets.bm2` — Bullet projectile sprites (4 levels)
- `bombs.bm2` — Bomb projectile sprites (4 levels)
- `mines.bm2` — Mine sprites
- `shrapnel.bm2` — Shrapnel fragments
- `explode0.bm2`, `explode1.bm2`, `explode2.bm2` — Explosion animations (3 sizes)
- `bombflsh.bm2` — Bomb flash effect
- `exhaust.bm2` — Engine thrust particles
- `trail.bm2` — Ship trail effect
- `repel.bm2` — Repel effect
- `rocket.bm2` — Rocket effect
- `empburst.bm2` — EMP burst visual

### HUD & UI
- `hlthbar.bm2` — Health/energy bar
- `engyfont.bm2` — Energy display font
- `led.bm2` — LED-style indicators
- `disp.bm2` — Display panel elements
- `gradient.bm2` — Background gradient
- `radarh.bm2`, `radarv.bm2` — Radar/minimap frame (horizontal/vertical)

### Map
- `tiles.bm2` — Map tileset (190 unique tile types)
- `wall.bm2` — Wall tiles
- `bg01-14.bm2` — Background star patterns (14 variants)
- `icondoor.bm2` — Door tiles

### Fonts
- `shrtfont.bm2` / `shrtfontf.bm2` — Short font (normal/bold)
- `largefont.bm2` / `largefontf.bm2` — Large font
- `hugefont.bm2` / `hugefontf.bm2` — Huge font
- `tallfont.bm2` / `tallfontf.bm2` — Tall font
- `specfont.bm2` — Spectator font
- `menutext.bm2` — Menu text

### Other
- `prizes.bm2` — Powerup/green icons
- `flag.bm2` — Flag sprite
- `dropflag.bm2` — Dropped flag
- `shield.bm2` — Shield effect
- `warp.bm2` — Warp/respawn effect
- `warppnt.bm2` — Warp point
- `king.bm2`, `kingex.bm2` — King crown
- `super.bm2` — Super weapon effect
- `spark.bm2` — Spark particles
- `colors.bm2` — Color palette reference
- `spectate.bm2` — Spectator icon
- Ship junk sprites: `junkwb.bm2`, `junkjv.bm2`, `junksp.bm2`, etc. (death debris per ship)
- Ship roll sprites: `wbroll.bm2`, `jvroll.bm2`, `sproll.bm2`, etc. (ship preview rotations)

## Sound (sound/*.wa2)

### Combat
- `gun1.wa2` - `gun4.wa2` — Bullet fire (4 weapon levels)
- `bomb1.wa2` - `bomb4.wa2` — Bomb fire (4 levels)
- `ebomb1.wa2` - `ebomb4.wa2` — EMP bomb fire
- `mine1.wa2` - `mine4.wa2` — Mine deploy
- `explode0.wa2` - `explode2.wa2` — Explosions (3 sizes)
- `ebombex.wa2` — EMP bomb explosion
- `bounce.wa2` — Wall bounce
- `repel.wa2` — Repel use
- `burst.wa2` — Burst use
- `thor.wa2` — Thor use
- `rocket1.wa2`, `rocket2.wa2` — Rocket fire
- `shrapnel` — (part of explosion sounds)

### Movement & Environment
- `thrust.wa2` — Engine thrust (looping)
- `wall.wa2` — Wall collision
- `warp.wa2` — Respawn/warp
- `warppnt.wa2` — Warp point

### Status & UI
- `prize.wa2` — Powerup pickup
- `flag.wa2` — Flag pickup
- `catch.wa2` — Catch sound
- `goal.wa2` — Goal scored
- `victory.wa2` — Match victory
- `victoryl.wa2` — Victory (long version)
- `alarm.wa2` — Low energy alarm
- `hum.wa2` — Background hum
- `rev.wa2` — Engine rev

### Abilities
- `cloak.wa2` — Cloak toggle
- `stealth.wa2` — Stealth toggle
- `antiwarp.wa2` — Antiwarp toggle
- `xradar.wa2` — X-Radar toggle
- `multion.wa2`, `multioff.wa2` — Multifire toggle
- `decoy.wa2` — Decoy deploy
- `throw.wa2` — Throw/attach

### Misc
- `off.wa2` — Power off
- `bong1.wa2` - `bong26.wa2` — Notification sounds (26 variants)

## TrenchWars Zone Files

Located in `zones/SSCU Trench Wars/`:
- `pub.lvl` — Public arena map
- `base.lvl` — Base map (for basing mode)
- `elim.lvl` — Elimination arena
- `javduel.lvl`, `wbduel.lvl` — Duel arenas
- Various `.lvz` files — LVZ overlay graphics (scoreboards, timers, splash screens)

## Skin System

Skins are BMP spritesheets + TXT coordinate files compiled to .SKN:
- Main lobby screen (640×480 typical)
- Hotspots for buttons, ship selection, zone list
- Profile, play, quit buttons
- TW2015.skn, TWOldschool.skn — TrenchWars-specific skins
