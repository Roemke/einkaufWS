"use strict";

const csvStore = require("./csvStore.js");
const config = require("./config.js");
const listStore = require("./listStore.js");

const timers = {}; // listName -> timeoutId

function scheduleSave(listName, state)
{
    if (timers[listName])
    {
        clearTimeout(timers[listName]);
    }

    timers[listName] = setTimeout(() =>
    {
        const filePath = listStore.get(listName).file;

        csvStore.saveList(
            filePath,
            state.lists[listName].items
        );

        timers[listName] = null;
    }, config.saveDebounceMs); // Ruhezeit
}

function flushAll(state)
{
    for (const listName in timers)
    {
        if (timers[listName])
        {
            clearTimeout(timers[listName]);

            const filePath = listStore.get(listName).file;
            csvStore.saveList(
                filePath,
                state.lists[listName].items
            );

            timers[listName] = null;
        }
    }
}

module.exports =
{
    scheduleSave,
    flushAll
};
