import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(process.env.MPMS_STATIC_DIR??'out');const port=Number(process.env.MPMS_PREVIEW_PORT??3000);
if(!fs.existsSync(path.join(root,'index.html')))throw new Error('먼저 npm.cmd run build를 실행하세요.');
const builtBase=fs.readFileSync(path.join(root,'index.html'),'utf8').match(/href="([^"]*)\/_next\/static\//)?.[1]??'';
const base=process.env.NEXT_PUBLIC_BASE_PATH??builtBase;
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.json':'application/json','.png':'image/png','.ico':'image/x-icon','.woff2':'font/woff2'};
http.createServer((req,res)=>{
 let url;try{url=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400).end();return;}
 if(base&&url.startsWith(`${base}/`))url=url.slice(base.length);
 const file=path.resolve(root,`.${url.endsWith('/')?`${url}index.html`:url}`);
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end('Not found');return;}
 res.writeHead(200,{'Content-Type':mime[path.extname(file)]??'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':'no-store'});fs.createReadStream(file).pipe(res);
}).listen(port,'127.0.0.1',()=>console.log(`소통해용: http://127.0.0.1:${port}${base}/`));
