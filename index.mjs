//fuck whoever decided that you need a workaround to use import/require in the same file
import { createRequire } from 'module';
//npm package because im too tired to rewrite the whole thing and figure out how to do circle - angled rect collisions efficiently myself
//im naming the circle from the collision package 'cricle' because there is alredy a variable named circle dont question it im sure this is a very intelligent decision that will not affect the readability whatsoever
import { Collisions, Circle as Cricle, Polygon } from 'collisions';
const require = createRequire(import.meta.url);
const WebSocket = require('ws');
const axios = require('axios');
const { performance } = require('perf_hooks');
const { QuadTree, Box, Point, Circle } = require('js-quadtree');
var map = require('./json/map-1.json');
var names = require('./json/names.json');
var gunStats = require('./json/gunstats.js');
var perkStats = require('./json/perkstats.json');
var serverconfig = require('./json/serverconfig.json');
require('dotenv').config();

function numberRange(x) {
    let arr = [];
    for (let i = 0; i < x; i++) arr.push(i);
    return arr;
}

var lvlReq = {
    '1': 100,
    '2': 300,
    '3': 600
};
var mapData = {
    mapHeight: 70000,
    mapWidth: 70000
};
var fogSize = {
    x: 2000,
    y: 2000
};
const quadtree = new QuadTree(
    new Box(0, 0, mapData.mapWidth, mapData.mapHeight),
    {
        removeEmptyNodes: true,
        arePointsEqual: (point1, point2) =>
            point1.id === point2.id && point1.type === point2.type
    }
);

const server = new WebSocket.Server({ port: serverconfig.port });
const password = process.env['password'];
const secretkey = process.env['secretkey'];
const connectionsPerIPLimit = serverconfig.connectionsPerIPLimit;
var ipCount = {};

var players = [];
var playerIds = [];
var maxPlayers = 81;
var playerPool = [...Array(maxPlayers)].map(() => ({}));
for (var i = 0; i < maxPlayers; i++) playerIds.push(i);

var bullets = [];
var bulletIds = [];
var maxBullets = 2000;
var bulletPool = [...Array(maxBullets)].map(() => ({}));
for (var i = 0; i < maxBullets; i++) bulletIds.push(i);

var maxObjects = 2000;
var objectIds = [];
var objectPool = [...Array(maxObjects)].map(() => ({}));
var lastObjId;
for (var i in map) {
    var obj = {
        x: map[i].rX || map[i].x,
        y: map[i].rY || map[i].y,
        id: map[i].id,
        orientation: map[i].orientation,
        type: 'object',
        objType: map[i].type,
        invincible: 1,
        hp: 1,
        maxHp: 1,
        lifespan: -1,
        hasPlayerCollision: 1
    };

    if (obj.objType == 1) {
        obj.width = 1000;
        obj.height = 1000;
    } else if (obj.objType == 2) {
        if (obj.orientation == 1) {
            obj.width = 1000;
            obj.height = 500;
        } else if (obj.orientation == 2) {
            obj.width = 500;
            obj.height = 1000;
        }
    }
    quadtree.insert(obj);
    objectPool[obj.id] = obj;
    lastObjId = obj.id;
}
for (var i = lastObjId + 1; i < maxObjects; i++) objectIds.push(i);

var maxMiscObjects = 2000;
var miscObjectIds = [];
var miscObjectPool = [...Array(maxMiscObjects)].map(() => ({}));
for (var i = 0; i < maxMiscObjects; i++) miscObjectIds.push(i);

var tickRate = 1000 / 25;
var heartbeatInterval = 2000;
var tickNum = 0;
var scoreReceived = serverconfig.scoreReceived;
const loadouts = {
    guns: numberRange(gunStats.length),
    colors: numberRange(8),
    armor: numberRange(4)
};

const armorStats = {
    '0': {
        weight: 0,
        health: 0
    },
    '1': {
        weight: 12,
        health: 30
    },
    '2': {
        weight: 22,
        health: 60
    },
    '3': {
        weight: 32,
        health: 90
    }
};

var serverData = {
    population: 0,
    max: maxPlayers,
    region: process.env['region'],
    city: process.env['city'],
    type: 'FFA',
    altUrl: process.env['url'],
    //TODO: let the game coordinator generate a random id
    id: Math.random()
        .toString(36)
        .slice(2),
    password: password
};

const updateTypes = {
    ext: 1,
    score: 2,
    player: 3,
    playerJoin: 4,
    playerLeave: 5,
    objectJoin: 6,
    objectUpdate: 7,
    objectLeave: 8,
    serverPopulation: 9,
    fog: 10,
    leaderboard: 11,
    bulletJoin: 12,
    bulletUpdate: 13,
    bulletLeave: 14,
    notif: 15,
    deathStats: 16,
    playerPerks: 17,
    otherObjectJoin: 18,
    otherObjectUpdate: 19,
    otherObjectLeave: 20,
    hitMarker: 21
};

const svPacketTypes = {
    ping: 1,
    spawn: 2,
    stateUpdate: 3,
    kicked: 4,
    joined: 5,
    accountExists: 6,
    accountExists2: 7,
    loggedIn: 8,
    dbOffline: 9,
    loggedOut: 10,
    alreadyLoggedIn: 11,
    invalidCreds: 12,
    playerJoinScreen: 13,
    playerUpdate: 14,
    playerExitScreen: 15,
    objectJoinScreen: 16,
    objectExitScreen: 17,
    gamemode: 18
};

const clPacketTypes = {
    grecaptcha: 0,
    ping: 1,
    spawn: 2,
    logout: 6,
    login: 7,
    register: 8,
    connect: 9,
    keydown: 10,
    keyup: 11,
    chat: 12,
    mousemove: 13,
    respawn: 14,
    upgrade: 15,
    special: 16
};

const chatOptions = {
    open: 1,
    close: 2,
    msg: 3
};

const keyCodes = {
    mouse: 0,
    left: 1,
    right: 2,
    up: 3,
    down: 4,
    space: 5,
    reload: 6,
    none: 7
};

const upgradeTypes1 = [
    'accuracy',
    'bino',
    'armorpiercing',
    'damage',
    'largemags',
    'fastreload',
    'bulletspeed',
    'speed',
    'range',
    'kevlar'
];

const upgradeTypes2 = ['gas', 'dash', 'build'];

const objectTypes = {
    gas: 0
};

const notifTypes = {
    hitDmg: 0,
    kill: 1,
    death: 2
};

const deathReasons = {
    fog: 0,
    bullet: 1
};

for (var i in names) {
    names[i] = {
        name: names[i],
        used: 0
    };
}

server.on('connection', function connection(ws, req) {
    ws.ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    var isPingConnection = req.url == '/ping';

    if (isPingConnection) {
        //prevents slow loris attack
        setTimeout(() => ws.readyState === WebSocket.OPEN && ws.close, 60000);
    } else {
        if (!ipCount[ws.ip]) ipCount[ws.ip] = 0;
        ipCount[ws.ip]++;

        //if player limit or connections per ip limit reached, kick the player
        if (players.length >= maxPlayers) return kick(ws, 'player limit reached');
        if (ipCount[ws.ip] > connectionsPerIPLimit)
            return kick(ws, 'connection per ip limit reached');
    }

    var player = {
        socket: ws,
        gameplayer: {}
    };

    ws.on('message', msg => recieveMsg(player, msg, isPingConnection));

    ws.on('close', () => isPingConnection || handleOnclose(player));
});

function initializePlayer(player, existingName) {
    var name;
    if (!existingName) {
        for (var i in names) {
            if (names[i].used == 0) {
                names[i].used = 1;
                name = names[i].name;
                break;
            }
        }
    }
    player.gameplayer = {
        type: 3,
        playing: true,
        spawned: false,
        spawning: {
            is: false
        },
        username: {
            guest: true,
            name: existingName || name
        },
        playerId: playerIds.shift(),
        x: null,
        y: null,
        vx: 1366,
        vy: 768,
        radius: 200,
        maxSpeed: null,
        spdX: null,
        spdY: null,
        hp: null,
        invincible: null,
        gun: null,
        color: null,
        armor: null,
        mouseAngle: 0,
        score: null,
        kills: null,
        mouse: null,
        up: null,
        down: null,
        right: null,
        left: null,
        space: null,
        healthRegenRate: 10,
        armorRegenRate: 10,
        perks: {
            '1': null,
            '2': null,
            '3': null
        },
        perkIndexes: {
            '1': null,
            '2': null,
            '3': null
        },
        perkArr: [],
        recentlyUpgraded: [],
        inView: {
            obstacles: [],
            objects: [],
            bullets: [],
            players: []
        },
        ticksSinceDeath: 0,
        chatboxOpen: false,
        chatMsg: null,
        shootingTimeout: 0,
        reloadingTimeout: 0,
        recentKills: [],
        receivedDmgMultiplier: 1,
        recoilMultiplier: 1,
        bulletSpeedMultiplier: 1,
        varianceFactor: 1,
        damageMultiplier: 1,
        bulletLifespanMultiplier: 1,
        reloadTimeoutMultiplier: 1,
        directDamageToHP: 0,
        dashing: 0,
        dashDuration: 0
    };
}

function recieveMsg(player, msg, isPingConnection) {
    var data = new Uint8Array(msg);
    var opcode = data[0];

    if (isPingConnection && opcode !== clPacketTypes.ping)
        return kick(
            player.socket,
            'sending non-ping packages as a ping connection'
        );

    switch (opcode) {
        case clPacketTypes.ping:
            player.socket.lastPing = Date.now();
            var buf = new ArrayBuffer(1);
            var dv = new DataView(buf);
            dv.setUint8(0, svPacketTypes.ping);
            setTimeout(() => player.socket.send(buf), 50);
            break;
        case clPacketTypes.spawn:
            handleSpawn(player, data);
            break;
        case clPacketTypes.login:
            handleLogin(player, msg);
            break;
        case clPacketTypes.register:
            handleRegister(player, msg);
            break;
        case clPacketTypes.logout:
            handleLogout(player, msg);
            break;
        case clPacketTypes.connect:
            handleConnect(player);
            break;
        case clPacketTypes.keydown:
            handleKeyDown(player, data);
            break;
        case clPacketTypes.keyup:
            handleKeyUp(player, data);
            break;
        case clPacketTypes.chat:
            handleChat(player, msg);
            break;
        case clPacketTypes.mousemove:
            handleMouseMove(player, data);
            break;
        case clPacketTypes.respawn:
            handleRespawn(player);
            break;
        case clPacketTypes.upgrade:
            handleUpgrade(player, data);
            break;
        case clPacketTypes.special:
            handleSpecial(player, data);
            break;
        case clPacketTypes.grecaptcha:
            var token = new TextDecoder().decode(data.slice(1));
            axios
                .post(
                    `https://www.google.com/recaptcha/api/siteverify?secret=${secretkey}&response=${token}&remoteip=${
                    player.socket.ip
                    }`
                )
                .then(res => {
                    player.socket.sentToken = true;
                    if (res.score < 0.1)
                        kick(player.socket, 'not enough recaptcha score');
                })
                .catch(err => {
                    //kick(player.socket, 'recaptcha threw error')
                });
            break;
        default:
            kick(player.socket, 'packet had invalid opcode');
            break;
    }
}

function handleSpecial(player, data) {
    var p = player.gameplayer;
    switch (data[1]) {
        //killbind tf2
        case 0:
            //you can't kill yourself if you are already dead
            if (!p.spawned || p.dying || p.dead || p.invincible) break;
            p.killedBy = 'yourself!';
            p.deathReason = deathReasons.bullet;
            p.hp = 0;
            p.dying = true;
            break;

        //kick every connection from this ip
        case 1:
            if (serverconfig.disableMultibox)
                for (var socket of server.clients)
                    if (socket.ip == player.socket.ip)
                        kick(socket, 'multibox detection via client', true);
            break;
    }
}

