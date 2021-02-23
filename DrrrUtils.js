// ==UserScript==
// @name         DrrrUtils
// @version      2.0
// @description  Utility Script for Drrr.com
// @author       Nick S. aka. Reimu
// @grant        none
// @match https://*/room*
// @match http://*/room*
// @require http://ajax.googleapis.com/ajax/libs/jqueryui/1.11.1/jquery-ui.min.js
// ==/UserScript==

(async function () {
    'use strict';



    let update = 0;
    let prefix = '!';
    let dmTarget = '';
    let oocBrackets = '))';

    // A global room object, yes some functions need a global room object, sadly.. :[ I know I suck at coding.
    let globalRoom;

    /*
    There are two types of modules:
    1: Modules that are dependent on room data, such as the users in a room, the room title, room description, lounge data etc. (modules)
    2: Modules that are dependent on the newest messages in a room. (messageModules)
    That is why I have to differentiate between message flow dependent modules and data dependent modules.
    They simply get their data in different places.
    The data dependent modules are handled in the Main Loop, message dependent modules in the message loop.
    Maybe I will find a better way of handling this situation later, if you have any recommendations, feel free to tell me about it!
    */

    let modules;
    let loadedModules = [];
    let commands;

    // Hook outcoming requests

    let _send = window.XMLHttpRequest.prototype.send;

    window.XMLHttpRequest.prototype.send = function (body) {

        if (body && body.includes('message')) {
            const parts = body.split('&');

            parts[2] = dmLock ? parts[2] + dmTarget : parts[2];
            parts[0] = oocBracketsLock ? parts[0] + ' ' + oocBrackets : parts[0];

            body = parts.join('&');
        }

        return _send.call(this, body);
    }


    /************************************
     *
     *
     * Modules
     *
     *
     ************************************/


    let dmLock = false;

    let oocBracketsLock = false;

    let blacklist = {
        name: 'Blacklist',
        storageKey: 'blacklist',
        type: 'data',
        uiType: 'complex',
        storage: [],
        run: async function ({
            roomData
        }) {
            for (const user of roomData.room.users) {
                for (const blacklistedUser of this.storage) {
                    if (user.name === blacklistedUser) {
                        await banUser(await findUser(user.name, roomData.room.users));
                    }
                }
            }
        }
    };

    let whitelist = {
        name: 'Whitelist',
        storageKey: 'whitelist',
        type: 'data',
        uiType: 'complex',
        storage: [],
        run: async function ({
            roomData
        }) {

            for (const user of roomData.room.users) {
                if (!(this.storage.includes(user.name)) && !(user.name === roomData.profile.name)) {
                    await banUser(await findUser(user.name, roomData.room.users));
                }
            }
        }
    };

    let notifyUser = {
        name: 'Notify',
        storageKey: 'notify',
        type: 'data',
        uiType: 'complex',
        storage: [],
        run: async function ({
            loungeData
        }) {
            for (const room of loungeData.rooms) {
                for (const user of room.users) {
                    if (this.storage.includes(user.name)) {
                        window.alert(`User ${user.name} is currently in the room ${room.name}.`);
                        const index = this.storage.indexOf(user.name);
                        this.storage.splice(index, 1);
                    }
                }
            }
        }
    };

    let dmCounter = {
        name: 'DM Counter',
        storageKey: 'dmCounter',
        type: 'data',
        uiType: 'simple',
        storage: undefined,
        run: async function ({
            roomData
        }) {
            let dms = 35 - roomData.room.talks.length;
            console.log(dms);
        }
    };

    let mute = {
        name: 'Mute',
        storageKey: 'mute',
        type: 'message',
        uiType: 'complex',
        storage: [],
        run: async function (talks) {
            for (const message of talks) {
                if (message.type === 'message') {
                    if (message.message) {
                        if (this.storage.includes(message.from.name)) {
                            setTimeout(async () => {
                                let htmlMessage = document.getElementById(`${message.id}`);
                                htmlMessage.parentNode.removeChild(htmlMessage);
                            }, 100);
                        }
                    }
                }
            }
        }
    };

    let greetUser = {
        name: 'Greet User',
        storageKey: 'greetUser',
        type: 'message',
        uiType: 'simple',
        storage: undefined,
        run: async function (talks) {
            for (const message of talks) {
                if (message.type === 'join') {
                    sendMessage(`Welcome ${message.user.name}!`);
                }
            }
        }
    };

    let commandHandler = {
        name: 'Command Handler',
        storageKey: 'commandHandler',
        type: 'message',
        uiType: 'complex',
        storage: [],
        run: async function (talks) {
            for (const message of talks) {
                if (message.message && message.from) {
                    if (message.from.tripcode) {
                        if (message.message.startsWith(prefix) && message.from.name !== globalRoom.profile.name && this.storage.includes(message.from.tripcode)) {
                            const [cmd, ...args] = message.message.slice(prefix.length).trim().split(/ +/g);
                            const command = commands.filter(command => command.name === cmd.toLowerCase())[0];
                            if (command) {
                                command.run(message, args);
                            }
                        }
                    }
                }
            }

        }
    };


    let 



    /*
    For some reason has to be down here, otherwise it cries, saying "blacklist is not defined mimimi"
    */
    modules = [blacklist, whitelist, notifyUser, dmCounter, mute, commandHandler, greetUser];

    loadData();

    $(document).ready(function () {
        appendCSS();
        buildHTML();
        setTimeout(() => {
            registerEventHandlers();
            populateModuleHTMLwithData();
        }, 100);
    })

    /************************************
     *
     *
     * Commands
     *
     *
     ************************************/

    let kick = {
        name: 'kick',
        run: async function (...args) {
            for (target of args[1]) {
                let user = await findUser(target, globalRoom.room.users);
                if (user) {
                    await kickUser(await findUser(target, globalRoom.room.users));
                } else {
                    await sendMessage(`User ${target} was not found.`);
                }
            }
        }
    }

    let ban = {
        name: 'ban',
        run: async function (...args) {
            for (target of args[1]) {
                let user = await findUser(target, globalRoom.room.users);
                if (user) {
                    await banUser();
                } else {
                    await sendMessage(`User ${target} was not found.`);
                }
            }
        }
    }

    let say = {
        name: 'say',
        run: async function (...args) {
            await sendMessage(args[1].join(' '));
        }
    }

    let setRoomTitle = {
        name: 'setroomtitle',
        run: async function (...args) {
            await changeRoomTitle(args[1].join(' '));
        }
    }

    let setRoomDescription = {
        name: 'setroomdescription',
        run: async function (...args) {
            await changeRoomDescription(args[1].join(' '));
        }
    }

    let setDJMode = {
        name: 'setdjmode',
        run: async function (...args) {
            await setDJMode(args[1]);
        }
    }

    let giveHost = {
        name: 'givehost',
        run: async function (...args) {
            let user = await findUser(args[1].join(' '), globalRoom.room.users);
            if (user) {
                await changeHost(user);
            } else {
                await sendMessage(`User ${args[1]} was not found.`);
            }
        }
    }

    commands = [kick, ban, say, setRoomTitle, setRoomDescription, setDJMode, giveHost];



    /************************************
     *
     *
     * LOOPS
     *
     *
     ************************************/

    //Main Loop
    setInterval(async () => {

        //Retrieving data from the lounge and current room
        let data = {
            roomData: await fetchAPI('room'),
            loungeData: await fetchAPI('lounge')
        }

        //Populating the global room object
        globalRoom = data.roomData;

        //Handling data dependent modules
        for (const module of loadedModules) {
            if (module.type === 'data') {
                module.run(data);
            }
        }

    }, 5000);

    //Message Loop
    while (true) {
        //Retrieving the newest messages of the current room
        let room = await fetchNewMessages();
        if (room.talks && update > 0) {

            //Handling message flow dependent modules
            for (const module of loadedModules) {
                if (module.type === 'message') {
                    module.run(room.talks);
                }

            }
        }
        update = room.update;
    }


    /************************************
     *
     *
     * DATA HANDLING
     *
     *
     ************************************/

    //Loads data from the local storage
    async function loadData() {
        let data = JSON.parse(localStorage.getItem('DrrrUtils'));
        if (data) {
            for (module of modules) {
                if (module.storage !== undefined) {
                    if (data[module.storageKey] !== undefined) {
                        module.storage = data[module.storageKey];
                    } else {
                        module.storage = [];
                    }
                }
            }
        }
    }

    //Adds data to local storage, to a certain key element.
    async function addData(module, value) {
        if (module.storage) {
            let data = JSON.parse(localStorage.getItem('DrrrUtils'));
            if (data) {
                if (data[module.storageKey]) {
                    data[module.storageKey].push(value);
                    localStorage.setItem('DrrrUtils', JSON.stringify(data));
                } else {
                    data[module.storageKey] = [value];
                    localStorage.setItem('DrrrUtils', JSON.stringify(data));
                }
            } else {
                let drrrUtils = {};
                drrrUtils[module.storageKey] = [value];
                localStorage.setItem('DrrrUtils', JSON.stringify(drrrUtils));
            }
            loadData();
        }
    }

    //Removes data from the local storage, from a certain key element.
    async function removeData(module, value) {

        //console.log(`Removing ${value} from Module ${module.name}`);

        let data = JSON.parse(localStorage.getItem('DrrrUtils'));
        if (data) {
            if (data[module.storageKey]) {
                const index = data[module.storageKey].indexOf(value);
                if (index > -1) {
                    data[module.storageKey].splice(index, 1);
                    localStorage.setItem('DrrrUtils', JSON.stringify(data));
                }
                loadData();
            }
        }
    }

    async function emptyData() {
        localStorage.removeItem('DrrrUtils');
        loadData();
    }

    /************************************
     *
     *
     * BASIC UTILITY FUNCTIONS
     *
     *
     ************************************/

    /*
    Fetches a certain API endpoint depending on what path you choose.
    Possible paths for drrr.com would be: room, lounge or an empty path.
    The function returns the result of the fetch operation in json format.
    */
    async function loadModule(module) {
        //console.log(`Loading module ${module.name}`);
        loadedModules.push(module);
    }

    async function unloadModule(module) {
        //console.log(`Unloading module ${module.name}`);
        const index = loadedModules.indexOf(module);
        (index > -1) ? loadedModules.splice(index, 1): 0;
    }

    async function findModule(name, ) {
        return modules.filter(module => module.name === name)[0];
    }

    async function fetchAPI(path) {
        let response = await fetch(`https://drrr.com/${path}/?api=json&update=${update}`);
        const json = await response.json();
        return json;
    }

    async function fetchNewMessages() {
        let response = await fetch(`https://drrr.com/json.php?update=${update}`);
        const json = await response.json();
        return json;
    }

    async function postAPI(path, data) {
        const formData = new FormData();
        formData.append(data[0], data[1]);
        let response = await fetch(`https://drrr.com/${path}/?ajax=1&api=json`, {
            method: 'POST',
            body: formData
        });
        return response;
    }

    async function findUser(userName, users) {
        return users.filter(user => user.name === userName)[0];
    }

    async function banUser(user) {
        return await postAPI('room',
            ['report_and_ban_user', user.id]
        );
    }

    async function kickUser(user) {
        return await postAPI('room',
            ['kick', user.id]
        );
    }

    async function sendMessage(message) {
        return await postAPI('room',
            ['message', message]
        );
    }

    async function changeRoomTitle(title) {
        return await postAPI('room', ['room_name', title]);
    }

    async function changeRoomDescription(description) {
        return await postAPI('room', ['room_description', description]);
    }

    async function changeDJMode(state) {
        return await postAPI('room', ['dj_mode', state]);
    }

    async function changeHost(user) {
        return await postAPI('room', ['new_host', user.id]);
    }

    async function forceNightMode() {
        document.body.classList.add('game-room--night');
    }

    async function forceDayMode() {
        document.body.classList.remove('game-room--night');
    }


    /************************************
     *
     *
     * FRONT END
     *
     *
     ************************************/

    async function createModuleHTML(module) {
        return `<div class="module">
    <div class="item-wrapper">
         <h4>${module.name}</h4>
         <button class="button" id="button-${module.storageKey}">🔧</button>
    </div>
  </div>`;
    }

    async function createComplexModuleHTML(module) {
        return `<div class="module-container draggable" id="${module.storageKey}-container">
        <div id="module-header">
            <h3>
                ${module.name}
            </h3>
            <label class="toggle" id= "toggle-${module.storageKey}" for="myToggle-${module.storageKey}">
                <input class="toggle__input" name="" type="checkbox" id="myToggle-${module.storageKey}" style="display: none;">
                <div class="toggle__fill"></div>
            </label>
        </div>
        <div class="flex">
            <div class="item">
                <div class="item-wrapper">
                    <p>Add User:</p>
                </div>
                <div class="item-wrapper">
                    <textarea class="module-input" name="${module.storageKey}" id="${module.storageKey}-input" rows="1" cols=16 style="width: 70%;"></textarea>
                    <button class="module-button" id="${module.storageKey}-add">ADD</button>
                </div>
            </div>
            <div class="item">
                <div class="item-wrapper">
                    <div>
                        <p>${module.name}-Users:</p>
                    </div>
                </div>
                <div class="item-wrapper">
                    <div id="textbox">
                        <span class="TagsInput-selected" id="TagsInput-selected-${module.storageKey}">
                        </span>
                    </div>
                </div>
            </div>
        </div>`
    }


    async function createSimpleModuleHTML(module) {
        return `<div class="module-container draggable" id="${module.storageKey}-container">
        <div id="module-header-simple">
            <h3>
                ${module.name}
            </h3>
            <label class="toggle" id= "toggle-${module.storageKey}" for="myToggle-${module.storageKey}">
                <input class="toggle__input" name="" type="checkbox" id="myToggle-${module.storageKey}" style="display: none;">
                <div class="toggle__fill"></div>
            </label>
        </div>
        </div>`;
    }

    async function createUsernameTag(username) {
        return ` <span class="TagsInput-tag">
                <span class="TagLabel colored">
                    <span class="TagLabel-text">
                        ${username}
                    </span>
                </span>
              </span>`
    }


    async function buildHTML() {
        let moduleList = `<div class="container draggable">
                            <div id="header">
                                <h2>
                                    Modules
                                </h2>
                            </div>
                         <div class="modules">

                         </div>
                        </div>
                        `;

        $('#body').prepend(moduleList);


        for (module of modules) {
            let moduleHTML = await createModuleHTML(module);
            $(".modules").append(moduleHTML);
        }


        for (const module of modules) {
            if (module.uiType === 'complex') {
                let moduleHTML = await createComplexModuleHTML(module);
                $('#body').prepend(moduleHTML);
            } else if (module.uiType === 'simple') {
                let moduleHTML = await createSimpleModuleHTML(module);
                $('#body').prepend(moduleHTML);
            }

        }

        $('#body').prepend(`  <script>
        $(function () {
            $(".draggable").draggable();
        });
    </script>`);

    }


    async function appendCSS() {
        let moduleListCSS = `
        <style>
        .container {
        background-color: rgb(57, 57, 62);
        color: rgb(170, 170, 170);
        border: 2px solid rgb(97, 97, 101);
        border-radius: 12px;
        width: 270px;
        font-family: 'Gill Sans', 'Gill Sans MT', Calibri, 'Trebuchet MS', sans-serif;
        z-index: 5000;
        position: fixed; 

    }

    .item {
        width: 100%;
        display: flex;
        flex-direction: column;
    }

    .item-wrapper {
        width: 100%;
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
        margin-left: 2px;
        margin-right: 1rem;
    }

    .flex {
        padding: 1rem;
        display: flex;
        flex-direction: column;
        align-items: center;
    }
    #header {
        padding: 0 0 0 1rem;
        display: flex;
        flex-direction: row;
        align-items: center;
        border-bottom: 1px solid rgb(97, 97, 101);
    }

    .module {
        padding: 0 0 0 1rem;
        display: flex;
        flex-direction: row;
        align-items: center;
        border-top: 1px solid rgb(97, 97, 101);
        height: 50px;
    }

    .modules {
        overflow-y: auto;
        height: 300px;
    }

    .button {
        outline: none;
        border: none;
        font-size: x-large;
        background-color: rgb(40, 40, 43);
        border: 1px solid rgb(97, 97, 101);
        border-radius: 12px;

    }

    .button:hover {
        background-color: rgb(57, 57, 62);
    }

    .button:active {
        background-color: #ff6c69;
    }


    .module-container {
        background-color: rgb(57, 57, 62);
        color: rgb(170, 170, 170);
        border: 1px solid rgb(97, 97, 101);
        border-radius: 12px;
        width: 200px;
        font-family: 'Gill Sans', 'Gill Sans MT', Calibri, 'Trebuchet MS', sans-serif;
        position:fixed;
        z-index: 5000;
        display:none;
    }

    #module-header {
        padding: 0 0 0 1rem;
        display: flex;
        flex-direction: row;
        align-items: center;
        border-bottom: 1px solid rgb(97, 97, 101);
    }


    #module-header-simple {
        padding: 0 0 0 1rem;
        display: flex;
        flex-direction: row;
        align-items: center;
    }
    
    .flex {
        padding: 1rem;
        display: flex;
        flex-direction: column;
        align-items: center;
    }
    
    .item {
        width: 100%;
        display: flex;
        flex-direction: column;
    }
    
    .item-wrapper {
        width: 100%;
        display: flex;
        flex-direction: row;
        align-items: center;
    }
    
    #textbox {
        display: flex;
        flex-direction: row;
        align-content: center;
        flex-wrap: wrap;
        width: 100%;
        border: 1px solid rgb(97, 97, 101);
        border-radius: 12px;
        border-radius: 5px;
        min-height : 40px; 
    }
    
    .module-button {
        margin-left: 5px; border: 1px solid rgb(107, 107, 107);
        border-radius: 5px;
        color: rgb(150, 150, 150);
        background-color: rgb(77, 77, 77);
        outline: none; 
    }
    
    
    .module-button:hover {
        background-color: rgb(57, 57, 62);
    }
    
    .module-button:active {
        background-color: #ff6c69;
    }
    
    
    .TagLabel {
        font-size: 85%;
        font-weight: 600;
        display: inline-block;
        padding: .1em .5em;
        margin: .2em .1em;
        border-radius: 4px;
        background: #212121;
        font-size: 14px;
        color: #1a1a1a;
        background-color: #ff6c69;
        text-transform: none;
    }

    .TagLabel:hover {
        background-color: #ff9491;
    }
    
    .TagsInput-selected {
       margin: 3px;
    }
    
    .module-input {
        background-color: rgb(57, 57, 62);
        border: 1px solid rgb(107, 107, 107);
        border-radius: 5px;
        color: rgb(255, 255, 255);
        resize: none;
    }
    
    .toggle {
        margin-left: 15px;
        margin-top: 15px; 
        --width: 40px;
        --height: calc(var(--width) / 2);
        --border-radius: calc(var(--height) / 2);
    
        display: inline-block;
        cursor: pointer;
    }
    
    
    .toggle__fill {
        position: relative;
        width: var(--width);
        height: var(--height);
        border-radius: var(--border-radius);
        background: #ff6c69;
        transition: background 0.2s;
    }
    
    .toggle__fill::after {
        content: "";
        position: absolute;
        top: 0;
        left: 0;
        height: var(--height);
        width: var(--height);
        background: #ffffff;
        box-shadow: 0 0 10px rgba(0, 0, 0, 0.25);
        border-radius: var(--border-radius);
        transition: transform 0.2s;
    }
    
    .toggle__input:checked~.toggle__fill {
        background: #70ff69;
    }
    
    .toggle__input:checked~.toggle__fill::after {
        transform: translateX(var(--height));
    }
    </style>`;

        $(document.body).append(moduleListCSS);
    }


    async function registerEventHandlers() {
        for (module of modules) {
            //Wrench Button in the module list
            let button = await document.getElementById(`button-${module.storageKey}`);
            //Open and close the module window
            button.onclick = () => {
                let name = button.id.toString().split('-')[1];
                let moduleContainer = document.getElementById(`${name}-container`);

                (moduleContainer.style.display === 'none' || moduleContainer.style.display === '') ? moduleContainer.style.display = 'block': moduleContainer.style.display = 'none';
            }

            if (module.uiType === 'complex') {
                //Add Button of each module
                let add = await document.getElementById(`${module.storageKey}-add`);
                //Add User to list
                add.onclick = async () => {
                    let name = add.id.toString().split('-')[0];
                    let module = modules.filter(mod => mod.storageKey === name)[0];
                    let input = document.getElementById(`${name}-input`);
                    if (input.value !== '' && !module.storage.includes(input.value)) {
                        await addData(module, input.value);
                        let tag = await createUsernameTag(input.value);
                        input.value = '';
                        let htmlTag = $(`#TagsInput-selected-${name}`).append(tag);
                        for (const element of htmlTag[0].childNodes) {
                            if (element.nodeName !== '#text') {
                                element.onclick = () => {
                                    let value = element.firstElementChild.firstElementChild.innerHTML.trim();
                                    removeData(module, value);
                                    element.remove();
                                }
                            }
                        }
                    }
                }

            }



            //Toggle Switch of each module
            let input = document.getElementById(`myToggle-${module.storageKey}`);

            //Either load or unload the module.
            input.onchange = async () => {
                let name = input.id.toString().split('-')[1];
                let module = modules.filter(mod => mod.storageKey === name)[0];

                if (!loadedModules.includes(module)) {
                    loadModule(module);
                } else {
                    unloadModule(module);
                }
            }

        }
    }

    async function populateModuleHTMLwithData() {
        for (const module of modules) {
            if (module.storage) {
                for (const user of module.storage) {
                    let tag = await createUsernameTag(user);
                    let htmlTag = $(`#TagsInput-selected-${module.storageKey}`).append(tag);
                    for (const element of htmlTag[0].childNodes) {
                        if (element.nodeName !== '#text') {
                            element.onclick = () => {
                                let value = element.firstElementChild.firstElementChild.innerHTML.trim();
                                removeData(module, value);
                                element.remove();
                            }
                        }
                    }
                }
            }
        }
    }



})();
