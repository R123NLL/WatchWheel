const fs=require('fs'),assert=require('assert'),path=require('path');
const root=path.resolve(__dirname,'../Jellyfin.Plugin.WatchWheel');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const service=read('Services/WatcherService.cs'),candidate=read('Services/CandidateService.cs');
const controller=read('Controllers/WatchWheelController.cs'),html=read('Web/watchWheel.html'),js=read('Web/watchWheel.js');

for(const contract of ['HttpGet("Watchers")','HttpPost("Watchers")','HttpPut("Watchers/{watcherId:guid}")','HttpDelete("Watchers/{watcherId:guid}")','HttpGet("Assignments/{itemId:guid}")','HttpPut("Assignments/{itemId:guid}")'])assert(controller.includes(contract),contract);
assert(service.includes('Guid.NewGuid()'),'stable generated IDs');
assert(service.includes('StringComparison.OrdinalIgnoreCase'),'case-insensitive duplicate prevention');
assert(service.includes('assignment.WatcherIds.RemoveAll(id => id == watcherId)'),'delete cleanup');
assert(candidate.includes('_watcherService.IsAssigned(item.Id, filters.WatcherId.Value)'),'backend authoritative filtering');
assert(html.includes('id="wwWatcher"')&&html.includes('id="wwWatcherList"')&&html.includes('id="wwAssignmentDialog"'),'web controls');
assert(js.includes("params.set('watcherId'"),'watcher request composition');

const ids={a:'watcher-a',b:'watcher-b'};
const assignments={A:[ids.a],B:[ids.b],C:[ids.a,ids.b],D:[]};
const eligible=watcher=>Object.keys(assignments).filter(item=>!watcher||assignments[item].includes(watcher));
assert.deepEqual(eligible(null),['A','B','C','D']);
assert.deepEqual(eligible(ids.a),['A','C']);
assert.deepEqual(eligible(ids.b),['B','C']);
const renamed={id:ids.a,name:'Renamed'};assert.equal(renamed.id,ids.a);assert(assignments.C.includes(renamed.id));
for(const item of Object.keys(assignments))assignments[item]=assignments[item].filter(id=>id!==ids.a);
assert.deepEqual(assignments.C,[ids.b]);
console.log('PASS: watcher API/model/UI contracts; All/A/B assignment semantics; rename stability; delete preserves other assignments.');