function handleConnect(player) {
    if (player.gameplayer.playing)
        kick(player.socket, 'gameplayer is already playing');
    players.push(player);
    initializePlayer(player);
    var buf = new ArrayBuffer(1);
    var dv = new DataView(buf);
    dv.setUint8(0, svPacketTypes.joined);
    player.socket.send(buf);
    var buf2 = new ArrayBuffer(2);
    var dv2 = new DataView(buf2);
    dv2.setUint8(0, svPacketTypes.gamemode);
    if (serverData.type == 'FFA') dv2.setUint8(1, 0);
    player.socket.send(buf2);
}

function handleSpawn(player, data) {
    player.socket.sendToken = false;
    var gp = player.gameplayer;
    if (!gp.spawning.is && !gp.spawned) {
        gp.spawning.is = true;
        if (
            typeof loadouts.guns[data[1]] == 'number' &&
            typeof loadouts.colors[data[2]] == 'number' &&
            typeof loadouts.armor[data[3]] == 'number'
        ) {
            gp.gun = data[1];
            gp.color = data[2];
            gp.armorSelection = data[3];
        } else {
            kick(player.socket, 'invalid loadout selection');
        }
    } else {
        kick(player.socket, 'already spawned');
    }
    setTimeout(() => {
        if (!player.socket.sentToken)
            kick(player.socket, 'no recaptcha token sent in time');
    }, 4000);
}

function handleRespawn(player) {
    var gp = player.gameplayer;
    if (gp.dead) {
        playerIds.push(gp.playerId);
        playerPool[gp.playerId] = {};
        initializePlayer(player, gp.username.guest ? gp.username.name : undefined);
    } else {
        kick(player.socket, 'tried to respawn while not dead');
    }
}

function handleKeyDown(player, data) {
    var code = data[1],
        gp = player.gameplayer;
    switch (code) {
        case keyCodes.mouse:
            gp.mouse = 1;
            break;
        case keyCodes.up:
            gp.up = 1;
            break;
        case keyCodes.down:
            gp.down = 1;
            break;
        case keyCodes.left:
            gp.left = 1;
            break;
        case keyCodes.right:
            gp.right = 1;
            break;
        case keyCodes.space:
            gp.space = 1;
            break;
        case keyCodes.reload:
            if (gp.ammo < gp.maxAmmo && gp.reloadingTimeout <= 0)
                forcePlayerReload(gp);
            break;
        case keyCodes.none:
            gp.mouse = 0;
            gp.up = 0;
            gp.down = 0;
            gp.left = 0;
            gp.right = 0;
            gp.space = 0;
            break;
        default:
            kick(player.socket, 'invalid keydown command');
            break;
    }
}

function forcePlayerReload(gp) {
    gp.reloadingTimeout =
        gunStats[gp.gun].reload +
        gunStats[gp.gun].reloadPerMissingBullet * (gp.maxAmmo - gp.ammo);
    gp.shootingTimeout = 0;
    gp.reloading = 1;
}

function handleKeyUp(player, data) {
    var code = data[1];
    switch (code) {
        case keyCodes.mouse:
            player.gameplayer.mouse = 0;
            break;
        case keyCodes.up:
            player.gameplayer.up = 0;
            break;
        case keyCodes.down:
            player.gameplayer.down = 0;
            break;
        case keyCodes.left:
            player.gameplayer.left = 0;
            break;
        case keyCodes.right:
            player.gameplayer.right = 0;
            break;
        case keyCodes.space:
            player.gameplayer.space = 0;
            break;
        case keyCodes.reload:
            break;
        default:
            kick(player.socket, 'invalid keyup command');
            break;
    }
}

function handleMouseMove(player, data) {
    var dv = new DataView(data.buffer);
    var angle = dv.getUint16(1);
    player.gameplayer.angle = angle;
}

function handleChat(player, data) {
    player = player.gameplayer;
    var action = data[1];
    if (player.dead) return;
    if (action == chatOptions.open) {
        player.oldChatboxOpen = player.chatboxOpen;
        player.chatboxOpen = true;
    } else if (action == chatOptions.close) {
        player.oldChatboxOpen = player.chatboxOpen;
        player.chatboxOpen = false;
    } else if (action == chatOptions.msg) {
        var msg = new TextDecoder().decode(new Uint8Array(data.slice(2)));
        if (msg.length > 32) {
            player.chatMsg = 'you tried :)';
            return;
        }
        var test = new RegExp('^[\x00-\x7F]*$').test(msg);
        player.oldChatMsg = '';
        if (test) player.chatMsg = msg;
        else player.chatMsg = 'you tried :)';
    }
}

function handleUpgrade(player, data) {
    //read the websocket data so we know what the fuck the player wants to upgrade
    var gp = player.gameplayer,
        dv = new DataView(data.buffer),
        upgradeIdx = dv.getUint8(2),
        upgradeSlot = dv.getUint8(1),
        upgrade = (upgradeSlot == 2 ? upgradeTypes2 : upgradeTypes1)[upgradeIdx];

    //if we spot ANY INDICATION OF CHEATING, kick the player
    if (
        !upgrade ||
        gp.perks[upgradeSlot] ||
        gp.score < lvlReq[upgradeSlot] ||
        gp.perkArr.includes(upgrade)
    )
        return kick(player.socket, 'invalid upgrade');

    //this keeps track of the upgrade happening
    gp.changedPerks = true;
    gp.perks[upgradeSlot] = upgrade;
    gp.perkIndexes[upgradeSlot] = upgradeIdx;
    gp.perkArr.push(upgrade);
    gp.recentlyUpgraded.push(upgrade);

    //this here applies the upgrade's stats
    let perkData = perkStats[upgrade];
    if (!perkData.player) return;
    for (let attribute in perkData.player) {
        if (gp[attribute]) {
            gp[attribute] *= perkData.player[attribute];
        } else {
            gp[attribute] = perkData.player[attribute];
        }
    }
    gp.maxAmmo = Math.round(gp.maxAmmo);
    gp.ammo = Math.round(gp.ammo);
}

function handleLogin(player, msg) {
    if (player.socket.loggingIn || player.socket.loggedIn) {
        kick(player.socket, 'tried to logged after having already logged in');
        return;
    }
    player.socket.loggingIn = true;
    var txtData = new TextDecoder().decode(msg);
    var credentials = txtData.split('\x00');
    credentials[0] = credentials[0].split('\x07')[1];
    var user = credentials[0];
    var pass = credentials[1];
    if (
        (/[^0-9a-z]/gi.test(user) && !/^\S+@\S+\.\S+$/.test(pass)) ||
        user.length < 3 ||
        user.length > 64 ||
        user.includes(':') ||
        pass.length < 3 ||
        pass.length > 40 ||
        pass.includes(':')
    ) {
        kick(player.socket, 'failed login credential regex check');
    } else {
        axios
            .post(`https://${serverconfig.apiUrl}/login`, {
                data: credentials.toString(),
                server: serverData.id
            })
            .then(res => {
                var $data = res.data.split(',');
                var buf = new ArrayBuffer(1);
                var dv = new DataView(buf);
                if ($data[0] == 'er') {
                    player.socket.loggingIn = false;
                    dv.setUint8(0, svPacketTypes.dbOffline);
                    player.socket.send(buf);
                } else if ($data[0] == 'ic') {
                    player.socket.loggingIn = false;
                    dv.setUint8(0, svPacketTypes.invalidCreds);
                    player.socket.send(buf);
                } else if ($data[0] == 'al') {
                    player.socket.loggingIn = false;
                    dv.setUint8(0, svPacketTypes.alreadyLoggedIn);
                    player.socket.send(buf);
                } else if ($data[0] == 'lg') {
                    player.socket.loggingIn = false;
                    player.socket.loggedIn = true;
                    player.gameplayer.username.guest = false;
                    for (var i in names) {
                        if (names[i].name == player.gameplayer.username.name) {
                            names[i].used = 0;
                            break;
                        }
                    }
                    player.gameplayer.username.name = $data[1];
                    dv.setUint8(0, svPacketTypes.loggedIn);
                    var userUint8 = new TextEncoder().encode($data[1]);
                    var userBuf = userUint8.buffer;
                    buf = appendBuffer(buf, userBuf);
                    player.socket.send(buf);
                }
            })
            .catch(error => kick(player.socket, 'invalid credentials'));
    }
}

function handleLogout(player, msg) {
    axios
        .post(`https://${serverconfig.apiUrl}/logout`, {
            data: player.gameplayer.username.name
        })
        .then(res => {
            player.socket.loggedIn = false;
            var buf = new ArrayBuffer(1);
            var dv = new DataView(buf);
            dv.setUint8(0, svPacketTypes.loggedOut);
            player.socket.send(buf);
            for (var i in names) {
                if (names[i].used == 0) {
                    names[i].used = 1;
                    player.gameplayer.username.guest = true;
                    player.gameplayer.username.name = names[i].name;
                    break;
                }
            }
        })
        .catch(error => kick(player.socket, 'invalid logout credentials'));
}

function handleRegister(player, msg) {
    if (player.socket.registering || player.socket.loggedIn) {
        kick(player.socket, 'player is registering again');
        return;
    }
    player.socket.registering = true;
    var txtData = new TextDecoder().decode(msg);
    if ((txtData.match(/\x00/g) || []).length != 2) {
        kick(player.socket, 'invalid register format');
        return;
    }
    var credentials = txtData.split('\x00');
    credentials[0] = credentials[0].split('\x08')[1];
    var user = credentials[0];
    var email = credentials[1];
    var pass = credentials[2];

    if (
        !user ||
        user.length < 3 ||
        user.length > 14 ||
        /^[^0-9a-z]$/gi.test(user) ||
        !email ||
        !/^\S+@\S+\.\S+$/.test(email) ||
        email.includes(':') ||
        email.length > 64 ||
        !pass ||
        pass.length < 3 ||
        pass.length > 40 ||
        pass.includes(':')
    ) {
        return kick(player.socket, 'invalid registration');
    }
    axios
        .post(`https://${serverconfig.apiUrl}/createAccount`, {
            data: credentials.toString(),
            server: serverData.id
        })
        .then(res => {
            var $data = res.data.split(',');
            var buf = new ArrayBuffer(1);
            var dv = new DataView(buf);
            if ($data[0] == 'ae') {
                player.socket.registering = false;
                dv.setUint8(0, svPacketTypes.accountExists);
                player.socket.send(buf);
            } else if ($data[0] == 'ae2') {
                player.socket.registering = false;
                dv.setUint8(0, svPacketTypes.accountExists2);
                player.socket.send(buf);
            } else if ($data[0] == 'er') {
                player.socket.registering = false;
                dv.setUint8(0, svPacketTypes.dbOffline);
                player.socket.send(buf);
            } else if ($data[0] == 'lg') {
                player.socket.registering = false;
                player.socket.loggedIn = true;
                player.gameplayer.username.guest = false;
                for (var i in names) {
                    if (names[i].name == player.gameplayer.username.name) {
                        names[i].used = 0;
                        break;
                    }
                }
                player.gameplayer.username.name = $data[1];
                dv.setUint8(0, svPacketTypes.loggedIn);
                var userUint8 = new TextEncoder().encode($data[1]);
                var userBuf = userUint8.buffer;
                buf = appendBuffer(buf, userBuf);
                player.socket.send(buf);
            }
        })
        .catch(error => kick(player.socket, 'bad account creation'));
}

function kick(ws, reason, silent) {
    if (!reason) reason = 'unknown reason';

    //just in case something fishy is going on
    if (serverconfig.revealIpInConsole) {
        console.log('Kicked ' + ws.ip + ' for: ' + reason);
    } else {
        console.log('Kicked a player for: ' + reason);
    }

    if (!silent) {
        var buf = new ArrayBuffer(1);
        var dv = new DataView(buf);
        dv.setUint8(0, svPacketTypes.kicked);
        ws.send(buf);
    }
    ws.close();
}

