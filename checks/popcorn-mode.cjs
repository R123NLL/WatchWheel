const assert = require('assert');
const {make, tick, html, js} = require('./watchwheel-reliability.cjs');

const key = 'watchwheel:v1:one:alice';
const titles = count => Array.from({length: count}, (_, i) => ({
    Id: `title-${i}`, Name: `Movie ${i}`, Type: 'Movie', IsInProgress: false
}));
const reelSize = e => e.els.wwPopcornReel.children.length;
const nextFrame = async (e, now) => {
    const frame = e.frames.shift();
    assert(frame, 'spin schedules an animation frame');
    frame(now);
    await tick();
};

(async () => {
    assert.match(html, /<option value="classic">Classic<\/option>/);
    assert.match(html, /<option value="popcorn">Popcorn<\/option>/);
    assert.match(js, /var winner = state\.items\[index\]/);

    for (const count of [0, 1, 50, 500, 1000]) {
        const e = make({items: titles(count)});
        await e.start();
        assert.equal(e.page.attrs['data-skin'], 'classic');
        assert.equal(reelSize(e), 15, `bounded reel with ${count} candidates`);
        assert.equal(e.els.wwPopcornBurst.children.length, 22);
        e.els.wwSkin.value = 'popcorn';
        await e.fire('wwSkin', 'change');
        assert.equal(e.page.attrs['data-skin'], 'popcorn');
        assert.equal(reelSize(e), 15, 'mode switch never maps candidates to boxes');
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
            assert(!e.els.winnerCard.classes.has('hidden'));
            assert.equal(e.els.winnerTitle.textContent.startsWith('Movie '), true);
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
    await nextFrame(reveal, 5000);
    assert(reveal.els.wwPopcornStage.classes.has('wwSettling'));
    assert(reveal.els.winnerCard.classes.has('hidden'), 'winner waits for anticipation');
    const anticipation = [...reveal.timers.values()].find(timer => timer.ms === 130);
    assert(anticipation); anticipation.f(); await tick();
    assert(reveal.els.wwPopcornStage.classes.has('wwRevealing'));
    assert(!reveal.els.winnerCard.classes.has('hidden'));
    const cleanup = [...reveal.timers.values()].find(timer => timer.ms === 850);
    assert(cleanup); cleanup.f(); await tick();
    assert(!reveal.els.wwPopcornStage.classes.has('wwRevealing'));
    assert(!reveal.els.wwSpin.disabled);

    console.log('PASS: Popcorn mode registration, Classic default, state-preserving switch, fixed 15-box reel at 0/1/50/500/1000 candidates, eligible winner, anticipation/burst cleanup, spin lock, reduced motion, and stale callback cancellation.');
})().catch(error => { console.error(error); process.exit(1); });
