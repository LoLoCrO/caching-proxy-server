const http = require('http');
const url = require('url');
const minimist = require('minimist');

const cache = new Map();

const args = minimist(process.argv.slice(2));

const port = args.port;
const origin = args.origin;

if (!port || !origin) {
    console.error('Usage: caching-proxy --port <number> --origin <url>');
    process.exit(1);
}


// not really needed since the cache is in memory which is cleared when the server is restarted
if (args['cache-clear']) {
    cache.clear();
    console.log('Cache cleared');
    process.exit(0);
}

const server = http.createServer((req, res) => {
    const reqUrl = url.parse(req.url).path;
    const cacheKey = `${req.method}:${reqUrl}`;

    if (cache.has(cacheKey) && req.method === 'GET') {
        console.log(`Cache HIT for ${cacheKey}`);

        const cachedResponse = cache.get(cacheKey);
        res.writeHead(cachedResponse.statusCode, {
            ...cachedResponse.headers,
            'X-Cache': 'HIT',
        });

        res.end(cachedResponse.body);
    } else {
        console.log(`Cache MISS for ${cacheKey}`);

        const options = {
            hostname: url.parse(origin).hostname,
            port: url.parse(origin).port || 80,
            path: reqUrl,
            method: req.method,
            headers: {
                ...req.headers,
                host: url.parse(origin).hostname,
            },
        };

        let body = '';
        req.on('data', (chunk) => {
            body += chunk;
        });

        req.on('end', () => {
            const proxyReq = http.request(options, (proxyRes) => {
                let responseBody = '';
                
                
                proxyRes.on('data', (chunk) => {
                    responseBody += chunk;
                });
                
                proxyRes.on('end', () => {
                    if (req.method === 'GET') {
                        cache.set(cacheKey, {
                            statusCode: proxyRes.statusCode,
                            headers: proxyRes.headers,
                            body: responseBody,
                        });
                    }

                    res.writeHead(proxyRes.statusCode, {
                        ...proxyRes.headers,
                        'X-Cache': 'MISS',
                    });

                    res.end(responseBody);
                });
            });

            proxyReq.on('error', (e) => {
                res.writeHead(500);
                res.end('Error connecting to origin');
                console.error(`Error: ${e.message}`);
            });

            if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
                proxyReq.write(body);
            }

            proxyReq.end();
        });

        req.on('error', (e) => {
            res.writeHead(500);
            res.end('Error receiving client request');
            console.error(`Request Error: ${e.message}`);
        });
    }

    console.log(cache);
});

server.listen(port, () => {
    console.log(`Caching server running on port ${port}, forwarding to ${origin}`);
});