function handleOnclose(player) {
    if (!player.gameplayer.playing) return;
    playerIds.push(player.gameplayer.playerId);
    if (player.gameplayer.username.guest) {
        for (var i in names) {
            if (names[i].name == player.gameplayer.username.name) {
                names[i].used = 0;
                break;
            }
        }
    } else {
        axios
            .post(`https://${serverconfig.apiUrl}/logout`, {
                data: player.gameplayer.username.name
            })
            .then(res => { })
            .catch(error => { });
    }
    quadtree.remove({
        x: player.gameplayer.x,
        y: player.gameplayer.y,
        id: player.gameplayer.playerId,
        type: 'player'
    });
    players.splice(players.indexOf(player), 1);
    playerPool[player.gameplayer.playerId] = {};

    ipCount[player.socket.ip]--;
    //prevents a limited memory leak based on ips being stored for no reason
    if (!ipCount[player.socket.ip]) delete ipCount[player.socket.ip];
}

function appendBuffer(buffer1, buffer2) {
    var tmp = new Uint8Array(buffer1.byteLength + buffer2.byteLength);
    tmp.set(new Uint8Array(buffer1), 0);
    tmp.set(new Uint8Array(buffer2), buffer1.byteLength);
    return tmp.buffer;
}

function toArrayBuffer(string) {
    var byteArray = new TextEncoder().encode(string);
    var buffer = byteArray.buffer;
    return buffer;
}

var apiSocket = null;
function connectToAPI() {
    apiSocket = new WebSocket('wss://' + serverconfig.apiUrl, {
        headers: { password: process.env.password }
    });
    apiSocket.onclose = () => setTimeout(connectToAPI, 5000);
    apiSocket.onerror = () => setTimeout(connectToAPI, 5000);
}

var sendInfo = setInterval(() => {
    if (apiSocket !== null && apiSocket.readyState == 1)
        apiSocket.send(JSON.stringify(serverData));
    else if (apiSocket == null) connectToAPI();
}, 5000);

var updatePopulation = setInterval(() => {
    serverData.population = 0;
    for (var i in players)
        if (players[i].gameplayer.playing) serverData.population++;
}, 1000);

//Game loop
var previousTick = performance.now();
var gameLoop = function() {
    var now = performance.now();
    update();
    setTimeout(gameLoop, tickRate);
};

function generateSpawnPositionInsideFog() {
    return {
        x: 35000 + fogSize.x * (Math.random() - 0.5) * 9.5, //fog size * 10 = fog size on map
        y: 35000 + fogSize.y * (Math.random() - 0.5) * 9.5 //the "* 0.95" is to make sure they dont spawn too near the fog
    };
}

//get a spawning position that is far enough away from other players
//TODO: make it allow to spawn close to team mates when TDM and/or DOM gets added
function getValidSpawnLocation(closeness) {
    let position,
        tooCloseToSomeoneElse = true,
        maxAttempts = 10;
    while (tooCloseToSomeoneElse) {
        position = generateSpawnPositionInsideFog();
        tooCloseToSomeoneElse = false;
        for (let player in players) {
            if (
                (player.x - position.x) ** 2 + (player.y - position.y) ** 2 <
                closeness ** 2
            ) {
                position = generateSpawnPositionInsideFog();

                //give up after too many attempts
                tooCloseToSomeoneElse = maxAttempts--;
                break;
            }
        }
    }
    return position;
}

