/* uebergebe Liste von Elementen */
//class Dragabble {} hmm, neuer ansatz ES6, jedoch ist nicht klar wie gut die Browser das unterstützen
/*
   also  teilweise unterstützung für class / meine Anfänge
   firefox ubuntu geht,
   chrome mobile geht
   mi browser mobile geht
   firefox mobile geht nicht, doch, hatte anscheinend version aus dem cache gesehen
/*
    1) https://htmldom.dev/drag-and-drop-element-in-a-list/ - ohne draggable type, etwas aufwendiger
    2) https://web.dev/drag-and-drop/ - mit draggable, Autor schreibt: geht nicht unter mobile
    vielleicht ein Mix - hmm beide gehen nicht in firefox mobile

    1) nutzt draggable nicht, sondern erledigt dies mit mousedown and move, das könnte man per touch realisieren
    mousedown arbeitet nicht mit einem touchscreen

    Binde ich beide events an, dann wird der Handler jeweils einmal gerufen, entweder mit mousedown oder mit touchstart event.
    (hmm, was meinte ich, nochmal denken...)

    Beide nicht für mich geeignet, eher eigene Loesung gebastelt, viel experimentiert

    Anforderungen: bekomme Listenelemente übergeben, diese beinhalten einem div in dem weitere Elemente sind 

    Nach Problemen mit den Touch-Events und einem Hinweis: Sind pointerevents sinnvoll, um das ganze umzusetzen?
    Probleme: Das device scrolled, preventDefault ist "verboten"
    Bedienung mit dem Browser funktioniert bei einfachem Ersetzen
    mousedown -> pointerdown
    mousemove -> pointermove
    mouseup   -> pointerup

    Bei pointerevents gibt es auch beim Touch ein movementY -> hätte mir arbeit sparen können ...
    aber das pointermove event wird nach kurzer Bewegung nicht mehr aufgerufen?
    The pointermove event is fired when a pointer changes coordinates, and the pointer has not been canceled by a browser touch-action.
    stelle mal um und hänge die events an document.body und setze style touchAction="none" dynamisch, aber das geht nicht ...
    alles Murcks

    setze touch-action in css auf none - es funktioniert, aber man kann nicht mehr scrollen - das ist ärgerlich
    prevent-default in pointermove hilft nicht 

    aber q&d: in touchmove hilft es ... leider zu q&d man bekommt seltsame neben-effekte, insbesondere wenn man mit zwei fingern 
    arbeitet, vielleicht das pointermove doch nicht global?
    mal wieder an das element gebunden und wenn ich schön langsam bewege geht es, sonst nicht, scheint nicht die Lösung zu sein

    mit pointerCapture geht es, hatte auch testweise mal auf onpointermove umgestellt statt addeventlistener
    wobei man die touch-action für den clone allerdings auf none setzen muss, s. in der Klasse dragClassKaro
    aber: der swap macht probleme, weiß nicht mehr, was ich mir dabei gedacht hatte, nochmal überlegen
    Probleme insofern, als das move dann hängen bleibt

    Da mein Element bewegt wird, ist der swap auch quatsch, ich muss nur den placeholder sinnvoll bewegen und tauschen
    swap überarbeitet, mit dem normalen Browser funktioniert es jetzt. 

    Aber mit Firefox auf Android klappt das schieben nicht und mann muss die zwei Finger geschichte noch irgendwie
    herausnehmen, das kann die Klasse nicht, ok ist raus, aber es ist noch ein Problem, dass bei der rückkehr zum normalen Modus die 
    Abstände nicht mehr stimmen und das schieben meist nur in eine Richtung läuft (Firefox Android), nochmal auf chrome testen 
*/

class Dragabble
{
    //private properties
    //hmm, und wenn es die Klasse im CSS schon gibt?
    static #dragClass = 'dragClassKaRo';
    static #shiftSignClass = 'shiftSignKaRo';
    static #placeHolderClass = 'placeHolderKaRo';

