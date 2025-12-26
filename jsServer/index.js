"use strict";

const WebSocket = require("ws");
const path = require("path");

const config = require("./config.js");
const csvStore = require("./csvStore.js");
const tokenStore = require("./tokenStore.js");
const saveScheduler = require("./saveScheduler.js");
const listStore = require("./listStore.js");
// ------------------------------------------------------------
// Pfade
// ------------------------------------------------------------


//beim beenden speichern
process.on("SIGINT", () =>
  {
      saveScheduler.flushAll(state);
      process.exit(0);
  });
  
  process.on("SIGTERM", () =>
  {
      saveScheduler.flushAll(state);
      process.exit(0);
  });

// ------------------------------------------------------------
// Globaler RAM-State
// ------------------------------------------------------------

tokenStore.init();
listStore.init();

const state =
{
    lists: {}
};
for (const listName in listStore.getAll())
{
    const cfg = listStore.get(listName);
    csvStore.ensureListFile(cfg.file);
    state.lists[listName] =
    {
        items: csvStore.loadList(cfg.file),
        revision: 0
    };
}
  
  

// ------------------------------------------------------------
// WebSocket-Server starten
// ------------------------------------------------------------

const wss = new WebSocket.Server({
  host: "127.0.0.1",
  port: 8080
});

console.log("WebSocket-Server läuft auf ws://127.0.0.1:8080");

// ------------------------------------------------------------
// Verbindung
// ------------------------------------------------------------

wss.on("connection", (ws) =>
{
    ws.context =
    {
        token: null,
        list: null
    }; //zur speicherung der beim hello gesendeten informationen

    ws.on("message", (raw) =>
    {
        let msg =
        {
            type: "error",
            message: "Invalid JSON"
        };

        try
        {
            msg = JSON.parse(raw.toString());
        }
        catch
        {
            wsSend(ws, msg);
            return;
        }

        handleMessage(ws, msg);
    });

    ws.on("close", () =>
    {
        // aktuell nichts zu tun
    });
});

// ------------------------------------------------------------
// Message Dispatcher
// ------------------------------------------------------------

function handleMessage(ws, msg)
{
  let listName = ws.context.list;
  let result = {
    response : {
        type: "error",
        message: "Unknown server state"
      },
    broadcast: null
  }
  //erstmal nur hello ohne auth möglich
  if (msg.type == "hello")
    result = handleHello(ws, msg.payload);
  else  
  { //alle anderen nur mit auth
    if (ws.context && ws.context.token &&  ws.context.list)
    {
      
      switch (msg.type)
      {
        case "load"://fuer das Neuladen der Liste
          result = handleLoad(ws);
          break;
        case "save"://speichern der Liste sollte unnötig sein
          result = handleSave(ws, msg.payload);
          break;
        case "sort": //sortieren der Liste
          result = handleSort(ws);
          break;
        case "toggle": //umschalten eines Eintrags
          result = handleToggle(ws, msg.payload);
          break;
        case "add": //neu
            result = handleAdd(ws, msg.payload);
            break;
        case "delete": //löschen
          result = handleDelete(ws, msg.payload);
          break;
        default:
          result.response = {
            type: "error",
            message: "Unknown message type: " + msg.type
        };
        
      }//end switch 
    }//end if auth ok
    else
      result.response = { type: "error", message: "Don't hack - not authenticated" };    
  } //end else - not hello
  wsSend(ws, result.response);
  if (result.broadcast)
    broadcast(ws.context.list,result.broadcast);//dann der broadcast
}