//Game logic
var update = function() {
    tickNum++;
    var oldFogSize = { x: fogSize.x, y: fogSize.y };
    var expectedFogSize = Math.floor(Math.sqrt(players.length)) * 1000;
    if (expectedFogSize < 2000) expectedFogSize = 2000;
    if (expectedFogSize > 7000) expectedFogSize = 7000;
    if (expectedFogSize > fogSize.x) fogSize.x++;
    if (expectedFogSize < fogSize.x) fogSize.x--;
    if (expectedFogSize > fogSize.y) fogSize.y++;
    if (expectedFogSize < fogSize.y) fogSize.y--;
    for (var i in players) {
        if (!players[i].gameplayer.spawning.is) continue;
        var p = players[i].gameplayer;
        var ps = players[i].socket;
        var spawnlocation = getValidSpawnLocation(500);
        p.x = spawnlocation.x;
        p.y = spawnlocation.y;
        p.invincible = true;
        p.spdX = 0;
        p.spdY = 0;
        p.recoilX = 0;
        p.recoilY = 0;
        p.clX = 0;
        p.clY = 0;
        p.midPerkTimeout = 0;
        p.hitMarkers = [];
        p.hp = 100;
        p.inAOE = false;
        p.maxHp = p.hp;
        if (![0, 1, 2, 3].includes(p.armorSelection))
            return kick(ps, 'invalid armor selection');
        p.maxArmor = armorStats[p.armorSelection.toString()].health;
        p.armor = p.maxArmor + 10;
        p.shotsFired = 0;
        p.shotsHit = 0;
        p.damageDealt = 0;
        p.damageTaken = 0;
        p.score = 0;
        p.kills = 0;
        p.killedBy = '';
        p.killedById = null;
        p.recentDmg = 0;
        p.maxAmmo = gunStats[p.gun.toString()].ammo;
        p.ammo = p.maxAmmo;
        p.maxSpeed =
            100 -
            gunStats[p.gun.toString()].weight -
            armorStats[p.armorSelection.toString()].weight;
        p.maxSpeedD = Math.round(Math.sqrt(p.maxSpeed ** 2 * 2) / 2);
        p.angle = 0;
        p.spawning.is = false;
        p.spawned = true;
        p.spawnedAt = Date.now();
        quadtree.insert({
            x: p.x,
            y: p.y,
            id: p.playerId,
            name: (p.username.guest ? 'Guest ' : '') + p.username.name,
            spdX: p.spdX,
            spdY: p.spdY,
            hp: p.hp,
            armor: p.armor,
            color: p.color,
            gun: p.gun,
            radius: p.radius,
            invincible: p.invincible,
            type: 'player',
            angle: p.angle
        });
        var spawnPacketBase = new ArrayBuffer(38);
        var dv = new DataView(spawnPacketBase);
        dv.setUint8(0, svPacketTypes.spawn);
        dv.setUint8(1, p.playerId);
        dv.setUint32(2, p.x);
        dv.setUint32(6, p.y);
        dv.setUint8(10, p.hp);
        dv.setUint8(11, p.gun);
        dv.setUint8(12, p.armor);
        dv.setUint8(13, p.color);
        dv.setUint8(14, p.ammo);
        dv.setUint8(15, p.username.guest);
        dv.setUint32(16, mapData.mapWidth);
        dv.setUint32(20, mapData.mapHeight);
        dv.setUint16(24, p.vx);
        dv.setUint16(26, p.vy);
        dv.setUint8(28, p.radius);
        dv.setUint8(29, players.length);
        dv.setUint32(30, fogSize.x);
        dv.setUint32(34, fogSize.y);
        var spawnPacket = appendBuffer(
            spawnPacketBase,
            toArrayBuffer(p.username.name)
        );
        ps.send(spawnPacket);
        players[i].gameplayer = p;
    }
    for (var i in players) {
        var p = players[i].gameplayer;
        if (!p.spawned) continue;
        playerPool[p.playerId] = p;
    }
    applyFogDamage();
    activateMidPerks();
    updateObjects();
    updateMidPerks();
    updateBullets();
    createBullets();
    updateScores();
    regenHealth();
    handleDeaths();
    var swappedVelocities = [];
    for (var i in players) {
        var p = players[i].gameplayer;
        if (!p.spawned || p.dying) continue;
        var ps = players[i].socket;
        if ((p.left || p.right || p.down || p.up || p.mouse) && p.invincible)
            p.invincible = false;

        var playersInView = quadtree.query(
            new Box(
                p.x - (p.vx * 10) / 2,
                p.y - (p.vy * 10) / 2,
                p.vx * 10,
                p.vy * 10
            )
        );
        playersInView = playersInView.filter(obj => {
            return obj.type == 'player';
        });

        for (var j in playersInView) {
            var player = playersInView[j];
            for (var k = 0; k < players.length; k++) {
                if (player.id == players[k].gameplayer.playerId)
                    player = players[k].gameplayer;
            }
            if (player.playerId != p.playerId) {
                //make sure velocity isnt swapped twice
                var alreadySwapped = false;
                for (var k = 0; k < swappedVelocities.length; k++) {
                    if (
                        swappedVelocities[k].includes(player.playerId) &&
                        swappedVelocities[k].includes(p.playerId)
                    ) {
                        alreadySwapped = true;
                        break;
                    }
                }
                if (alreadySwapped) continue;
                if (
                    p.radius * 1.05 + player.radius * 1.05 >
                    Math.sqrt((player.x - p.x) ** 2 + (player.y - p.y) ** 2)
                ) {
                    var temp1 = player.spdX;
                    var temp2 = player.spdY;
                    var temp3 = player.recoilX;
                    var temp4 = player.recoilY;
                    player.spdX = p.spdX;
                    player.spdY = p.spdY;
                    player.recoilX = p.recoilX;
                    player.recoilY = p.recoilY;
                    p.spdX = temp1;
                    p.spdY = temp2;
                    p.recoilX = temp3;
                    p.recoilY = temp4;
                    //serverside units are 10x greater than on the client
                    // Math.sign(x):  x > 0 => 1 | x < 0 => -1 | x = 0 => 0
                    player.clX -= Math.sign(p.x - player.x) * 10;
                    player.clY -= Math.sign(p.y - player.y) * 10;
                    p.clX -= Math.sign(player.x - p.x) * 10;
                    p.clY -= Math.sign(player.y - p.y) * 10;
                    swappedVelocities.push([player.playerId, p.playerId]);
                }
            }
        }

        if (p.dashing) {
            var vector = pointOnCircle(
                0,
                0,
                p.maxSpeed * perkStats.dash.player.speedMultiplier,
                p.angle
            );
            p.spdX = vector.x;
            p.spdY = vector.y;
        }

        for (var j in p.inView.obstacles) {
            var obj = objectPool[p.inView.obstacles[j]];

            var circleDistance = {
                x: Math.abs(p.x + p.spdX - p.recoilX - obj.x),
                y: Math.abs(p.y + p.spdY - p.recoilY - obj.y)
            };

            var distance = [{
                x: obj.x - obj.width,
                y: obj.y,
                name: 'left'
            }, {
                x: obj.x + obj.width,
                y: obj.y,
                name: 'right'
            }, {
                x: obj.x,
                y: obj.y - obj.height,
                name: 'top'
            }, {
                x: obj.x,
                y: obj.y + obj.height,
                name: 'bottom'
            }].sort((a, b) => {
                return (
                    (a.x - (p.x + p.spdX - p.recoilX)) ** 2 +
                    (a.y - (p.y + p.spdY - p.recoilY)) ** 2 -
                    ((b.x - (p.x + p.spdX - p.recoilX)) ** 2 +
                        (b.y - (p.y + p.spdY - p.recoilY)) ** 2)
                );
            })[0].name;

            //this is dumb
            //if the edge is touched
            if ((circleDistance.x - obj.width / 2) ** 2 + (circleDistance.y - obj.height / 2) ** 2 <= p.radius ** 2
            || (
            //or if the edge is touched
                circleDistance.y <= obj.height && circleDistance.x <= obj.width / 2 + p.radius
             && circleDistance.x <= obj.width && circleDistance.y <= obj.height / 2 + p.radius
            ) && obj.hasPlayerCollision
            ) {
                var newVelocityVec = velocityAfterCollision(p.spdX, p.spdY, distance);
                p.spdX = newVelocityVec.x;
                p.spdY = newVelocityVec.y;
                p.recoilX = 0;
                p.recoilY = 0;
                p.colliding = true;
                continue;
            };
        }

        //welcome to the land of spaghetti
        if (!p.dashing && !p.colliding) {
            if (!p.left || (p.left && p.right)) {
                if (p.spdX < 0) {
                    p.spdX -= Math.floor(0.0625 * p.spdX) - Math.floor(0.07 * p.maxSpeed);
                    if (p.spdX > 0) p.spdX = 0;
                }
            }
            if (!p.right || (p.right && p.left)) {
                if (p.spdX > 0) {
                    p.spdX -= Math.floor(0.0625 * p.spdX) + Math.floor(0.07 * p.maxSpeed);
                    if (p.spdX < 0) p.spdX = 0;
                }
            }
            if (!p.down || (p.down && p.up)) {
                if (p.spdY > 0) {
                    p.spdY -= Math.floor(0.0625 * p.spdY) + Math.floor(0.07 * p.maxSpeed);
                    if (p.spdY < 0) p.spdY = 0;
                }
            }
            if (!p.up || (p.up && p.down)) {
                if (p.spdY < 0) {
                    p.spdY -= Math.floor(0.0625 * p.spdY) - Math.floor(0.07 * p.maxSpeed);
                    if (p.spdY > 0) p.spdY = 0;
                }
            }
            if (p.left && !(p.down || p.up)) {
                p.spdX -=
                    Math.floor(0.125 * (p.maxSpeed + p.spdX)) +
                    Math.floor(0.08 * p.maxSpeed);
                if (p.spdX < -p.maxSpeed) p.spdX = -p.maxSpeed;
            }
            if (p.right && !(p.down || p.up)) {
                p.spdX +=
                    Math.floor(0.125 * (p.maxSpeed - p.spdX)) +
                    Math.floor(0.08 * p.maxSpeed);
                if (p.spdX > p.maxSpeed) p.spdX = p.maxSpeed;
            }
            if (p.up && !(p.left || p.right)) {
                p.spdY -=
                    Math.floor(0.125 * (p.maxSpeed + p.spdY)) +
                    Math.floor(0.08 * p.maxSpeed);
                if (p.spdY < -p.maxSpeed) p.spdY = -p.maxSpeed;
            }
            if (p.down && !(p.left || p.right)) {
                p.spdY +=
                    Math.floor(0.125 * (p.maxSpeed - p.spdY)) +
                    Math.floor(0.08 * p.maxSpeed);
                if (p.spdY > p.maxSpeed) p.spdY = p.maxSpeed;
            }
            if (p.down && p.right && !(p.left || p.up)) {
                if (p.spdX < p.maxSpeedD - 5)
                    p.spdX +=
                        Math.floor(0.125 * (p.maxSpeedD - p.spdX)) +
                        Math.floor(0.08 * p.maxSpeedD);
                else if (p.spdX > p.maxSpeedD + 5)
                    p.spdX -= Math.floor(0.5 * p.maxSpeedD);
                else p.spdX = p.maxSpeedD;
                if (p.spdY < p.maxSpeedD - 5)
                    p.spdY +=
                        Math.floor(0.125 * (p.maxSpeedD - p.spdY)) +
                        Math.floor(0.08 * p.maxSpeedD);
                else if (p.spdY > p.maxSpeedD + 5)
                    p.spdY -= Math.floor(0.5 * p.maxSpeedD);
                else p.spdY = p.maxSpeedD;
            }
            if (p.down && p.left && !(p.right || p.up)) {
                if (p.spdX > -p.maxSpeedD + 5)
                    p.spdX -=
                        Math.floor(0.125 * (p.maxSpeedD - p.spdX)) +
                        Math.floor(0.08 * p.maxSpeedD);
                else if (p.spdX < -p.maxSpeedD - 5)
                    p.spdX += Math.floor(0.05 * p.maxSpeedD);
                else p.spX = -p.maxSpeedD;
                if (p.spdY < p.maxSpeedD - 5)
                    p.spdY +=
                        Math.floor(0.125 * (p.maxSpeedD - p.spdY)) +
                        Math.floor(0.08 * p.maxSpeedD);
                else if (p.spdY > p.maxSpeedD + 5)
                    p.spdY -= Math.floor(0.05 * p.maxSpeedD);
                else p.spY = p.maxSpeedD;
            }
            if (p.up && p.right && !(p.left || p.down)) {
                if (p.spdX < p.maxSpeedD - 5)
                    p.spdX +=
                        Math.floor(0.125 * (p.maxSpeedD - p.spdX)) +
                        Math.floor(0.08 * p.maxSpeedD);
                else if (p.spdX > p.maxSpeedD + 5)
                    p.spdX -= Math.floor(0.05 * p.maxSpeedD);
                else p.spdX = p.maxSpeedD;
                if (p.spdY > -p.maxSpeedD + 5)
                    p.spdY -=
                        Math.floor(0.125 * (p.maxSpeedD - p.spdY)) +
                        Math.floor(0.08 * p.maxSpeedD);
                else if (p.spdY < -p.maxSpeedD - 5)
                    p.spdY += Math.floor(0.05 * p.maxSpeedD);
                else p.spdY = -p.maxSpeedD;
            }
            if (p.up && p.left && !(p.right || p.down)) {
                if (p.spdX > -p.maxSpeedD + 5)
                    p.spdX -=
                        Math.floor(0.125 * (p.maxSpeedD - p.spdX)) +
                        Math.floor(0.08 * p.maxSpeedD);
                else if (p.spdX < -p.maxSpeedD - 5)
                    p.spdX += Math.floor(0.05 * p.maxSpeedD);
                else p.spdX = -p.maxSpeedD;
                if (p.spdY > -p.maxSpeedD + 5)
                    p.spdY -=
                        Math.floor(0.125 * (p.maxSpeedD - p.spdY)) +
                        Math.floor(0.08 * p.maxSpeedD);
                else if (p.spdY < -p.maxSpeedD - 5)
                    p.spdY += Math.floor(0.05 * p.maxSpeedD);
                else p.spdY = -p.maxSpeedD;
            }
        }

        //check collision with map border
        if (p.x + p.spdX < 0 || p.x + p.spdX > 70000) p.spdX = 0;
        if (p.y + p.spdY < 0 || p.y + p.spdY > 70000) p.spdY = 0;

        quadtree.remove({ x: p.x, y: p.y, id: p.playerId, type: 'player' });

        p.x += p.spdX - p.recoilX + p.clX;
        p.y += p.spdY - p.recoilY + p.clY;

        if (p.x < 0) p.x = 0;
        if (p.y < 0) p.y = 0;
        if (p.x > mapData.mapWidth) p.x = mapData.mapWidth;
        if (p.y > mapData.mapHeight) p.y = mapData.mapHeight;

        quadtree.insert({
            x: p.x,
            y: p.y,
            id: p.playerId,
            name: (p.username.guest ? 'Guest ' : '') + p.username.name,
            spdX: p.spdX,
            spdY: p.spdY,
            hp: p.hp,
            armor: p.armor,
            color: p.color,
            gun: p.gun,
            radius: p.radius,
            invincible: p.invincible,
            type: 'player',
            angle: p.angle
        });
    }
    for (var i in players) {
        var p = players[i].gameplayer;
        if (!p.spawned) continue;
        var ps = players[i].socket;
        var buf = new ArrayBuffer(1);
        var dv = new DataView(buf);
        dv.setUint8(0, svPacketTypes.stateUpdate);
        buf = appendBuffer(buf, buildPlayerPacketMain(p));
        buf = appendBuffer(buf, buildPlayerPacketExt(p));
        buf = appendBuffer(buf, buildPlayersExitingViewPacket(p));
        buf = appendBuffer(buf, buildPlayersInViewPacket(p));
        buf = appendBuffer(buf, buildNewPlayersInViewPacket(p));
        buf = appendBuffer(buf, buildPlayersInViewPacketExt(p));
        buf = appendBuffer(buf, buildObjectsExitingViewPacket(p));
        buf = appendBuffer(buf, buildObjectsInViewPacket(p));
        buf = appendBuffer(buf, buildNewObjectsInViewPacket(p));
        buf = appendBuffer(buf, buildFogPacket(oldFogSize));
        buf = appendBuffer(buf, buildBulletsExitingViewPacket(p));
        buf = appendBuffer(buf, buildBulletsInViewPacket(p));
        buf = appendBuffer(buf, buildNewBulletsInViewPacket(p));
        buf = appendBuffer(buf, buildNotifPacket(p));
        buf = appendBuffer(buf, buildRecentUpgradePacket(p));
        buf = appendBuffer(buf, buildOtherObjectsExitingViewPacket(p));
        buf = appendBuffer(buf, buildOtherObjectsInViewPacket(p));
        buf = appendBuffer(buf, buildNewOtherObjectsInViewPacket(p));
        buf = appendBuffer(buf, buildHitMarkerPacket(p));
        if (tickNum % 5 == 0) {
            buf = appendBuffer(buf, buildPlayersOnlinePacket());
            buf = appendBuffer(buf, buildLeaderboardPacket());
        }
        ps.send(buf);
    }
    for (var i in players) {
        var p = players[i].gameplayer;
        if (!p.spawned) continue;
        p.oldInvinc = p.invincible;
        p.oldHp = p.hp;
        p.oldArmor = p.armor;
        p.oldChatMsg = p.chatMsg;
        p.oldChatboxOpen = p.chatboxOpen;
        p.oldScore = p.score;
        p.oldRadius = p.radius;
        p.oldAmmo = p.ammo;
        p.oldMaxAmmo = p.maxAmmo;
        p.oldReloading = p.reloading;
        p.oldShooting = p.shooting;
        if (p.recentlyDied) p.recentlyDied = false;
        p.oldKills = p.kills;
        p.oldInAOE = p.inAOE;
        p.oldDashing = p.dashing;
        p.inAOE = false;
        p.oldvx = p.vx;
        p.oldvy = p.vy;
        p.changedPerks = false;
        p.recentlyUpgraded = [];
        p.oldMidPerkTimeout = p.midPerkTimeout;
        p.oldMaxMidPerkTimeout = p.maxMidPerkTimeout;
        p.oldReloadTimeoutMultiplier = p.reloadTimeoutMultiplier;
        p.clX = 0;
        p.clY = 0;
        p.hitMarkers = [];
        p.colliding = false;
    }
};

function velocityAfterCollision(velocityX, velocityY, side) {
    if (side == 'left') {
        return {
            x: -10,
            y: velocityY
        };
    } else if (side == 'right') {
        return {
            x: 10,
            y: velocityY
        };
    } else if (side == 'top') {
        return {
            x: velocityX,
            y: -10
        };
    } else if (side == 'bottom') {
        return {
            x: velocityX,
            y: 10
        };
    }
}

function updateObjects() {
    for (var object of objectPool) {
        //this coding of lifespan is intentional
        //objects with negative lifespan (map-created crates) shouldn't despawn
        if (object.lifespan > 0) object.lifespan--;
        if (object.lifespan == 0 || ('hp' in object && object.hp <= 0)) {
            quadtree.remove({ x: object.x, y: object.y, id: object.id, type: 'object' });
            objectPool[object.id] = {};
            objectIds.push(object.id);
        } else {
            object.oldMaxHp = object.maxHp;
            object.oldHp = object.hp;
        }
    }
}

function applyFogDamage() {
    for (var i in players) {
        var p = players[i].gameplayer;
        if (!p.spawned || p.dying || p.dead || p.invincible) continue;
        //check if player is in fog
        if (
            Math.abs(p.x - 35000) > (fogSize.x * 10) / 2 ||
            Math.abs(p.y - 35000) > (fogSize.y * 10) / 2
        ) {
            if (!p.invincible && p.hp > 0) {
                p.inAOE = true;
                if (tickNum % 2 == 0) p.hp -= 1;
            }
            if (p.hp <= 0) {
                p.killedBy = 'the Fog!';
                p.deathReason = deathReasons.fog;
                p.hp = 0;
                p.dying = true;
            }
        }
    }
}

