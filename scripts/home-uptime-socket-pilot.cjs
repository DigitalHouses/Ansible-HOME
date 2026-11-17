// Pilot for pinned Uptime Kuma v2.5.11. `cfg` arrives via protected stdin,
// never as command arguments or a file on the Uptime guest.
'use strict';
const { io } = require('socket.io-client');
const socket = io('http://127.0.0.1:3001', { transports: ['websocket'], timeout: 8000, reconnection: false });
let loggedIn = false;
let accountStatus = 'EXISTING';
let authStage = 'CONNECT';
let monitors = null;
let notifications = null;
let started = false;
let telegramStatus = 'NOT_CONFIGURED';
const shutdownTimer = setTimeout(() => finish('TIMEOUT'), 20000);
function finish(message, exitCode = 1) {
    clearTimeout(shutdownTimer);
    console.log('HOME_KUMA_PILOT ' + message);
    socket.disconnect();
    process.exit(exitCode);
}
function call(event, ...args) {
    return new Promise((resolve, reject) => {
        socket.timeout(7000).emit(event, ...args, (err, result) => {
            if (err) return reject(new Error('SOCKET_TIMEOUT_' + event));
            if (!result || !result.ok) return reject(new Error('API_REJECTED_' + event));
            resolve(result);
        });
    });
}
socket.on('connect_error', () => finish('CONNECT_FAILED'));
socket.on('disconnect', reason => { if (!started && reason !== 'io client disconnect') finish('DISCONNECTED'); });
// Explicitly query first-run state. Never reset or overwrite an existing user.
// Upstream emits loginRequired only AFTER registering all Socket.IO handlers.
// The transport connect event fires earlier and can race needSetup registration.
socket.on('loginRequired', async () => {
    try {
        authStage = 'NEED_SETUP';
        const requiresSetup = await new Promise((resolve, reject) => {
            socket.timeout(7000).emit('needSetup', (err, result) => {
                if (err || typeof result !== 'boolean') return reject(new Error('SETUP_QUERY_FAILED'));
                resolve(result);
            });
        });
        if (requiresSetup) {
            authStage = 'SETUP';
            await call('setup', cfg.username, cfg.password);
            accountStatus = 'CREATED';
        }
        authStage = 'LOGIN';
        const response = await call('login', { username: cfg.username, password: cfg.password });
        if (!response?.ok) throw new Error('AUTH_FAILED');
        loggedIn = true;
        maybeRun();
    } catch (e) {
        const reason = e.message === 'API_REJECTED_login' ? 'REJECTED' :
            e.message.startsWith('SOCKET_TIMEOUT_') ? 'TIMEOUT' : 'UNEXPECTED';
        finish(`AUTH_STAGE=${authStage} FAILURE=${reason}`);
    }
});
socket.on('monitorList', list => { monitors = Object.values(list || {}); maybeRun(); });
socket.on('notificationList', list => { notifications = Array.isArray(list) ? list : Object.values(list || {}); maybeRun(); });
async function maybeRun() {
    if (!loggedIn || monitors === null || notifications === null || started) return;
    started = true;
    try {
        let notificationID = null;
        if (cfg.telegramBotToken && cfg.telegramChatID) {
            const name = 'HOME Telegram';
            const existing = notifications.find(n => n.name === name);
            if (existing) {
                const c = typeof existing.config === 'string' ? JSON.parse(existing.config) : existing.config;
                if (c && (c.telegramBotToken !== cfg.telegramBotToken || String(c.telegramChatID) !== String(cfg.telegramChatID))) {
                    return finish('TELEGRAM_NAME_CONFLICT');
                }
                notificationID = existing.id;
                telegramStatus = 'EXISTING';
            } else {
                const notification = {
                    name, type: 'telegram', telegramBotToken: cfg.telegramBotToken,
                    telegramChatID: cfg.telegramChatID, isDefault: false, applyExisting: false
                };
                await call('testNotification', notification);
                const saved = await call('addNotification', notification, null);
                notificationID = saved.id;
                telegramStatus = 'TESTED_AND_CREATED';
            }
        } else if (cfg.telegramBotToken || cfg.telegramChatID) {
            return finish('TELEGRAM_PAIR_INCOMPLETE');
        }
        const name = 'HOME PVE';
        const current = monitors.find(m => m.name === name);
        if (current) {
            if (current.type !== 'ping' || current.hostname !== cfg.pveIP) {
                return finish('MONITOR_NAME_CONFLICT');
            }
            // Preserve existing monitor; do not silently change notification bindings.
            const linked = notificationID === null || !!current.notificationIDList?.[notificationID];
            finish(`ACCOUNT=${accountStatus} MONITOR=EXISTING ID=${current.id} TELEGRAM=${telegramStatus} LINKED=${linked}`, 0);
        }
        const monitor = {
            name, type: 'ping', hostname: cfg.pveIP, active: true,
            interval: 60, retryInterval: 60, resendInterval: 0, maxretries: 0,
            accepted_statuscodes: ['200-299'], notificationIDList: notificationID ? { [notificationID]: true } : {},
            kafkaProducerBrokers: [], kafkaProducerSaslOptions: {}, rabbitmqNodes: [], conditions: []
        };
        const result = await call('add', monitor);
        finish(`ACCOUNT=${accountStatus} MONITOR=CREATED ID=${result.monitorID} TELEGRAM=${telegramStatus} LINKED=${notificationID !== null}`, 0);
    } catch (e) {
        // Never print remote exception messages: some HTTP libraries include tokens in their errors.
        finish(e.message.startsWith('SOCKET_TIMEOUT_') ? 'SOCKET_TIMEOUT' : 'API_OPERATION_FAILED');
    }
}
