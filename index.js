const http = require('http');
const https = require('https');
const url = require('url');
const minimist = require('minimist');
const zlib = require('zlib');

const cache = new Map();

const args = minimist(process.argv.slice(2));

const port = args.port;
const origin = args.origin;

if (!port || !origin) {
    console.error('Usage: caching-proxy --port <number> --origin <url>');
    process.exit(1);
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

        const parsedOrigin = url.parse(origin);
        const isHttps = parsedOrigin.protocol === 'https:';
        const protocol = isHttps ? https : http;

        const options = {
            hostname: parsedOrigin.hostname,
            port: parsedOrigin.port || (isHttps ? 443 : 80),
            path: reqUrl,
            method: req.method,
            headers: {
                ...req.headers,
                host: parsedOrigin.hostname,
            },
        };

        let body = '';
        req.on('data', (chunk) => {
            body += chunk;
        });

        req.on('end', () => {
            const proxyReq = protocol.request(options, (proxyRes) => {
                const encoding = proxyRes.headers['content-encoding'];
                let responseStream = proxyRes;

                if (encoding === 'gzip') {
                    responseStream = proxyRes.pipe(zlib.createGunzip());
                } else if (encoding === 'deflate') {
                    responseStream = proxyRes.pipe(zlib.createInflate());
                }

                let responseBody = '';
                responseStream.on('data', (chunk) => {
                    responseBody += chunk;
                });

                responseStream.on('end', () => {
                    const headers = { ...proxyRes.headers };
                    delete headers['content-encoding'];

                    if (req.method === 'GET') {
                        cache.set(cacheKey, {
                            statusCode: proxyRes.statusCode,
                            headers: headers,
                            body: responseBody,
                        });
                    }

                    res.writeHead(proxyRes.statusCode, {
                        ...headers,
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

    // Uncomment to see cached body contents
    // cache.forEach((value, _key) => {
    //     console.log(JSON.parse(value.body));
    // });
});

server.listen(port, () => {
    console.log(`Caching server running on port ${port}, forwarding to ${origin}`);
});
