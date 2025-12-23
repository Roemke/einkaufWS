"use strict";

const fs = require("fs");
const path = require("path");
const config = require("./config.js");

let tokenFile = null;
let tokens = {};

function init()
{
    tokenFile = path.resolve(__dirname, config.tokenFile);
    tokens = {};

    if (fs.existsSync(tokenFile))
    {
        const content = fs.readFileSync(tokenFile, "utf8").trim();
        if (content)
        {
            tokens = JSON.parse(content);
        }
    }
}

function save()
{
    if (!tokenFile)
    {
        throw new Error("tokenStore not initialized");
    }

    const dir = path.dirname(tokenFile);
    if (!fs.existsSync(dir))
    {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(tokenFile, JSON.stringify(tokens, null, 2), "utf8");
}

/**
 * Prüft, ob ein Token für eine bestimmte Liste gültig ist.
 * Rückgabe:
 *  - { ok: true }
 *  - { ok: false, reason: "unknown-token" }
 *  - { ok: false, reason: "list-mismatch" }
 */
function validate(token, listName)
{
    if (!token || !tokens[token])
    {
        return { ok: false, reason: "unknown-token" };
    }

    if (tokens[token].list !== listName)
    {
        return { ok: false, reason: "list-mismatch" };
    }

    return { ok: true };
}

/**
 * Registriert oder hängt ein Token auf eine Liste um.
 */
function register(token, listName)
{
    tokens[token] =
    {
        list: listName,
        created: new Date().toISOString()
    };

    save();

    return { ok: true };
}

function getList(token)
{
    return tokens[token]?.list ?? null;
}

module.exports =
{
    init,
    validate,
    register,
    getList
};
