//Erst diverse Funktionen "main" unten - wenn window das load Event auslöst
/*
   2023-01-27: sort eingebaut, dabei aufgefallen save der konfiguration klappt nicht ganz, Meldung keine Aenderung
   und die tokengeschichte am Anfang klappt nicht nochmal anschauen - ein wenig korrigiert, ob es fertig ist - hmm, 
   weiß nicht mehr :-)

   2023-01-28: wenn Zeit ist, dann mal mit drag and drop spielen, s. klasse draggable.js
   2023-02-18: Draggable ein wenig repariert
   2023-02-22: Löschen per waste-Symbol, hatte event vergessen wieder anzuhängen nach dem auf nicht draggable geschaltet
   2025-12-22: kopieren, umstellen auf WebSocket-Server
*/
let ws = null;
let reconnectTimer = null;
let configAvailable = false;

const WS_URL =
    (location.protocol === "https:" ? "wss://" : "ws://") +
    location.host +
    "/ws";


//aus js nachladen ist komplizierter:

var dragScript =  document.createElement('script');
dragScript.type = 'text/javascript'; //ist das noetig?
dragScript.src = 'jsClient/draggable.js';
document.head.appendChild(dragScript);

//websocket netzwerk funktionen

function connect()
{    
    ws = new WebSocket(WS_URL);
    ws.onmessage = onMessage;
    ws.onclose = () =>
    {
        console.log("WS closed");
        ws = null;
        scheduleReconnect();
    };
    ws.onerror = () =>
    {
        // Fehler führt immer zu close
        ws?.close();
    };
    ws.onopen = () =>
    {
        ws.send(JSON.stringify({
            type: "hello",
            payload:
            {
                token: localStorage.getItem("token"),
                list:  localStorage.getItem("liste")    
            }}));
        console.log("WS connected");
    } ;
    
    
}

function scheduleReconnect()
{
    if (reconnectTimer)
        return;
    reconnectTimer = setTimeout(() =>
    {
        reconnectTimer = null;
        connect();
    }, 1000);
}

function onMessage(event)
{
    let msg;

    try
    {
        msg = JSON.parse(event.data);
    }
    catch
    {
        error("Ungültige Serverantwort (kein JSON)", true, 5000);
        return;
    }

    switch (msg.type)
    {
        case "state": //wird auch gesendet, wenn sortiert wurde
            handleState(msg.payload);
            break;
        case "addOk" : case "toggleOk": case "deleteOk": case "sortOk": case "toggleRegisterOk":
            console.log("received simple ok: ", msg.type);
            break;
        case "itemAdded":
            handleItemAdded(msg.payload);
            break;
        case "itemToggled":
            handleItemToggled(msg.payload);
            break;
        case "itemDeleted":
            handleItemDeleted(msg.payload);
            break;
        case "registerListAllowed":
            handleRegisterListedAllowed(msg.payload);
            break;
        case "registered":
            info("Token erfolgreich registriert", true, 5000);
            break;    
        case "error":
            if (msg.message && msg.message.indexOf("token invalid, Registration disabled")!=-1)
            {   
                configAvailable = false;
                document.getElementById("settingTab").click();
                console.log("confAvailable to false");
            }
            error(msg.message || "Serverfehler", true, 5000);
            break;

        default:
            console.warn("Unbekannter Nachrichtentyp:", msg.type);
    }
}
function handleState(payload)
{
    if (!payload || !Array.isArray(payload.entries))
    {
        error("Ungültiger State vom Server", true, 5000);
        return;
    }

    // komplette Liste verwerfen
    document.getElementById("list").innerHTML = "";

    // Einträge IN DER SERVER-REIHENFOLGE neu aufbauen
    payload.entries.forEach(e =>
    {
        // Mapping auf dein bestehendes Modell
        addEntry(
            e.done ? 1 : 0,
            e.text,
            e.id,
            true
        );
    });
    //setze registerAllowd-Status
    const container = document.getElementById('iListStatus');
    container.innerHTML = "status unkown"; //standard
    const bsToggle = document.getElementById('bsToggleRegister');
    bsToggle.className = "hidden"; 
    if ("registerAllowed" in payload)
    {    
        bsToggle.classList.remove('hidden');
        container.innerHTML =
                     payload.registerAllowed ? "register allowed" : "register denied";
    }
}
function handleRegisterListedAllowed(payload)
{
    const container = document.getElementById('iListStatus');
    container.innerHTML = "status unkown"; //standard
    const bsToggle = document.getElementById('bsToggleRegister');
    bsToggle.className = "hidden"; 

    if ("registerAllowed" in payload)
    {    
        bsToggle.classList.remove('hidden');
        container.innerHTML =
                     payload.registerAllowed ? "register allowed" : "register denied";
    }
}
function handleItemAdded(payload)
{
    if (!payload || !payload.item)
        return;

    const e = payload.item;

    addEntry(
        e.done ? 1 : 0,
        e.text,
        e.id,
        false   // false = oben einfügen
    );
}

