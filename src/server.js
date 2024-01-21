const PORT = 8081;
const ENABLE_AUTH = false;
const USER = 'morph';
const PASS = 'ss1488228';
const DATA_DIR = "./data/"; // must be with slash at the end and be absolute path in your's system FS

import {access, mkdir, opendir} from 'fs/promises';
import {fileTypeFromBuffer} from 'file-type';

import express from 'express';
import fileUpload from 'express-fileupload';
import basicAuth from 'express-basic-auth';

// HTTP authorizer
var htAuth = (req, res, next) => next();
if (ENABLE_AUTH) {
    htAuth = basicAuth( { authorizer: httpAuthorizer, challenge: true } );

    function httpAuthorizer(user, pass) {
        const userMatches = basicAuth.safeCompare(user, USER);
        const passwordMatches = basicAuth.safeCompare(pass, PASS);

        return userMatches & passwordMatches;
    }
}
// \HTTP authorizer

async function ProgInit() {
    if (DATA_DIR[DATA_DIR.length-1] != '/') {
        console.log('[ERROR]: Please specify DATA_DIR with slash at the end.');
        return;
    }

    try {
        await access(DATA_DIR);
    } catch (e) {
        if (e.message.includes("no such file or directory")) {
            try {
                await mkdir(DATA_DIR);
            } catch (e) {
                console.error("Creating data folder error [%s]: [%s]", e.name, e.message);
                return;
            }
        } else {
            console.log("data folder access error [%s]: [%s]", e.name, e.message);
            return;
        }
    }

    let expressApp = express();
    CreateExpressRoutes(expressApp);
    expressApp.listen(PORT, () => {
        console.log(`Server started...`);
    });
}

ProgInit();

// ========= <DEFINES>:

function CreateExpressRoutes(app) {
    app.use("/upload", htAuth, express.static(("./public")));
    app.use('/', redirectToUploadOrNext, express.static(DATA_DIR));
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    app.use(fileUpload({
        //limits: { fileSize: 50 * 1024 * 1024 },
        useTempFiles: false,
    }));

    app.post("/upload", htAuth, uploadFiles);
}

function redirectToUploadOrNext(req, res, next) {
    if (req.originalUrl == '/') {
        res.redirect('/upload');
        return;
    }

    next();
}

function makeid(length) {
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
        await access(path);
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

async function getNotExistedRandomFilename(folder, fileSuffix) {
    folder = './' + folder;

    while(true) {
        let randomName = makeid(5) + fileSuffix;

        try {
            const dir = await opendir(folder);
            for await (const dirent of dir) {
                if (dirent.name == randomName) {
                    continue;
                }
            }
        } catch (err) {
            console.log("Folder iteration error: ", err);
        }

        return randomName;
    }
}

async function uploadFiles(req, res) {
    try {
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

        if (!req.files) { 
            res.send("No files found");
            res.status(400).end();
            return;
        }

        const reqFolder = req.body["folder"];
        const reqName = req.body["name"];
        const reqNotUseExt = req.body["dont-use-ext"];
        
        let file = req.files.file;
        if (!file) {
            res.send("File not attached");
            res.status(400).end();
            return;
        }

        let fileDir = '';
        if (reqFolder) {
            if (!isValidFolder(reqFolder)) {
                res.send("Folder is not valid");
                res.status(400).end();
                return;
            }
            fileDir = reqFolder;
        }

        // Checking the folder existing specified by the user
        if (fileDir != '') {
            try {
                await access(DATA_DIR + '/' + fileDir);
            } 
            catch (e) {
                if (e.message.includes("no such file or directory")) {
                    try {
                        await mkdir(DATA_DIR + '/' + fileDir);
                    } 
                    catch (e) {
                        console.error("Creating folder error [%s]: [%s]", e.name, e.message);
                        res.send('[${e.name}]: ${e.message}');
                        res.status(500).end();
                        return;
                    }
                } else {
                    console.log("folder access error [%s]: [%s]", e.name, e.message);
                    res.send('[${e.name}]: ${e.message}');
                    res.status(500).end();
                    return;
                }
            }

            if (! await isFileExists(DATA_DIR + '/' + fileDir)) {
                await mkdir(DATA_DIR + '/' + fileDir);
            }
        }

        let extSuffix = '';

        if (reqNotUseExt == 'false') {
            let fileTypeInfo = await fileTypeFromBuffer(file.data);
            if (fileTypeInfo) {
                extSuffix = '.' + fileTypeInfo.ext;
            }
            else if (file.name) {
                let lastDotIndex = file.name.lastIndexOf('.');
                if (lastDotIndex != -1) {
                    extSuffix = file.name.substring(lastDotIndex);
                }
            }
        }

        let fileName = reqName;

        if (fileName && fileName != '') {
            fileName = fileName + extSuffix;

            if (!isValidFilename(fileName)) {
                res.send("Filename is not valid");
                res.status(400).end();
                return;
            }

            if (await isFileExists(DATA_DIR + '/' + fileDir + '/' + fileName)) {
                res.send("File with given name is exists");
                res.status(400).end();
                return;
            }
        }
        else {
            fileName = await getNotExistedRandomFilename(DATA_DIR + '/' + fileDir, extSuffix);
        }

        try {
            await req.files.file.mv(DATA_DIR + '/' + fileDir + '/' + fileName);
        } 
        catch (e) {
            console.log('mv error: [${e.name}]: ${e.message}');
            res.send('[${e.name}]: ${e.message}');
            res.status(500).end();
        }

        res.send(fileDir + '/' + fileName);
        res.status(200).end();
    }
    catch (e) {
        console.log("[uploadFile ERROR]: ", e);
        res.send(e);
        res.status(500).end();
    }
}