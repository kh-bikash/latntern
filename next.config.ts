import type { NextConfig } from 'next';
const config:NextConfig={poweredByHeader:false,outputFileTracingIncludes:{'/api/flight':['./public/flight/terrain/*.json'],'/api/world':['./public/flight/global/airports.json']},async headers(){return [{source:'/:path*',headers:[{key:'X-Content-Type-Options',value:'nosniff'},{key:'Referrer-Policy',value:'strict-origin-when-cross-origin'}]},// live game APIs are never cached; the /api/geo scenery relay sets its own long CDN cache (tiles never change)
 {source:'/api/:path((?!geo/).*)',headers:[{key:'Cache-Control',value:'no-store'},{key:'CDN-Cache-Control',value:'no-store'}]}];}};
export default config;