function activateMidPerks() {
    for (var i in players) {
        var p = players[i].gameplayer;
        if (p.midPerkTimeout > 0) {
            p.midPerkTimeout--;
            if (p.midPerkTimeout > 0) continue;
        }
        if (!p.space) continue;

        let perkName = p.perks[2],
            perk = perkStats[perkName];
        if (!perk) continue;
        p.maxMidPerkTimeout = perk.timeout;
        p.midPerkTimeout = perk.timeout;

        if (perk.type == 'dash') {
            p.dashDuration = perk.player.maxDuration;
            p.dashing = 1;
        }

        if (perk.type == 'crate') {
            var stats = perk.crate,
                spawn = pointOnCircle(p.x, p.y, stats.spawnDistance, p.angle),
                crate = {
                    id: objectIds.shift(),
                    hp: 1,
                    maxHp: 1,
                    type: 'object',
                    x: spawn.x,
                    y: spawn.y,
                    width: stats.width,
                    height: stats.height,
                    objType: 3, //objtype 3 are user crates, objtype 4 are user crates with ontouch abilities
                    invincible: 1,
                    lifespan: -1,
                    hasPlayerCollision: 0
                };
            for (let key in stats) crate[key] = stats[key];
            objectPool[crate.id] = crate;
            quadtree.insert(crate);
        }

        //if the perk has stats related to a throwable object
        if (perk.type == 'throwable') {
            var stats = perk.throwable,
                speed = pointOnCircle(0, 0, stats.speed, p.angle),
                grenade = {
                    type: perkName,
                    type2: 'miscObject',
                    spdX: speed.x,
                    spdY: speed.y,
                    x: p.x,
                    y: p.y,
                    angle: p.angle,
                    teamId: p.teamId,
                    ownerId: p.playerId,
                    id: miscObjectIds.shift(),
                    frags: 0,
                    landmine: 0,
                    ticksPerDmg: 0,
                    dmg: 0,
                    rotationSpeed: 0,
                    ticksAlive: 0,
                    maxTicksAlive: 0,
                    maxTravelTicks: 0,
                    radius: 0,
                    maxRadius: 0,
                    expansionSpeed: 0,
                    detonated: false,
                    oldDetonated: false
                };
            for (let attribute in stats) grenade[attribute] = stats[attribute];

            miscObjectPool[grenade.id] = grenade;
            quadtree.insert(grenade);
        }
    }
}

function updateMidPerks() {
    for (var i in players) {
        var p = players[i].gameplayer;
        if (p.dashDuration > 0) {
            p.dashDuration--;
            if (p.dashDuration <= 0) {
                var vector = pointOnCircle(0, 0, p.maxSpeed, p.angle);
                p.spdX = vector.x;
                p.spdY = vector.y;
                p.dashing = 0;
            }
        }
    }
    //update gas grenades
    var gasGrenades = miscObjectPool;
    for (var g of gasGrenades) {
        if (g.type != 'gas') continue;
        quadtree.remove(g);
        g.oldDetonated = g.detonated;
        if (g.ticksAlive <= g.maxTravelTicks) {
            g.x += g.spdX;
            g.y += g.spdY;
            g.angle += g.rotationSpeed;
            g.angle %= 360;
        }
        g.ticksAlive++;
        if (g.ticksAlive >= g.maxTravelTicks) {
            if (!g.detonated) g.detonated = true;
            if (g.radius < g.maxRadius) {
                g.radius += g.expansionSpeed;
                if (g.radius > g.maxRadius) g.radius = g.maxRadius;
            }
        }
        if (g.ticksAlive >= g.maxTicksAlive) {
            miscObjectPool[g.id] = {};
        } else {
            var playersInView = quadtree.query(new Circle(g.x, g.y, g.radius));
            for (var i in playersInView) {
                if (playersInView[i].type != 'player') continue;
                var p = playerPool[playersInView[i].id];
                if (['TDM', 'DOM'].includes(serverData.type) && g.teamId == p.teamId)
                    continue;
                if (g.ownerId == p.playerId) continue;
                var owner = playerPool[g.ownerId];
                var startHp = p.hp;
                if (!p.invincible && p.hp > 0) {
                    p.inAOE = true;
                    if (tickNum % g.ticksPerDmg == 0) p.hp -= g.dmg;
                }
                if (p.hp <= 0 && !p.dying && !p.dead) {
                    p.hp = 0;
                    p.dying = true;
                    p.deathReason = deathReasons.bullet;
                    p.killedBy =
                        (owner.username.guest ? 'Guest ' : '') + owner.username.name;
                    p.killedById = g.ownerId;
                    owner.recentKills.push(
                        (p.username.guest ? 'Guest ' : '') + p.username.name
                    );
                    owner.kills++;
                }
                var scoreForOwner = startHp - p.hp;
                owner.score += scoreForOwner;
                owner.recentDmg += scoreForOwner;
            }
            quadtree.insert(g);
        }
    }
}

function updateBullets() {
    for (var i = 0; i < bullets.length; i++) {
        var owner = playerPool[bullets[i].ownerId];
        var stats = gunStats[owner.gun];
        quadtree.remove({
            x: bullets[i].x,
            y: bullets[i].y,
            id: bullets[i].id,
            type: 'bullet'
        });

        var inView = quadtree.query(
            new Box(
                bullets[i].x - 500,
                bullets[i].y - 500,
                bullets[i].x + 500,
                bullets[i].y + 500
            )
        );
        for (var j = 0; j < inView.length; j++) {
            var o = inView[j];
            //we need to access the "real" object from the pool
            o = objectPool[o.id]
            if (o.type != 'object') continue;
            var line = {
                p1: {
                    x: bullets[i].x,
                    y: bullets[i].y
                },
                p2: {
                    x: bullets[i].x + bullets[i].spdX,
                    y: bullets[i].y + bullets[i].spdY
                }
            };
            var intercepts = rectLineIntercepts(o, line);
            var intercepts2 = rectLineIntercepts2(o, line);
            if (intercepts.length > 0 || intercepts2) {
                bullets[i].intersected = true;
                if (!o.invincible) {
                    o.oldHp = o.hp;
                    o.hp -= bullets[i].dmg;
                }
            }
        }

        for (var j in inView) {
            if (inView[j].type != 'player') continue;
            var p = playerPool[inView[j].id];
            if (
                p.playerId == bullets[i].ownerId ||
                bullets[i].intersected ||
                p.invincible ||
                p.dying
            )
                continue;
            var lines = {
                p1: {
                    x: bullets[i].x,
                    y: bullets[i].y
                },
                p2: {
                    x: bullets[i].x + bullets[i].spdX,
                    y: bullets[i].y + bullets[i].spdY
                }
            };
            //inb4 the code turns into accel v2
            var system = new Collisions();
            var circle = system.createCircle(p.x, p.y, p.radius);
            var b = bullets[i];
            //dont know why the documentation assigns it to a variable if its just getting stored within `system` but ok
            var polygon = system.createPolygon(
                b.x,
                b.y,
                [
                    [(-b.bulletWidth * 10) / 2, (-b.bulletLength * 10) / 2],
                    [(b.bulletWidth * 10) / 2, (-b.bulletLength * 10) / 2],
                    [(b.bulletWidth * 10) / 2, (b.bulletLength * 10) / 2],
                    [(-b.bulletWidth * 10) / 2, (b.bulletLength * 10) / 2]
                ],
                degsToRads(b.angle)
            );
            var res = system.createResult();
            //var intercepts = circleLineIntercepts(p, lines)
            if (circle.collides(polygon, res)) {
                var dmg = Math.round(
                    bullets[i].dmg * owner.damageMultiplier * p.receivedDmgMultiplier
                ),
                    dmgDealt = 0;

                if (p.armor > 0 && dmgDealt < dmg) {
                    if (p.armor >= dmg) {
                        p.armor -= dmg;
                        dmgDealt += dmg;
                    } else {
                        dmgDealt += p.armor;
                        p.armor = 0;
                    }
                }

                dmg += Math.round(dmg * owner.directDamageToHP);

                if (p.hp > 0 && dmgDealt < dmg) {
                    if (p.hp >= dmg - dmgDealt) {
                        p.hp -= dmg - dmgDealt;
                        dmgDealt += dmg - dmgDealt;
                    } else {
                        dmgDealt += p.hp;
                        p.hp = 0;
                    }
                }

                if (p.hp <= 0) {
                    p.hp = 0;
                    p.dying = true;
                    p.deathReason = deathReasons.bullet;
                    p.killedBy =
                        (owner.username.guest ? 'Guest ' : '') + owner.username.name;
                    p.killedById = bullets[i].ownerId;
                    owner.recentKills.push(
                        (p.username.guest ? 'Guest ' : '') + p.username.name
                    );
                    owner.kills++;
                }
                bullets[i].intersected = true;
                owner.score += dmgDealt;
                owner.recentDmg += dmgDealt;
                var x = p.x + res.overlap_x * p.radius;
                var y = p.y + res.overlap_y * p.radius;
                owner.hitMarkers.push([x, y, dmgDealt]);
                owner.damageDealt += dmgDealt;
                p.damageTaken += dmgDealt;
                owner.shotsHit++;
            }
        }

        bullets[i].x += bullets[i].spdX;
        bullets[i].y += bullets[i].spdY;

        bullets[i].dmg -= bullets[i].dmgDrop;
        if (bullets[i].dmg < stats.maxDmgDrop) bullets[i].dmg = stats.maxDmgDrop;
        bullets[i].ticksTravelled++;

        if (bullets[i].ticksTravelled >= bullets[i].maxTicks)
            bullets[i].intersected = true;

        if (bullets[i].intersected) {
            bulletPool[bullets[i].id] = {};
            bulletIds.push(bullets[i].id);
            var keys = Object.keys(bullets[i]);
            for (var j in keys) {
                delete bullets[i][keys[j]];
            }
            bullets.splice(i, 1);
            continue;
        } else {
            quadtree.insert({
                x: bullets[i].x,
                y: bullets[i].y,
                id: bullets[i].id,
                type: 'bullet'
            });
        }
    }
}

function rectLineIntercepts2(rect, line) {
    var corners = {
        tl: {
            x: rect.x - rect.width / 2,
            y: rect.y - rect.height / 2
        },
        br: {
            x: rect.x + rect.width / 2,
            y: rect.y + rect.height / 2
        }
    };
    if (
        (corners.tl.x < line.p1.x &&
            line.p1.x < corners.br.x &&
            corners.tl.y < line.p1.y &&
            line.p1.y < corners.br.y) ||
        (corners.tl.x < line.p2.x &&
            line.p2.x < corners.br.x &&
            corners.tl.y < line.p2.y &&
            line.p2.y < corners.br.y)
    ) {
        return true;
    } else return false;
}

function rectLineIntercepts(rect, line) {
    var intercepts = [];
    var lines = [
        {
            p1: {
                x: rect.x - rect.width / 2,
                y: rect.y - rect.height / 2
            },
            p2: {
                x: rect.x + rect.width / 2,
                y: rect.y - rect.height / 2
            }
        },
        {
            p1: {
                x: rect.x + rect.width / 2,
                y: rect.y - rect.height / 2
            },
            p2: {
                x: rect.x + rect.width / 2,
                y: rect.y + rect.height / 2
            }
        },
        {
            p1: {
                x: rect.x + rect.width / 2,
                y: rect.y + rect.height / 2
            },
            p2: {
                x: rect.x - rect.width / 2,
                y: rect.y + rect.height / 2
            }
        },
        {
            p1: {
                x: rect.x - rect.width / 2,
                y: rect.y + rect.height / 2
            },
            p2: {
                x: rect.x - rect.width / 2,
                y: rect.y - rect.height / 2
            }
        }
    ];
    for (var i in lines) {
        var intercept = lineIntercept(line, lines[i]);
        if (intercept != null) intercepts.push(intercept);
    }
    return intercepts;
}

