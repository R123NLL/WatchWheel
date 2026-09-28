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

const colors = {blue: '36,156,255', purple: '145,71,255', red: '227,38,54', gold: '255,185,31'};
const tiers = Object.keys(colors).map(tier => {
    const block = css.match(new RegExp(`#WatchWheelPage \\[data-rarity="${tier}"\\] \\{([^}]*)\\}`));
    assert(block, `${tier} retains its rarity style`);
    const value = name => {
        const match = block[1].match(new RegExp(`--ww-${name}: ([\\d.]+)`));
        assert(match, `${tier} has ${name}`);
        return Number(match[1]);
    };
    assert(block[1].includes(`--ww-rarity-rgb: ${colors[tier]}`), `${tier} keeps its approved color`);
    return {tier, halo: value('halo-idle'), haloLock: value('halo-lock'),
        under: value('under-idle'), underLock: value('under-lock'), rim: value('rim-alpha')};
});
const crossingBoost = Number(js.match(/--ww-cross-alpha', \(center \* ([\d.]+)\)/)[1]);
assert.match(js, /\[\['0%', '\.88'\], \['48%', '\.42'\], \['100%', '0'\]\]/, 'existing back-halo gradient is brighter');
for (let i = 0; i < tiers.length; i++) {
    const tier = tiers[i];
    assert(tier.halo >= .4 && tier.under >= .42 && tier.rim >= .55, `${tier.tier} remains visible in normal travel`);
    assert(tier.halo + crossingBoost < tier.haloLock, `${tier.tier} halo progresses from travel through crossing to lock`);
    assert(tier.under + crossingBoost < tier.underLock, `${tier.tier} floor glow progresses from travel through crossing to lock`);
    if (i) for (const layer of ['halo', 'under', 'rim']) {
        assert(tier[layer] > tiers[i - 1][layer], `${tier.tier} ${layer} stands above the prior tier`);
    }
}

(async () => {
    const items = [
        {Id: 'gold', Name: 'Gold', Type: 'Movie', CommunityRating: 8.5},
        {Id: 'red', Name: 'Red', Type: 'Movie', CommunityRating: 7.5},
        {Id: 'purple', Name: 'Purple', Type: 'Movie', CommunityRating: 6.5},
        {Id: 'blue', Name: 'Blue', Type: 'Movie', CommunityRating: null}
    ];
    const expectedByName = {Gold: 'gold', Red: 'red', Purple: 'purple', Blue: 'blue'};
    const app = make({items, reduced: false});
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
    const frame = app.frames.shift();
    app.now = 4220; frame(4220);
    const itemById = new Map(items.map(item => [item.Id, item]));
    for (const box of app.els.wwPopcornReel.children) {
        const item = itemById.get(box.attrs['data-item-id']);
        assert(item, 'virtualized rarity bucket maps to a real candidate');
        assert.equal(box.attrs['data-rarity'], helper.tier(item.CommunityRating), 'bucket aura follows its current media identity');
    }
    assert.equal(app.els.wwPopcornReel.children[39 % 15].attrs['data-rarity'], winnerTier, 'center bucket maps to the selected candidate');
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