// ------------------------------------------------------------
// Handler
// ------------------------------------------------------------
//helper functions handler
function tryCreateList(listName) { 
  let payloadResponse = null;
  let listCfg = null;
  if (config.listCreationAllowed) //neue Liste anlegen
  { 
    if (!listStore.exists(listName))
    {
      listStore.create(
          listName,          
          config.defaultRegisterAllowed
      );
    }
    state.lists[listName] = { items: [], revision: 0 };
    listCfg = listStore.get(listName);
    //leere Datei anlegen    
    csvStore.ensureListFile(listCfg.file);
  }
  else {
    payloadResponse = { type: "error", message: "List does not exist, creation not allowed" };
  }
  return  {listCfg, payloadResponse};
}
//------------------------------------------------------------
/*
  Erster kontakt des Clients mit dem Server, Sende die Liste wenn das token passt,
  ansonsten registriere ein neues token wenn erlaubt
  erzeuge ggf. eine neue Liste wenn erlaubt
*/
function handleHello(ws, payload)
{
    let payloadResponse=null;
    let listCfg = null;
    const token = payload?.token || null;
    const listName = payload?.list || null;
    console.log("handleHello: token=", token, " list=", listName);
    // ------------------------------------------------------------
    // Vorbedingungen prüfen
    // ------------------------------------------------------------

    if (token && listName)
    {       
      const existingListCfg = listStore.get(listName);
      ( { listCfg, payloadResponse } =
            existingListCfg
              ? { listCfg: existingListCfg, payloadResponse: null }
              : tryCreateList(listName) );
      if (listCfg)
      {
        const validation = tokenStore.validate(token, listName);
        if (validation.ok) //token gültig
        {
          ws.context.token = token;
          ws.context.list = listName;
          payloadResponse =
          {
            type: "state",
            payload:
            {
              list: listName,
              revision: state.lists[listName].revision,
              entries: state.lists[listName].items
            }
          };
        }//sonst token registrieren, wenn erlaubt
        else if(listCfg.registerAllowed)
        {        
          const newToken = payload.token;          
          tokenStore.register(newToken,listName);
          ws.context.token = newToken;    
          ws.context.list = listName;
          payloadResponse =
          {
            type: "state",
            payload:
            {
              token: newToken,
              list: listName,
              revision: state.lists[listName].revision,
              entries: state.lists[listName].items
            }
          };
        }
        else
          payloadResponse = {type: "error", message: "token invalid, Registration disabled for this list"};             
      }
      //else      
      //  payloadResponse = { type: "error", message: "List does not exist, creation not allowed" };
      //unnötig, da in tryCreateList schon gesetzt
    }
    else
      payloadResponse =  { type: "error", message: "Invalid hello payload, token and Listname required" };
  
    return {
      response: payloadResponse,
      broadcast: null
    }
}

function handleSort(ws)
{
  let result =
    {
        response: {type: "sortOk"},
        broadcast: null
    };
  const listName = ws.context.list;
  const items = state.lists[listName].items;

  let idx = items.findIndex(it => it.done === true);
  let undone = items.slice(0, idx === -1 ? items.length : idx);
  let done = idx === -1 ? [] : items.slice(idx);
  undone.sort((a, b) => a.text.localeCompare(b.text));
  done.sort((a, b) => a.text.localeCompare(b.text));
  items.splice(0, items.length, ...undone, ...done);//inplace arbeiten

  state.lists[listName].revision++;
  saveScheduler.scheduleSave(listName, state);
  result.broadcast =  {
    type: "state",
    payload:
    {
      list: listName,
      revision: state.lists[listName].revision,
      entries: items
    }
  };
  return result;
  
}
function handleAdd(ws, payload)
{
    let result =
    {
        response: null,
        broadcast: null
    };
    const listName = ws.context.list;
    console.log("handleAdd for list:", listName);
    const listState = state.lists[listName];
    if (!payload || !payload.text || payload.text.trim() === "")
    {
        result.response =  {
            type: "error",
            message: "Missing text"
        };
        return result;
    }

    const newText = payload.text.trim();
    const newTextLower = newText.toLowerCase();

    // 1) vorhandenen Eintrag mit gleichem Text entfernen
    const oldIndex = listState.items.findIndex(
        it => it.text.toLowerCase() === newTextLower
    );

    if (oldIndex !== -1)
    {
        const oldItem = listState.items[oldIndex];
        listState.items.splice(oldIndex, 1);

        // optional: Delete-Event für alte UUID, lasse das mal als sofortigen broadcast
        broadcast(listName, { //nicht erhöhen, da gleich ein neuer Eintrag folgt
            type: "itemDeleted",
            payload: {
                id: oldItem.id
            }
        });
    }

    // 2) neuen Eintrag erzeugen
    const item =
    {
        id: generateId(),
        text: newText,
        done: false
    };

    // 3) immer oben einfügen
    listState.items.unshift(item);

    // 4) Revision erhöhen
    listState.revision++;

    // 5) speichern (debounced)
    saveScheduler.scheduleSave(listName, state);

    // 6) bc speichern
    result.broadcast =  {
        type: "itemAdded",
        payload: {
            list: listName,
            item: item,
            revision: state.lists[listName].revision
        }
    };

    // 7) direkte Antwort an Sender
    result.response = {
        type: "addOk"
    };

    return result;
}


