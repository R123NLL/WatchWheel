const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {make, tick, html, js} = require('./watchwheel-reliability.cjs');
const vm = require('vm');
const plugin = path.resolve(__dirname, '../Jellyfin.Plugin.WatchWheel');
const css = fs.readFileSync(path.join(plugin, 'Web/watchWheel.css'), 'utf8');
const controller = fs.readFileSync(path.join(plugin, 'Controllers/WatchWheelController.cs'), 'utf8');
const project = fs.readFileSync(path.join(plugin, 'Jellyfin.Plugin.WatchWheel.csproj'), 'utf8');

const key = 'watchwheel:v1:one:alice';
const titles = count => Array.from({length: count}, (_, i) => ({
    Id: `title-${i}`, Name: `Movie ${i}`, Type: 'Movie', IsInProgress: false
}));
const reelSize = e => e.els.wwPopcornReel.children.length;
const nextFrame = async (e, now) => {
    const frame = e.frames.shift();
    assert(frame, 'spin schedules an animation frame');
    e.now = now;
    frame(now);
    await tick();
};

(async () => {
    assert.match(html, /<option value="classic">Classic<\/option>/);
    assert.match(html, /<option value="popcorn">Popcorn<\/option>/);
    assert.match(js, /var winner = state\.items\[index\]/);
    const art = ['cinematic_popcorn_reveal_stage.png', 'popcorn-vector.svg', 'popcorn-kernel.svg'];
    const classicArt = 'classic-atmosphere.svg';
    const sfx = ['spin-launch.wav', 'reel-pass-fast.wav', 'reel-pass-slow.wav', 'winner-lock.wav', 'winner-reveal.wav'];
    for (const name of [...art, ...sfx]) {
        assert(fs.statSync(path.join(plugin, 'Web/Assets', name)).size > 300, `${name} is bundled`);
        assert(controller.includes(`"${name}"`), `${name} is served with an explicit MIME type`);
        assert(project.includes(`Web\\Assets\\${name}`), `${name} is explicitly embedded`);
    }
    assert(fs.statSync(path.join(plugin, 'Web/Assets', classicArt)).size > 300, 'Classic atmosphere is bundled');
    assert(controller.includes(`"${classicArt}"`), 'Classic atmosphere is explicitly served');
    assert(project.includes(`Web\\Assets\\${classicArt}`), 'Classic atmosphere is explicitly embedded');
    assert(css.includes(`Assets/${classicArt}`), 'Classic atmosphere is visibly used');
    assert.match(css, /\.wwAtmosphereLayer\s*\{[^}]*transition:\s*opacity 300ms ease/s, 'mode environments crossfade without moving the UI');
    assert.match(css, /\.pcPoster\s*\{[^}]*bottom:\s*265px/s, 'Popcorn poster rests higher above the bucket');
    assert(!js.includes('The reel has chosen.'), 'redundant Popcorn result sentence is removed');
    for (const name of art) assert(css.includes(`Assets/${name}`), `${name} is visibly used`);
    const svg=fs.readFileSync(path.join(plugin,'Web/Assets/popcorn-vector.svg'),'utf8');
    assert(!/<image|data:image/i.test(svg),'original vector geometry, no raster wrapper');
    for(const part of ['bucket-body','bucket-left-lid','bucket-right-lid','bucket-medallion','bucket-popcorn','popcorn-kernel-01','popcorn-kernel-02','popcorn-kernel-03','burst-rays','glow']) {
        assert(svg.includes(`id="${part}"`),`addressable vector part ${part}`);
    }
    for (const name of sfx) assert(js.includes(`'${name}'`), `${name} is wired to sound events`);
    assert(!project.includes('Web\\Assets\\*.wav') && !project.includes('Web\\Assets\\*.png') && !project.includes('Web\\Assets\\*.svg'), 'production assets are embedded explicitly, not by wildcard');
    const obsolete = ['golden_star_popcorn_bucket.png', 'golden_popcorn_explosion_tub.png',
        'popcorn-spin-start.wav', 'popcorn-reel-tick.wav', 'popcorn-slow-tick.wav', 'popcorn-stop.wav', 'popcorn-reveal.wav',
        'popcorn-spin-start-v2.wav', 'popcorn-reel-tick-v2.wav', 'popcorn-slow-tick-v2.wav', 'popcorn-stop-v2.wav', 'popcorn-reveal-v2.wav'];
    for (const name of obsolete) {
        assert(!fs.existsSync(path.join(plugin, 'Web/Assets', name)), `${name} is removed`);
        assert(!controller.includes(`"${name}"`) && !css.includes(name) && !js.includes(name), `${name} has no production reference`);
    }
    assert(!/['"]popcorn-(?:spin-start|reel-tick|slow-tick|stop|reveal)(?:-v2)?\.wav/.test(js), 'old audio is inactive');
    const motion = {};
    vm.runInNewContext(js.slice(js.indexOf('    var POPCORN_TIMING'), js.indexOf('    function createApp(')) + ';this.phase=popcornPhase;this.timing=POPCORN_TIMING;', motion);
    const speed = t => (motion.phase(t + .1) - motion.phase(t - .1)) / .2;
    assert(speed(10) < speed(100) && speed(100) < speed(199), 'smooth acceleration');
    assert(Math.abs(speed(500) - speed(2000)) < 1e-8, 'constant fast travel');
    assert(speed(2250) > speed(3000) && speed(3000) > speed(3750), 'progressive quartic drag');
    assert(motion.phase(4110) > 39 && motion.phase(4110) < 39.1, 'subtle overshoot');
    assert.equal(motion.phase(4220), 39, 'exact center lock');
    const crossingTimes = [];
    let previous = 0, lastTick = -1000;
    for (let t = 0; t < motion.timing.dragEnd; t += 1000 / 60) {
        const slot = Math.floor(motion.phase(t) + 1e-7);
        if (slot > previous && t-lastTick >= 125) { crossingTimes.push(t); lastTick=t; }
        previous=slot;
    }
    const spacing = crossingTimes.slice(1).map((t,i) => t-crossingTimes[i]);
    assert(spacing.every(t => t >= 125), 'maximum eight crossing ticks per second');
    const actualCrossings = [];
    previous = Math.floor(motion.phase(motion.timing.travelEnd));
    for (let t = motion.timing.travelEnd; t <= motion.timing.dragEnd; t += 1) {
        const slot = Math.floor(motion.phase(t) + 1e-7);
        if (slot > previous) actualCrossings.push(t);
        previous = slot;
    }
    const finalSpacing = actualCrossings.slice(-4).slice(1).map((t, i) => t - actualCrossings.slice(-4)[i]);
    assert(finalSpacing[2] > finalSpacing[1] && finalSpacing[1] > finalSpacing[0], 'final three real center crossings build anticipation');

    for (const count of [0, 1, 50, 500, 1000]) {
        const e = make({items: titles(count)});
        await e.start();
        assert.equal(e.page.attrs['data-skin'], 'classic');
        assert.equal(reelSize(e), 15, `bounded reel with ${count} candidates`);
        assert.equal(e.els.wwPopcornBurst.children.length, 22);
        e.els.wwSkin.value = 'popcorn';
        await e.fire('wwSkin', 'change');
        assert.equal(e.page.attrs['data-skin'], 'popcorn');
        assert.equal(reelSize(e), 15, 'mode switch keeps the fixed reel bound');
        assert.equal(e.requests.filter(x => x.includes('/Items')).length, 1, 'mode switch does not reload');
        if (count === 0) {
            assert(e.els.wwPopcornReel.children.every(box => box.classes.has('wwReelEmpty')), 'empty pool shows no cosmetic contenders');
            assert(e.els.wwSpin.disabled);
            await e.fire('wwSpin');
            assert.equal(e.frames.length, 0);
        } else {
            await e.fire('wwSpin');
            assert(e.els.wwSpin.disabled, 'active spin is locked');
            await e.fire('wwSpin');
            assert.equal(e.frames.length, 1, 'duplicate spin did not start');
            await nextFrame(e, 0);
            assert(e.els.pcwinnerCard.classes.has('wwPopcornPreparing'), 'prepared winner remains invisible');
            assert(e.els.wwSpin.disabled, 'reduced motion still has anticipation');
            await nextFrame(e, 150);
            await nextFrame(e, 510);
            assert(!e.els.pcwinnerCard.classes.has('hidden'));
            assert(e.els.winnerCard.classes.has('hidden'),'Classic card stays hidden');
            assert.equal(e.els.pcwinnerTitle.textContent.startsWith('Movie '), true);
            assert(!e.els.winnerTitle.textContent,'Popcorn does not populate Classic presentation');
            assert.equal(e.els.wwSpin.disabled, false);
        }
    }

    const contenders = make({items: titles(75).map((item, index) => ({
        ...item, CommunityRating: [8.5, 7.5, 6.5, null][index % 4]
    })), reduced: false});
    const thumbnailRequests = [];
    contenders.api.getImageUrl = (id, options) => {
        thumbnailRequests.push({id, width: options.maxWidth});
        return `/Images/${id}?maxWidth=${options.maxWidth}`;
    };
    await contenders.start();
    assert.equal(thumbnailRequests.length, 0, 'Classic mode does not preload hidden Popcorn thumbnails');
    contenders.els.wwSkin.value = 'popcorn';
    await contenders.fire('wwSkin', 'change');
    const slots = [...contenders.els.wwPopcornReel.children];
    const seen = new Set();
    const visibleIds = () => slots.map(box => box.attrs['data-item-id']);
    const recordVisible = () => visibleIds().forEach(id => { if (id) seen.add(id); });
    assert(slots.every(box => box.children.length === 2 && box.attrs['data-item-id']), 'each reusable slot contains a lightweight real candidate');
    assert(slots.every(box => box.children[1].children[1].children[2].textContent.startsWith('Movie ')), 'each slot shows its real title');
    assert.match(html, /<div class="pcMarker" aria-hidden="true"><\/div>/, 'selector is an upward marker below the reel');
    assert.match(css, /\.pcMarker::before\s*\{[^}]*border-bottom:\s*15px solid/, 'selector arrow points upward');
    const itemRequests = contenders.requests.filter(url => url.includes('/Items')).length;
    await contenders.fire('wwSpin');
    for (const now of [0, 1000, 2200, 3000, 4000, 4220]) {
        await nextFrame(contenders, now);
        assert.deepEqual(contenders.els.wwPopcornReel.children, slots, 'spin reuses the same 15 slot nodes');
        assert(visibleIds().every(id => /^title-\d+$/.test(id)), 'every occupied slot maps to an eligible item');
        assert(slots.every(box => box.attrs['data-rarity'] === ['gold', 'red', 'purple', 'blue'][Number(box.attrs['data-item-id'].slice(6)) % 4]),
            'every passing contender keeps its own rating aura');
        recordVisible();
    }
    assert(seen.size > 15 && seen.size < 75, 'virtual travel presents more contenders than DOM slots without loading the full pool');
    assert.equal(contenders.requests.filter(url => url.includes('/Items')).length, itemRequests, 'spin makes no candidate API request');
    assert(thumbnailRequests.some(request => request.width === 160), 'reel uses small poster thumbnails');
    assert(thumbnailRequests.filter(request => request.width === 160).length < 75, 'only near-visible posters are requested');
    const winnerId = 'title-' + contenders.els.pcwinnerTitle.textContent.slice('Movie '.length);
    const center = slots[39 % 15];
    assert.equal(center.attrs['data-item-id'], winnerId, 'locked center contender is the uniformly selected winner');
    assert(center.children[1].children[1].children[1].src.includes(winnerId), 'locked contender shows the selected thumbnail');
    assert(thumbnailRequests.some(request => request.id === winnerId && request.width === 500), 'full-size poster is reserved for the winner scene');
    assert(center.classes.has('wwSelectedBucket'), 'winner retains the center lock treatment');
    for (const offset of [-2, -1, 1, 2]) {
        assert(slots[(39 + offset + 15) % 15].classes.has('wwNeighbor'), 'nearby contenders receive only the secondary lift');
    }
    await nextFrame(contenders, 4370);
    assert(contenders.els.wwPopcornStage.classes.has('wwWon'), 'existing bag burst reveal follows the lock');
    assert(contenders.els.pcwinnerCard.classes.has('wwPopcornWinner'), 'full winner poster and panel remain in the dedicated reveal');

    const prefs = {preferences: {wwGenre: 'Drama', wwWatcher: 'watcher-1', showChoices: false, soundEnabled: false}, history: []};
    const saved = {[key]: JSON.stringify(prefs)};
    const preserved = make({saved});
    preserved.watchers = [{Id: 'watcher-1', Name: 'Viewer'}];
    await preserved.start();
    const genre = preserved.els.wwGenre.value;
    const watcher = preserved.els.wwWatcher.value;
    assert.equal(watcher, 'watcher-1');
    preserved.els.wwSkin.value = 'popcorn';
    await preserved.fire('wwSkin', 'change');
    assert.equal(preserved.els.wwGenre.value, genre);
    assert.equal(preserved.els.wwWatcher.value, watcher);
    assert.equal(preserved.els.wwShowChoices.checked, false);
    assert.equal(preserved.els.wwSound.attrs['aria-pressed'], 'false');
    preserved.els.wwSkin.value = 'classic';
    await preserved.fire('wwSkin', 'change');
    assert.equal(preserved.page.attrs['data-skin'], 'classic');
    assert.equal(preserved.els.wwGenre.value, genre);
    assert.equal(preserved.requests.filter(x => x.includes('/Items')).length, 1);

    const interrupted = make({items: titles(2), reduced: false});
    await interrupted.start();
    interrupted.els.wwSkin.value = 'popcorn';
    await interrupted.fire('wwSkin', 'change');
    assert(interrupted.page.classList.contains('wwThemeChanging'), 'existing transition is used');
    await interrupted.fire('wwSpin');
    await nextFrame(interrupted, 100);
    interrupted.els.wwSkin.value = 'classic';
    await interrupted.fire('wwSkin', 'change');
    while (interrupted.frames.length) await nextFrame(interrupted, 6000);
    assert(interrupted.els.winnerCard.classes.has('hidden'), 'stale spin cannot reveal');
    assert(!interrupted.els.wwSpin.disabled, 'cancellation releases lock');

    const reveal = make({items: titles(1), reduced: false});
    await reveal.start();
    reveal.els.wwSkin.value = 'popcorn';
    await reveal.fire('wwSkin', 'change');
    await reveal.fire('wwSpin');
    // Geometry is sampled during preparation, never during the animation loop.
    reveal.els.wwPopcornStage.getBoundingClientRect = () => { throw Error('layout read in animation'); };
    await nextFrame(reveal, 4220);
    assert(reveal.els.wwPopcornStage.classes.has('wwSettling'));
    assert(reveal.els.pcwinnerCard.classes.has('wwPopcornPreparing'), 'winner waits for anticipation');
    await nextFrame(reveal, 4369);
    assert(reveal.els.pcwinnerCard.classes.has('wwPopcornPreparing'));
    await nextFrame(reveal, 4370);
    assert(reveal.els.wwPopcornStage.classes.has('wwRevealing'));
    assert(!reveal.els.pcwinnerCard.classes.has('hidden'));
    assert(!reveal.audio.some(e => e.url.endsWith('winner-reveal.wav')), 'visual reveal starts before the delayed audio');
    const historyAtBurst = JSON.parse(reveal.saved[key]).history.length;
    await nextFrame(reveal, 4489);
    assert(!reveal.audio.some(e => e.url.endsWith('winner-reveal.wav')), 'reveal cue waits for the full audio offset');
    await nextFrame(reveal, 4490);
    await nextFrame(reveal, 5329);
    assert(reveal.els.pcwwPlay.disabled, 'Popcorn actions locked through their final fade');
    assert.equal(JSON.parse(reveal.saved[key]).history.length, historyAtBurst, 'reveal records once');
    await nextFrame(reveal, 5330);
    assert(!reveal.els.wwPopcornStage.classes.has('wwRevealing'));
    assert(!reveal.els.wwSpin.disabled);
    assert.equal(reveal.frames.length, 0, 'one clock drains completely');
    assert.equal(reveal.audio.filter(e => e.url.endsWith('winner-lock.wav')).length, 1, 'single lock cue');
    assert.equal(reveal.audio.filter(e => e.url.endsWith('winner-reveal.wav')).length, 1, 'single reveal cue');
    assert.equal(reveal.audio.find(e => e.url.endsWith('winner-lock.wav')).time, 4220);
    assert.equal(reveal.audio.find(e => e.url.endsWith('winner-reveal.wav')).time, 4490);

    const repeated = make({items: titles(2), reduced: false}); await repeated.start();
    repeated.els.wwSkin.value='popcorn'; await repeated.fire('wwSkin','change');
    for(let spin=0;spin<5;spin++) {
        await repeated.fire('wwSpin');
        for(let time=0;time<=4350;time+=100) await nextFrame(repeated,time);
        await nextFrame(repeated,4370); await nextFrame(repeated,4490); await nextFrame(repeated,5330);
        assert.equal(reelSize(repeated),15); assert.equal(repeated.els.wwPopcornBurst.children.length,22);
        assert.equal(repeated.frames.length,0);
    }
    assert.equal(repeated.audio.filter(e=>e.url.endsWith('winner-reveal.wav')).length,5,'one flourish per repeated spin');

    const leave = make({items: titles(2), reduced: false}); await leave.start();
    leave.els.wwSkin.value='popcorn'; await leave.fire('wwSkin','change'); await leave.fire('wwSpin');
    await nextFrame(leave,4400); leave.captures.viewhide();
    while(leave.frames.length) await nextFrame(leave,10000);
    assert(leave.els.pcwinnerCard.classes.has('hidden'),'leaving page clears unrevealed pick');
    assert(!leave.audio.some(e=>e.url.endsWith('winner-reveal.wav')),'leaving cannot play delayed flourish');

    for (const time of [100, 3990, 4230, 4400, 4500, 5250]) {
        const e = make({items: titles(2), reduced: false}); await e.start();
        e.els.wwSkin.value='popcorn'; await e.fire('wwSkin','change'); await e.fire('wwSpin');
        await nextFrame(e,time);
        e.els.wwSkin.value='classic'; await e.fire('wwSkin','change');
        while(e.frames.length) await nextFrame(e,10000);
        assert(e.els.pcwinnerCard.classes.has('hidden'), 'interruption clears prepared/revealing winner at '+time);
        if (time < 4490) assert(!e.audio.some(x=>x.url.endsWith('winner-reveal.wav')), 'interrupted spin cannot fire delayed reveal at '+time);
        assert(!e.page.classList.contains('wwPopcornRunning'));
        assert(!e.els.wwSpin.disabled);
    }

    console.log('PASS: real candidates virtualized across 15 slots, thumbnail bounds, center winner and neighboring lift, approved SFX, bag reveal, reduced motion, and interruption cleanup.');
})().catch(error => { console.error(error); process.exit(1); });