//check if 2 lines intersect
function lineIntercept(line1, line2) {
    var x1 = line1.p1.x;
    var y1 = line1.p1.y;
    var x2 = line1.p2.x;
    var y2 = line1.p2.y;
    var x3 = line2.p1.x;
    var y3 = line2.p1.y;
    var x4 = line2.p2.x;
    var y4 = line2.p2.y;
    var den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (den == 0) return null;
    var t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den;
    var u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / den;
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
        return {
            x: x1 + t * (x2 - x1),
            y: y1 + t * (y2 - y1)
        };
    }
    return null;
}

function circleLineIntercepts(circle, line) {
    //credit to Blindman67 on stackoverflow, good time saver, I just tweaked his algorithm a bit
    var a, b, c, d, u1, u2, ret, retP1, retP2, v1, v2;
    v1 = {};
    v2 = {};
    v1.x = line.p2.x - line.p1.x;
    v1.y = line.p2.y - line.p1.y;
    v2.x = line.p1.x - circle.x;
    v2.y = line.p1.y - circle.y;
    b = v1.x * v2.x + v1.y * v2.y;
    c = 2 * (v1.x * v1.x + v1.y * v1.y);
    b *= -2;
    d = Math.sqrt(
        b * b - 2 * c * (v2.x * v2.x + v2.y * v2.y - circle.radius * circle.radius)
    );
    if (isNaN(d)) {
        return [];
    }
    u1 = (b - d) / c;
    u2 = (b + d) / c;
    retP1 = {};
    retP2 = {};
    ret = [];
    if (u1 <= 1 && u1 >= 0) {
        retP1.x = line.p1.x + v1.x * u1;
        retP1.y = line.p1.y + v1.y * u1;
        ret[0] = retP1;
    }
    if (u2 <= 1 && u2 >= 0) {
        retP2.x = line.p1.x + v1.x * u2;
        retP2.y = line.p1.y + v1.y * u2;
        ret[ret.length] = retP2;
    }
    return ret;
}

function createBullets() {
    for (var i in players) {
        var gp = players[i].gameplayer;
        if (!gp.spawned || gp.dying) continue;
        var stats = gunStats[gp.gun];
        gp.recoilX *= 0.85;
        gp.recoilY *= 0.85;
        if (gp.recoilX < 1 && gp.recoilX > -1) gp.recoilX = 0;
        if (gp.recoilY < 1 && gp.recoilY > -1) gp.recoilY = 0;
        if (gp.ammo <= 0 && !gp.reloading) {
            forcePlayerReload(gp);
            continue;
        }
        gp.reloading = gp.reloadingTimeout > 0;
        if (gp.reloading) {
            gp.reloadingTimeout--;
            if (gp.reloadingTimeout == 0) {
                gp.ammo = gp.maxAmmo;
            } else {
                continue;
            }
        }
        if (gp.shootingTimeout > 0) {
            gp.shootingTimeout--;
            if (gp.shootingTimeout > 0) continue;
        }
        //if (gp.dashing) continue
        gp.shooting = gp.mouse;
        if (gp.mouse && gp.shootingTimeout <= 0) {
            for (let i = 0; i < stats.shrapnel; i++) {
                var speed = Math.sqrt(
                    (gp.spdX - gp.recoilX) ** 2 + (gp.spdY - gp.recoilY) ** 2
                );
                var spread =
                    stats.spread *
                    gp.varianceFactor *
                    (speed === 0 ? 1 : speed > 20 ? 2 : 1.5);
                var variation = Math.round((Math.random() - 0.5) * spread);
                var point1 = pointOnCircle(
                    gp.x + gp.spdX,
                    gp.y + gp.spdY,
                    gp.radius,
                    gp.angle - 90
                );
                var point2 = extend(gp.angle, stats.offset, point1.x, point1.y);
                var bulletSpeed = pointOnCircle(
                    0,
                    0,
                    stats.speed * gp.bulletSpeedMultiplier,
                    gp.angle + variation
                );
                var bullet = {
                    x: point2.x,
                    y: point2.y,
                    spdX: bulletSpeed.x,
                    spdY: bulletSpeed.y,
                    maxSpeed: stats.speed * gp.bulletSpeedMultiplier,
                    angle: gp.angle + variation,
                    id: bulletIds.shift(),
                    ownerId: gp.playerId,
                    teamId: gp.teamId,
                    ticksTravelled: 0,
                    maxTicks: stats.travelTime * gp.bulletLifespanMultiplier,
                    dmg: stats.dmg,
                    dmgDrop: stats.dmgDrop,
                    bulletType: gp.gun,
                    bulletWidth: stats.bulletWidth,
                    bulletLength: stats.bulletLength
                };
                bullets.push(bullet);
                bulletPool[bullet.id] = bullet;
                quadtree.insert({
                    x: bullet.x,
                    y: bullet.y,
                    id: bullet.id,
                    type: 'bullet'
                });
                gp.shotsFired++;
            }
            var recoil = gp.recoilMultiplier * stats.recoil;
            gp.recoilX = Math.round(Math.cos((gp.angle * Math.PI) / 180) * recoil);
            gp.recoilY = Math.round(Math.sin((gp.angle * Math.PI) / 180) * recoil);
            gp.shootingTimeout = stats.fireRate;
            gp.ammo--;
        }
    }
}

function pointOnCircle(x, y, radius, angle) {
    angle = degsToRads(angle);
    return {
        x: x + radius * Math.cos(angle),
        y: y + radius * Math.sin(angle)
    };
}

function degsToRads(degs) {
    return (degs * Math.PI) / 180;
}

function extend(angle, distance, x, y) {
    var radians = (angle * Math.PI) / 180;
    return {
        x: x + Math.cos(radians) * distance,
        y: y + Math.sin(radians) * distance
    };
}

function handleDeaths() {
    for (var i in players) {
        var gp = players[i].gameplayer;
        if (gp.dying && gp.radius > 0) {
            gp.radius -= 8;
            if (gp.radius <= 8 && !gp.dead) {
                gp.dead = true;
                gp.timeAlive = Date.now() - gp.spawnedAt;
                gp.spdX = 0;
                gp.spdY = 0;
                gp.recoilX = 0;
                gp.recoilY = 0;
                gp.recentlyDied = true;
                quadtree.remove({ x: gp.x, y: gp.y, id: gp.playerId, type: 'player' });
            }
        }
    }
}

function regenHealth() {
    for (var i in players) {
        var gp = players[i].gameplayer;
        if (gp.dying) continue;
        if (gp.hp < gp.maxHp && tickNum % gp.healthRegenRate == 0) gp.hp++;
        if (gp.armor < gp.maxArmor && tickNum % gp.armorRegenRate == 0) gp.armor++;
    }
}

function lerp(a, b, t) {
    return a + t * (b - a);
}

function buildPlayerPacketMain(p) {
    var buf = new ArrayBuffer(20);
    var dv = new DataView(buf);

    //stuff for the killcam
    if (p.dead && playerPool[p.killedById]) {
        //works!
        if (
            undefined !== playerPool[p.killedById].x &&
            undefined !== playerPool[p.killedById].y
        ) {
            p.killerX = playerPool[p.killedById].x;
            p.killerY = playerPool[p.killedById].y;
        }

        //if you think this looks complicated, its smooth unlike x=y
        var lerpPath =
            0.5 + Math.cos(Math.min(1, p.ticksSinceDeath++ / 60) * Math.PI) / 2,
            prevX = p.x,
            prevY = p.y;
        p.x = lerp(p.killerX, p.deathX, lerpPath);
        p.y = lerp(p.killerY, p.deathY, lerpPath);
        p.spdX = p.x - prevX;
        p.spdY = p.y - prevY;
        p.recoilX = 0;
        p.recoilY = 0;
    } else if (!p.killedById) {
        p.deathX = p.x;
        p.deathY = p.y;
    }
    dv.setUint8(0, updateTypes.player);
    dv.setUint8(1, p.playerId);
    dv.setUint32(2, p.x);
    dv.setUint32(6, p.y);
    dv.setUint16(10, p.spdX - p.recoilX + 300);
    dv.setUint16(12, p.spdY - p.recoilY + 300);
    dv.setUint8(14, p.angle);
    dv.setUint32(16, 999999999);
    if (p.recentlyDied) {
        var buf2 = new ArrayBuffer(26);
        var dv2 = new DataView(buf2);
        dv2.setUint8(0, updateTypes.deathStats);
        dv2.setUint32(1, p.score);
        dv2.setUint16(5, p.kills);
        dv2.setUint16(7, Math.round(p.timeAlive / 1000));
        dv2.setUint32(9, p.shotsFired);
        dv2.setUint32(13, p.shotsHit);
        dv2.setUint32(17, p.damageDealt);
        dv2.setUint32(21, p.damageTaken);
        dv2.setUint8(25, p.deathReason);
        if (p.killedById != null) {
            var buf3 = new ArrayBuffer(11);
            var dv3 = new DataView(buf3);
            var killedBy = playerPool[p.killedById];
            dv3.setUint8(0, killedBy.gun);
            dv3.setUint8(1, killedBy.armorSelection);
            dv3.setUint8(2, killedBy.color);
            dv3.setUint16(3, killedBy.kills);
            dv3.setUint32(5, killedBy.score);
            dv3.setUint8(9, killedBy.hp);
            dv3.setUint8(10, killedBy.armor);
            buf3 = appendBuffer(
                buf3,
                toArrayBuffer(
                    (killedBy.username.guest ? 'Guest ' : '') + killedBy.username.name
                )
            );
            buf2 = appendBuffer(buf2, buf3);
        }
        var buf4 = new ArrayBuffer(4);
        var dv4 = new DataView(buf4);
        dv4.setUint32(0, 999999999);
        buf2 = appendBuffer(buf2, buf4);
        buf = appendBuffer(buf, buf2);
    }
    return buf;
}

function buildPlayerPacketExt(p) {
    if (
        p.oldInvinc == p.invincible &&
        p.oldHp == p.hp &&
        p.oldArmor == p.armor &&
        p.oldChatboxOpen == p.chatboxOpen &&
        p.oldChatMsg == p.chatMsg &&
        p.oldScore == p.score &&
        p.oldRadius == p.radius &&
        p.oldAmmo == p.ammo &&
        p.oldMaxAmmo == p.maxAmmo &&
        p.oldReloading == p.reloading &&
        p.oldShooting == p.shooting &&
        p.oldKills == p.kills &&
        p.oldInAOE == p.inAOE &&
        p.oldDashing == p.dashing &&
        p.oldvx == p.vx &&
        p.oldvy == p.vy &&
        p.oldMidPerkTimeout == p.midPerkTimeout &&
        p.oldMaxMidPerkTimeout == p.maxMidPerkTimeout &&
        p.oldReloadTimeoutMultiplier == p.reloadTimeoutMultiplier
    ) {
        return new ArrayBuffer(0);
    } else {
        var buf = new ArrayBuffer(31);
        var dv = new DataView(buf);
        dv.setUint8(0, updateTypes.ext);
        dv.setUint8(1, p.playerId);
        dv.setUint8(2, Number(p.invincible));
        dv.setUint8(3, p.hp);
        dv.setUint8(4, p.armor);
        dv.setUint8(5, Number(p.chatboxOpen));
        dv.setUint32(6, p.score);
        dv.setUint8(10, p.radius);
        dv.setUint8(11, p.ammo);
        dv.setUint8(12, p.maxAmmo);
        dv.setUint8(13, Number(p.reloading));
        dv.setUint8(14, Number(p.shooting));
        dv.setUint16(15, p.kills);
        dv.setUint8(17, Number(p.inAOE));
        dv.setUint8(18, Number(p.dashing));
        dv.setUint16(19, Math.round(p.vx));
        dv.setUint16(21, Math.round(p.vy));
        dv.setUint16(23, p.midPerkTimeout);
        dv.setUint16(25, p.maxMidPerkTimeout);
        dv.setFloat32(27, p.reloadTimeoutMultiplier);
        if (p.oldChatMsg != p.chatMsg)
            buf = appendBuffer(buf, toArrayBuffer(p.chatMsg));
        var buf2 = new ArrayBuffer(4);
        var dv2 = new DataView(buf2);
        dv2.setUint32(0, 999999999);
        buf = appendBuffer(buf, buf2);
        return buf;
    }
}

