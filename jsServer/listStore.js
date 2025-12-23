"use strict";

const fs = require("fs");
const path = require("path");
const config = require("./config.js");
//console.log("CONFIG in listStore:", config);
let storeFile = null;
let lists = {};
/* Aufbau 
{
  "tl": {
    "file": "/var/www/html/einkaufWS/data/tl.csv",
    "registerAllowed": true
  }
}
*/
function init()
{
    storeFile = path.resolve(__dirname, config.listFile);
    lists = {};

    if (fs.existsSync(storeFile))
    {
        const content = fs.readFileSync(storeFile, "utf8").trim();
        if (content)
            lists = JSON.parse(content);
    }
}

function save()
{
    fs.writeFileSync(storeFile, JSON.stringify(lists, null, 2), "utf8");
}

function exists(listName)
{
    return !!lists[listName];
}

function get(listName)
{
    return lists[listName] || null;
}

function getAll()
{
    return lists;
}

function create(listName, registerAllowed)
{
    const filePath = path.resolve(
        __dirname,
        config.dataDir,
        `${listName}.csv`
    );

    lists[listName] =
    {
        file: filePath, //absoluter Pfad zur CSV-Datei
        registerAllowed: registerAllowed
    };

    save();
}

module.exports =
{
    init,
    exists,
    get,
    getAll,
    create
};