function handleItemToggled(payload)
{
    if (!payload || payload.id === undefined || payload.done === undefined)
        return;

    const input = document.querySelector(`input[data-uuid="${payload.id}"]`);
    if (!input)
        return;

    input.checked = !!payload.done;

    // Optional: deine UI-Logik auch bei Server-Events anwenden
    const li = input.closest("li");
    if (li)
    {
        if (input.checked) moveDown(li);
        else moveUp(li);
    }
}

function handleItemDeleted(payload)
{
    if (!payload || payload.id === undefined)
        return;

    const input = document.querySelector(`input[data-uuid="${payload.id}"]`);
    if (!input)
        return;

    const li = input.closest("li");
    if (li) li.remove();
}

function wsSend(type, payload)
{
    if (ws && ws.readyState === WebSocket.OPEN)
    {
        ws.send(JSON.stringify({ type, payload }));
        return true;
    }

    error("WebSocket nicht verbunden", true, 3000);
    return false;
}
function sendAdd(text)
{
    const t = (text || "").trim();
    if (t === "")
    {
        error("Eintrag benötigt", true, 3000);
        return;
    }

    wsSend("add", { text: t });
}
function sendToggleByInput(input)
{
    const id = input?.dataset?.uuid || "";
    if (!id)
        return;

    wsSend("toggle", { id: id });
}

function sendDeleteByWaste(span)
{
    const li = span.closest("li");//nächstes übergeordnetes li
    if (!li)
        return;

    const input = li.querySelector('input[type="checkbox"]');
    const id = input?.dataset?.uuid || "";
    if (!id)
        return;

    wsSend("delete", { id: id });
}

function sendSort() 
{    
    wsSend("sort", { text: "aber fix" });
}

//------------ende Netzwerkfunktionen
//Funktionen Liste
function inputChangeListener(e)
{
    let li = e.currentTarget.parentNode.parentNode.parentNode;
    if (e.currentTarget.checked)
    {
        moveDown(li);
    }
    else
        moveUp(li); //ganz nach oben
    //console.log(li);
    sendToggleByInput(e.currentTarget);
}

function appendEventSpanWaste(span)
{
    span.addEventListener("click", event => {
        sendDeleteByWaste(event.currentTarget);
        //let liste = document.getElementById("list"); //falls sich liste geändert hat - hmm, sinnvoll?
        //let li = event.currentTarget.parentNode.parentNode;
        //liste.removeChild(li);
    });

}
function addEntry(checked, text, uuid="", end=true)
{
     /* Aufbau ist:
        <li> 
          <div>//an checkbox kommt uuid mit dran
            <label> <input type="checkbox"> <span>First Entry</span></label> <span class="waste">&#128465;</span>
          </div>
        </li>
        */
    let liste = document.getElementById("list");

    //gibt es ein element mit dem Text-Eintrag schon - dann entfernen, das neue wird sowieso gecheckt und nach oben gesetzt
    const itemList = document.querySelectorAll("li div input + span");
    let foundItem = false;
    let compareText = text.toLowerCase().trim();
    for(let i = 0; i < itemList.length; ++i)
    {
        let ittext = itemList[i].innerText.toLowerCase().trim();

        if (compareText == ittext)
        {
            foundItem = itemList[i];
            break;
        }
    }
    if (foundItem)
        liste.removeChild(foundItem.parentNode.parentNode.parentNode);//richtig zaehlen :-)
    //und das neue 
    let li = document.createElement("li");
    let div = document.createElement("div");
    let label = document.createElement("label");
    let input = document.createElement("input");
    input.type = "checkbox";
    input.dataset.uuid = uuid; 
    li.dataset.uuid = uuid; //falls ich das mal brauchen sollte

    if (checked == 1)
        input.checked = true;

    input.addEventListener("change", inputChangeListener);

    let span1 = document.createElement("span");
    let span2 = document.createElement("span");
    //und zusammen bauen
    span1.appendChild(document.createTextNode(text));
    span2.innerHTML = "&#128465;";
    span2.classList.add("waste");
    appendEventSpanWaste(span2);
    label.appendChild(input);
    label.appendChild(span1);
    div.appendChild(label);
    div.appendChild(span2);
    li.appendChild(div);

    if(!end && liste.firstChild)
        liste.firstChild.before(li);
    else
        liste.appendChild(li);
}
function fillList(data)
{
    //leeren
    let liste = document.getElementById("list");
    liste.innerHTML = "";
    for (const entry of data)
    {
       addEntry(entry[0],entry[1],entry[2]);
    }
}