function buildPlayersInViewPacket(p) {
    var buf = new ArrayBuffer(0);
    var playersInView = quadtree.query(
        new Box(p.x - (p.vx * 14) / 2, p.y - (p.vy * 14) / 2, p.vx * 14, p.vy * 14)
    );
    for (var i in playersInView) {
        if (playersInView[i].type != 'player') continue;
        var player = playersInView[i];
        if (player.id == p.playerId || !p.inView.players.includes(player.id))
            continue;
        var buf2 = new ArrayBuffer(20);
        var dv = new DataView(buf2);
        dv.setUint8(0, updateTypes.player);
        dv.setUint8(1, player.id);
        dv.setUint32(2, player.x);
        dv.setUint32(6, player.y);
        dv.setUint16(10, player.spdX + 300);
        dv.setUint16(12, player.spdY + 300);
        dv.setUint16(14, player.angle);
        dv.setUint32(16, 999999999);
        buf = appendBuffer(buf, buf2);
    }
    return buf;
}

function buildPlayersInViewPacketExt(p) {
    var buf = new ArrayBuffer(0);
    var playersInView = quadtree.query(
        new Box(p.x - (p.vx * 14) / 2, p.y - (p.vy * 14) / 2, p.vx * 14, p.vy * 14)
    );
    for (var i in playersInView) {
        if (playersInView[i].type != 'player') continue;
        var player = playerPool[playersInView[i].id];
        if (
            player.playerId == p.playerId ||
            !p.inView.players.includes(player.playerId)
        )
            continue;
        if (
            player.oldInvinc == player.invincible &&
            player.oldHp == player.hp &&
            player.oldArmor == player.armor &&
            player.oldChatboxOpen == player.chatboxOpen &&
            player.oldChatMsg == player.chatMsg &&
            player.oldRadius == player.radius &&
            player.oldReloading == player.reloading &&
            player.oldShooting == player.shooting &&
            player.oldDashing == player.dashing &&
            player.oldReloadTimeoutMultiplier == player.reloadTimeoutMultiplier
        ) {
            continue;
        } else {
            var buf2 = new ArrayBuffer(14);
            var dv = new DataView(buf2);
            dv.setUint8(0, updateTypes.ext);
            dv.setUint8(1, player.playerId);
            dv.setUint8(2, Number(player.invincible));
            dv.setUint8(3, player.hp);
            dv.setUint8(4, player.armor);
            dv.setUint8(5, Number(player.chatboxOpen));
            dv.setUint8(6, player.radius);
            dv.setUint8(7, Number(player.reloading));
            dv.setUint8(8, Number(player.shooting));
            dv.setUint8(9, Number(player.dashing));
            dv.setFloat32(10, player.reloadTimeoutMultiplier);
            if (player.oldChatMsg != player.chatMsg)
                buf2 = appendBuffer(buf2, toArrayBuffer(player.chatMsg));
            var buf3 = new ArrayBuffer(4);
            var dv2 = new DataView(buf3);
            dv2.setUint32(0, 999999999);
            buf2 = appendBuffer(buf2, buf3);
            buf = appendBuffer(buf, buf2);
        }
        if (player.changedPerks && p.perkArr.includes('bino')) {
            var buf4 = new ArrayBuffer(9);
            var dv3 = new DataView(buf4);
            dv3.setUint8(0, updateTypes.playerPerks);
            dv3.setUint8(1, player.id);
            dv3.setUint8(
                2,
                player.perkIndexes[1] != null ? player.perkIndexes[1] : 255
            );
            dv3.setUint8(
                3,
                player.perkIndexes[2] != null ? player.perkIndexes[2] : 255
            );
            dv3.setUint8(
                4,
                player.perkIndexes[3] != null ? player.perkIndexes[3] : 255
            );
            dv3.setUint32(5, 999999999);
            buf = appendBuffer(buf, buf4);
        }
    }
    return buf;
}

function buildNewPlayersInViewPacket(p) {
    var buf = new ArrayBuffer(0);
    var playersInView = quadtree.query(
        new Box(p.x - (p.vx * 14) / 2, p.y - (p.vy * 14) / 2, p.vx * 14, p.vy * 14)
    );
    playersInView = playersInView.filter(obj => {
        return obj.type == 'player';
    });
    for (var i in playersInView) {
        var player = playerPool[playersInView[i].id];
        if (
            playersInView[i].id == p.playerId ||
            p.inView.players.includes(playersInView[i].id)
        )
            continue;
        p.inView.players.push(playersInView[i].id);
        var buf2 = new ArrayBuffer(23);
        var dv = new DataView(buf2);
        dv.setUint8(0, updateTypes.playerJoin);
        dv.setUint8(1, playersInView[i].id);
        dv.setUint32(2, playersInView[i].x);
        dv.setUint32(6, playersInView[i].y);
        dv.setUint16(10, playersInView[i].spdX + 300);
        dv.setUint16(12, playersInView[i].spdY + 300);
        dv.setUint8(14, playersInView[i].hp);
        dv.setUint8(15, playersInView[i].armor);
        dv.setUint8(16, playersInView[i].gun);
        dv.setUint8(17, playersInView[i].color);
        dv.setUint8(18, playersInView[i].radius);
        dv.setUint8(19, playersInView[i].invincible);
        dv.setUint8(20, playersInView[i].chatboxOpen);
        dv.setUint16(21, playersInView[i].angle);
        buf2 = appendBuffer(buf2, toArrayBuffer(playersInView[i].name));
        var buf3 = new ArrayBuffer(4);
        var dv2 = new DataView(buf3);
        dv2.setUint32(0, 999999999);
        buf2 = appendBuffer(buf2, buf3);
        buf = appendBuffer(buf, buf2);

        //if the user has bino then also send the other player's perks
        if (p.perkArr.includes('bino')) {
            var buf4 = new ArrayBuffer(9);
            var dv3 = new DataView(buf4);
            dv3.setUint8(0, updateTypes.playerPerks);
            dv3.setUint8(1, playersInView[i].id);
            dv3.setUint8(
                2,
                player.perkIndexes[1] != null ? player.perkIndexes[1] : 255
            );
            dv3.setUint8(
                3,
                player.perkIndexes[2] != null ? player.perkIndexes[2] : 255
            );
            dv3.setUint8(
                4,
                player.perkIndexes[3] != null ? player.perkIndexes[3] : 255
            );
            dv3.setUint32(5, 999999999);
            buf = appendBuffer(buf, buf4);
        }
    }
    return buf;
}

function buildPlayersExitingViewPacket(p) {
    //remove players that are no longer in view
    var buf = new ArrayBuffer(0);
    var playersInView = quadtree.query(
        new Box(p.x - (p.vx * 14) / 2, p.y - (p.vy * 14) / 2, p.vx * 14, p.vy * 14)
    );
    playersInView = playersInView.filter(obj => {
        return obj.type == 'player';
    });
    var ids = [];
    for (var i in playersInView) {
        ids.push(playersInView[i].id);
    }
    for (var i in p.inView.players) {
        var player = playerPool[p.inView.players[i]];
        if (!ids.includes(p.inView.players[i]) || player.recentlyDied) {
            var buf2 = new ArrayBuffer(6);
            var dv = new DataView(buf2);
            dv.setUint8(0, updateTypes.playerLeave);
            dv.setUint8(1, p.inView.players[i]);
            dv.setUint32(2, 999999999);
            buf = appendBuffer(buf, buf2);
            p.inView.players.splice(i, 1);
        }
    }
    if (p.recentlyDied) {
        var buf2 = new ArrayBuffer(6);
        var dv = new DataView(buf2);
        dv.setUint8(0, updateTypes.playerLeave);
        dv.setUint8(1, p.playerId);
        dv.setUint32(2, 999999999);
        buf = appendBuffer(buf, buf2);
    }
    return buf;
}

function buildNewObjectsInViewPacket(p) {
    var buf = new ArrayBuffer(0);
    var objectsInView = quadtree.query(
        new Box(p.x - (p.vx * 14) / 2, p.y - (p.vy * 14) / 2, p.vx * 14, p.vy * 14)
    );
    for (var obj of objectsInView) {
        if (obj.type != 'object') continue;
        if (p.inView.obstacles.includes(obj.id)) continue;
        p.inView.obstacles.push(obj.id);
        var buf2 = new ArrayBuffer(21);
        var dv = new DataView(buf2);
        dv.setUint8(0, updateTypes.objectJoin);
        dv.setUint16(1, obj.id);
        dv.setUint32(3, obj.x);
        dv.setUint32(7, obj.y);
        dv.setUint8(11, obj.objType);
        dv.setUint8(12, obj.orientation);
        dv.setUint16(13, obj.hp);
        dv.setUint16(15, obj.maxHp);
        dv.setUint32(17, 999999999);
        buf = appendBuffer(buf, buf2);
    }
    return buf;
}

function buildObjectsInViewPacket(p) {
    var buf = new ArrayBuffer(0);
    var objectsInView = quadtree.query(
        new Box(p.x - p.vx * 7, p.y - p.vy * 7, p.vx * 14, p.vy * 14)
    );
    for (var obj of objectsInView) {
        if (obj.type != 'object') continue;
        var obj = objectPool[obj.id];
        if (!p.inView.obstacles.includes(obj.id)) continue;
        if (obj.oldMaxHp != obj.maxHp || obj.oldHp != obj.hp) {
            var buf2 = new ArrayBuffer(11);
            var dv = new DataView(buf2);
            dv.setUint8(0, updateTypes.objectUpdate);
            dv.setUint16(1, obj.id);
            dv.setUint16(3, obj.hp);
            dv.setUint16(5, obj.maxHp);
            dv.setUint32(7, 999999999);
            buf = appendBuffer(buf, buf2);
        }
    }
    return buf;
}

function buildObjectsExitingViewPacket(p) {
    var buf = new ArrayBuffer(0);
    var objectsInView = quadtree.query(
        new Box(p.x - (p.vx * 14) / 2, p.y - (p.vy * 14) / 2, p.vx * 14, p.vy * 14)
    );
    var ids = [];
    for (var i in objectsInView)
        if (objectsInView[i].type == 'object') ids.push(objectsInView[i].id);
    for (var i in p.inView.obstacles) {
        if (ids.includes(p.inView.obstacles[i])) continue;
        var buf2 = new ArrayBuffer(7);
        var dv = new DataView(buf2);
        dv.setUint8(0, updateTypes.objectLeave);
        dv.setUint16(1, p.inView.obstacles[i]);
        dv.setUint32(3, 999999999);
        buf = appendBuffer(buf, buf2);
        p.inView.obstacles.splice(i, 1);
    }
    return buf;
}

