// HOME monitor provisioning for pinned Uptime Kuma v2.5.11. `cfg` arrives via protected stdin,
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
        if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(cfg.ownerSlug || '')) {
            return finish('OWNER_SLUG_INVALID');
        }
        if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)+$/.test(cfg.siteId || '')) {
            return finish('SITE_ID_INVALID');
        }
        const names = {
            'HOME PVE': 'pve',
            'HOME PBS': 'pbs',
            'HOME MQTT broker': 'mqtt',
            'HOME Internet': 'internet',
            'HOME HAOS': 'haos',
            'HOME gateway': 'router',
            'HOME PostgreSQL': 'postgresql'
        };
        const canonicalName = legacy => cfg.siteId + '-' + names[legacy];
        const matchingMonitors = legacy => {
            const aliases = new Set([legacy, cfg.ownerSlug + '-' + names[legacy], canonicalName(legacy)]);
            return monitors.filter(m => aliases.has(m.name));
        };
        // Refuse collisions before editing any monitor. Never delete a monitor or
        // create a duplicate when migrating legacy names.
        for (const [legacy, object] of Object.entries(names)) {
            if (matchingMonitors(legacy).length > 1) {
                return finish('MONITOR_NAME_CONFLICT_' + object);
            }
        }
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
        const base = {
            active: true, interval: 60, retryInterval: 60, resendInterval: 0,
            maxretries: 0, accepted_statuscodes: ['200-299'],
            kafkaProducerBrokers: [], kafkaProducerSaslOptions: {},
            rabbitmqNodes: [], conditions: []
        };
        const targets = [
            { name: 'HOME PVE', type: 'ping', hostname: cfg.pveIP },
            { name: 'HOME PBS', type: 'ping', hostname: cfg.pbsIP },
            { name: 'HOME MQTT broker', type: 'mqtt', hostname: cfg.mqttHost, port: 1883,
                mqttUsername: cfg.mqttUsername, mqttPassword: cfg.mqttPassword,
                mqttTopic: '$SYS/broker/uptime', mqttCheckType: 'keyword', mqttSuccessMessage: 'seconds' },
            { name: 'HOME Internet', type: 'http', url: 'https://www.cloudflare.com/cdn-cgi/trace', method: 'GET', accepted_statuscodes: ['200'] },
            { name: 'HOME HAOS', type: 'ping', hostname: cfg.haosIP },
            { name: 'HOME gateway', type: 'ping', hostname: cfg.gatewayIP }
        ];
        if (cfg.postgresPassword) {
            targets.push({
                name: 'HOME PostgreSQL', type: 'postgres',
                databaseConnectionString: `postgres://postgres:${encodeURIComponent(cfg.postgresPassword)}@${cfg.postgresIP}:5432/homeassistant`,
                databaseQuery: 'SELECT 1'
            });
        }
        let created = 0;
        let existing = 0;
        let updated = 0;
        // Rename even an existing PostgreSQL monitor if credentials are not
        // available on this run; do not replace its connection settings.
        if (!cfg.postgresPassword && matchingMonitors('HOME PostgreSQL').length === 1) {
            targets.push({ name: 'HOME PostgreSQL' });
        }
        for (const target of targets) {
            const legacy = target.name;
            target.name = canonicalName(legacy);
            const current = matchingMonitors(legacy)[0];
            if (current) {
                const changes = target.type === 'mqtt' || target.type === 'postgres'
                    ? target : { name: target.name };
                if (current.name !== target.name || target.type === 'mqtt' || target.type === 'postgres') {
                    const saved = (await call('getMonitor', current.id)).monitor;
                    if (Object.entries(changes).some(([key, value]) => saved[key] !== value)) {
                        await call('editMonitor', { ...saved, ...changes });
                        updated++;
                        continue;
                    }
                }
                existing++;
                continue;
            }
            const monitor = {
                ...base, ...target,
                notificationIDList: notificationID ? { [notificationID]: true } : {}
            };
            await call('add', monitor);
            created++;
        }
        const postgres = cfg.postgresPassword ? 'CONFIGURED' : 'WAITING_TASK05';
        finish(`ACCOUNT=${accountStatus} MONITOR=${created ? 'CREATED' : updated ? 'UPDATED' : 'EXISTING'} CREATED=${created} UPDATED=${updated} EXISTING=${existing} POSTGRES=${postgres} TELEGRAM=${telegramStatus}`, 0);
    } catch (e) {
        // Never print remote exception messages: some HTTP libraries include tokens in their errors.
        finish(e.message.startsWith('SOCKET_TIMEOUT_') ? 'SOCKET_TIMEOUT' : 'API_OPERATION_FAILED');
    }
}