function moveDown(li)
{ //move down as far as I found another checked item
    let liste = document.getElementById("list");
    let target = null;
    let childs = liste.childNodes;
    //console.log(childs[0]);
    for (const element of childs) //problem: finde das element selbst
    {
        if (element.firstChild.firstChild.firstChild.checked &&
             element.firstChild.firstChild.firstChild != li.firstChild.firstChild.firstChild )
        {
            target = element;
            break;
        }
    }
    if (target)
    {
        target.before(li);
    }
    else
    {
        liste.lastChild.after(li);
    }
}

function moveUp(li)
{ //move up
    let liste = document.getElementById("list");
    let childs = liste.childNodes;
    if (liste.firstChild)
    {
        liste.firstChild.before(li);
    }
}

//styles anpassen, warning / error
function error(text,overwrite=true,timeout=null)
{
    if (typeof error.timeOutId != "undefined")
        clearTimeout(error.timeOutId);

    if (overwrite)
        document.getElementById("errorText").innerHTML = text;
    else
        document.getElementById("errorText").innerHTML += text;
    document.getElementById("error").classList.remove("hidden");
    if (timeout)
        error.timeOutId = setTimeout(() => {document.getElementById("error").classList.add("hidden");},timeout);
}

function info(text,overwrite=true,timeout=null)
{
    if (typeof info.timeOutId != "undefined")
        clearTimeout(info.timeOutId);
    if (overwrite)
        document.getElementById("infoText").innerHTML = text;
    else
        document.getElementById("infoText").innerHTML += text;
    document.getElementById("info").classList.remove("hidden");
    if (timeout)
        info.timeOutId = setTimeout(() => {document.getElementById("info").classList.add("hidden");},timeout);
}


//hilfsfunktion(en)
function generateToken(n) {
    var chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    var token = '';
    for(var i = 0; i < n; i++) {
        token += chars[Math.floor(Math.random() * chars.length)];
    }
    return token;
}

function registerListenerEtc()
{
    let liste = localStorage.getItem("liste");
    let token = localStorage.getItem("token");
    document.getElementById("iListe").value = liste;
    document.getElementById("iToken").value = token;
    addSettingsListener();
    addStandardListener();    
}


//eventlistener hinzufuegen, settings und die "normalen"
function addSettingsListener()
{
    //fuer die Settings
    let bsSave = document.getElementById("bsSave");
    let bsCancel = document.getElementById("bsCancel");
    let bsClear = document.getElementById("bsClear");
    let bsNew = document.getElementById("bsNew");
    let bsToggleRegister = document.getElementById("bsToggleRegister");
    let fSettings = document.getElementById("fSettings");
    let liste = localStorage.getItem("liste");

    bsToggleRegister.addEventListener("click", () => {
       wsSend("toggleRegister",{list: localStorage.getItem("liste")}); 
    });
    bsNew.addEventListener("click", (e) => {
        e.preventDefault();
        let token = generateToken(32);
        document.getElementById("iToken").value=token;
        document.getElementById("iListe").value="";
    });
    bsClear.addEventListener("click", (e) => {
        e.preventDefault();
        localStorage.clear();
        configAvailable = false;
        liste = "";
        document.getElementById("list").innerHTML="";
        document.getElementById("iListe").value="";
        token = generateToken(32); //neues generieren, erst speichern, wenn registriert 
        document.getElementById("iToken").value=token;
    });
    //save muss ggf. auf registrierung des tokens warten 
    bsSave.addEventListener("click", (e) =>
    {
        e.preventDefault();
        const liste = document.getElementById("iListe").value.trim();
        const oldListe = localStorage.getItem("liste");
        const oldToken = localStorage.getItem("token");
        let token = document.getElementById("iToken").value;

        if (liste === "")
        {
            error("Liste benötigt", true, 5000);
            configAvailable = false;
            return;
        }

        // Token absichern (sollte eigentlich schon existieren)
        if (!token)
        {
            token = generateToken(32);
            document.getElementById("iToken").value = token;
        }

        // Keine Änderung → nur UI umschalten
        if (oldListe === liste && oldToken === token)
        {
            info("Keine Änderung vorgenommen", true, 3000);
            return;
        }

        // Neue Einstellungen lokal speichern
        localStorage.setItem("token", token);
        localStorage.setItem("liste", liste);

        info("Einstellungen gespeichert, verbinde neu …", false, 3000);

        // UI-Listener einmalig sicherstellen
        //addStandardListener();
        //liste leeren, nein sollte nicht nötig sein
        //document.getElementById("list").innerHTML = "";
        // Reconnect erzwingen → hello → Full-State
        if (ws)
            ws.close();
         init();
         connect();
         document.getElementById("defaultTab").click();
    });

    bsCancel.addEventListener("click",(e) => {
        e.preventDefault();
        //server = localStorage.getItem("server");
        iListe.value = localStorage.getItem("liste");
        iToken.value = localStorage.getItem("token");
        if (ws)
            ws.close();
        document.getElementById("defaultTab").click();
    });

    //infofelder
    document.getElementById("berrorOk").addEventListener("click", (e) => {
        document.getElementById("error").classList.add("hidden");
    });
    document.getElementById("binfoOk").addEventListener("click", (e) => {
        document.getElementById("info").classList.add("hidden");
    });
}



