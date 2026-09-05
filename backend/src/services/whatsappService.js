const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const prisma = require('../lib/prisma');
const { hasDedicatedWhatsAppAccess } = require('../lib/access');

const WA_PROTOCOL_TIMEOUT_MS = Number.parseInt(process.env.WA_PROTOCOL_TIMEOUT_MS || '180000', 10);
const WA_OPERATION_RETRIES = Number.parseInt(process.env.WA_OPERATION_RETRIES || '2', 10);
const WA_RETRY_DELAY_MS = Number.parseInt(process.env.WA_RETRY_DELAY_MS || '5000', 10);
const WA_RECOVERY_TIMEOUT_MS = Number.parseInt(process.env.WA_RECOVERY_TIMEOUT_MS || '30000', 10);
const WA_AUTO_RECONNECT_DELAY_MS = Number.parseInt(process.env.WA_AUTO_RECONNECT_DELAY_MS || '5000', 10);
const WA_INITIALIZE_TIMEOUT_MS = Number.parseInt(process.env.WA_INITIALIZE_TIMEOUT_MS || '90000', 10);
const execFileAsync = promisify(execFile);
const DEFAULT_WINDOWS_CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const GLOBAL_SESSION_ID = 'admin-global';
const PUPPETEER_GUARD_FLAG = Symbol('divulgazap-puppeteer-guards');

let processGuardsRegistered = false;

function createSessionState() {
  return {
    client: null,
    qrCode: null,
    status: 'disconnected',
    connectingStartedAt: null,
    readyAt: null,
    recoveryPromise: null,
    reconnectTimer: null,
    manualDisconnect: false,
  };
}

const sessions = new Map([
  [GLOBAL_SESSION_ID, createSessionState()],
]);

const dedicatedSessionCache = new Map();

function getSession(sessionId = GLOBAL_SESSION_ID) {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, createSessionState());
  }

  return sessions.get(sessionId);
}

function getSessionAuthPath(sessionId) {
  return path.join(process.cwd(), 'tokens', `session-${sessionId}`);
}

async function resolveSessionId(userId, dedicatedWhatsApp) {
  if (!userId) {
    return GLOBAL_SESSION_ID;
  }

  if (typeof dedicatedWhatsApp === 'boolean') {
    const sessionId = dedicatedWhatsApp ? `dedicated-${userId}` : GLOBAL_SESSION_ID;
    dedicatedSessionCache.set(userId, sessionId);
    return sessionId;
  }

  if (dedicatedSessionCache.has(userId)) {
    return dedicatedSessionCache.get(userId);
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { dedicatedWhatsApp: true, plan: true, planExpiresAt: true, createdAt: true },
  });

  const sessionId = hasDedicatedWhatsAppAccess(user) ? `dedicated-${userId}` : GLOBAL_SESSION_ID;
  dedicatedSessionCache.set(userId, sessionId);
  return sessionId;
}

function clearSessionCache(userId) {
  if (!userId) {
    return;
  }

  dedicatedSessionCache.delete(userId);
}

function getSessionLabel(sessionId) {
  return sessionId === GLOBAL_SESSION_ID ? 'admin-global' : sessionId;
}

function clearReconnectTimer(session) {
  if (!session.reconnectTimer) {
    return;
  }

  clearTimeout(session.reconnectTimer);
  session.reconnectTimer = null;
}

