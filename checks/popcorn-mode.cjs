const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {make, tick, html, js} = require('./watchwheel-reliability.cjs');
const vm = require('vm');
const plugin = path.resolve(__dirname, '../Jellyfin.Plugin.WatchWheel');
const css = fs.readFileSync(path.join(plugin, 'Web/watchWheel.css'), 'utf8');
const controller = fs.readFileSync(path.join(plugin, 'Controllers/WatchWheelController.cs'), 'utf8');

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
    const sfx = ['spin-start', 'reel-tick', 'slow-tick', 'stop', 'reveal'].map(x => 'popcorn-' + x + '-v2.wav');
    for (const name of [...art, ...sfx]) {
        assert(fs.statSync(path.join(plugin, 'Web/Assets', name)).size > 300, `${name} is bundled`);
        assert(controller.includes(`"${name}"`), `${name} is served with an explicit MIME type`);
    }
    assert(fs.statSync(path.join(plugin, 'Web/Assets', classicArt)).size > 300, 'Classic atmosphere is bundled');
    assert(controller.includes(`"${classicArt}"`), 'Classic atmosphere is explicitly served');
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
    assert(fs.existsSync(path.join(plugin, 'Web/Assets/README-v2.txt')));
    assert(!/['"]popcorn-(?:spin-start|reel-tick|slow-tick|stop|reveal)\.wav/.test(js), 'old audio is inactive');
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
    const historyAtBurst = JSON.parse(reveal.saved[key]).history.length;
    await nextFrame(reveal, 5329);
    assert(reveal.els.pcwwPlay.disabled, 'Popcorn actions locked through their final fade');
    assert.equal(JSON.parse(reveal.saved[key]).history.length, historyAtBurst, 'reveal records once');
    await nextFrame(reveal, 5330);
    assert(!reveal.els.wwPopcornStage.classes.has('wwRevealing'));
    assert(!reveal.els.wwSpin.disabled);
    assert.equal(reveal.frames.length, 0, 'one clock drains completely');
    assert.equal(reveal.audio.filter(e => e.url.endsWith('popcorn-stop-v2.wav')).length, 1, 'single lock cue');
    assert.equal(reveal.audio.filter(e => e.url.endsWith('popcorn-reveal-v2.wav')).length, 1, 'single reveal cue');
    assert.equal(reveal.audio.find(e => e.url.endsWith('popcorn-stop-v2.wav')).time, 4220);
    assert.equal(reveal.audio.find(e => e.url.endsWith('popcorn-reveal-v2.wav')).time, 4370);

    const repeated = make({items: titles(2), reduced: false}); await repeated.start();
    repeated.els.wwSkin.value='popcorn'; await repeated.fire('wwSkin','change');
    for(let spin=0;spin<5;spin++) {
        await repeated.fire('wwSpin');
        for(let time=0;time<=4350;time+=100) await nextFrame(repeated,time);
        await nextFrame(repeated,4370); await nextFrame(repeated,5330);
        assert.equal(reelSize(repeated),15); assert.equal(repeated.els.wwPopcornBurst.children.length,22);
        assert.equal(repeated.frames.length,0);
    }
    assert.equal(repeated.audio.filter(e=>e.url.endsWith('popcorn-reveal-v2.wav')).length,5,'one flourish per repeated spin');

    const leave = make({items: titles(2), reduced: false}); await leave.start();
    leave.els.wwSkin.value='popcorn'; await leave.fire('wwSkin','change'); await leave.fire('wwSpin');
    await nextFrame(leave,4250); leave.captures.viewhide();
    while(leave.frames.length) await nextFrame(leave,10000);
    assert(leave.els.pcwinnerCard.classes.has('hidden'),'leaving page clears unrevealed pick');
    assert(!leave.audio.some(e=>e.url.endsWith('popcorn-reveal-v2.wav')),'leaving cannot play delayed flourish');

    for (const time of [100, 3990, 4230, 4500, 5250]) {
        const e = make({items: titles(2), reduced: false}); await e.start();
        e.els.wwSkin.value='popcorn'; await e.fire('wwSkin','change'); await e.fire('wwSpin');
        await nextFrame(e,time);
        e.els.wwSkin.value='classic'; await e.fire('wwSkin','change');
        while(e.frames.length) await nextFrame(e,10000);
        assert(e.els.pcwinnerCard.classes.has('hidden'), 'interruption clears prepared/revealing winner at '+time);
        assert(!e.page.classList.contains('wwPopcornRunning'));
        assert(!e.els.wwSpin.disabled);
    }

    console.log('PASS: V2 assets, continuous motion/settle, crossing cadence, 15-box bound, prepared poster, staged reveal/action lock, reduced sequence, single reveal and interruption cleanup.');
})().catch(error => { console.error(error); process.exit(1); });