//Standard Eventlistener fuer buttons etc
function addStandardListener()
{
    let bAdd = document.getElementById("bAdd");
    let bReload = document.getElementById("bReload");
    let bSort = document.getElementById("bSort");
    const bDrag = document.getElementById("bDrag"); //eigentlich koennte alles const sein
    let iAddTopic = document.getElementById("iAddTopic");

    //unnoetige event-Listener
    //folgendes wird im realen Einsatz nicht noetig sein, da ich den eventlistener beim dynamischen einfuegen der Elemente anhaenge
    let listEntries = document.querySelectorAll("span.waste");
    let liste = document.getElementById("list");
    listEntries.forEach(element => appendEventSpanWaste(element));

    //das genauso ?
    listEntries = document.querySelectorAll("li input");
    listEntries.forEach(element =>  element.addEventListener("change", inputChangeListener))
    //--------------------------------------------
    //fuer die Einträge und Liste
    iAddTopic.addEventListener("keypress", function(event) {
        if (event.key === "Enter") {
          event.preventDefault();
          bAdd.click();
        }
    });
    bReload.addEventListener("click", (e)=> {
        e.preventDefault();
        if(ws)
            ws.close(); //neu verbinden
    });

    bAdd.addEventListener("click", e => {
        e.preventDefault();
        console.log("add handler");
        let iAdd = document.getElementById("iAddTopic");
        //addEntry(0,iAdd.value,"",false); //nicht am Ende sondern Anfang
        sendAdd(iAdd.value);
        iAdd.value="";
        //handleAutoSave();
    });
    bSort.addEventListener("click",e => {
        e.preventDefault();
        console.log("Sort Handler")
        sendSort();
    });
    //listener if dragbutton is pressed
    bDrag.addEventListener("click",dragPressed); //named function to use a static var
    //only used here:
    function dragPressed()
    {
        const iAddTopic = document.getElementById("iAddTopic");
        if (bDrag.innerText != 'done')
        {
            //liste abrufen
            const [todoEntries, doneEntries] = getDoneAndTodoEntries();
            bDrag.innerText = 'done';
            dragPressed.elementDisabler = new EnDisabledElements([bAdd,bReload,bSort,iAddTopic]);
            dragPressed.elementDisabler.disable();
            dragPressed.DragItemsTodo = new Dragabble(todoEntries,"todo");
            dragPressed.DragItemsDone = new Dragabble(doneEntries,"done");
            dragPressed.DragItemsTodo.makeDragabble();
            dragPressed.DragItemsDone.makeDragabble();
        }
        else
        {
            dragPressed.DragItemsTodo.makeUnDraggable(); //erst danach kann ich getDoneAnd... wieder nutzen
            dragPressed.DragItemsDone.makeUnDraggable(); //erst danach kann ich getDoneAnd... wieder nutze
            //und die eventhandler wieder zu den elementen hinzufügen, hatte die Objekte lokal gespeichert, aber 
            //das geht nicht sie sind ja ausgetauscht in der Drag-Klasse
            const [todoEntries, doneEntries] = getDoneAndTodoEntries();
            const entries = todoEntries.concat(doneEntries);
            for (let el of entries)
            {
                let input = el.querySelector('input');
                input.addEventListener('change',inputChangeListener);
                let waste = el.querySelector('.waste'); //erstes Element mit der Klasse - es sollte nur eines geben, einen span
                appendEventSpanWaste(waste);

            }
            //handleAutoSave(); nein, ein drag wird nicht gespeichert
            bDrag.innerText="drag";
            dragPressed.elementDisabler.enable();

        }
    }
    function getDoneAndTodoEntries()
    {
        const entries = document.querySelectorAll("#list li");
        let todoEntries = [];
        let doneEntries = [];
        console.log(entries[0].childNodes[0].childNodes[0].childNodes[0]); //das ist das input feld
        //erstelle zwei listen, eine mit den nicht markierten und eine mit den markierten also erledigten
        entries.forEach(el => {
            if (el.childNodes[0].childNodes[0].childNodes[0].checked == false)
            {
                //console.log("find " + el.childNodes[0].childNodes[0].childNodes[1].innerText + " unchecked");
                //this.todoEntries.push(el); //this sollte das element sein, an das der handler gebunden ist, stimmt auch                                                //vielleicht nur bei onclick
                todoEntries.push(el); //speichere aber lieber in dem Objekt, das diese funktion ist
            }
            else
            {
                doneEntries.push(el);
            }
        });
        return [todoEntries, doneEntries];
    }

    //q&d, hatte die eventlistener als anonyme function hinzugefügt - entfernen? - keinen sinnvollen Weg gefunden
    //clone sie - kann auch direkt ausgrauen und die Listener sind weg. Verberge die originale
    class EnDisabledElements
    {
        #elementClones; //privat elements with #
        #elements;
        constructor (elements)
        {
            this.#elementClones = [];
            this.#elements = [];
            elements.forEach(element => {
                if (! element.classList.contains("hidden"))
                { //don't handle hidden elements
                    this.#elements.push(element);
                }
            });

        }
        disable(elements)//array of elements
        {
            this.#elements.forEach(element => {
                if (! element.classList.contains("hidden"))
                { //don't hide and clone hidden elements
                    let clone = element.cloneNode(true);
                    this.#elementClones.push(clone);
                    element.classList.add("hidden");
                    clone.classList.add("greyed");
                    element.after(clone);
                }
            });
        }
        enable() //enable all
        {
            let i = 0;
            while(this.#elementClones.length > 0)
            {
                let clone = this.#elementClones.shift();
                let el = this.#elements[i++];
                el.classList.remove("hidden");
                clone.remove();
            }
        }
    }
}
function openTab(evt, tabName) {
    let i, tabcontent, tablinks;
    if (!configAvailable)
        tabName = "setup";
    let specials = document.getElementById("specialsEinkauf");
    tabcontent = document.getElementsByClassName("tabcontent");
    for (i = 0; i < tabcontent.length; i++) { tabcontent[i].style.display = "none"; }
    tablinks = document.getElementsByClassName("tablink");
    for (i = 0; i < tablinks.length; i++) { tablinks[i].className = tablinks[i].className.replace(" active", ""); }
    document.getElementById(tabName).style.display = "block";
    evt.currentTarget.className += " active";
    if (tabName==="einkauf")
    {    
        specials.classList.remove("hidden");
    }
    else
        specials.classList.add("hidden");
        
}

function init() 
{
    let liste = localStorage.getItem("liste");
    let token = localStorage.getItem("token");
    
    let fSettings = document.getElementById("fSettings");
    let main = document.getElementsByTagName("main")[0];
    configAvailable = false;
    document.getElementById("list").innerHTML = "";
    //kein token, generieren
    if (!token)
    {
        token = generateToken(32);
        localStorage.setItem("token", token);    
    }
    document.getElementById("iToken").value=token;
    if (liste == null) //zwingend noetig, ein token gehoert zur Liste, bevor token registriert wird, muss die Liste da sein
    {
        document.getElementById("settingTab").click();
    }
    else //alles da
    {
        connect();
        configAvailable = true;
    }    
    return;
}
//window - alles geladen
window.addEventListener("load", () =>
{
    //Tab-Funks anhängen
    registerListenerEtc();
    init();
    if (configAvailable)
     document.getElementById("defaultTab").click();//click ist angehängt in html
});
