const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const {make} = require('./watchwheel-reliability.cjs');

const web = path.resolve(__dirname, '../Jellyfin.Plugin.WatchWheel/Web');
const js = fs.readFileSync(path.join(web, 'watchWheel.js'), 'utf8');
const css = fs.readFileSync(path.join(web, 'watchWheel.css'), 'utf8');
const helper = {};
vm.runInNewContext(
    js.slice(js.indexOf('    function getPopcornRarityTier('), js.indexOf('    function popcornPhase('))
        + ';this.tier=getPopcornRarityTier;',
    helper
);

const cases = [
    [8.5, 'gold'], [10, 'gold'],
    [8.4999, 'red'], [7.5, 'red'],
    [7.4999, 'purple'], [6.5, 'purple'],
    [6.4999, 'blue'], [0, 'blue'],
    [null, 'blue'], [undefined, 'blue'], [NaN, 'blue'], ['invalid', 'blue']
];
for (const [rating, expected] of cases) {
    assert.equal(helper.tier(rating), expected, `rating ${String(rating)} is ${expected}`);
}

(async () => {
    const items = [
        {Id: 'gold', Name: 'Gold', Type: 'Movie', CommunityRating: 8.5},
        {Id: 'red', Name: 'Red', Type: 'Movie', CommunityRating: 7.5},
        {Id: 'purple', Name: 'Purple', Type: 'Movie', CommunityRating: 6.5},
        {Id: 'blue', Name: 'Blue', Type: 'Movie', CommunityRating: null}
    ];
    const expectedByName = {Gold: 'gold', Red: 'red', Purple: 'purple', Blue: 'blue'};
    const app = make({items});
    await app.start();
    assert.equal(app.els.wwPopcornReel.children.length, 15, 'rarity reel stays bounded');
    const actualTiers = app.els.wwPopcornReel.children.map(box => box.attrs['data-rarity']);
    assert(actualTiers.every(tier => ['gold', 'red', 'purple', 'blue'].includes(tier)), 'all reel auras come from real candidate ratings');
    assert.deepEqual([...new Set(actualTiers)].sort(), ['blue', 'gold', 'purple', 'red'], 'idle reel derives every visible tier from candidate data');
    app.els.wwSkin.value = 'popcorn';
    await app.fire('wwSkin', 'change');
    const requestsBeforeSpin = app.requests.length;
    await app.fire('wwSpin');
    const winnerTier = expectedByName[app.els.pcwinnerTitle.textContent];
    assert(winnerTier, 'spin exposes the already-selected real candidate');
    app.frames.shift()(0);
    assert.equal(app.els.wwPopcornReel.children[39 % 15].attrs['data-rarity'], winnerTier, 'center bucket maps to the selected candidate');
    assert.equal(app.els.wwPopcornReel.children[39 % 15].attrs['data-item-id'], app.els.pcwinnerPoster.alt.toLowerCase(), 'locked center slot is the selected item');
    assert.equal(app.els.pcwinnerCard.attrs['data-rarity'], winnerTier, 'winner scene carries the selected rarity');
    assert.equal(app.els.wwPopcornStage.attrs['data-rarity'], winnerTier, 'stage carries the selected rarity');
    assert.equal(app.requests.length, requestsBeforeSpin, 'rarity presentation makes no API request');

    assert.match(js, /var index = Math\.floor\(Math\.random\(\) \* state\.items\.length\);\s*var winner = state\.items\[index\];/, 'uniform winner selection remains unchanged');
    assert.match(js, /document\.createElementNS\([^)]*'svg'\)/, 'aura uses a real SVG layer');
    assert.match(css, /\.wwPopcornBucketArt\s*\{[^}]*popcorn-vector\.svg/s, 'bucket artwork remains the existing vector');
    assert.match(css, /\.wwRarityAura\s*\{[^}]*pointer-events:\s*none/s, 'aura is decorative only');
    assert.match(css, /prefers-reduced-motion:reduce[\s\S]*\.wwPopcornBucketArt\s*\{[^}]*transform:\s*none[^}]*transition:\s*none/, 'reduced motion keeps rarity color while disabling the crossing scale pulse');
    assert.match(css, /\.wwRarityHalo\s*\{[^}]*stroke:\s*none/s, 'soft halo has no hard circular ring');
    assert.match(css, /@media \(max-width:640px\)[\s\S]*\.wwRarityAura\s*\{[^}]*width:\s*104%/s, 'narrow layouts tighten the reusable aura');
    console.log('PASS: exact CommunityRating rarity boundaries, real-candidate reel mapping, selected-winner continuity, bounded DOM, no rarity requests, and unchanged uniform selection.');
})().catch(error => { console.error(error); process.exit(1); });
