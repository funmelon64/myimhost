import http from 'node:http';

class WebServer {
    constructor() {
        this.server = http.createServer((req, res) => {
            
        });
    }

    /**
     * @param {number} port
     * @param {function(): void} callback
     */
    listen(port, callback) {
        this.server.listen(port, callback);
    }
}