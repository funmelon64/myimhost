import process from 'node:process';
import 'dotenv/config';

const PORT = process.env.PORT;
const ENABLE_AUTH = process.env.ENABLE_AUTH;
const USER = process.env.USER;
const PASS = process.env.PASS;
const DATA_DIR = process.env.DATA_DIR;

import {WebServer} from "./web_server.mjs";
import {buildAuthMidware} from './userauth.mjs';
import {multipartMidware} from "./multipart.mjs";

import serveStatic from "serve-static";

import {fileTypeFromBuffer} from 'file-type';

import fsAsync from 'node:fs/promises';
import path from 'node:path';

appStart().then();

// ========= FUNCTION DECLARATIONS:

async function appStart() {
    try {
        await fsAsync.access(DATA_DIR);
    } catch (e) {
        if (e.message.includes("no such file or directory")) {
            console.error("[ERROR]: data folder is not exists");
        } else {
            console.error("[ERROR]: data folder access error [%s]: [%s]", e.name, e.message);
        }
        return;
    }

    var webServer = new WebServer();
    createWebserverRoutes(webServer);
    webServer.listen(PORT, () => {
        console.log(`Server started...`);
    });
}

function createWebserverRoutes(webServer) {
    var htAuth = ENABLE_AUTH ? buildAuthMidware(USER, PASS) : null;

    webServer.get("/upload", [htAuth, serveStatic("./public")]);
    webServer.get('/', [redirectToUploadOrNext, serveStatic(DATA_DIR)]);

    webServer.post("/upload", [htAuth, multipartMidware, uploadFilesRoute]);
}

function redirectToUploadOrNext(req, res, next) {
    if (req.originalUrl === '/')
        return res.redirect('/upload');

    next();
}

async function uploadFilesRoute(req, res) {
    function HTTPResponse(httpErrCode, message) {
        this.code = httpErrCode;
        this.message = message;
        return this;
    }

    try {
        // Input getting and checking
        if (!req.files || !req.files.file) {
            throw new HTTPResponse(400, 'File in parameter "file" not attached');
        }

        let file = req.files.file;

        const reqFolder = req.body["folder"];
        const reqName = req.body["name"];
        const reqDontUseExt = req.body["dont-use-ext"];

        var fileDir = '';
        
        if (reqFolder) {
            if (!isValidFolder(reqFolder))
                throw new HTTPResponse(400, '"folder" parameter is not valid');
            
            fileDir = reqFolder;
        }

        if (!isValidFilename(reqName)) {
            res.write("Filename is not valid");
            res.statusCode = 400;
            res.end();
            return;
        }
        //

        // Checking the folder specified by user is existing
        if (fileDir !== '') {
            // todo: duplicate of action above, that i wasn't fixed
            if (! await isFileExists(path.join(DATA_DIR, fileDir))) {
                await fsAsync.mkdir(path.join(DATA_DIR, fileDir));
            }
        }
        //

        // Specifying extension suffix
        let extSuffix = '';

        if (reqDontUseExt === 'false') {
            let fileTypeInfo = await fileTypeFromBuffer(file.data);
            if (fileTypeInfo) {
                extSuffix = '.' + fileTypeInfo.ext;
            }
            else if (file.name) {
                extSuffix = path.extname(file.name);
            }
        }
        //

        // Specifying filename
        var fileName = reqName;

        if (fileName && fileName !== '') {
            fileName = fileName + extSuffix;

            if (await isFileExists(path.join(DATA_DIR, fileDir, fileName))) {
                throw new HTTPResponse(400, "File with given name is exists");
            }
        }
        else {
            fileName = await getNotExistedRandomFilename(path.join(DATA_DIR, fileDir), extSuffix);
        }
        //

        // Saving file
        await fsAsync.writeFile(path.join(DATA_DIR, fileDir, fileName), file.data);
        //

        // Sending path to saved file
        throw new HTTPResponse(200, path.posix.join('/', fileDir, fileName));
        //
    }
    catch (e) {
        if (e instanceof HTTPResponse) {
            res.write(e.message);
            res.statusCode = e.code;
            res.end();
        }
        else {
            console.error("[uploadFileRoute]:\n", e);
            res.write("[Unexpected error]: " + e.message);
            res.statusCode = 500;
            res.end();
        }
    }
}

function makeId(length) {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    let counter = 0;
    while (counter < length) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
        counter += 1;
    }
    return result;
}

async function isFileExists(path) {
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

async function getNotExistedRandomFilename(folder, fileExtSuffix) {
    folder = './' + folder;

    var filenames = await fsAsync.readdir(folder);

    while(true) {
        let randomName = makeId(5) + fileExtSuffix;
        var isFound = false;

        for (var name of filenames) {
            if (name === randomName) {
                isFound = true;
                break;
            }
        }

        if (!isFound)
            return randomName;
    }
}

function isValidFolder(str) {
    return  (typeof(str) == 'string' &&
        str.length < 65 &&
        str.match(/\W/gm) == null);
}

function isValidFilename(str) {
    return  (typeof(str) == 'string' &&
        str.length < 65 &&
        str.match(/[^a-zA-Z\d.\-\_]|\.{2,}/gm) == null);
}