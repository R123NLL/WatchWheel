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
    assert.match(html, /class="pcMarker" viewBox="0 0 36 34"[^>]*><path[^>]*d="M18 1 3 14h30L18 1Z"/, 'fixed selector points upward');
    assert.match(css, /\.pcMarker\s*\{[^}]*bottom:\s*-17px;[^}]*width:\s*36px;[^}]*height:\s*34px/s, 'selector sits below center within the existing stage-to-button gap');
    assert.match(css, /\.wwWon \.pcMarker\s*\{\s*opacity:\s*\.4;/, 'selector dims after reveal');
    assert.match(css, /\.wwRarityHalo\s*\{[^}]*var\(--ww-halo-idle\)[^}]*var\(--ww-cross-alpha\)/s, 'rarity remains visible away from crossings');
    assert.match(css, /\.wwPopcornBucketArt\s*\{[^}]*drop-shadow\(0 0 9px rgba\(var\(--ww-rarity-rgb\)/s, 'bucket rim carries the persistent rarity color');
    assert.match(css, /\.wwPopcornBox\.wwNearbyLoser\s*\{\s*--ww-neighbor-y:\s*-8px;\s*opacity:\s*\.4;/, 'nearby losers get only a small lift and reduced emphasis');
    assert.match(css, /\.wwSelectedBucket \.wwRarityHalo\s*\{\s*opacity:\s*var\(--ww-halo-lock\)/, 'winner gets the strongest rarity treatment');
    assert.match(css, /\.wwPopcornBucketArt\s*\{\s*position:\s*absolute;\s*z-index:\s*3;/, 'existing bucket art remains in front of its poster');
    assert.match(css, /\.wwReelPoster\s*\{\s*position:\s*absolute;\s*z-index:\s*2;/, 'reel poster stays inside the bucket presentation');
    assert.match(css, /\.wwWon \.wwPopcornBox\.wwNearbyLoser \.wwReelPoster\s*\{\s*--ww-poster-rise:\s*-55%;/, 'nearby losers receive the moderate poster rise');
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

    const rich = make({items: titles(70), reduced: false});
    const imageUrls = [];
    rich.api.getImageUrl = (id, options) => {
        imageUrls.push({id, options});
        return `/image/${id}/${options.maxWidth}`;
    };
    await rich.start();
    assert.equal(imageUrls.length, 0, 'hidden Popcorn reel does not load thumbnails in Classic mode');
    rich.els.wwSkin.value = 'popcorn'; await rich.fire('wwSkin', 'change');
    const richBoxes = rich.els.wwPopcornReel.children;
    assert.equal(richBoxes.length, 15, 'large pool reuses the same fifteen buckets');
    assert(richBoxes.every(box => box.children.length === 3 && box.children[2].className === 'wwPopcornBucketArt'), 'poster is an added child behind existing bucket art');
    assert.equal(imageUrls.length, 15, 'only initial visible/near-visible thumbnails are requested');
    const image = richBoxes[0].children[1].children[1];
    assert.equal(richBoxes[0].children[1].children[0].textContent, '✦', 'neutral fallback exists inside every bucket');
    image.onload(); assert(richBoxes[0].classes.has('wwPosterReady'), 'loaded thumbnail becomes visible');
    image.onerror(); assert(!richBoxes[0].classes.has('wwPosterReady'), 'missing artwork returns to neutral fallback');
    const candidateRequests = rich.requests.filter(x => x.includes('/Items')).length;
    await rich.fire('wwSpin');
    const winnerId = `title-${rich.els.pcwinnerTitle.textContent.split(' ').at(-1)}`;
    const seen = new Set();
    let staleImageLoad, staleImageId;
    for (const time of [0, 600, 1200, 2000, 3000, 3900, 4220]) {
        await nextFrame(rich, time);
        richBoxes.forEach(box => seen.add(box.attrs['data-item-id']));
        if (time === 0) {
            staleImageLoad = richBoxes[0].children[1].children[1].onload;
            staleImageId = richBoxes[0].attrs['data-item-id'];
        }
        if (time === 3000) {
            assert.notEqual(richBoxes[0].attrs['data-item-id'], staleImageId, 'offscreen slot is recycled to another real candidate');
            staleImageLoad();
            assert(!richBoxes[0].classes.has('wwPosterReady'), 'late load cannot display a recycled candidate poster');
        }
    }
    assert(seen.size > 15, 'recycled slots show more real candidates than the DOM count');
    assert.equal(richBoxes[9].attrs['data-item-id'], winnerId, 'final center bucket is the full-pool selected winner');
    assert(richBoxes.every(box => box.attrs['data-item-id'].startsWith('title-')), 'every reel slot maps to an eligible item');
    assert.equal(rich.requests.filter(x => x.includes('/Items')).length, candidateRequests, 'spin makes no additional candidate API fetch');
    const thumbs = imageUrls.filter(entry => entry.options.maxWidth === 160);
    assert(thumbs.length <= 69 && thumbs.every(entry => entry.options.maxHeight === 240 && entry.options.quality === 65), 'only bounded modest thumbnails load during the spin');
    assert.equal(imageUrls.filter(entry => entry.options.maxWidth === 500).length, 1, 'full-size artwork remains winner-only');
    await nextFrame(rich, 4370);
    assert.equal(richBoxes.filter(box => box.classes.has('wwSelectedBucket')).length, 1, 'only winner bucket is selected for pop');
    assert(richBoxes[8].classes.has('wwNearbyLoser') && !richBoxes[8].classes.has('wwSelectedBucket'), 'near loser only receives secondary poster treatment');
    await nextFrame(rich, 4490); await nextFrame(rich, 5330);
    assert.equal(rich.audio.filter(entry => entry.url.endsWith('winner-reveal.wav')).length, 1, 'non-winner poster rises add no reveal audio');
    await rich.fire('wwApplyFilters');
    assert(!rich.els.wwPopcornStage.classes.has('wwWon'), 'Refresh clears the prior poster reveal state');
    assert(richBoxes.every(box => !box.classes.has('wwNearbyLoser')), 'Refresh clears loser positions');
    await rich.fire('wwSpin');
    assert(!rich.els.wwPopcornStage.classes.has('wwWon'), 'Spin Again starts with posters lowered');
    rich.els.wwSkin.value = 'classic'; await rich.fire('wwSkin', 'change');
    assert(richBoxes.every(box => !box.classes.has('wwPosterReady') && !box.classes.has('wwNearbyLoser')), 'mode switch clears poster and loser state');
    assert(richBoxes.every(box => box.children[1].children[1].src === undefined), 'mode switch clears thumbnail sources');

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
    await nextFrame(reveal, 0);
    const travelBoxes = reveal.els.wwPopcornReel.children;
    assert(travelBoxes.every(box => box.attrs['data-rarity'] === 'blue'), 'every travel bucket retains its mapped rarity');
    assert(travelBoxes.some(box => Number(box.style['--ww-cross-alpha']) === 0), 'off-center rarity uses its persistent idle intensity');
    assert(travelBoxes.some(box => Number(box.style['--ww-cross-alpha']) > 0), 'center crossing increases rarity intensity');
    assert(travelBoxes.every(box => !box.classes.has('wwNearbyLoser')), 'loser lift waits for the lock');
    // Geometry is sampled during preparation, never during the animation loop.
    reveal.els.wwPopcornStage.getBoundingClientRect = () => { throw Error('layout read in animation'); };
    await nextFrame(reveal, 4220);
    assert(reveal.els.wwPopcornStage.classes.has('wwSettling'));
    const lockedBoxes = reveal.els.wwPopcornReel.children;
    assert(lockedBoxes.every(box => box.children.length === 3), 'bounded reel keeps bucket art, aura, and an internal poster');
    assert(lockedBoxes[9].classes.has('wwSelectedBucket'), 'winner alone owns the selected bucket');
    for (const i of [7, 8, 10, 11]) assert(lockedBoxes[i].classes.has('wwNearbyLoser'), `nearby loser ${i} acknowledges lock`);
    assert.equal(lockedBoxes.filter(box => box.classes.has('wwNearbyLoser')).length, 4, 'only four neighbors lift');
    assert(reveal.els.pcwinnerCard.classes.has('wwPopcornPreparing'), 'winner waits for anticipation');
    await nextFrame(reveal, 4369);
    assert(reveal.els.pcwinnerCard.classes.has('wwPopcornPreparing'));
    await nextFrame(reveal, 4370);
    assert(reveal.els.wwPopcornStage.classes.has('wwRevealing'));
    assert(lockedBoxes[8].classes.has('wwNearbyLoser'), 'losers remain visible during the bag-pop reveal');
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
        assert(repeated.els.wwPopcornReel.children.every(box => !box.classes.has('wwNearbyLoser')), 'new spin clears previous loser lift');
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
        assert(e.els.wwPopcornReel.children.every(box => !box.classes.has('wwNearbyLoser')), 'interruption clears loser lift at '+time);
        if (time < 4490) assert(!e.audio.some(x=>x.url.endsWith('winner-reveal.wav')), 'interrupted spin cannot fire delayed reveal at '+time);
        assert(!e.page.classList.contains('wwPopcornRunning'));
        assert(!e.els.wwSpin.disabled);
    }

    console.log('PASS: approved SFX, continuous motion, 15-bucket virtual media reel, thumbnail fallback/recycling, existing winner reveal, silent loser posters, reduced sequence and interruption cleanup.');
})().catch(error => { console.error(error); process.exit(1); });
