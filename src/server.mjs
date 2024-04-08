import process from 'node:process';
import fsAsync from 'node:fs/promises';
import path from 'node:path';

import 'dotenv/config';

import serveStatic from "serve-static";
import {fileTypeFromBuffer} from 'file-type';

import {WebServer} from "./web_server.mjs";
import {buildAuthMiddleware} from './userauth.mjs';
import {multipartMiddleware} from "./multipart.mjs";

/** @type {number}  */ const PORT = process.env.PORT ? parseInt(process.env.PORT) : 8080;
/** @type {boolean} */ const ENABLE_AUTH = process.env.ENABLE_AUTH ? process.env.ENABLE_AUTH.toLowerCase() !== 'false' : false;
/** @type {string}  */ const USER = process.env.LOGIN ?? 'user';
/** @type {string}  */ const PASS = process.env.PASS ?? 'pass';
/** @type {string}  */ const DATA_DIR = process.env.DATA_DIR ?? './data/';

tryStartApp().then();

async function tryStartApp() {
    if (! await isFileOrDirExists(DATA_DIR)) {
        console.log(`Data folder "${DATA_DIR}" is not exists, creating..`);
        try {
            await fsAsync.mkdir(DATA_DIR);
            console.log(`Folder "${DATA_DIR} created`);
        } catch (e) {
            return console.error(`[ERROR]: data folder "${DATA_DIR}" creating error ( [${e.name}]: ${e.message} )\n===Stack Trace===\n${e.stack}`);
        }
    }

    try {
        var webServer = new WebServer();
        createRoutes(webServer);
        webServer.listen(PORT, () => {
            console.log(`HTTP server started at ${PORT}`);
        }).on('error', (err) => {
            if (err.code === "EADDRINUSE")
                console.error(`[ERROR]: Address with port ${PORT} is already in use`);
            else
                console.error(`[ERROR]: TCP server throws error with code ${err.code}: ${err.message}`);
        });
    } catch (e) {
        return console.error(`[ERROR]: web server startup error ( [${e.name}]: ${e.message} )\n===Stack Trace===\n${e.stack}`);
    }
}

function createRoutes(webServer) {
    var baseAuthMw = ENABLE_AUTH ? buildAuthMiddleware(USER, PASS) : null;

    webServer.get("/upload", [baseAuthMw, serveStatic('./src/public'), errorHandler]);
    webServer.get('/', [redirectToUploadOrNext, serveStatic(DATA_DIR), errorHandler]);

    webServer.post("/upload", [baseAuthMw, multipartMiddleware, uploadRoute, errorHandler]);
}

function redirectToUploadOrNext(req, res, next) {
    if (req.originalUrl === '/')
        return res.redirect('/upload');
    next();
}

function errorHandler(error, req, res, next) {
    res.statusCode = 500;
    res.write("Error: " + error.message);
    res.end();
}

async function uploadRoute(req, res) {
    function closeWithStatus(httpStatus, message) {
        res.statusCode = httpStatus;
        res.write(message);
        res.end();
    }

    /** dir name where will saved uploaded file (max depth = 1) */
    var fileDir = '';
    /** @type {BodyFile} - uploaded file */
    var file;
    /** suffix part of filename, e.g. ".png" */
    var extSuffix = '';
    /** file name with filed will saved on disk */
    var fileName = '';

    // Input getting and checking
    if (!req.files || !req.files.file) {
        return closeWithStatus(400, '"file" parameter is empty');
    }

    file = req.files.file;

    const reqFolder = req.body["folder"];
    const reqName = req.body["name"];
    const reqDontUseExtSuffix = req.body["dont-use-ext"];

    if (reqFolder) {
        if (!isValidFolder(reqFolder))
            return closeWithStatus(400, '"folder" parameter is invalid');

        fileDir = reqFolder;
    }

    if (!isValidFilename(reqName)) {
        return closeWithStatus(400, '"name" filename is invalid');
    }

    if (fileDir !== '') {
        if (! await isFileOrDirExists(path.join(DATA_DIR, fileDir))) {
            await fsAsync.mkdir(path.join(DATA_DIR, fileDir));
        }
    }
    //

    // Determine extension suffix
    if (!reqDontUseExtSuffix) {
        let fileTypeInfo = await fileTypeFromBuffer(file.data);
        if (fileTypeInfo) {
            extSuffix = '.' + fileTypeInfo.ext;
        }
        else if (file.name) {
            extSuffix = path.extname(file.name);
        }
    }
    //

    // Determine name for save with uploaded file
    if (reqName && reqName !== '') {
        fileName = reqName + extSuffix;

        if (await isFileOrDirExists(path.join(DATA_DIR, fileDir, fileName))) {
            return closeWithStatus(400, "File with given name is exists");
        }
    }
    else {
        fileName = await findNotExistedRandomFilename(path.join(DATA_DIR, fileDir), extSuffix);
    }
    //

    // Save file on disk
    await fsAsync.writeFile(path.join(DATA_DIR, fileDir, fileName), file.data);

    // Send url to saved file
    return closeWithStatus(200, path.posix.join('/', fileDir, fileName));
}

/** @returns {string} */
function genRndId(length) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var result = Array(length);
    for (let i = 0; i < length; i++) {
        result[i] = characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result.join('');
}

/** @returns {Promise<boolean>} */
async function isFileOrDirExists(path) {
    try {
        await fsAsync.access(path);
        return true;
    }
    catch (e) {
        if (e.message.includes("no such file or directory")) {
            return false;
        } else {
            console.log("folder/file access error [%s]: [%s]", e.name, e.message);
            throw e;
        }
    }
}

/** @returns {Promise<string>} */
async function findNotExistedRandomFilename(folder, fileExtSuffix) {
    var filenames = await fsAsync.readdir(folder);

    genLoop: while(true) {
        let fileName = genRndId(5) + fileExtSuffix;

        for (var name of filenames) {
            if (name === fileName)
                continue genLoop;
        }

        return fileName;
    }
}

function isValidFolder(str) {
    return ( typeof(str) == 'string' &&
                str.length < 65 &&
                str.match(/\W/gm) == null );
}

function isValidFilename(str) {
    return ( typeof(str) == 'string' &&
                str.length < 65 &&
                str.match(/[^a-zA-Z\d.\-\_]|\.{2,}|^\.|\.$/gm) == null );
}