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
    run: async function (talks) {
        for (const message of talks) {
            if (message.type === 'message') {
                if (this.storage.includes(message.from.name)) {
                    setTimeout(async () => {
                        let htmlMessage = document.getElementById(`${message.id}`);
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
async function main(){
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
                if (data[module.name] !== undefined) {
                    module.storage = data[module.name];
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
            if (data[module.name]) {
                data[module.name].push(value);
                localStorage.setItem('DrrrUtils', JSON.stringify(data));
            } else {
                data[module.name] = [value];
                localStorage.setItem('DrrrUtils', JSON.stringify(data));
            }
        } else {
            let drrrUtils = {};
            drrrUtils[module.name] = [value];
            localStorage.setItem('DrrrUtils', JSON.stringify(drrrUtils));
        }
        loadData();
    }
}

//Removes data from the local storage, from a certain key element.
async function removeData(module, value) {
    let data = JSON.parse(localStorage.getItem('DrrrUtils'));
    if (data) {
        if (data[module.name]) {
            const index = data[module.name].indexOf(value);
            if (index > -1) {
                data[module.name].splice(index, 1);
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


/************************************
 *
 *
 * FRONT END
 *
 *
 ************************************/

i18n = {
    zh: { utilSetting: '插件設定'
        , moduleName: '模組名稱'
        , moduleSave: '儲存'
        , moduleConfig: '模組設定'
        , removeEntry: '移除條目'
        , newEntry: '新增條目'
    },
    en: { utilSetting: 'Utility Setting'
        , moduleName: 'Module Name'
        , moduleSave: 'Save'
        , moduleConfig: 'Module Config'
        , removeEntry: '-'
        , newEntry: '+'
    }
}

function plugCSS(){
    const css = `
  <style>
    #form-settings-util-module-config {
      border-right-width: 2px;
      background: rgba(255,255,255,.1);
      color: #fff;
      border-width: 2px;
    }
  </style>`
    $('head').append(css);
}

function plugSettingUI(){
    const lang = ['zh-TW', 'zh-CN'].includes($('html').attr('lang')) ? i18n.zh : i18n.en;

    const moduleOptions = modules.map(m => `<option class="modal-content">${m.name}</option>`).join('');

    const tabIndex = `<li role="presentation" id="settings-util-tab" class="">
      <a href="#settings-util" aria-controls="settings-util" role="tab" data-toggle="tab" aria-expanded="false">${lang.utilSetting}</a>
  </li>`;

    const entry = val => `
  <div class="input-group">
    <input class="form-control" value="${val}" disabled/>
    <span class="input-group-btn">
      <button class="btn btn-default form-settings-util-entry-remove" type="button">${lang.removeEntry}</button>
    </span>
  </div>`

    const tabContent = `<div role="tabpanel" class="tab-pane" id="settings-util">
              <p></p>
              <div class="form-group" id="settings-util-name">
                <label for="form-settings-util-name">${lang.moduleName}</label>
                <div class="input-group">

                  <select class="form-control" id="form-settings-util-module-name" name="util_name">
                      ${moduleOptions}
                  </select>

                  <span class="input-group-btn">
                    <button class="btn btn-default" type="button" id="form-settings-util-module-save">${lang.moduleSave}</button>
                  </span>

                </div>
              </div>
              <div class="form-group" id="settings-util-config">

                <label for="form-settings-util-config">${lang.moduleConfig}</label>

                <!-- textarea style -->
                <textarea rows="10" type="text" class="form-control module-content"
                id="form-settings-util-module-textarea" placeholder="config here"></textarea>

                <!-- entry style -->
                <div id="form-settings-util-module-entries">
                  <div id="module-entries">
                  </div>
                  <div class="input-group">
                    <input class="form-control" placeholder="new entry"/>
                    <span class="input-group-btn">
                      <button class="btn btn-default form-settings-util-entry-new" type="button">${lang.newEntry}</button>
                    </span>
                  </div>
                </div>
              </div>
  </div>`;
    $('#modal-settings').find('ul').append(tabIndex);
    $('.tab-content').append(tabContent);

    const getModule = () => modules[$('#form-settings-util-module-name').prop('selectedIndex')]

    $('#form-settings-util-module-name').on('change', function(){
        $('#form-settings-util-module-textarea').hide();
        $('#form-settings-util-module-entries').hide();
        let currentModule = getModule();
        if(currentModule.storage instanceof Array){
            $('#module-entries').empty();
            for(e of currentModule.storage){
                $('#module-entries').append(entry(String(e)));
            }
            $('.form-settings-util-entry-remove').click(function(){
                let val = $(this).parent().parent().find('input').val();
                removeData(getModule(), val);
                $('#form-settings-util-module-name').change();
            })
            $('#form-settings-util-module-entries').show();
        }
        else{
            $('#form-settings-util-module-textarea').val(JSON.stringify(currentModule.storage))
            $('#form-settings-util-module-textarea').show();
        }
    }).change();

    $('.form-settings-util-entry-new').click(function(){
        let input = $(this).parent().parent().find('input');
        let val = input.val();
        input.val('');
        if(val.trim().length){
            addData(getModule(), val.trim());
            $('#form-settings-util-module-name').change();
        }
        else
            $('head').append('<script>swal("Empty Entry")</script>');
    })

    $('#form-settings-util-module-save').on('click', function(){
        $('head').append(`<script>swal("save button for textarea, but seems like we don't need it")</script>`);
        // text area on save
        /*
    try{
      config = $('#form-settings-util-module-config').val()
      if(config.trim().length)
        config = JSON.parse(config)
      else
        config = undefined;
      modules[$('#form-settings-util-module-name').prop('selectedIndex')].storage = config
      $('head').append('<script>swal("done")</script>');
    }
    catch(err){ alert(err); }
    */
    })
}

$(document).ready(function(){
    plugCSS();
    plugSettingUI();
    main(); // await is not permit in non-async function in some browser
    // but chrome console is allowed
})
