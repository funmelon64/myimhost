import busboy from "busboy";

/** @typedef {Record<string, string>} BodyFields */
/** @typedef { {name: string, data: Buffer, mimetype: string} } BodyFile */
/** @typedef {Record<string, BodyFile>} BodyFiles */

/** Mixins to req: .body: {@link BodyFields}, .files: {@link BodyFiles}
 * @param {IncomingMessage} req
 * @param {ServerResponse} res
 * @param {(error: any=undefined)=>void} next */
export function multipartMiddleware(req, res, next) {
    var contType = req.headers ? req.headers["content-type"] : undefined;
    if (!contType || !contType.includes("multipart/form-data"))
        return next();

    var reqBody = {};
    var reqFiles = {};

    var bb = busboy({ headers: req.headers });
    bb.on('file', (name, file, info) => {
        var { fileName, encoding, mimeType } = info;
        var fileChunks = [];
        file.on('data', (data) => {
            fileChunks.push(data);
        });
        file.on('end', () => {
            var buffer = Buffer.concat(fileChunks);
            reqFiles[name] = { name: fileName, data: buffer, mimetype: mimeType };
        })
    });

    bb.on('field', (name, value, info) => {
        reqBody[name] = value;
    });

    // bb will only close, when all data (incl. files) has been received and fired 'end' event
    bb.on('close', () => {
        req.body = reqBody;
        req.files = reqFiles;
        next();
    });

    req.pipe(bb);
}