    static #dragSelectedKaroClass = 'dragSelectedKaRo';
    static #draggingEle = null; //aktives element, nur eines denkbar
    static #placeHolder = null; //fuer das verschobene Element
    static #placeHolderInserted = false;

    static #dragActive = false;
    static #dragStyleGenerated = false;
    static #dragClassText = '\
    .dragClassKaRo { \
        cursor: move;\
        user-select: none; \
        touch-action: none; \
        display: flex; \
        justify-content: space-between; \
    } \
    .shiftSignKaRo {\
        font-size: 150%; \
        flex-basis: 5%; /*klein*/\
        padding-right: 0.5em; \
    }\
    .shiftSignKaRo + div  { /*der nächste div ist ein flex-element */\
        flex-basis: 90%; /*nicht auf 100%, etwas Platz*/\
    }\
    .dragSelectedKaRo {\
        opacity: 0.6; \
        border: 2px solid #aaa; \
    }\
    .placeHolderKaRo {\
        border: 2px dashed blue; \
        background-color: #eee; \
    }\
    ';
    #name ; //debug-Gruende, evtl. mehrere Objekte gleichzeitig (obwohl: wie dann das richtige heraus suchen)
    #elements; //oh, die muss man tatsaechlich angeben, sonst gibt es beim Zugriff einen Fehler

    static #previousTouch; //nur fuer ein touch element, fuer movementY noetig, das gibt's beim Touch nicht

    static #deltaX; //Abstand des Mouseclicks von der linken oberen Ecke
    static #deltaY;
    static #width;  //des Elements, bevor es auf position absolute gesetzt wird
    static #height;