function buildNewBulletsInViewPacket(p) {
    var buf = new ArrayBuffer(0);
    var bulletsInView = quadtree.query(
        new Box(p.x - (p.vx * 14) / 2, p.y - (p.vy * 14) / 2, p.vx * 14, p.vy * 14)
    );
    for (var bulletInView of bulletsInView) {
        if (bulletInView.type != 'bullet') continue;
        var bullet = bulletPool[bulletInView.id];
        if (p.inView.bullets.includes(bullet.id)) continue;
        p.inView.bullets.push(bullet.id);
        var buf2 = new ArrayBuffer(24);
        var dv = new DataView(buf2);
        dv.setUint8(0, updateTypes.bulletJoin);
        dv.setUint16(1, bullet.id);
        dv.setUint32(3, bullet.x);
        dv.setUint32(7, bullet.y);
        dv.setUint16(11, bullet.spdX + 500);
        dv.setUint16(13, bullet.spdY + 500);
        dv.setUint8(15, bullet.bulletType);
        dv.setUint8(16, bullet.bulletWidth);
        dv.setUint8(17, bullet.bulletLength);
        dv.setUint16(18, bullet.angle);
        dv.setUint32(20, 999999999);
        buf = appendBuffer(buf, buf2);
    }
    return buf;
}

function buildBulletsInViewPacket(p) {
    var buf = new ArrayBuffer(0);
    var bulletsInView = quadtree.query(
        new Box(p.x - p.vx * 7, p.y - p.vy * 7, p.vx * 14, p.vy * 14)
    );
    bulletsInView = bulletsInView.filter(obj => {
        return obj.type == 'bullet';
    });
    for (var i in bulletsInView) {
        var bullet = bulletPool[bulletsInView[i].id];
        if (!p.inView.bullets.includes(bullet.id)) continue;
        var buf2 = new ArrayBuffer(15);
        var dv = new DataView(buf2);
        dv.setUint8(0, updateTypes.bulletUpdate);
        dv.setUint16(1, bullet.id);
        dv.setUint32(3, bullet.x);
        dv.setUint32(7, bullet.y);
        dv.setUint32(11, 999999999);
        buf = appendBuffer(buf, buf2);
    }
    return buf;
}

function buildBulletsExitingViewPacket(p) {
    var buf = new ArrayBuffer(0);
    var bulletsInView = quadtree.query(
        new Box(p.x - p.vx * 7, p.y - p.vy * 7, p.vx * 14, p.vy * 14)
    );
    var ids = [];
    for (var i in bulletsInView)
        if (obj.type == 'bullet') ids.push(bulletsInView[i].id);
    for (var i in p.inView.bullets) {
        if (!ids.includes(p.inView.bullets[i])) {
            var buf2 = new ArrayBuffer(7);
            var dv = new DataView(buf2);
            dv.setUint8(0, updateTypes.bulletLeave);
            dv.setUint16(1, p.inView.bullets[i]);
            dv.setUint32(3, 999999999);
            buf = appendBuffer(buf, buf2);
            p.inView.bullets.splice(i, 1);
        }
    }
    return buf;
}

function buildOtherObjectsExitingViewPacket(p) {
    var buf = new ArrayBuffer(0),
        ids = [],
        objectsInView = quadtree.query(
            new Box(p.x - p.vx * 7, p.y - p.vy * 7, p.vx * 14, p.vy * 14)
        );
    for (var i in objectsInView)
        if (objectsInView[i].type2 == 'miscObject') ids.push(objectsInView[i].id);
    for (var i in p.inView.objects) {
        if (!ids.includes(p.inView.objects[i])) {
            var buf2 = new ArrayBuffer(7);
            var dv = new DataView(buf2);
            dv.setUint8(0, updateTypes.otherObjectLeave);
            dv.setUint16(1, p.inView.objects[i]);
            dv.setUint32(3, 999999999);
            buf = appendBuffer(buf, buf2);
            p.inView.objects.splice(i, 1);
        }
    }
    return buf;
}

function buildOtherObjectsInViewPacket(p) {
    var buf = new ArrayBuffer(0);
    var thingsInView = quadtree.query(
        new Box(p.x - p.vx * 7, p.y - p.vy * 7, p.vx * 14, p.vy * 14)
    );
    for (var grenade of thingsInView) {
        if (grenade.type != 'gas') continue;
        var g = miscObjectPool[grenade.id];
        if (!p.inView.objects.includes(g.id)) continue;
        var buf2 = new ArrayBuffer(20);
        var dv = new DataView(buf2);
        dv.setUint8(0, updateTypes.otherObjectUpdate);
        dv.setUint8(1, objectTypes.gas);
        dv.setUint16(2, g.id);
        dv.setUint32(4, g.x);
        dv.setUint32(8, g.y);
        dv.setUint16(12, g.angle);
        dv.setUint16(14, g.radius);
        dv.setUint32(16, 999999999);
        buf = appendBuffer(buf, buf2);
    }
    return buf;
}

function buildNewOtherObjectsInViewPacket(p) {
    var buf = new ArrayBuffer(0);
    var thingsInView = quadtree.query(
        new Box(p.x - p.vx * 7, p.y - p.vy * 7, p.vx * 14, p.vy * 14)
    );
    var gasGrenadesInView = thingsInView.filter(obj => {
        return obj.type == 'gas';
    });
    for (var i in gasGrenadesInView) {
        var g = miscObjectPool[gasGrenadesInView[i].id];
        if (p.inView.objects.includes(g.id)) continue;
        p.inView.objects.push(g.id);
        var buf2 = new ArrayBuffer(30);
        var dv = new DataView(buf2);
        dv.setUint8(0, updateTypes.otherObjectJoin);
        dv.setUint8(1, objectTypes.gas);
        dv.setUint16(2, g.id);
        dv.setUint32(4, g.x);
        dv.setUint32(8, g.y);
        dv.setUint16(12, g.spdX + 500);
        dv.setUint16(14, g.spdY + 500);
        dv.setUint16(16, g.angle);
        dv.setUint8(18, g.maxTravelTicks);
        dv.setUint16(19, g.maxRadius);
        dv.setUint8(21, g.expansionSpeed);
        dv.setUint16(22, g.radius);
        dv.setUint16(24, g.ticksAlive);
        dv.setUint32(26, 999999999);
        buf = appendBuffer(buf, buf2);
    }
    return buf;
}

function buildRecentUpgradePacket(p) {
    var buf = new ArrayBuffer(0);
    if (p.recentlyUpgraded.includes('bino')) {
        for (var i of p.inView.players) {
            var player = playerPool[i];
            var buf2 = new ArrayBuffer(9);
            var dv = new DataView(buf2);
            dv.setUint8(0, updateTypes.playerPerks);
            dv.setUint8(1, player.playerId);
            dv.setUint8(
                2,
                player.perkIndexes[1] != null ? player.perkIndexes[1] : 255
            );
            dv.setUint8(
                3,
                player.perkIndexes[2] != null ? player.perkIndexes[2] : 255
            );
            dv.setUint8(
                4,
                player.perkIndexes[3] != null ? player.perkIndexes[3] : 255
            );
            dv.setUint32(5, 999999999);
            buf = appendBuffer(buf, buf2);
        }
    }
    return buf;
}

function buildFogPacket(oldFogSize) {
    if (oldFogSize.x == fogSize.x && oldFogSize.y == fogSize.y)
        return new ArrayBuffer(0);
    var buf = new ArrayBuffer(13);
    var dv = new DataView(buf);
    dv.setUint8(0, updateTypes.fog);
    dv.setUint32(1, fogSize.x);
    dv.setUint32(5, fogSize.y);
    dv.setUint32(9, 999999999);
    return buf;
}

function buildPlayersOnlinePacket() {
    var buf = new ArrayBuffer(6);
    var dv = new DataView(buf);
    dv.setUint8(0, updateTypes.serverPopulation);
    dv.setUint8(1, players.length);
    dv.setUint32(2, 999999999);
    return buf;
}

function buildHitMarkerPacket(p) {
    var buf = new ArrayBuffer(0);
    for (var hitMarker of p.hitMarkers) {
        var buf2 = new ArrayBuffer(17);
        var dv = new DataView(buf2);
        dv.setUint8(0, updateTypes.hitMarker);
        dv.setUint32(1, hitMarker[0]);
        dv.setUint32(5, hitMarker[1]);
        dv.setUint32(9, hitMarker[2]);
        dv.setUint32(13, 999999999);
        buf = appendBuffer(buf, buf2);
    }
    return buf;
}

function buildNotifPacket(p) {
    var buf = new ArrayBuffer(0);
    if (p.recentDmg != 0) {
        var buf2 = new ArrayBuffer(7);
        var dv = new DataView(buf2);
        dv.setUint8(0, updateTypes.notif);
        dv.setUint8(1, notifTypes.hitDmg);
        dv.setUint8(2, p.recentDmg);
        dv.setUint32(3, 999999999);
        buf = appendBuffer(buf, buf2);
        p.recentDmg = 0;
    }
    if (p.recentKills.length > 0) {
        for (var i in p.recentKills) {
            var buf2 = new ArrayBuffer(2);
            var dv = new DataView(buf2);
            dv.setUint8(0, updateTypes.notif);
            dv.setUint8(1, notifTypes.kill);
            buf2 = appendBuffer(buf2, toArrayBuffer(p.recentKills[i]));
            var buf3 = new ArrayBuffer(4);
            var dv2 = new DataView(buf3);
            dv2.setUint32(0, 999999999);
            buf2 = appendBuffer(buf2, buf3);
            buf = appendBuffer(buf, buf2);
        }
        p.recentKills = [];
    }
    if (p.killedBy != '') {
        var buf2 = new ArrayBuffer(2);
        var dv = new DataView(buf2);
        dv.setUint8(0, updateTypes.notif);
        dv.setUint8(1, notifTypes.death);
        buf2 = appendBuffer(buf2, toArrayBuffer(p.killedBy));
        var buf3 = new ArrayBuffer(4);
        var dv2 = new DataView(buf3);
        dv2.setUint32(0, 999999999);
        buf2 = appendBuffer(buf2, buf3);
        buf = appendBuffer(buf, buf2);
        p.killedBy = '';
    }
    return buf;
}

function buildLeaderboardPacket() {
    if (serverData.type == 'FFA') {
        var leaderboard = players.sort((a, b) => b.score - a.score).slice(0, 10);
        var buf = new ArrayBuffer(1);
        var dv = new DataView(buf);
        dv.setUint8(0, updateTypes.leaderboard);
        var leaderboardStr = '';
        for (var i in leaderboard) {
            var p = leaderboard[i].gameplayer;
            if (!p.spawned || p.hp <= 0) continue;
            var name = (p.username.guest ? 'Guest ' : '') + p.username.name;
            leaderboardStr += `|${name},${p.score},${p.kills},${p.playerId}`;
        }
        buf = appendBuffer(buf, toArrayBuffer(leaderboardStr));
        var buf2 = new ArrayBuffer(4);
        var dv2 = new DataView(buf2);
        dv2.setUint32(0, 999999999);
        buf = appendBuffer(buf, buf2);
        return buf;
    }
}

function updateScores() {
    if (tickNum % 25 != 0) return;
    if (serverData.type == 'FFA') {
        var playersAtCenter = quadtree.query(
            new Box(
                mapData.mapWidth / 2 - 1000,
                mapData.mapHeight / 2 - 1000,
                2000,
                2000
            )
        );
        var scorePerPlayer = Math.ceil(scoreReceived / playersAtCenter.length);
        for (var i in playersAtCenter)
            if (playersAtCenter[i].type == 'player')
                playerPool[playersAtCenter[i].id].score += scorePerPlayer;
    }
}

gameLoop();

function spawnFlare() {
    const { spawn } = require('child_process');

    const cloudflared = spawn(
        process.env['pathname'],
        `tunnel --url http://localhost:${serverconfig.port}`.split(' ')
    );

    cloudflared.stderr.on('data', data => {
        var output = data.toString().match(/https:\/\/.*\.trycloudflare\.com/);
        if (output) {
            var tunnelLink = output[0].split('https')[1];
            serverData.altUrl = `wss${tunnelLink}/`;
        }
    });

    cloudflared.on('close', code => {
        console.log('cloudflared exited with code', code);
        spawnFlare();
    });
}

if (process.env['local'] == 'true') spawnFlare();
