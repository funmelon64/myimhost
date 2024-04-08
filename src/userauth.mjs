import crypto from "node:crypto";

/**@param {string} login
 * @param {string} pass
 * @param {string} realm="realm"
 * @returns {(req: IncomingMessage, res: ServerResponse, next: ()=>void) => void} */
export function buildAuthMiddleware(login, pass, realm="realm") {
    return (req, res, next) => {
        var creds = getCredentialsFromReq(req);
        if (creds.length > 1) {
            if (validateCredentials(creds, [login, pass]))
                return next();
        }

        res.statusCode = 401;
        res.setHeader('WWW-Authenticate', `Basic realm="${realm}"`);
        res.end('Access denied');
    }
}

var CREDENTIALS_REGEXP = /^ *(?:[Bb][Aa][Ss][Ii][Cc]) +([A-Za-z0-9._~+/-]+=*) *$/
var USER_PASS_REGEXP = /^([^:]*):(.*)$/

function decodeBase64(str) {
    return Buffer.from(str, 'base64').toString()
}

function getCredentialsFromReq(req) {
    if (!req.headers || !req.headers.authorization)
        return [];

    var authStr = req.headers.authorization;
    var match = CREDENTIALS_REGEXP.exec(authStr);
    if (!match)
        return [];

    var creds = USER_PASS_REGEXP.exec(decodeBase64(match[1]));
    if (!creds)
        return [];

    return [creds[1], creds[2]];
}

function validateCredentials(creds1, creds2) {
    if ((creds1[0].length !== creds2[0].length) || (creds1[1].length !== creds2[1].length))
        return false;

    var loginBuf1 = Buffer.from(creds1[0], 'utf-8');
    var passBuf1 = Buffer.from(creds1[1], 'utf-8');
    var loginBuf2 = Buffer.from(creds2[0], 'utf-8');
    var passBuf2 = Buffer.from(creds2[1], 'utf-8');

    return crypto.timingSafeEqual(loginBuf1, loginBuf2) && crypto.timingSafeEqual(passBuf1, passBuf2);
}