    //public methods
    constructor (elements,name = "")
    {
        this.#elements = elements;
        this.#name = name;
        this.#generateCssClass();
        this.#generateShiftSign();
    }
    makeDragabble()
    {
        let store = [];
        for (let el of this.#elements) 
        {
            let clone = el.cloneNode(true); //tiefe kopie (true)
            let inputs = clone.querySelectorAll('input');
            for (let el of inputs)//ausschalten
                el.disabled = true; //readOnly geht nicht, aber so schon
            store.push(clone);
            clone.classList.add(Dragabble.#dragClass);
            clone.firstElementChild.before(this.#generateShiftSign());//fuegt einen Div ein 
            
            clone.addEventListener('pointerdown',this.#mouseDownHandler);
            //clone.addEventListener('touchstart',this.#mouseDownHandler);
            //clone.addEventListener('mouseup',this.#mouseUpHandler);
            //clone.addEventListener('touchend',this.#mouseUpHandler);
            el.replaceWith(clone); //ersetze im DOM damit sind auch die listener weg
        }
        this.#elements = store; //ersetze  die Liste
        //for (let el of this.#elements)
        //    el.classList.remove("dragClassKaRo");
    }

    makeUnDraggable()
    {
        for (let el of this.#elements)
        {
            let inputs = el.querySelectorAll('input');
            for (let el of inputs)
                el.disabled = false;
            el.classList.remove(Dragabble.#dragClass);
            el.firstChild.remove();
            el.removeEventListener('pointerdown',this.#mouseDownHandler);
            //el.removeEventListener('touchstart',this.#mouseDownHandler);
        }

        /*wollte den Handler mal static machen, geht aber nicht, irgendwo unten dokumentiert.
        Interessant, auch wenn man es ausführt kein Fehler, ich entferne ein undefined (Dragabble.glo...), das interessiert
        JS anscheinend nicht
        if (--Dragabble.#dragCounter <= 0 )
        {  //letzer entfernt
            document.removeEventListener("mouseup",Dragabble.mouseUpHandler);
            document.removeEventListener("touchend",Dragabble.mouseUpHandler); //mal sehen, dürfte nicht stören
        }
        */
    }


    //und ein wenig private
    //static method(s)
    //eventlistener auf dem document wird von den anderen listenern entfernt
    //vermute, dass der globale Handler reicht

    //ein q&d hack, verhindere beim touchmove das default verhalten um scrollen zu unterbinden. 
    #disableDefaultTouchMove = e => {
        e.preventDefault();
        e.stopPropagation();
    }

    //handler fuer diverse Elemente0
    #mouseDownHandler = e => { //hinweis gefunden: fat-arrow syntax binds to the lexical (?) scope of the function
                                //damit ist this nicht das objekt auf dem der event ausgeloest wurde, sondern mein Objekt
        //ermittle das zugehörige Element
        //document.body.addEventListener("touchmove",this.#disableDefaultTouchMove,{passive:false})
        //document.body.addEventListener("pointerup",this.#mouseUpHandler);//,{once : true})//nur einmal
        //vorsicht, ein einfaches true heißt nicht false, sondern das der event in der capturing phase und nicht  in der bubbling phase agefangen wird
        //document.addEventListener("touchend",this.#mouseUpHandler);//,{once : true})//nur einmal
        if (!Dragabble.#draggingEle)
        {//sonst aktiv 
            for (const el of this.#elements)
            {
                if (el.contains(e.target)) //habe in ein oder auf das Listenelement geclickt
                {
                    Dragabble.#draggingEle = el; //mal auf static gesetzt, ein aktuelles kann es nur eines geben
                    el.classList.add(Dragabble.#dragSelectedKaroClass);
                    const rect = el.getBoundingClientRect(); //x und y sind left und top, bezieht sich auf viewport
                    Dragabble.#width = rect.width;
                    Dragabble.#height = rect.height;
                    Dragabble.#placeHolder = el.cloneNode(false); //keine tiefe kopie
                    let ph = Dragabble.#placeHolder;
                    ph.style.width = Dragabble.#width + "px";
                    ph.style.height = Dragabble.#height + "px";
                    ph.classList.add(Dragabble.#placeHolderClass);
                    Dragabble.#deltaX = e.clientX - rect.x; //clientX Y  auch auf Viewport bezogen
                    Dragabble.#deltaY = e.clientY - rect.y;
                    //document.body.addEventListener("pointermove",this.#mouseMoveHandler);
                    el.setPointerCapture(e.pointerId);
                    el.onpointermove = this.#mouseMoveHandler;
                    //el.addEventListener("pointermove",this.#mouseMoveHandler);
                    el.onpointerup = this.#mouseUpHandler;
                    //el.addEventListener("pointerup",this.#mouseUpHandler);
                    console.log("attach mousemove object has name " + this.#name)
                    break;
                }
            }
        }
    }

    //geht prinzipiell, aber wenn der user zu schnell bewegt, dann verliert man den Handle
    //lässt sich eventuell über client rect lösen und indem ich statt movement die absoluten positionen
    //verwende - mal sehen, ja, außerdem an das dokument binden
    #mouseMoveHandler = e => {
        const el = Dragabble.#draggingEle;
        const ph = Dragabble.#placeHolder;
        if (el != null) //hatte hier manchmal null - warum?
        {
            //position absolte kann die Breite ändern, höhe eigentlich nicht, aber nehme es mal dazu
            //interessant, passiert nicht mehr, aber wenn ich es so mache habe ich leichte abweichungen in der Höhe 
            //daher nehme ich es heraus
            //el.style.width = Dragabble.#width+"px";
            //el.style.height = Dragabble.#height+"px";
            //console.log("style top: "+ el.style.top)

            if (!Dragabble.#placeHolderInserted)
            {//einfuegen
                el.after(Dragabble.#placeHolder); //erst drag ele, dann der platzhalter
                Dragabble.#placeHolderInserted = true;
            }
            el.style.position="absolute";
            el.style.top =   parseInt(e.pageY - Dragabble.#deltaY) +"px"; //hier page noetig, falls gescrollt
            el.style.left = parseInt(e.pageX - Dragabble.#deltaX) + "px";
            //aufpassen, das element bleibt an der position in der liste, nur die position auf dem Bildschirm
            //ändert sich, daher next und prev nötig
            let next = (ph.nextElementSibling == el) ? el.nextElementSibling : ph.nextElementSibling;
            let prev = (ph.previousElementSibling == el) ? el.previousElementSibling : ph.previousElementSibling;

            //console.log(`Movement x ${e.movementX} and Movement y ${e.movementY}`);

            //firefox on android does not have negative values for movementY, chrome has, on desktop both has ...
            //but it should be enough to check the position with isAbove
            //if(e.movementY > 0 //nach unten
            if ( next //ein nachfolger unter dem platzhalter ist da
                && this.#myListContains(next) //Bedingung, dass der nächste auch zu meiner Liste gehört
                &&  Dragabble.#isAbove( next, el))//el unter dem nächsten unterhalb des Plathalters
            {
                Dragabble.#swap(ph, next);
            }
            //if(e.movementY < 0 //nach oben
            else if(  prev
                && this.#myListContains(prev) //Bedingung, dass der nächste auch zu meiner Liste gehört
                &&  Dragabble.#isAbove( el, prev))//el über dem vorigen oberhalb des Plathalters
            {
                    Dragabble.#swap(ph, prev);
            }
        }
    }

    //umgestellt, im mouseUpHandler muss das Element einsortiert werden 
    #mouseUpHandler = e => { 
        console.log("in mouseuphandler object hast name " + this.#name)
        Dragabble.#previousTouch = null;
        if (Dragabble.#draggingEle != null)
            Dragabble.#draggingEle.classList.remove(Dragabble.#dragSelectedKaroClass);
        let ph = Dragabble.#placeHolder
        let el = Dragabble.#draggingEle;
        ph.after(el); //das reicht schon       
        ph && ph.parentNode && ph.parentNode.removeChild(ph);
        Dragabble.#placeHolderInserted = false;
        el.style.removeProperty('top');
        el.style.removeProperty('left');
        el.style.removeProperty('position');
        el.onpointermove = null;
        el.onpointerup = null;
        //document.body.removeEventListener("pointermove",this.#mouseMoveHandler);
        Dragabble.#draggingEle = null;
        Dragabble.#placeHolder = null;
        //document.body.removeEventListener("pointerup",this.#mouseUpHandler);
        //document.body.removeEventListener("touchmove",this.#disableDefaultTouchMove,{passive:false});

    }

    //hilfsmethoden
    static #isAbove (nodeA, nodeB) {
        // Get the bounding rectangle of nodes
        const rectA = nodeA.getBoundingClientRect();
        const rectB = nodeB.getBoundingClientRect();

        return rectA.top + rectA.height / 2 < rectB.top + rectB.height / 2;
    };
    //austausch, klappt auch wenn im DOM eingehängt
    static #swap(nodeA, nodeB)
    {
        const nextOfA = nodeA.nextSibling;
        const prevOfA = nodeA.previousSibling;
        nodeB.after(nodeA);
        if (nextOfA)
            nextOfA.before(nodeB);
        else
            prevOfA.after(nodeB);
    }

    #myListContains(element)
    {
        for (const el of this.#elements)
            if (el == element)
                return true;
        return false;
    }
    #generateCssClass()
    {
        //ohne document geht es nicht ?- hänge die Klasse ein
        if (! Dragabble.#dragStyleGenerated)
        {
            let sheet = document.createElement('style');
            sheet.innerHTML = Dragabble.#dragClassText;
            document.head.appendChild(sheet);
        }
    }
    #generateShiftSign()
    {
        let insert = document.createElement('div');
        insert.classList.add(Dragabble.#shiftSignClass);
        insert.innerHTML = "&equiv;";
        return insert;
    }
}