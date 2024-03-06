import process from "node:process";

import basicAuth from 'express-basic-auth';
const ENABLE_AUTH = process.env.ENABLE_AUTH;
const USER = process.env.USER;
const PASS = process.env.PASS;

function httpAuthorizer(user, pass) {
    const userMatches = basicAuth.safeCompare(user, USER);
    const passwordMatches = basicAuth.safeCompare(pass, PASS);

    return userMatches & passwordMatches;
}

if (ENABLE_AUTH)
    module.exports.httpAuthMidware = basicAuth( { authorizer: httpAuthorizer, challenge: true } );
else
    module.exports.httpAuthMidware = (req, res, next) => next();