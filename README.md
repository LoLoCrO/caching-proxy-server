# Caching-proxy-server
Caching server that caches responses from other servers
Sample for [Caching Proxy](https://roadmap.sh/projects/caching-server) from [roadmap.sh](https://roadmap.sh/)

## Usage
This app only caches `GET` responses to avoid caching data-modifying requests like `POST`

### Start/Run server
inside project run:
```bash
# node index.js --port <number> --origin <url>
node index.js --port 3000 --origin http://dummyjson.com
```

### Test
in another terminal window run:
```bash
curl "http://localhost:3000/products/1"
```

or target that endpoint in Postman.
```yaml
localhost:3000/products/1
```

You can use other port or origin to your linking.
DummyJSON is use here because it provides documented endpoints for testing.
[Link](https://dummyjson.com/docs/products#products-all) for DummyJSON endpoint docs used.