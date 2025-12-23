const fs = require("fs");
const path = require("path");

function ensureListFile(filePath)
{
    if (!fs.existsSync(filePath))
    {
        fs.writeFileSync(filePath, "", { encoding: "utf8", flag: "wx" });
    }
}

function loadList(filePath)
{
    if (!fs.existsSync(filePath))
    {
        return [];
    }

    const content = fs.readFileSync(filePath, "utf8").trim();
    if (!content)
    {
        return [];
    }

    const lines = content.split(/\r?\n/);
    const items = [];

    for (const line of lines)
    {
        // bestehendes CSV-Parsing
        const [done, text, id] = line.split(",");

        items.push(
        {
            done: done === "1",
            text: text.replace(/(^"|"$)/g, ""),
            id: id
        });
    }

    return items;
}

function saveList(filePath, items)
{
    const lines = items.map(item =>
        `${item.done ? 1 : 0},"${item.text}",${item.id}`
    );

    fs.writeFileSync(filePath, lines.join("\n"), "utf8");
}

module.exports =
{
    ensureListFile,
    loadList,
    saveList
};