function clearConnectingState(session) {
  session.connectingStartedAt = null;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function createInitializationTimeoutError() {
  return new Error(`WhatsApp initialization timed out after ${WA_INITIALIZE_TIMEOUT_MS}ms`);
}

async function initializeClientWithTimeout(client) {
  let timeoutHandle;

  try {
    await Promise.race([
      client.initialize(),
      new Promise((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(createInitializationTimeoutError());
        }, WA_INITIALIZE_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

function resolveChromeExecutablePath() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  if (process.platform === 'win32' && fs.existsSync(DEFAULT_WINDOWS_CHROME_PATH)) {
    return DEFAULT_WINDOWS_CHROME_PATH;
  }

  return undefined;
}

function isQrAuthenticationPending(session) {
  return !!session?.qrCode || session?.status === 'qr_ready';
}

function isRrError(error) {
  // WhatsApp Web lança um Error com name='r' e message='r' (código minificado)
  // error.stack é "r: r\n  at ..." mas error.message é apenas 'r'
  if (error?.name === 'r' && error?.message === 'r') return true;
  if (typeof error === 'string' && /^r:\s*r$/i.test(error.trim())) return true;
  return /^r:\s*r$/i.test((error?.message || '').trim());
}

function isRetryableWhatsAppError(error) {
  const message = (error?.message || '').toLowerCase();
  // r: r NÃO é retryable — falha imediatamente sem resetar sessão
  if (isRrError(error)) return false;
  return message.includes('timed out') ||
    message.includes('initialization timed out') ||
    message.includes('protocolerror') ||
    message.includes('execution context was destroyed') ||
    message.includes('target closed') ||
    message.includes('detached frame') ||
    message.includes('cannot read properties of undefined') ||
    message.includes('session closed') ||
    message.includes('not opened');
}

function isRecoverableWhatsAppRuntimeError(error) {
  if (!isRetryableWhatsAppError(error)) {
    return false;
  }

  const stack = (error?.stack || '').toLowerCase();
  return stack.includes('whatsapp-web.js') || stack.includes('puppeteer');
}

function isTargetClosedError(error) {
  const message = (error?.message || '').toLowerCase();
  return error?.name === 'TargetCloseError' || message.includes('target closed');
}

function isSessionProfileLockedError(error) {
  const message = (error?.message || '').toLowerCase();
  return message.includes('browser is already running');
}

async function killStaleSessionProcesses(sessionId, sessionLabel) {
  if (process.platform !== 'win32') {
    return;
  }

  const sessionPath = getSessionAuthPath(sessionId).replace(/'/g, "''");
  const script = [
    `$sessionPath = '${sessionPath}'`,
    "$pids = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object { $_.Name -eq 'chrome.exe' -and $_.CommandLine -like \"*$sessionPath*\" } | Select-Object -ExpandProperty ProcessId",
    'if ($pids) { foreach ($processId in $pids) { try { Stop-Process -Id $processId -Force -ErrorAction Stop } catch {} }; Write-Output ($pids -join ",") }',
  ].join('; ');

  try {
    const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-Command', script], {
      windowsHide: true,
    });

    const killedPids = stdout.trim();
    if (killedPids) {
      console.warn(`⚠️ [${sessionLabel}] Processos Chrome presos removidos: ${killedPids}`);
    }
  } catch (error) {
    console.warn(`⚠️ [${sessionLabel}] Não foi possível limpar processos presos do Chrome: ${error.message}`);
  }
}

function removeSessionLockFiles(sessionId, sessionLabel) {
  const authPath = getSessionAuthPath(sessionId);
  const lockFiles = ['lockfile', 'SingletonLock', 'SingletonCookie', 'SingletonSocket', 'DevToolsActivePort'];

  for (const fileName of lockFiles) {
    const filePath = path.join(authPath, fileName);
    try {
      if (fs.existsSync(filePath)) {
        fs.rmSync(filePath, { force: true });
      }
    } catch (error) {
      console.warn(`⚠️ [${sessionLabel}] Não foi possível remover ${fileName}: ${error.message}`);
    }
  }
}

function clearSessionAuthPath(sessionId, sessionLabel) {
  const authPath = getSessionAuthPath(sessionId);

  try {
    if (fs.existsSync(authPath)) {
      fs.rmSync(authPath, { recursive: true, force: true });
      console.warn(`⚠️ [${sessionLabel}] Perfil de autenticação removido para forçar novo QR Code.`);
    }
  } catch (error) {
    console.warn(`⚠️ [${sessionLabel}] Não foi possível remover o perfil de autenticação: ${error.message}`);
  }
}

async function waitForConnection(sessionId, timeoutMs = WA_RECOVERY_TIMEOUT_MS) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const session = getSession(sessionId);
    if (session.client && session.status === 'connected') {
      return session.client;
    }

    if (isQrAuthenticationPending(session)) {
      throw new Error('WhatsApp exige nova autenticação por QR Code');
    }

    if (session.status === 'disconnected' && !session.recoveryPromise) {
      break;
    }

    await delay(1000);
  }

  throw new Error('WhatsApp não está conectado');
}

async function safeDestroyClient(client, sessionLabel) {
  if (!client) {
    return;
  }

  try {
    await client.destroy();
  } catch (error) {
    if (!isTargetClosedError(error)) {
      console.error(`Erro ao destruir cliente [${sessionLabel}]:`, error);
    }
  }
}

async function runWithRetry(operationName, fn) {
  let lastError;

  for (let attempt = 1; attempt <= WA_OPERATION_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (!isRetryableWhatsAppError(error) || attempt === WA_OPERATION_RETRIES) {
        break;
      }

      console.warn(`⚠️ ${operationName} falhou na tentativa ${attempt}/${WA_OPERATION_RETRIES}. Nova tentativa em ${WA_RETRY_DELAY_MS}ms.`);
      await delay(WA_RETRY_DELAY_MS);
    }
  }

  throw lastError;
}

async function resetSession(sessionId, reason) {
  const session = getSession(sessionId);
  const sessionLabel = getSessionLabel(sessionId);

  clearReconnectTimer(session);

  if (session.client) {
    await safeDestroyClient(session.client, sessionLabel);
  }

  session.client = null;
  session.status = 'disconnected';
  session.qrCode = null;
  clearConnectingState(session);

  if (reason) {
    console.warn(`⚠️ [${sessionLabel}] Reiniciando sessão: ${reason}`);
  }
}

function getSessionContext(sessionId) {
  if (sessionId === GLOBAL_SESSION_ID) {
    return { userId: undefined, dedicatedWhatsApp: false };
  }

  if (sessionId.startsWith('dedicated-')) {
    return {
      userId: sessionId.slice('dedicated-'.length),
      dedicatedWhatsApp: true,
    };
  }

  return { userId: undefined, dedicatedWhatsApp: false };
}

function scheduleSessionRecovery(sessionId, reason) {
  const session = getSession(sessionId);
  const sessionLabel = getSessionLabel(sessionId);

  if (session.manualDisconnect || session.recoveryPromise || session.reconnectTimer) {
    return;
  }

  if (isQrAuthenticationPending(session)) {
    console.warn(`⚠️ [${sessionLabel}] Recuperação automática ignorada porque a sessão está aguardando autenticação por QR Code.`);
    return;
  }

  const { userId, dedicatedWhatsApp } = getSessionContext(sessionId);
  clearReconnectTimer(session);

  session.reconnectTimer = setTimeout(() => {
    session.reconnectTimer = null;
    whatsappService.recoverSession(userId, dedicatedWhatsApp, reason)
      .catch((recoveryError) => {
        console.error(`❌ [${sessionLabel}] Falha na recuperação automática:`, recoveryError.message);
      });
  }, WA_AUTO_RECONNECT_DELAY_MS);
}

function markSessionAsDisconnected(sessionId, options = {}) {
  const { preserveQrCode = false } = options;
  const session = getSession(sessionId);
  session.status = preserveQrCode && session.qrCode ? 'qr_ready' : 'disconnected';
  session.client = null;
  clearConnectingState(session);
  if (!preserveQrCode) {
    session.qrCode = null;
  }
}

function handleSessionRuntimeError(sessionId, error, source) {
  const session = getSession(sessionId);
  const sessionLabel = getSessionLabel(sessionId);

  if (!isRetryableWhatsAppError(error)) {
    console.error(`❌ [${sessionLabel}] ${source}:`, error);
    return;
  }

  console.warn(`⚠️ [${sessionLabel}] ${source}: ${error.message}`);

  if (isQrAuthenticationPending(session)) {
    markSessionAsDisconnected(sessionId, { preserveQrCode: true });
    console.warn(`⚠️ [${sessionLabel}] Sessão mantida aguardando QR Code após erro transitório.`);
    return;
  }

  markSessionAsDisconnected(sessionId);
  scheduleSessionRecovery(sessionId, `${source}: ${error.message}`);
}

function bindPuppeteerRuntimeGuards(client, sessionId) {
  const page = client.pupPage;

  if (!page || page[PUPPETEER_GUARD_FLAG]) {
    return;
  }

  page[PUPPETEER_GUARD_FLAG] = true;

  const onRuntimeError = (error) => {
    handleSessionRuntimeError(sessionId, error, 'Erro do Puppeteer');
  };

  page.on('error', onRuntimeError);
  page.on('pageerror', onRuntimeError);
}

function registerProcessGuards() {
  if (processGuardsRegistered) {
    return;
  }

  processGuardsRegistered = true;

  const recoverActiveSessions = (reason) => {
    for (const [sessionId, session] of sessions.entries()) {
      if (session.manualDisconnect || (!session.client && session.status !== 'connecting')) {
        continue;
      }

      markSessionAsDisconnected(sessionId, { preserveQrCode: isQrAuthenticationPending(session) });
      scheduleSessionRecovery(sessionId, reason);
    }
  };

  process.on('unhandledRejection', (reason) => {
    if (!isRecoverableWhatsAppRuntimeError(reason)) {
      return;
    }

    console.warn(`⚠️ Erro assíncrono do WhatsApp interceptado: ${reason.message}`);
    recoverActiveSessions(`erro assíncrono do WhatsApp: ${reason.message}`);
  });

  process.on('uncaughtException', (error) => {
    if (!isRecoverableWhatsAppRuntimeError(error)) {
      console.error('❌ Erro fatal não tratado:', error);
      process.exit(1);
      return;
    }

    console.warn(`⚠️ Erro fatal do WhatsApp interceptado: ${error.message}`);
    recoverActiveSessions(`erro fatal do WhatsApp: ${error.message}`);
  });
}

const whatsappService = {
  clearSessionCache,

  async initialize(userId, dedicatedWhatsApp) {
    const sessionId = await resolveSessionId(userId, dedicatedWhatsApp);
    const session = getSession(sessionId);
    const sessionLabel = getSessionLabel(sessionId);

    if (session.client && session.status === 'connected') {
      return session.client;
    }

    if (session.status === 'connecting') {
      console.log(`⏳ [${sessionLabel}] Já está conectando...`);
      return session.client;
    }

    clearReconnectTimer(session);
    session.manualDisconnect = false;
    session.status = 'connecting';
    session.qrCode = null;
    session.connectingStartedAt = Date.now();

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const executablePath = resolveChromeExecutablePath();
        const client = new Client({
          authStrategy: new LocalAuth({
            clientId: sessionId,
            dataPath: './tokens',
          }),
          puppeteer: {
            headless: true,
            protocolTimeout: WA_PROTOCOL_TIMEOUT_MS,
            executablePath,
            args: [
              '--no-sandbox',
              '--disable-setuid-sandbox',
              '--disable-dev-shm-usage',
              '--disable-accelerated-2d-canvas',
              '--no-first-run',
              '--disable-gpu',
            ],
          },
        });

        let qrCount = 0;
        client.on('qr', async (qr) => {
          qrCount++;
          // Após 5 QR Codes sem escanear, para a sessão para não vazar memória
          if (qrCount > 5) {
            console.warn(`⚠️ [${sessionLabel}] Limite de QR Codes atingido (${qrCount}). Encerrando sessão para evitar consumo de memória.`);
            session.status = 'disconnected';
            session.qrCode = null;
            clearConnectingState(session);
            client.destroy().catch(() => {});
            return;
          }
          console.log(`📱 [${sessionLabel}] QR Code gerado! (${qrCount}/5)`);
          try {
            session.qrCode = await qrcode.toDataURL(qr, { width: 300 });
            session.status = 'qr_ready';
            clearConnectingState(session);
          } catch (err) {
            console.error('Erro ao gerar QR image:', err);
            session.qrCode = qr;
            session.status = 'qr_ready';
            clearConnectingState(session);
          }
        });

        client.on('ready', () => {
          console.log(`✅ [${sessionLabel}] WhatsApp conectado!`);
          session.status = 'connected';
          session.qrCode = null;
          session.readyAt = Date.now();
          clearConnectingState(session);

          if (client.pupPage) {
            client.pupPage.setDefaultTimeout(WA_PROTOCOL_TIMEOUT_MS);
            client.pupPage.setDefaultNavigationTimeout(WA_PROTOCOL_TIMEOUT_MS);
          }
        });

        client.on('authenticated', () => {
          console.log(`🔐 [${sessionLabel}] WhatsApp autenticado!`);
        });

        client.on('error', (error) => {
          handleSessionRuntimeError(sessionId, error, 'Erro do cliente WhatsApp');
        });

        client.on('auth_failure', (msg) => {
          console.error(`❌ [${sessionLabel}] Falha na autenticação:`, msg);
          session.status = 'qr_ready';
          session.client = null;
          clearConnectingState(session);
        });

        client.on('disconnected', (reason) => {
          console.log(`📡 [${sessionLabel}] Desconectado:`, reason);
          session.client = null;
          clearConnectingState(session);

          if (isQrAuthenticationPending(session)) {
            session.status = 'qr_ready';
            console.warn(`⚠️ [${sessionLabel}] Sessão desconectada aguardando QR Code. A recuperação automática foi pausada até nova autenticação.`);
            return;
          }

          session.status = 'disconnected';
          session.qrCode = null;

          if (!session.manualDisconnect) {
            clearReconnectTimer(session);
            session.reconnectTimer = setTimeout(() => {
              session.reconnectTimer = null;
              this.recoverSession(userId, dedicatedWhatsApp, `desconectado: ${reason || 'sem motivo'}`)
                .catch((recoveryError) => {
                  console.error(`❌ [${sessionLabel}] Falha na recuperação automática:`, recoveryError.message);
                });
            }, WA_AUTO_RECONNECT_DELAY_MS);
          }
        });

        session.client = client;
        await initializeClientWithTimeout(client);
        bindPuppeteerRuntimeGuards(client, sessionId);
        return client;
      } catch (error) {
        await safeDestroyClient(session.client, sessionLabel);
        session.client = null;
        clearConnectingState(session);

        const shouldRetryInitialization = attempt < 3 && (isSessionProfileLockedError(error) || isRetryableWhatsAppError(error));

        if (shouldRetryInitialization) {
          const retryMessage = attempt === 1
            ? 'Limpando Chrome preso e locks antes de tentar novamente.'
            : 'Forçando novo perfil para gerar um QR Code limpo.';

          console.warn(`⚠️ [${sessionLabel}] Falha ao iniciar WhatsApp. ${retryMessage}`);
          await killStaleSessionProcesses(sessionId, sessionLabel);
          removeSessionLockFiles(sessionId, sessionLabel);

          if (attempt === 2) {
            clearSessionAuthPath(sessionId, sessionLabel);
          }

          continue;
        }

        console.error(`❌ [${sessionLabel}] Erro ao conectar:`, error);
        session.status = 'disconnected';
        throw error;
      }
    }
  },

  async ensureConnected(userId, dedicatedWhatsApp, reason = 'verificação de conexão') {
    const sessionId = await resolveSessionId(userId, dedicatedWhatsApp);
    const session = getSession(sessionId);

    if (session.client && session.status === 'connected') {
      return session.client;
    }

    if (session.status === 'connecting') {
      try {
        return await waitForConnection(sessionId);
      } catch {
        // Continua para recuperação abaixo.
      }
    }

    // Não resetar a sessão se já está aguardando scan do QR Code — deixar o QR estável
    if (isQrAuthenticationPending(session)) {
      throw new Error('WhatsApp exige nova autenticação por QR Code');
    }

    await this.recoverSession(userId, dedicatedWhatsApp, reason);
    return waitForConnection(sessionId);
  },

  async recoverSession(userId, dedicatedWhatsApp, reason = 'recuperação automática') {
    const sessionId = await resolveSessionId(userId, dedicatedWhatsApp);
    const session = getSession(sessionId);
    const sessionLabel = getSessionLabel(sessionId);

    if (session.recoveryPromise) {
      return session.recoveryPromise;
    }

    session.recoveryPromise = (async () => {
      await resetSession(sessionId, reason);
      await killStaleSessionProcesses(sessionId, sessionLabel);
      removeSessionLockFiles(sessionId, sessionLabel);
      await this.initialize(userId, dedicatedWhatsApp);
      return waitForConnection(sessionId);
    })();

    try {
      return await session.recoveryPromise;
    } finally {
      session.recoveryPromise = null;
    }
  },

  async getClient(userId, dedicatedWhatsApp) {
    const sessionId = await resolveSessionId(userId, dedicatedWhatsApp);
    const session = getSession(sessionId);
    return session.client;
  },

  async getQRCode(userId, dedicatedWhatsApp) {
    const sessionId = await resolveSessionId(userId, dedicatedWhatsApp);
    const session = getSession(sessionId);
    return session.qrCode;
  },

  async getStatus(userId, dedicatedWhatsApp) {
    const sessionId = await resolveSessionId(userId, dedicatedWhatsApp);
    const session = getSession(sessionId);
    return session.status;
  },

  async getGroups(userId, dedicatedWhatsApp) {
    const sessionId = await resolveSessionId(userId, dedicatedWhatsApp);
    const session = getSession(sessionId);
    let client = await this.ensureConnected(userId, dedicatedWhatsApp, 'listagem de grupos');

    // Aguarda 20s após o ready para os stores internos do WhatsApp carregarem
    const WARMUP_MS = 20000;
    if (session.readyAt && Date.now() - session.readyAt < WARMUP_MS) {
      const wait = WARMUP_MS - (Date.now() - session.readyAt);
      console.log(`⏳ [${getSessionLabel(sessionId)}] Aguardando ${Math.round(wait / 1000)}s de aquecimento antes de listar grupos...`);
      await delay(wait);
    }

    // Leitura direta da coleção interna do WhatsApp Web, sem chamar getChatModel/getChats
    // que usam WAWebLidMigrationUtils.toPn e groupMetadata.update() — fontes do erro r:r
    let groups;

    try {
      groups = await runWithRetry('Listagem de grupos do WhatsApp', async () => {
        return client.pupPage.evaluate(() => {
          try {
            const chats = window.require('WAWebCollections').Chat.getModelsArray();
            return chats
              .filter(c => c.id && c.id._serialized && c.id._serialized.endsWith('@g.us'))
              .map(c => ({
                id: c.id._serialized,
                name: c.formattedTitle || c.name || c.id._serialized,
                participants: c.groupMetadata && c.groupMetadata.participants
                  ? c.groupMetadata.participants.length
                  : 0,
              }));
          } catch (e) {
            throw new Error('WA_COLLECTION_ERROR: ' + (e && e.message ? e.message : String(e)));
          }
        });
      });
    } catch (error) {
      if (!isRetryableWhatsAppError(error)) {
        throw error;
      }

      try {
        client = await this.recoverSession(userId, dedicatedWhatsApp, `falha ao listar grupos: ${error.message}`);
        groups = await runWithRetry('Listagem de grupos após reconexão', async () => {
          return client.pupPage.evaluate(() => {
            const chats = window.require('WAWebCollections').Chat.getModelsArray();
            return chats
              .filter(c => c.id && c.id._serialized && c.id._serialized.endsWith('@g.us'))
              .map(c => ({
                id: c.id._serialized,
                name: c.formattedTitle || c.name || c.id._serialized,
                participants: c.groupMetadata && c.groupMetadata.participants
                  ? c.groupMetadata.participants.length
                  : 0,
              }));
          });
        });
      } catch (recoveryError) {
        throw recoveryError;
      }
    }

    return groups || [];
  },

  async sendText(userId, groupId, text) {
    let client = await this.ensureConnected(userId, undefined, `envio de texto para ${groupId}`);

    try {
      return await runWithRetry(`Envio de texto para ${groupId}`, async () => {
        return client.sendMessage(groupId, text);
      });
    } catch (error) {
      if (!isRetryableWhatsAppError(error)) {
        throw error;
      }

      client = await this.recoverSession(userId, undefined, `falha ao enviar texto para ${groupId}: ${error.message}`);
      return runWithRetry(`Envio de texto para ${groupId} após reconexão`, async () => {
        return client.sendMessage(groupId, text);
      });
    }
  },

  async sendImage(userId, groupId, imageUrl, caption) {
    let client = await this.ensureConnected(userId, undefined, `envio de imagem para ${groupId}`);
    const media = await MessageMedia.fromUrl(imageUrl, { unsafeMime: true });

    try {
      return await runWithRetry(`Envio de imagem para ${groupId}`, async () => {
        return client.sendMessage(groupId, media, { caption: caption || '' });
      });
    } catch (error) {
      if (!isRetryableWhatsAppError(error)) {
        throw error;
      }

      client = await this.recoverSession(userId, undefined, `falha ao enviar imagem para ${groupId}: ${error.message}`);
      return runWithRetry(`Envio de imagem para ${groupId} após reconexão`, async () => {
        return client.sendMessage(groupId, media, { caption: caption || '' });
      });
    }
  },

  async disconnect(userId, dedicatedWhatsApp) {
    const sessionId = await resolveSessionId(userId, dedicatedWhatsApp);
    const session = getSession(sessionId);
    session.manualDisconnect = true;
    clearReconnectTimer(session);
    if (session.client) {
      await safeDestroyClient(session.client, getSessionLabel(sessionId));
      session.client = null;
    }
    session.status = 'disconnected';
    session.qrCode = null;
    clearConnectingState(session);
  },

  async logout(userId, dedicatedWhatsApp) {
    const sessionId = await resolveSessionId(userId, dedicatedWhatsApp);
    const session = getSession(sessionId);
    const sessionLabel = getSessionLabel(sessionId);
    session.manualDisconnect = true;
    clearReconnectTimer(session);

    if (session.client) {
      // Destroying the browser and clearing LocalAuth data is enough to force a fresh login.
      // Calling client.logout() has been crashing the backend with TargetCloseError.
      await safeDestroyClient(session.client, sessionLabel);
      session.client = null;
    }
    session.status = 'disconnected';
    session.qrCode = null;
    clearConnectingState(session);

    // Apagar a pasta usada pelo LocalAuth para forçar nova autenticação.
    const authPath = getSessionAuthPath(sessionId);
    try {
      if (fs.existsSync(authPath)) {
        fs.rmSync(authPath, { recursive: true, force: true });
        console.log(`Sessão local removida [${sessionLabel}]`);
      }
    } catch (e) {
      console.error(`Erro ao remover sessão local [${sessionLabel}]:`, e);
    }
  },

  getAllSessions() {
    return Array.from(sessions.entries()).map(([sessionId, session]) => ({
      userId: sessionId,
      status: session.status,
    }));
  },
};

registerProcessGuards();

module.exports = whatsappService;
