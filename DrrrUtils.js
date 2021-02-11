let update = 0;
let prefix = '!';
/*
There are two types of modules: 
1: Modules that are dependent on room data, such as the users in a room, the room title, room description, lounge data etc. (modules)
2: Modules that are dependent on the newest messages in a room. (messageModules)
That is why I have to differentiate between message flow dependent modules and data dependent modules. 
They simply get their data in different places.
The data dependent modules are handled in the Main Loop, message dependent modules in the message loop.
Maybe I will find a better way of handling this situation later, if you have any recommendations, feel free to tell me about it!
*/
let loadedModules = [];
let commands = [];


/************************************
 *
 *
 * Modules
 *
 *
 ************************************/

let blacklist = {
    name: 'blacklist',
    type: 'data',
    storage: [],
    storageKey: 'blacklistedUsers',
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
    name: 'whitelist',
    type: 'data',
    storage: [],
    storageKey: 'whitelistedUsers',
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
    name: 'notifyUser',
    type: 'data',
    storage: [],
    storageKey: 'notifyUsers',
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
    name: 'dmCounter',
    type: 'data',
    storage: undefined,
    run: async function ({
        roomData
    }) {
        let dms = 35 - roomData.room.talks.length;
        console.log(dms);
    }
};

let mute = {
    name: 'mute',
    type: 'message',
    storage: [],
    storageKey: 'mutedUsers',
    run: async function (talks) {
        for (const message of talks) {
            if (message.type === 'message') {
                if (this.storage.includes(message.from.name)) {
                    setTimeout(async () => {
                        let htmlMessage = document.getElementById(`${message.id}`);
                        console.log(htmlMessage);
                        htmlMessage.parentNode.removeChild(htmlMessage);
                    }, 100);
                }
            }
        }
    }
};

let greetUser = {
    name: 'greetUser',
    type: 'message',
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
    name: 'commandHandler',
    type: 'message',
    storage: undefined,
    run: async function (talks) {

        for (const message of talks) {
            if (message.message === '!ping') {
                await sendMessage('pong!');
            }
        }

    }
};

/*
For some reason has to be down here, otherwise it cries, saying "blacklist is not defined mimimi"
*/
let modules = [blacklist, whitelist, notifyUser, dmCounter, mute, commandHandler, greetUser];

loadData();


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
    for (module of modules) {
        if (module.storage !== undefined)
            module.storage = JSON.parse(localStorage.getItem(module.storageKey));
    }
}

//Adds data to local storage, to a certain key element.
async function addData(key, value) {
    let data = JSON.parse(localStorage.getItem(key));
    console.log(data);
    if (data) {
        data.push(value);
        localStorage.setItem(key, JSON.stringify(data));
    } else {
        localStorage.setItem(key, JSON.stringify([value]));
    }
    loadData();
}

//Removes data from the local storage, from a certain key element.
async function removeData(key, value) {
    let data = JSON.parse(localStorage.getItem(key));
    const index = data.indexOf(value);
    if (index > -1) {
        data.splice(index, 1);
        localStorage.setItem(key, JSON.stringify(data));

    }
    loadData();
}

async function emptyData(key)
{
    localStorage.setItem(key, null);
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
    loadedModules.push(module);
}

async function unloadModule(module) {
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

async function forceNightMode() {
    document.body.classList.add('game-room--night');
}