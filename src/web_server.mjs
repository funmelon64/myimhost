import http from 'node:http';
import path from 'node:path';

/** @typedef { (req: IncomingMessage, res: ServerResponse, next: ()=>void) => void } Midware */
/** @typedef { Map<string, Midware[]> } Routes */

export class WebServer {
    /** pairs of <HTTP_Method - Routes>
     * @type { Object<string, Routes> } */
    #routes
    constructor() {
        this.#routes = {
            'GET': new Map(),
            'POST': new Map(),
        };

        this.server = http.createServer((req, res) => {
            try {
                this.#requestListener(req, res);
            }
            catch (err) {
                console.error("RequestListener throw error:\n", err, "\n\nRequest:\n", req);
            }
        });
    }

    /**@param {number} port
     * @param {function(): void} callback
     * @returns {import('node:net').Server} */
    listen(port, callback) {
        return this.server.listen(port, callback);
    }

    /**@param {string} route
     * @param {Midware[]} midwares */
    get(route, midwares) {
        midwares = midwares.filter(el => !!el);
        this.#routes['GET'].set(route, midwares);
    }

    /**@param {string} route
     * @param {Midware[]} midwares */
    post(route, midwares) {
        midwares = midwares.filter(el => !!el);
        this.#routes['POST'].set(route, midwares);
    }

    /**@param {IncomingMessage} req
     * @param {ServerResponse} res */
    #requestListener(req, res) {
        var url = new URL(req.url, `http://${req.headers.host}`);
        var urlPath = url.pathname;

        if (!this.#routes[req.method] === undefined) {
            return res.end('Route not found');
        }

        var routes = [...this.#routes[req.method].keys()];
        var rulePath = getMatchingRoute(urlPath, routes);
        if (!rulePath)
            return res.end('Route not found');

        var midwares = this.#routes[req.method].get(rulePath);
        if (!midwares || !midwares.length)
            return res.end('Route not found');

        req.url = req.url[0] !== '/' ? '/' : req.url;
        req.originalUrl = req.url;
        req.url = getPathRelativeToMidware(rulePath, req.url);

        res.redirect = redirect;

        var midwaresIterator = midwares.values();

        function endConnection() {
            if (!res.writableEnded)
                res.end();
        }

        /** @returns {Promise<boolean>} - last midware is existing */
        async function callLastMidwareAsErrorHandlerAndClose(err) {
            if (midwares[midwares.length-1].length >= 4) {
                midwares[midwares.length - 1](err, req, res, () => {
                    endConnection();
                });
                return true;
            }
            else {
                return false;
            }
        }

        var next = async (err) => {
            if (err) {
                // do we have error-handling middleware at the end of route?
                if (await callLastMidwareAsErrorHandlerAndClose(err)) {
                    return;
                } else {
                    console.error('next(error) from middleware:\n', err);
                    return endConnection();
                }
            }

            var nextIter = midwaresIterator.next();
            if (!nextIter.done) {
                var midware = nextIter.value;
                // if encounter error-handling middleware:
                if (midware.length >= 4) {
                    return endConnection();
                }

                try {
                    await midware(req, res, next);
                }
                catch (err) {
                    console.error(`Middleware ${midware.name} throw error.\nreq:`, req, '\nError:\n', err);
                    return callLastMidwareAsErrorHandlerAndClose(err);
                }
            } else {
                return endConnection();
            }
        }

        next();
    }
}

/**@param {string} url
 * @param {string[]} routes
 * @returns {string | null} */
function getMatchingRoute(url, routes) {
    var urlSplited = url.split(path.posix.sep);

    /** @type { {route: string, length: number}[] } */
    var matchingRoutes = [];

    for (var route of routes) {
        var routeSplited = route.split(path.posix.sep);
        if (routeSplited[routeSplited.length-1] === '')
            routeSplited = routeSplited.slice(0, routeSplited.length-1);

        var isRouteMatching = true;

        for (var i = 0; i < routeSplited.length; i++) {
            var routePathLayer = routeSplited[i];
            var urlPathLayer = urlSplited[i];
            if (routePathLayer !== urlPathLayer) {
                isRouteMatching = false;
                break;
            }
        }

        if (isRouteMatching)
            matchingRoutes.push({ route, length: routeSplited.length });
    }

    if (matchingRoutes.length) {
        matchingRoutes.sort((a,b) => b.length - a.length);
        return matchingRoutes[0].route;
    }

    return null;
}

/** @this {ServerResponse} */
function redirect(url) {
    var message = `Redirecting to <a href="${url}"> ${url} </a>`;
    // redirect
    this.statusCode = 301;
    this.setHeader('Content-Type', 'text/html; charset=UTF-8');
    this.setHeader('Content-Length', Buffer.byteLength(message));
    this.setHeader('Content-Security-Policy', "default-src 'none'");
    this.setHeader('X-Content-Type-Options', 'nosniff');
    this.setHeader('Location', url);
    this.end(message);
}

function getPathRelativeToMidware(midwarePath, path) {
    path = path.slice(midwarePath.length);
    if (path[0] !== '/')
        path = '/' + path;
    return path;
}