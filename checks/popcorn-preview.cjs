// Local motion review using the actual app/CSS and a single synthetic candidate.
// Run: node checks/popcorn-preview.cjs, then http://127.0.0.1:8787/web/
const http = require('http'), fs = require('fs'), path = require('path');
const web = path.resolve(__dirname, '../Jellyfin.Plugin.WatchWheel/Web');
const boot = `<style>body{margin:0;background:#080a12;font-family:Arial,sans-serif}</style><script>
const candidate={Id:'motion-review',Name:'Motion review',Type:'Movie',Year:2026,Overview:'A local choreography preview.',Genres:['Adventure']};
window.ApiClient={serverId:()=> 'preview',getCurrentUserId:()=> 'preview',getUrl:p=>'/'+p,getImageUrl:()=>'/poster.svg',getJSON:async p=>p.includes('Filters')?{Genres:[],Years:[],Decades:[],Libraries:[]}:p.includes('Watchers')?{Watchers:[]}:{Items:[candidate]}};
localStorage.setItem('watchwheel:v1:preview:preview',JSON.stringify({preferences:{skin:'popcorn',showChoices:false,soundEnabled:false},history:[]}));
</script>`;
http.createServer((req,res)=>{
    const url = new URL(req.url,'http://127.0.0.1');
    let file;
    if(url.pathname==='/web/' || url.pathname==='/') {
        res.setHeader('Content-Type','text/html');
        return res.end(fs.readFileSync(path.join(web,'watchWheel.html'),'utf8').replace('</head>',boot+'</head>'));
    }
    if(url.pathname==='/poster.svg') {
        res.setHeader('Content-Type','image/svg+xml');
        return res.end('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="#205387"/><stop offset="1" stop-color="#f99e44"/></linearGradient></defs><path fill="url(#g)" d="M0 0h400v600H0z"/><circle cx="200" cy="230" r="110" fill="#ffe8ad"/><text x="200" y="460" font-size="35" font-family="sans-serif" text-anchor="middle" fill="white">MOTION REVIEW</text></svg>');
    }
    if(url.pathname==='/web/configurationpage') {
        const names={'watchWheel.js':'watchWheel.js','watchWheel.css':'watchWheel.css'};
        file=names[url.searchParams.get('name')];
    } else if(url.pathname.startsWith('/WatchWheel/Assets/')) {
        const name=path.basename(url.pathname);
        if(/^[a-z0-9_-]+\.(png|wav|svg)$/.test(name))file='Assets/'+name;
    }
    if(!file || !fs.existsSync(path.join(web,file))){res.writeHead(404);return res.end();}
    res.setHeader('Content-Type',file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript':file.endsWith('.png')?'image/png':file.endsWith('.svg')?'image/svg+xml':'audio/wav');
    fs.createReadStream(path.join(web,file)).pipe(res);
}).listen(8787,'127.0.0.1',()=>console.log('Motion preview: http://127.0.0.1:8787/web/'));