function handleToggle(ws, payload)
{
    let result =
    {
        response: null,
        broadcast: null
    };
    const listName = ws.context.list;
    const id = payload?.id || null;
    if (id)
    {
        const items = state.lists[listName].items;
        const item = items.find(e => e.id === id);
        if (item)
        {
            item.done = !item.done;
            //liste neu sortieren
            let idx=items.indexOf(item)
            items.splice(idx, 1); //entfernen
            if (item.done)
            {
              let insertIndex = items.findIndex(it => it.done === true);
              if (insertIndex === -1)
                  items.push(item); //ans Ende setzen
              else
                  items.splice(insertIndex, 0, item);
            }
            else
            {
                items.unshift(item); //an den Anfang setzen
            }
            state.lists[listName].revision++;
            saveScheduler.scheduleSave(listName, state);
            result.broadcast =
            {
                type: "itemToggled",
                payload:
                {
                  list: listName,
                  revision: state.lists[listName].revision,
                  id: item.id, //hier reicht die id                    
                  done: item.done
                }
            };
            result.response = { type: "toggleOk" };
        }
        else
        {
            result.response =
            {
                type: "error",
                message: "Item not found"
            };
        }
    }
    else
    {
        result.response =
        {
            type: "error",
            message: "Missing id"
        };
    }
    return result;
}

function handleDelete(ws, payload)
{
    let result =
    {
        response: null,
        broadcast: null
    };    
    const listName = ws.context.list;
    const id = payload?.id || null;

    if (id)
    {
        const items = state.lists[listName].items;
        const index = items.findIndex(e => e.id === id);
        if (index !== -1)
        {
            items.splice(index, 1);
            state.lists[listName].revision++;
            saveScheduler.scheduleSave(listName, state);
            result.broadcast = 
            {
                type: "itemDeleted",
                payload:
                {
                  list: listName,
                  revision: state.lists[listName].revision,
                  id: id //auch hier reicht die id
                }
            };
            result.response = { type: "deleteOk" };
        }
        else        
          result.response =   {  type: "error",  message: "Item not found" };        
    }
    else    
      result.response = { type: "error", message: "Missing id"};
    

    return result;
}
function handleLoad(ws)
{
    const listName = ws.context.list;
    let result =
    {
        response: null,
        broadcast: null
    };
    result.response = 
    {
      type: "state",
      payload:
      {
          list: ws.context.list,
          revision: state.lists[listName].revision,
          entries: state.lists[listName].items
      }
    };
    return result;
}

function handleSave(ws, payload)
{
  let result =
  {
     response: {
       type: "error",
       message: "Save not required/(yet) implemented"
       },
     broadcast: null
  };
  return result ;
}

// ------------------------------------------------------------
// Hilfsfunktionen
// ------------------------------------------------------------

function wsSend(ws, obj)
{
    if (ws.readyState === WebSocket.OPEN)
    {
        ws.send(JSON.stringify(obj));
    }
}
const crypto = require("crypto");

function generateId()
{
    return crypto.randomBytes(16).toString("hex");
}

function broadcast(listName,obj)
{
    if (! obj || !listName) 
	    return;
    const data = JSON.stringify(obj);

    wss.clients.forEach(ws =>
    {
        if (
            ws.readyState === WebSocket.OPEN &&
            ws.context &&
            ws.context.list === listName
        )
        {
            ws.send(data);
        }
    });
}

