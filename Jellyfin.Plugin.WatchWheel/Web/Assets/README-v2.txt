Popcorn Mode SFX v2
Designed to be softer, warmer, and more playful than the first prototype.

Suggested event mapping:
- popcorn-spin-start-v2.wav  -> spin launch
- popcorn-reel-tick-v2.wav   -> center-crossing tick during fast travel
- popcorn-slow-tick-v2.wav   -> deceleration crossings only
- popcorn-stop-v2.wav        -> final center lock
- popcorn-reveal-v2.wav      -> popcorn burst + winner flourish

Mixing guidance:
- Do NOT play reel-tick on every frame/item.
- Trigger ticks only when a reel box crosses the fixed center marker.
- Cap fast tick rate around 7-9 per second.
- During slowdown, naturally space ticks farther apart.
- Duck reel ticks slightly under spin-start.
- Stop sound should finish before reveal begins.
- Reveal should play once.
- Keep master Popcorn SFX around 0.65-0.8 relative to the old slot-machine mix.
