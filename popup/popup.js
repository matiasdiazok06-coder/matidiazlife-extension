// Popup Script para Instagram Bot con Firebase Auth

// Debug limpio para verificar que el script se carga
console.log('🚀 Popup.js iniciando...');

// Función simple para mostrar debug en la interfaz
function showDebug(message, type = 'info') {
    console.log(`🔍 DEBUG: ${message}`);
    const debugLog = document.getElementById('debug-log');
    if (debugLog) {
        const timestamp = new Date().toLocaleTimeString();
        const debugEntry = document.createElement('div');
        debugEntry.className = `debug-entry ${type}`;
        debugEntry.textContent = `[${timestamp}] ${message}`;
        debugLog.appendChild(debugEntry);
        debugLog.scrollTop = debugLog.scrollHeight;
    } else {
        console.log(`❌ Debug log element no encontrado`);
    }
}

const CURRENT_USER_STORAGE_KEY = 'matidiaz_current_user';
const CURRENT_CREDENTIAL_STORAGE_KEY = 'matidiaz_current_credential';

// SISTEMA LIMPIO: Inicialización simplificada
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 DOM Content Loaded - Iniciando md outbound');
    showDebug('DOM Content Loaded', 'info');
    
    // Crear instancia del popup
    console.log('🚀 Creating InstagramPopupScript instance...');
    showDebug('Creating InstagramPopupScript instance...', 'info');
    const popup = new InstagramPopupScript();
    console.log('🚀 InstagramPopupScript created successfully');
    showDebug('InstagramPopupScript inicializado', 'success');
});

class InstagramPopupScript {
    constructor() {
        console.log('🔧 Constructor iniciando...');
        this.auth = null;
        this.db = null;
        this.isAuthenticated = false;
        this.userEmail = null;
        this.userId = null;
        this.dailyMessageCount = 0;
        this.isRunning = false;
        this.campaigns = [];
        this.logs = [];
        this.currentCampaign = null;
        this.isExecuting = false; // NUEVO: Flag para evitar ejecuciones múltiples
        
        // SISTEMA LIMPIO: Contadores de mensajes del usuario
        this.dailyMessageCount = 0;       // Contador diario del usuario 
        this.messageLimit = 80;            // Límite personalizado del usuario
        this.lastResetDate = null;         // Fecha del último reset
        
        // NUEVO: Sistema de equipo
        this.deviceId = null;              // ID único del dispositivo
        this.teamMemberName = null;        // Nombre del miembro del equipo
        this.isTeamMember = false;         // Si es parte de un equipo
        this.isTeamAdmin = false;          // Si es el administrador del equipo
        this.teamAdminDeviceId = null;     // Device ID del administrador

        // Control de acceso por credenciales locales
        this.teamAccessGranted = false;
        this.teamOwnerBypass = false;
        this.teamAccessInfo = null;
        this.teamCredential = '';
        this.teamEmail = null;

        console.log('🔧 Constructor completado, llamando init...');
        console.log('🔧 POPUP CONSTRUCTOR EJECUTADO - VERIFICAR ESTE LOG');
        this.init();
    }

    async init() {
        console.log('🔧 Init iniciando...');
        console.log('🔧 POPUP INIT EJECUTADO - VERIFICAR ESTE LOG');
        try {
            const accesoValido = await this.enforceTeamCredentialAccess();
            if (!accesoValido) {
                this.lockExtensionForCredential();
                return;
            }
        } catch (error) {
            console.error('❌ Error verificando credenciales del equipo:', error);
            this.lockExtensionForCredential(error.message);
            return;
        }

        this.initializeFirebase();
        this.setupAuthStateListener();
        this.setupEventListeners();
        this.loadCampaigns();
        this.loadLogs();
        this.loadMessageTemplates(); // NUEVO: Cargar plantillas guardadas
        // NO cargar contadores inmediatamente, esperar a que el usuario se autentique
        this.startResetTimer(); // NUEVO: Iniciar timer de reset
        // DESACTIVADO: Listener agresivo que reseteaba contadores
        // setInterval(async () => {
        //     if (this.isAuthenticated && this.userId) {
        //         await this.loadMessageCounters();
        //     }
        // }, 2000); // Cada 2 segundos
        
        // DESACTIVADO: Verificación que también reseteaba contadores
        // setInterval(async () => {
        //     if (this.isAuthenticated && this.userId && this.db) {
        //         console.log('🔄 Verificación periódica de contadores globales...');
        //         const today = this.getArgentinaDate();
        //         const userStatsRef = this.db.collection('users').doc(this.userId).collection('dailyStats').doc(today);
        //         try {
        //             const doc = await userStatsRef.get();
        //             if (doc.exists) {
        //                 const data = doc.data();
        //                 const newGlobalCount = data.globalMessageCount || 0;
        //                 if (newGlobalCount !== this.globalMessageCount) {
        //                     console.log(`📊 Contador global actualizado: ${this.globalMessageCount} → ${newGlobalCount}`);
        //                     this.globalMessageCount = newGlobalCount;
        //                     this.updateMessageCountersUI();
        //                 }
        //             }
        //         } catch (error) {
        //             console.log('⚠️ Error verificando contadores globales:', error);
        //         }
        //     }
        // }, 30000); // Cada 30 segundos

        console.log('🔧 Popup inicializado');
    }

    async enforceTeamCredentialAccess() {
        try {
            const resultado = await this.readLocalStorage([CURRENT_USER_STORAGE_KEY, CURRENT_CREDENTIAL_STORAGE_KEY]);
            const email = typeof resultado[CURRENT_USER_STORAGE_KEY] === 'string'
                ? resultado[CURRENT_USER_STORAGE_KEY].trim().toLowerCase()
                : '';
            const credential = typeof resultado[CURRENT_CREDENTIAL_STORAGE_KEY] === 'string'
                ? resultado[CURRENT_CREDENTIAL_STORAGE_KEY].trim().toUpperCase()
                : '';

            this.teamEmail = email;
            this.teamCredential = credential;

            if (!email) {
                this.teamAccessInfo = { reason: 'Guardá tu email desde la página de opciones para validar el acceso.' };
                showDebug('Bloqueado: falta email local', 'error');
                return false;
            }

            const respuesta = await this.sendRuntimeMessage({
                action: 'matidiaz_validateCredential',
                payload: { email, credential }
            });

            if (!respuesta || respuesta.success !== true) {
                const motivo = respuesta?.error || 'No se pudo validar tu credencial local.';
                this.teamAccessInfo = { reason: motivo };
                showDebug(`Bloqueado: ${motivo}`, 'error');
                return false;
            }

            const datos = respuesta.data || {};
            if (!datos.valid) {
                const motivo = datos.reason || 'Credencial inválida o faltante.';
                this.teamAccessInfo = { reason: motivo };
                showDebug(`Bloqueado: ${motivo}`, 'error');
                return false;
            }

            this.teamAccessGranted = true;
            this.teamOwnerBypass = Boolean(datos.ownerBypass);
            this.teamAccessInfo = { reason: 'Acceso concedido' };
            showDebug('Acceso al equipo validado correctamente.', 'success');
            return true;
        } catch (error) {
            this.teamAccessInfo = { reason: error.message };
            showDebug(`Error al validar credenciales: ${error.message}`, 'error');
            throw error;
        }
    }

    lockExtensionForCredential(motivoExtra) {
        const mensaje = motivoExtra || this.teamAccessInfo?.reason || 'Debés configurar tus credenciales locales para usar md outbound.';
        this.teamAccessGranted = false;
        const screens = document.querySelectorAll('.screen');
        screens.forEach(screen => {
            if (screen) {
                screen.classList.add('hidden');
            }
        });

        let overlay = document.getElementById('matidiaz-credential-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'matidiaz-credential-overlay';
            overlay.className = 'credential-overlay';
            overlay.innerHTML = `
                <div class="credential-overlay__card">
                    <h2>Credencial requerida</h2>
                    <p class="credential-overlay__message"></p>
                    <p class="credential-overlay__note">Pedile al owner tu credencial (formato MATI-XXXXXX-AAAA) y guardala desde la pantalla de Equipo.</p>
                    <div class="credential-overlay__actions">
                        <button type="button" id="abrir-opciones-credencial">Abrir opciones</button>
                    </div>
                </div>`;
            document.body.appendChild(overlay);

            const boton = overlay.querySelector('#abrir-opciones-credencial');
            if (boton) {
                boton.addEventListener('click', () => {
                    if (chrome.runtime.openOptionsPage) {
                        chrome.runtime.openOptionsPage();
                    } else {
                        window.open(chrome.runtime.getURL('options/options.html'), '_blank');
                    }
                });
            }
        }

        const mensajeElemento = overlay.querySelector('.credential-overlay__message');
        if (mensajeElemento) {
            mensajeElemento.textContent = mensaje;
        }

        overlay.classList.remove('hidden');
        showDebug(`Acceso bloqueado por credenciales: ${mensaje}`, 'error');
    }

    readLocalStorage(claves) {
        return new Promise((resolve, reject) => {
            try {
                const keys = Array.isArray(claves) ? claves : [claves];
                chrome.storage.local.get(keys, (resultado) => {
                    const error = chrome.runtime.lastError;
                    if (error) {
                        reject(new Error(error.message));
                        return;
                    }
                    resolve(resultado);
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    sendRuntimeMessage(payload) {
        return new Promise((resolve, reject) => {
            try {
                chrome.runtime.sendMessage(payload, (response) => {
                    const error = chrome.runtime.lastError;
                    if (error) {
                        reject(new Error(error.message));
                        return;
                    }
                    resolve(response);
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    // SISTEMA LIMPIO: Incrementar contador en el documento principal del usuario
    async incrementMessageCounters() {
        console.log('📈 INCREMENTANDO CONTADOR DE MENSAJES...');
        console.log('🔍 Estado inicial:', {
            isAuthenticated: this.isAuthenticated,
            userId: this.userId,
            userEmail: this.userEmail,
            db: !!this.db
        });
        
        if (!this.isAuthenticated || !this.userId || !this.db) {
            const error = `Usuario no autenticado o Firebase no disponible. Auth: ${this.isAuthenticated}, UserID: ${this.userId}, DB: ${!!this.db}`;
            console.error('❌', error);
            throw new Error(error);
        }

        try {
            // Obtener hora Argentina del servidor usando timestamp de Firebase
            const serverTimestamp = firebase.firestore.FieldValue.serverTimestamp();
            
            // Obtener datos actuales del usuario
            const userRef = this.db.collection('users').doc(this.userId);
            const userDoc = await userRef.get();
            
            if (!userDoc.exists) {
                throw new Error('Usuario no encontrado en Firestore');
            }
            
            const userData = userDoc.data();
            const messageLimit = userData.messageLimit || 80;
            const currentCount = userData.messagesSent || 0;
            
            console.log('📊 Estado actual:', {
                currentCount,
                messageLimit,
                lastResetDate: userData.lastResetDate
            });
            
            // Obtener fecha Argentina actual desde el servidor
            const tempRef = this.db.collection('temp').doc('timestamp');
            await tempRef.set({ timestamp: serverTimestamp });
            const tempDoc = await tempRef.get();
            const serverTime = tempDoc.data().timestamp.toDate();
            
            // Convertir a hora Argentina (UTC-3)
            const argentinaTime = new Date(serverTime.getTime() - (3 * 60 * 60 * 1000));
            const todayArgentina = argentinaTime.toLocaleDateString('en-US', {
                timeZone: 'America/Argentina/Buenos_Aires'
            });
            
            console.log('🕐 Hora servidor Argentina:', argentinaTime);
            console.log('📅 Fecha Argentina:', todayArgentina);
            
            // Verificar si necesita reset diario
            if (userData.lastResetDate !== todayArgentina) {
                console.log('🔄 Nuevo día detectado - Reseteando contador');
                await userRef.update({
                    messagesSent: 1,
                    lastResetDate: todayArgentina,
                    lastMessageAt: serverTimestamp
                });
                
                // Limpiar timestamp temporal
                await tempRef.delete();
                
                            this.addLog('🔄 Contador diario reseteado - Primer mensaje del día', 'info');
            this.updateMessageCountersUI();
            
            // NUEVO: Sincronizar con storage local
            await this.syncCountersToLocal(1, messageLimit);
            
            // NUEVO: Actualizar contador del miembro del equipo si es parte de uno
            // NOTA: Solo actualizamos el contador individual, NO el contador principal
            if (this.isTeamMember && this.deviceId && this.teamMemberName) {
                await this.updateTeamMemberCounterOnly();
            }
            
            return { 
                messagesSent: 1, 
                messageLimit: messageLimit,
                resetOccurred: true 
            };
            }
            
            // Verificar límite diario
            if (currentCount >= messageLimit) {
                // Limpiar timestamp temporal
                await tempRef.delete();
                
                throw new Error(`Límite diario alcanzado: ${currentCount}/${messageLimit} mensajes`);
            }
            
            // Incrementar contador ATÓMICAMENTE para evitar race conditions
            await userRef.update({
                messagesSent: firebase.firestore.FieldValue.increment(1),
                lastMessageAt: serverTimestamp
            });
            
            // Obtener el nuevo valor después del incremento atómico
            const updatedDoc = await userRef.get();
            const newCount = updatedDoc.data().messagesSent;
            
            // Limpiar timestamp temporal
            await tempRef.delete();
            
            console.log(`✅ CONTADOR ACTUALIZADO: ${newCount}/${messageLimit}`);
            this.addLog(`📈 Mensaje enviado: ${newCount}/${messageLimit}`, 'success');
        
        // Actualizar interfaz
        this.updateMessageCountersUI();
        
                    // NUEVO: Sincronizar con storage local para persistencia
            await this.syncCountersToLocal(newCount, messageLimit);
            
            // NUEVO: Actualizar contador del miembro del equipo si es parte de uno
            // NOTA: Solo actualizamos el contador individual, NO el contador principal
            // El contador principal ya se actualizó arriba y es COMPARTIDO entre todo el equipo
            if (this.isTeamMember && this.deviceId && this.teamMemberName) {
                await this.updateTeamMemberCounterOnly();
            }
        
        return { 
                messagesSent: newCount, 
                messageLimit: messageLimit,
                resetOccurred: false 
            };
            
        } catch (error) {
            console.error('❌ ERROR INCREMENTANDO CONTADOR:', error);
            this.addLog(`❌ Error: ${error.message}`, 'error');
            throw error;
        }
    }

    initializeFirebase() {
        console.log('🔧 InitializeFirebase iniciando...');
        try {
            this.showDebug('Inicializando Firebase...');
            console.log('🔧 Verificando si firebase está disponible...');
            
            // Verificar que Firebase esté disponible
            if (typeof firebase === 'undefined') {
                console.log('❌ Firebase no está disponible');
                this.showDebug('Firebase no está cargado', 'error');
                setTimeout(() => this.initializeFirebase(), 1000); // Reintentar en 1 segundo
                return;
            }
            
            console.log('✅ Firebase está disponible, configurando...');
            
            // Firebase configuration
            const firebaseConfig = {
                apiKey: "AIzaSyDjtsuDe5LXIwBfd9Z6NqI2FiFvo9m5qzQ",
                authDomain: "extension-prime-outbound.firebaseapp.com",
                projectId: "extension-prime-outbound",
                storageBucket: "extension-prime-outbound.firebasestorage.app",
                messagingSenderId: "314906404713",
                appId: "1:314906404713:web:9a36ac254357784235bff8",
                measurementId: "G-249X5PEFNL"
            };
            
            console.log('🔧 Inicializando Firebase con config...');
            
            // Initialize Firebase
            firebase.initializeApp(firebaseConfig);
            console.log('✅ Firebase inicializado');
            
            // Obtener las instancias
            this.auth = firebase.auth();
            this.db = firebase.firestore();
            
            console.log('✅ Auth y DB obtenidos');
            this.showDebug('Firebase inicializado correctamente', 'success');
            this.showDebug(`Auth: ${this.auth ? 'OK' : 'NULL'}`, 'info');
            this.showDebug(`DB: ${this.db ? 'OK' : 'NULL'}`, 'info');
            
        } catch (error) {
            console.log(`❌ Error en initializeFirebase: ${error.message}`);
            this.showDebug(`Error inicializando Firebase: ${error.message}`, 'error');
            // Reintentar después de un error
            setTimeout(() => this.initializeFirebase(), 2000);
        }
    }

    setupAuthStateListener() {
        this.auth.onAuthStateChanged(async (user) => {
            if (user) {
                this.showDebug(`Usuario autenticado: ${user.email}`, 'success');
                this.isAuthenticated = true;
                
                // Guardar estado de autenticación en storage
                await chrome.storage.local.set({
                    isAuthenticated: true,
                    userEmail: user.email,
                    userId: user.uid
                });
                
                // Guardar info del usuario para sistema de contadores
                this.userEmail = user.email;
                this.userId = user.uid;
                
                this.showBotScreen();
                this.updateUserInfo();
                this.loadUserData();
                
                // SISTEMA LIMPIO: Cargar contadores desde Firebase después de autenticación
                await this.loadMessageCounters();
                
                // NUEVO: Recargar campañas con datos específicos del usuario
                await this.loadCampaigns();
                
                // NUEVO: Auto-refresh de campañas cada 3 segundos
                this.startCampaignAutoRefresh();
                
                // NUEVO: Iniciar listener de sincronización en tiempo real
                this.startRealtimeSync();
                
                // NUEVO: Verificar estado del miembro del equipo
                await this.checkTeamMemberStatus();
                
                // NUEVO: Asignar referencia global para administración
                window.teamManager = this;
                
                // CAMPAÑAS LOCALES: No necesitamos sincronización en tiempo real
                // Cada miembro maneja sus campañas independientemente
            } else {
                this.showDebug('Usuario no autenticado', 'info');
                this.isAuthenticated = false;
                
                // Limpiar estado de autenticación en storage
                await chrome.storage.local.remove(['isAuthenticated', 'userEmail', 'userId']);
                
                // NUEVO: Detener sincronización en tiempo real
                this.stopRealtimeSync();
                
                // NUEVO: Detener listener del equipo
                this.stopTeamRealtimeUpdates();
                
                // CAMPAÑAS LOCALES: No hay listeners que detener
                
                // NUEVO: Ocultar botón del panel de equipo
                const teamPanelBtn = document.getElementById('team-panel-btn');
                if (teamPanelBtn) {
                    teamPanelBtn.classList.add('hidden');
                }
                
                this.showLoginScreen();
            }
        });
    }

    async checkAuthState() {
        try {
            // Verificar si hay un usuario autenticado guardado en storage
            const result = await chrome.storage.local.get(['isAuthenticated', 'userEmail']);
            
            if (result.isAuthenticated && result.userEmail) {
                this.showDebug(`Estado de autenticación encontrado: ${result.userEmail}`, 'info');
                
                // Verificar si el usuario sigue autenticado en Firebase
                const currentUser = this.auth.currentUser;
                if (currentUser && currentUser.email === result.userEmail) {
                    this.showDebug('Usuario sigue autenticado en Firebase', 'success');
                    this.isAuthenticated = true;
                    this.showBotScreen();
                    this.updateUserInfo();
                    this.loadUserData();
                } else {
                    this.showDebug('Usuario no está autenticado en Firebase, mostrando login', 'info');
                    this.isAuthenticated = false;
                    this.showLoginScreen();
                }
            } else {
                this.showDebug('No hay estado de autenticación guardado', 'info');
                this.isAuthenticated = false;
                this.showLoginScreen();
            }
        } catch (error) {
            this.showDebug(`Error verificando estado de autenticación: ${error.message}`, 'error');
            this.isAuthenticated = false;
            this.showLoginScreen();
        }
    }

    setupEventListeners() {
        try {
            this.showDebug('Configurando event listeners...');
            
            // Hacer la instancia disponible globalmente para los botones de campaña
            window.popupInstance = this;
            
            // PREVENIR MÚLTIPLES LISTENERS
            if (!window.POPUP_LISTENER_REGISTERED) {
                console.log('🎧 🆕 POPUP ACTUALIZADO - VERSIÓN 5.0 - CAMPAIGNPROGRESS FIX - TIMESTAMP: ' + Date.now() + ' 🆕');
                console.log('🎧 Registrando listener de mensajes por PRIMERA VEZ');
                console.log('🎧 POPUP: Estado inicial - window.popupInstance:', !!window.popupInstance);
                console.log('🎧 POPUP: Listener incluirá campaignProgress handler');
                
                // Escuchar mensajes del content script
                chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
                    console.log('📨 POPUP: MENSAJE RECIBIDO:', request.action, request);
                    console.log('📨 POPUP: Sender info:', sender);
                    console.log('📨 POPUP: Window popupInstance:', !!window.popupInstance);
                    
                    // Para manejar respuestas asíncronas
                    const handleAsync = async () => {
                    if (request.action === 'logUpdate') {
                        console.log('📨 POPUP RECIBIÓ LOG:', request.message);
                        
                        // Buscar la instancia del popup activa
                        if (window.popupInstance) {
                            window.popupInstance.addLog(request.message, request.type);
                        } else {
                            console.log('❌ No hay instancia del popup activa');
                        }
                        
                        sendResponse({ success: true });
                    } else if (request.action === 'checkGlobalLimit') {
                        console.log('🔍 POPUP RECIBIÓ: Verificar límite global');
                        
                        if (window.popupInstance && window.popupInstance.isAuthenticated) {
                            try {
                                await window.popupInstance.loadMessageCounters();
                                const limitReached = window.popupInstance.dailyMessageCount >= window.popupInstance.messageLimit;
                                const message = limitReached ? 
                                    `Límite alcanzado: ${window.popupInstance.dailyMessageCount}/${window.popupInstance.messageLimit}` : 
                                    `Límite OK: ${window.popupInstance.dailyMessageCount}/${window.popupInstance.messageLimit}`;
                                    
                                sendResponse({ 
                                    success: true, 
                                    limitReached,
                                    message,
                                    dailyCount: window.popupInstance.dailyMessageCount,
                                    messageLimit: window.popupInstance.messageLimit
                                });
                            } catch (error) {
                                sendResponse({ success: false, error: error.message });
                            }
                        } else {
                            sendResponse({ success: false, error: 'Usuario no autenticado' });
                        }
                    } else if (request.action === 'incrementMessageCounters') {
                        console.log('📈 POPUP RECIBIÓ incrementMessageCounters');
                        
                        if (window.popupInstance && window.popupInstance.isAuthenticated) {
                            try {
                                console.log('🚀 INICIANDO incrementMessageCounters...');
                                const result = await window.popupInstance.incrementMessageCounters();
                                console.log('✅ RESULTADO:', result);
                                
                                sendResponse({
                                    success: true,
                                    messagesSent: result.messagesSent,
                                    messageLimit: result.messageLimit,
                                    resetOccurred: result.resetOccurred,
                                    message: `Contador actualizado: ${result.messagesSent}/${result.messageLimit}`
                                });
                            } catch (error) {
                                console.error('❌ ERROR:', error);
                                sendResponse({ 
                                    success: false, 
                                    error: error.message 
                                });
                            }
                        } else {
                            console.log('❌ Usuario no autenticado');
                            sendResponse({ 
                                success: false, 
                                error: 'Usuario no autenticado' 
                            });
                        }
                    // ELIMINADO: Handler redundante que causaba doble conteo
                    } else if (request.action === 'campaignProgress') {
                        console.log('🔍 🎯 POPUP RECIBIÓ: campaignProgress!!');
                        console.log('🔍 POPUP request completo:', request);
                        console.log('🔍 POPUP deviceId actual:', window.popupInstance?.deviceId);
                        console.log('🔍 POPUP deviceId del request:', request.deviceId);
                        console.log('🔍 POPUP instance existe:', !!window.popupInstance);
                        
                        // DEBUGGING: Ver storage antes de recargar
                        const debugStorage = await chrome.storage.local.get(null);
                        console.log('🔍 STORAGE completo antes de reload:', debugStorage);
                        
                        // ARREGLADO: Recargar campañas desde storage para reflejar cambios
                        if (window.popupInstance) {
                            console.log('🔄 POPUP: Iniciando recarga de campañas...');
                            
                            // Recargar campañas desde storage
                            await window.popupInstance.loadCampaigns();
                            console.log('✅ POPUP: Campañas recargadas:', window.popupInstance.campaigns.length);
                            
                            // Log de progreso
                            const progressMsg = `📈 Progreso: @${request.username} ${request.success ? 'completado' : 'error'} - ${request.sentMessages}/${request.sentMessages + request.remainingUsers}`;
                            console.log('📈 POPUP: Agregando log:', progressMsg);
                            
                            window.popupInstance.addLog(progressMsg, request.success ? 'success' : 'error');
                        } else {
                            console.log('❌ POPUP: No hay instancia del popup para procesar el progreso');
                        }
                        
                        console.log('✅ POPUP: Enviando respuesta de campaignProgress');
                        sendResponse({ success: true });
                    } else if (request.action === 'counterUpdated') {
                        console.log('🔄 POPUP RECIBIÓ: Contador actualizado desde otra extensión');
                        
                        if (window.popupInstance && 
                            window.popupInstance.userId === request.userId && 
                            window.popupInstance.isAuthenticated) {
                            
                            // Solo actualizar si el cambio es más reciente
                            const timeDiff = Date.now() - request.timestamp;
                            if (timeDiff < 5000) { // Solo cambios de los últimos 5 segundos
                                window.popupInstance.dailyMessageCount = request.messagesSent;
                                window.popupInstance.messageLimit = request.messageLimit;
                                window.popupInstance.updateMessageCountersUI();
                                
                                console.log(`🔄 Contador sincronizado desde broadcast: ${request.messagesSent}/${request.messageLimit}`);
                            }
                        }
                        
                        sendResponse({ success: true });
                    } else {
                        console.log('📨 POPUP RECIBIÓ MENSAJE:', request.action);
                        sendResponse({ success: true });
                    }
                    };
                    
                    // Ejecutar el handler asíncrono
                    handleAsync().catch(error => {
                        console.error('❌ Error en handleAsync:', error);
                        sendResponse({ success: false, error: error.message });
                    });
                    
                    // Retornar true para indicar respuesta asíncrona
                    return true;
                });
                
                window.POPUP_LISTENER_REGISTERED = true;
            } else {
                console.log('⚠️ Listener ya estaba registrado, no duplicando');
            }
            
            // Login events
            const loginBtn = document.getElementById('login-btn');
            this.showDebug(`Login button encontrado: ${loginBtn ? 'SÍ' : 'NO'}`);
            
            if (loginBtn) {
                this.showDebug('Agregando event listener al login button');
                
                // Remover listeners existentes para evitar duplicados
                loginBtn.replaceWith(loginBtn.cloneNode(true));
                const newLoginBtn = document.getElementById('login-btn');
                
                newLoginBtn.addEventListener('click', (e) => {
                    this.showDebug('Login button clicked!', 'success');
                    e.preventDefault();
                    this.handleLogin();
                });
                
                this.showDebug('Event listener agregado al login button', 'success');
                
        } else {
                this.showDebug('Login button no encontrado', 'error');
                this.showDebug(`Total botones en página: ${document.querySelectorAll('button').length}`);
            }

            // Test Firebase button
            const testFirebaseBtn = document.getElementById('test-firebase-btn');
            if (testFirebaseBtn) {
                testFirebaseBtn.addEventListener('click', (e) => {
                    this.showDebug('Test Firebase button clicked!', 'success');
                    e.preventDefault();
                    this.testFirebaseConnection();
                });
                this.showDebug('Event listener agregado al test Firebase button', 'success');
            }
            
            // Logout button
            const logoutBtn = document.getElementById('logout-btn');
            if (logoutBtn) {
                logoutBtn.addEventListener('click', () => this.handleLogout());
            }
            
            // Campaign events - Usar setTimeout para asegurar que los elementos estén listos
            setTimeout(() => {
                const nuevaCampanaBtn = document.getElementById('nueva-campaña-btn');
                const saveCampaignBtn = document.getElementById('save-campaign-btn');
                const cancelCampaignBtn = document.getElementById('cancel-campaign-btn');
                const closeModalBtn = document.getElementById('close-modal-btn');
                const debugBtn = document.getElementById('debug-btn');
                
                this.showDebug(`Nueva campaña button encontrado: ${nuevaCampanaBtn ? 'SÍ' : 'NO'}`);
                this.showDebug(`Save campaign button encontrado: ${saveCampaignBtn ? 'SÍ' : 'NO'}`);
                this.showDebug(`Debug button encontrado: ${debugBtn ? 'SÍ' : 'NO'}`);
                
                if (nuevaCampanaBtn) {
                    nuevaCampanaBtn.addEventListener('click', () => {
                        this.showDebug('Nueva campaña button clicked!', 'success');
                        this.showCampaignModal();
                    });
                }
                
                if (saveCampaignBtn) {
                    saveCampaignBtn.addEventListener('click', () => {
                        this.showDebug('Save campaign button clicked!', 'success');
                        this.saveCampaign();
                    });
                }
                
                if (cancelCampaignBtn) {
                    cancelCampaignBtn.addEventListener('click', () => {
                        this.showDebug('Cancel campaign button clicked!', 'success');
                        this.hideCampaignModal();
                    });
                }
                
                if (closeModalBtn) {
                    closeModalBtn.addEventListener('click', () => {
                        this.showDebug('Close modal button clicked!', 'success');
                        this.hideCampaignModal();
                    });
                }
                
        if (debugBtn) {
                    debugBtn.addEventListener('click', () => this.debugInstagram());
                }
                
                // Event listener para el modal de equipo se agrega en showTeamMemberModal()
                
                // NUEVO: Event listeners para el panel de equipo
                const teamPanelBtn = document.getElementById('team-panel-btn');
                if (teamPanelBtn) {
                    teamPanelBtn.addEventListener('click', () => {
                        this.showTeamPanel();
                    });
                }
                
                const closeTeamPanelBtn = document.getElementById('close-team-panel-btn');
                if (closeTeamPanelBtn) {
                    closeTeamPanelBtn.addEventListener('click', () => {
                        this.hideTeamPanel();
                    });
                }
                
                const refreshTeamBtn = document.getElementById('refresh-team-btn');
                if (refreshTeamBtn) {
                    refreshTeamBtn.addEventListener('click', () => {
                        this.refreshTeamData();
                    });
                }
                
                // NUEVO: Event listeners para plantillas de mensajes
                const saveTemplateBtn = document.getElementById('save-template-btn');
                if (saveTemplateBtn) {
                    saveTemplateBtn.addEventListener('click', () => {
                        this.saveMessageTemplate();
                    });
                }
                
                const manageTemplatesBtn = document.getElementById('manage-templates-btn');
                if (manageTemplatesBtn) {
                    manageTemplatesBtn.addEventListener('click', () => {
                        this.showTemplateManager();
                    });
                }
                
                const messageTemplatesSelect = document.getElementById('message-templates-select');
                if (messageTemplatesSelect) {
                    messageTemplatesSelect.addEventListener('change', (e) => {
                        this.loadTemplate(e.target.value);
                    });
                }
                
                const closeTemplateManagerBtn = document.getElementById('close-template-manager-btn');
                if (closeTemplateManagerBtn) {
                    closeTemplateManagerBtn.addEventListener('click', () => {
                        this.hideTemplateManager();
                    });
                }
                
                const addNewTemplateBtn = document.getElementById('add-new-template-btn');
                if (addNewTemplateBtn) {
                    addNewTemplateBtn.addEventListener('click', () => {
                        this.createNewTemplate();
                    });
                }
                
                this.showDebug('Event listeners configurados', 'success');
            }, 100);
            
        } catch (error) {
            this.showDebug(`Error configurando event listeners: ${error.message}`, 'error');
        }
    }

    async handleLogin() {
        this.showDebug('🔐 handleLogin llamado');
        this.showDebug(`🔧 this.auth disponible: ${this.auth ? 'SÍ' : 'NO'}`);
        
        // Verificar que Firebase esté inicializado
        if (!this.auth) {
            this.showDebug('❌ Firebase Auth no está inicializado', 'error');
            this.showLoginStatus('Error: Firebase no está inicializado. Recarga la extensión.', 'error');
            
            // Intentar reinicializar Firebase
            this.showDebug('🔄 Intentando reinicializar Firebase...', 'info');
            this.initializeFirebase();
            return;
        }
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        this.showDebug(`📧 Email: ${email}`);
        this.showDebug(`🔑 Password length: ${password.length}`);
        this.showDebug(`🔍 Email válido: ${this.isValidEmail(email)}`);

        if (!email || !password) {
            this.showDebug('❌ Campos vacíos detectados', 'error');
            this.showLoginStatus('Por favor completa todos los campos', 'error');
            return;
        }

        if (!this.isValidEmail(email)) {
            this.showDebug('❌ Formato de email inválido', 'error');
            this.showLoginStatus('El formato del email no es válido', 'error');
            return;
        }

        this.showDebug('⏳ Iniciando proceso de autenticación...', 'info');
        this.showLoginStatus('Iniciando sesión...', 'info');

        try {
            this.showDebug('🚀 Intentando autenticar con Firebase...', 'info');
            this.showDebug(`🔧 Auth instance check: ${typeof this.auth}`, 'info');
            this.showDebug(`🔧 Auth methods: ${Object.getOwnPropertyNames(this.auth).slice(0, 5).join(', ')}...`, 'info');
            
            // Verificar conexión de red
            if (!navigator.onLine) {
                throw new Error('Sin conexión a internet');
            }
            
            const userCredential = await this.auth.signInWithEmailAndPassword(email, password);
            this.showDebug('✅ Autenticación exitosa!', 'success');
            this.showDebug(`👤 Usuario: ${userCredential.user.email}`, 'success');
            this.showDebug(`🆔 UID: ${userCredential.user.uid}`, 'info');
            
            this.showLoginStatus('¡Login exitoso!', 'success');
            setTimeout(() => {
                this.showBotScreen();
                this.updateUserInfo();
                this.loadUserData();
            }, 1000);
            
        } catch (error) {
            this.showDebug(`❌ Error en autenticación: ${error.message}`, 'error');
            this.showDebug(`🔍 Error code: ${error.code}`, 'error');
            this.showDebug(`🔍 Error details: ${JSON.stringify(error, null, 2)}`, 'error');
            
            let userMessage = this.getFriendlyErrorMessage(error);
            this.showLoginStatus(userMessage, 'error');
        }
    }

    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    getFriendlyErrorMessage(error) {
        switch (error.code) {
            case 'auth/user-not-found':
                return 'Usuario no encontrado. ¿Creaste tu cuenta con create-test-user.html?';
            case 'auth/wrong-password':
                return 'Contraseña incorrecta. Verifica que sea la correcta.';
            case 'auth/invalid-email':
                return 'El formato del email no es válido.';
            case 'auth/user-disabled':
                return 'Esta cuenta está deshabilitada.';
            case 'auth/too-many-requests':
                return 'Demasiados intentos fallidos. Espera un momento antes de intentar nuevamente.';
            case 'auth/network-request-failed':
                return 'Error de conexión. Verifica tu internet y que Firebase esté disponible.';
            case 'auth/invalid-api-key':
                return 'Error de configuración Firebase (API Key inválida).';
            case 'auth/app-not-authorized':
                return 'Esta aplicación no está autorizada para usar Firebase Auth.';
            default:
                return `Error: ${error.message}`;
        }
    }

    async handleLogout() {
        try {
            this.showDebug('Cerrando sesión...', 'info');
            
            // Cerrar sesión en Firebase
            await this.auth.signOut();
            
            // Limpiar estado de autenticación en storage
            await chrome.storage.local.remove(['isAuthenticated', 'userEmail', 'userId']);
            
            // NUEVO: Detener sincronización en tiempo real
            this.stopRealtimeSync();
            
            this.showDebug('Sesión cerrada exitosamente', 'success');
            this.isAuthenticated = false;
            this.showLoginScreen();
            
        } catch (error) {
            this.showDebug(`Error cerrando sesión: ${error.message}`, 'error');
            console.error('Error logging out:', error);
        }
    }

    async testFirebaseConnection() {
        this.showDebug('🔧 ===== DIAGNÓSTICO FIREBASE =====', 'info');
        
        try {
            // 1. Verificar que Firebase esté cargado
            this.showDebug('1️⃣ Verificando Firebase SDK...', 'info');
            if (typeof firebase === 'undefined') {
                this.showDebug('❌ Firebase SDK no está cargado', 'error');
                this.showLoginStatus('Error: Firebase SDK no cargado. Recarga la extensión.', 'error');
                return;
            }
            this.showDebug('✅ Firebase SDK cargado correctamente', 'success');
            
            // 2. Verificar inicialización
            this.showDebug('2️⃣ Verificando inicialización...', 'info');
            this.showDebug(`Apps inicializadas: ${firebase.apps.length}`, 'info');
            if (firebase.apps.length === 0) {
                this.showDebug('⚠️ Firebase no está inicializado, inicializando...', 'warning');
                this.initializeFirebase();
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
            // 3. Verificar Auth
            this.showDebug('3️⃣ Verificando Firebase Auth...', 'info');
            if (!this.auth) {
                this.showDebug('❌ Firebase Auth no disponible', 'error');
                this.showLoginStatus('Error: Firebase Auth no disponible', 'error');
                return;
            }
            this.showDebug('✅ Firebase Auth disponible', 'success');
            
            // 4. Verificar Firestore
            this.showDebug('4️⃣ Verificando Firestore...', 'info');
            if (!this.db) {
                this.showDebug('❌ Firestore no disponible', 'error');
                this.showLoginStatus('Error: Firestore no disponible', 'error');
                return;
            }
            this.showDebug('✅ Firestore disponible', 'success');
            
            // 5. Probar conexión a Firebase
            this.showDebug('5️⃣ Probando conexión a Firebase...', 'info');
            const testAuth = firebase.auth();
            const currentUser = testAuth.currentUser;
            this.showDebug(`Usuario actual: ${currentUser ? currentUser.email : 'ninguno'}`, 'info');
            
            // 6. Probar conexión a Firestore
            this.showDebug('6️⃣ Probando conexión a Firestore...', 'info');
            try {
                // Intentar crear una referencia (no acceder a datos)
                const testRef = this.db.collection('test').doc('connection');
                this.showDebug('✅ Referencia Firestore creada exitosamente', 'success');
                
                // Intentar una operación básica
                await testRef.set({ test: true, timestamp: new Date() });
                this.showDebug('✅ Escritura Firestore exitosa', 'success');
                
                // Limpiar el documento de prueba
                await testRef.delete();
                this.showDebug('✅ Eliminación Firestore exitosa', 'success');
                
            } catch (firestoreError) {
                this.showDebug(`⚠️ Error Firestore: ${firestoreError.message}`, 'warning');
                this.showDebug(`🔍 Código error: ${firestoreError.code}`, 'info');
            }
            
            // 7. Resultado final
            this.showDebug('7️⃣ Resultado final...', 'info');
            this.showDebug('🎉 Firebase está funcionando correctamente', 'success');
            this.showLoginStatus('✅ Firebase funciona. Puedes intentar hacer login.', 'success');
            
        } catch (error) {
            this.showDebug(`❌ Error en diagnóstico: ${error.message}`, 'error');
            this.showDebug(`🔍 Stack: ${error.stack}`, 'error');
            this.showLoginStatus(`Error en diagnóstico: ${error.message}`, 'error');
        }
        
        this.showDebug('🔧 ===== FIN DIAGNÓSTICO =====', 'info');
    }

    showLoginStatus(message, type) {
        const statusElement = document.getElementById('login-status');
        statusElement.textContent = message;
        statusElement.className = `status-message ${type}`;
    }

    // Función para mostrar debug en la interfaz
    showDebug(message, type = 'info') {
        const debugLog = document.getElementById('debug-log');
        if (debugLog) {
            const timestamp = new Date().toLocaleTimeString();
            const debugEntry = document.createElement('div');
            debugEntry.className = `debug-entry ${type}`;
            debugEntry.textContent = `[${timestamp}] ${message}`;
            debugLog.appendChild(debugEntry);
            debugLog.scrollTop = debugLog.scrollHeight;
        }
        // También mostrar en consola
        console.log(`📋 ${message}`);
    }

    showLoginScreen() {
        document.getElementById('login-screen').classList.remove('hidden');
        document.getElementById('bot-screen').classList.add('hidden');
    }

    showBotScreen() {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('bot-screen').classList.remove('hidden');
    }

    updateUserInfo() {
        const user = this.auth.currentUser;
        if (user) {
            document.getElementById('user-email').textContent = user.email;
        }
    }

    async loadUserData() {
        try {
            const user = this.auth.currentUser;
            if (!user) return;

            const userDocRef = this.db.collection('users').doc(user.uid);
            const userDocSnap = await userDocRef.get();
            
            if (userDocSnap.exists) {
                const userData = userDocSnap.data();
                this.dailyMessageCount = userData.messagesSent || 0;
                document.getElementById('mensajes-enviados').textContent = this.dailyMessageCount;
                
                const remaining = Math.max(0, 80 - this.dailyMessageCount);
                document.getElementById('mensajes-restantes').textContent = remaining;
                
                this.addLog(`✅ Usuario cargado: ${userData.messagesSent} mensajes enviados hoy`, 'success');
        } else {
                // Create new user document
                await this.initializeUserData();
            }
        } catch (error) {
            console.error('Error loading user data:', error);
        }
    }

    async initializeUserData() {
        const user = this.auth.currentUser;
        if (!user) return;

        const userDocRef = this.db.collection('users').doc(user.uid);
        const userDocSnap = await userDocRef.get();

        if (!userDocSnap.exists) {
            // Create new user document
            await userDocRef.set({
                email: user.email,
                plan: 'basic',
                messagesSent: 0,
                lastResetDate: this.getArgentinaDate(),
                isActive: true,
                createdAt: new Date()
            });
        } else {
            // Check if we need to reset the counter (new day)
            await this.checkAndResetDailyLimit();
        }
    }

    getArgentinaDate() {
        return new Date().toLocaleDateString('en-US', {
            timeZone: 'America/Argentina/Buenos_Aires'
        });
    }

    async checkAndResetDailyLimit() {
        const user = this.auth.currentUser;
        if (!user) return;

        const userDocRef = this.db.collection('users').doc(user.uid);
        const userDocSnap = await userDocRef.get();
        
        if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            const today = this.getArgentinaDate();
            
            if (userData.lastResetDate !== today) {
                // Reset counter for new day
                await userDocRef.update({
                    messagesSent: 0,
                    lastResetDate: today
                });
            }
        }
    }

    async canSendMessage() {
        this.addLog('🔍 Verificando límites de mensajes...', 'info');
        
        try {
            // Verificar si hay usuario autenticado
            if (!this.isAuthenticated || !this.userId || !this.db) {
                this.addLog('⚠️ Usuario no autenticado', 'warning');
                return false;
            }

            this.addLog(`✅ Usuario autenticado: ${this.userEmail}`, 'success');
            
            // Cargar datos actuales del usuario
            const userRef = this.db.collection('users').doc(this.userId);
            const userDoc = await userRef.get();
            
            if (!userDoc.exists) {
                this.addLog('❌ Usuario no encontrado en Firestore', 'error');
                return false;
            }
            
            const userData = userDoc.data();
            const currentCount = userData.messagesSent || 0;
            const messageLimit = userData.messageLimit || 80;
            const isActive = userData.isActive !== false;
            
            this.addLog(`📊 Mensajes enviados: ${currentCount}/${messageLimit}`, 'info');
            this.addLog(`📊 Usuario activo: ${isActive}`, 'info');
            
            // Verificar si el usuario está activo
            if (!isActive) {
                this.addLog('❌ Usuario desactivado por el administrador', 'error');
                return false;
            }
            
            // Verificar límite diario
            if (currentCount >= messageLimit) {
                this.addLog(`❌ Límite diario alcanzado: ${currentCount}/${messageLimit}`, 'error');
                return false;
            }
            
            // Verificar fecha de expiración
            if (userData.expiryDate) {
                const expiryDate = new Date(userData.expiryDate);
                const now = new Date();
                
                if (now > expiryDate) {
                    this.addLog('❌ Plan expirado. Contacta al administrador.', 'error');
                    return false;
                }
            }
            
            this.addLog(`✅ Puede enviar mensajes: ${messageLimit - currentCount} restantes`, 'success');
            return true;
            
        } catch (error) {
            this.addLog(`❌ Error verificando límites: ${error.message}`, 'error');
            return false;
        }
    }

    // ELIMINADO: Función duplicada, usar incrementMessageCounters() en su lugar

    async debugInstagram() {
        try {
            this.addLog('🔧 Iniciando debug de Instagram...', 'info');
            
            const tabs = await chrome.tabs.query({ url: '*://*.instagram.com/*' });
            
            if (tabs.length === 0) {
                this.addLog('❌ No hay pestaña de Instagram abierta', 'error');
                return;
            }

            this.addLog(`✅ Pestaña de Instagram encontrada: ${tabs[0].url}`, 'success');

            const loginResponse = await chrome.tabs.sendMessage(tabs[0].id, {
                action: 'checkLoginStatus'
            });

            if (loginResponse && loginResponse.success) {
                this.addLog(`✅ Login verificado: ${loginResponse.isLoggedIn ? 'Conectado' : 'No conectado'}`, 'success');
            } else {
                this.addLog('❌ Error verificando login', 'error');
            }

            const debugResponse = await chrome.tabs.sendMessage(tabs[0].id, {
                action: 'debugPageElements'
            });

            if (debugResponse && debugResponse.success) {
                this.addLog('🔍 Elementos encontrados en la página:', 'info');
                this.addLog(`- Botones de mensaje: ${debugResponse.messageButtons}`, 'info');
                this.addLog(`- Campos de texto: ${debugResponse.textAreas}`, 'info');
                this.addLog(`- Modales: ${debugResponse.modals}`, 'info');
                this.addLog(`- Destacadas: ${debugResponse.highlights}`, 'info');
                
                if (debugResponse.highlights > 0) {
                    this.addLog('✅ Destacadas encontradas - El bot debería funcionar', 'success');
                } else {
                    this.addLog('⚠️ No se encontraron destacadas - Usará mensaje directo', 'warning');
                }
            } else {
                this.addLog('❌ Error obteniendo elementos de la página', 'error');
            }

        } catch (error) {
            console.error('Error en debug:', error);
            this.addLog('❌ Error en debug: ' + error.message, 'error');
        }
    }

    updateStatus(text, type) {
        const statusElement = document.getElementById('instagram-status');
        statusElement.textContent = text;
        statusElement.className = `value ${type}`;
    }

    addLog(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const logMessage = `[${timestamp}] ${message}`;
        
        // Mostrar en la interfaz
        const logsContainer = document.getElementById('logs-container');
        if (logsContainer) {
            const logEntry = document.createElement('div');
            logEntry.className = `log-entry ${type}`;
            logEntry.textContent = logMessage;
            logsContainer.appendChild(logEntry);
            logsContainer.scrollTop = logsContainer.scrollHeight;
        }
        
        // Guardar en el array de logs
        this.logs.push({
            message: logMessage,
            type: type,
            timestamp: new Date().toISOString()
        });
        
        // Mantener solo los últimos 100 logs para no saturar el storage
        if (this.logs.length > 100) {
            this.logs = this.logs.slice(-100);
        }
        
        // Solo guardar logs en storage cada 10 entradas para evitar spam
        if (this.logs.length % 10 === 0) {
            chrome.storage.local.set({ logs: this.logs });
        }
        
        // Mostrar en consola también
        console.log(`📋 ${message}`);
    }

    async navigateToUserPage(tabId, target) {
        try {
            this.addLog(`🔄 Navegando a @${target}...`, 'info');
            
            await chrome.tabs.update(tabId, {
                url: `https://www.instagram.com/${target}/`
            });
            
            await this.sleep(3000);
            
            this.addLog(`✅ Navegación completada a @${target}`, 'success');
            
        } catch (error) {
            console.error('Error navegando al usuario:', error);
            this.addLog(`❌ Error navegando a @${target}: ${error.message}`, 'error');
        }
    }

    async sendMessageWithTimeout(tabId, target, message) {
        return new Promise(async (resolve) => {
            const timeout = setTimeout(() => {
                resolve({ success: false, error: 'Timeout: No se recibió respuesta del content script' });
            }, 60000);

            try {
                const response = await chrome.tabs.sendMessage(tabId, {
                    action: 'sendMessageToUser',
                    target: target,
                    message: message
                });
                
                clearTimeout(timeout);
                resolve(response);
            } catch (error) {
                clearTimeout(timeout);
                resolve({ success: false, error: error.message });
            }
        });
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async exploreUserProfile(tabId) {
        try {
            await chrome.tabs.sendMessage(tabId, {
                action: 'exploreUserProfile'
            });
            
            await this.sleep(5000);
            
        } catch (error) {
            console.error('Error explorando perfil:', error);
            this.addLog('⚠️ Error explorando perfil, continuando...', 'warning');
        }
    }

    async simulateConservativeBehaviorDuringCooldown(tabId, customDelay = null) {
        try {
            const delay = customDelay || this.delay;
            this.addLog(`⏳ Iniciando simulación de ${delay} segundos...`, 'info');
            
            await chrome.tabs.sendMessage(tabId, {
                action: 'simulateConservativeBehavior',
                duration: delay * 1000
            });
            
            await this.sleep(delay * 1000);
            
            this.addLog(`✅ Simulación completada`, 'success');
            
        } catch (error) {
            console.error('Error simulando comportamiento conservador:', error);
            this.addLog('⚠️ Error simulando comportamiento, continuando...', 'warning');
        }
    }

    // Campaign Management Methods
    async loadCampaigns() {
        try {
            // MEJORADO: Cargar campañas específicas del usuario si está autenticado
            let campaigns = [];
            
            // CAMPAÑAS LOCALES: No cargamos desde Firebase para evitar conflictos entre miembros
            // Cada miembro del equipo maneja sus propias campañas localmente
            
            // ÚNICA FUENTE: Storage local por dispositivo (campañas locales)
            if (this.userId) {
                const deviceSpecificKey = `campaigns_${this.deviceId || 'unknown'}`;
                
                console.log('🔄 LOAD: Iniciando carga de campañas...');
                console.log('🔄 LOAD: Device key:', deviceSpecificKey);
                console.log('🔄 LOAD: User ID:', this.userId);
                console.log('🔄 LOAD: Device ID:', this.deviceId);
                
                // Intentar cargar datos específicos del dispositivo PRIMERO
                const result = await chrome.storage.local.get([
                    deviceSpecificKey,
                    `campaigns_${this.userId}`,
                    'campaignData',
                    'campaigns'
                ]);
                
                console.log('🔄 LOAD: Storage result completo:', result);
                
                // PRIORIDAD 1: Campañas específicas del dispositivo
                const deviceCampaignData = result[deviceSpecificKey];
                console.log(`🔍 LOAD: Buscando en key: ${deviceSpecificKey}`);
                console.log(`🔍 LOAD: Encontrado:`, deviceCampaignData);
                
                if (deviceCampaignData && deviceCampaignData.campaigns) {
                    campaigns = deviceCampaignData.campaigns;
                    this.addLog(`📱 Campañas locales cargadas: ${campaigns.length}`, 'success');
                    console.log('📱 Campañas específicas del dispositivo cargadas:', deviceCampaignData);
                    console.log(`🔍 LOAD: Campaigns array:`, campaigns.map(c => ({ 
                        id: c.id, 
                        name: c.name, 
                        userCount: c.users?.length,
                        completedUsers: c.users?.filter(u => u.status === 'completed').length,
                        pendingUsers: c.users?.filter(u => u.status !== 'completed' && u.status !== 'error').length
                    })));
                    
                    // NUEVO: Verificar si hay cambios desde la última vez que se renderizó
                    const lastRenderTime = this.lastCampaignRenderTime || 0;
                    const currentTime = Date.now();
                    const dataUpdateTime = new Date(deviceCampaignData.lastUpdated || 0).getTime();
                    
                    if (dataUpdateTime > lastRenderTime) {
                        console.log(`🔄 LOAD: Datos actualizados detectados (${dataUpdateTime} > ${lastRenderTime}), re-renderizando...`);
                        this.lastCampaignRenderTime = currentTime;
                    }
                    
                    this.campaigns = campaigns;
                    this.renderCampaigns();
                    return;
                }
                
                // PRIORIDAD 2: Fallback a campañas del usuario (migración)
                const userCampaignData = result[`campaigns_${this.userId}`];
                
                if (userCampaignData && userCampaignData.userId === this.userId) {
                    campaigns = userCampaignData.campaigns || [];
                    this.addLog(`📦 Migrando campañas a tu dispositivo: ${campaigns.length}`, 'info');
                    console.log('📦 Migrando campañas del usuario al dispositivo:', userCampaignData);
                    
                    // Migrar automáticamente al nuevo sistema de dispositivo
                    this.campaigns = campaigns;
                    await this.saveCampaigns(); // Esto guardará en el nuevo formato
                    this.renderCampaigns();
                    return;
                } else {
                    // Fallback a campañas generales
                    campaigns = result.campaigns || [];
                    this.addLog(`📁 Campañas generales cargadas: ${campaigns.length}`, 'info');
                }
            } else {
                // Usuario no autenticado, cargar campañas generales
            const result = await chrome.storage.local.get(['campaigns']);
                campaigns = result.campaigns || [];
                this.addLog(`📁 Campañas cargadas (sin usuario): ${campaigns.length}`, 'info');
            }
            
            this.campaigns = campaigns;
            this.renderCampaigns();
            
        } catch (error) {
            console.error('Error cargando campañas:', error);
            this.addLog('❌ Error cargando campañas', 'error');
            this.campaigns = [];
        }
    }

    async saveCampaigns() {
        try {
            // MEJORADO: Agregar timestamp y información de usuario para persistencia robusta
            const campaignData = {
                campaigns: this.campaigns,
                lastUpdated: new Date().toISOString(),
                userId: this.userId,
                userEmail: this.userEmail,
                version: '2.0'
            };
            
            // CAMPAÑAS LOCALES: No sincronizamos campañas en Firebase
            // Solo se guardan localmente para evitar conflictos entre miembros del equipo
            
            // MANTENER: Guardar local como backup
            // CAMPAÑAS LOCALES: Guardar específico por dispositivo para evitar conflictos
            const deviceSpecificKey = `campaigns_${this.deviceId || 'unknown'}`;
            
            await chrome.storage.local.set({ 
                campaigns: this.campaigns,
                campaignData: campaignData,
                [`campaigns_${this.userId}`]: campaignData, // Mantener por compatibilidad
                [deviceSpecificKey]: campaignData // NUEVO: Por dispositivo
            });
            
            this.addLog('💾 Campañas guardadas localmente en tu dispositivo', 'success');
            console.log('📦 Datos de campañas guardados:', campaignData);
        } catch (error) {
            console.error('Error guardando campañas:', error);
            this.addLog('❌ Error guardando campañas', 'error');
        }
    }

    async loadLogs() {
        try {
            const result = await chrome.storage.local.get(['logs']);
            if (result.logs) {
                this.logs = result.logs;
                this.renderLogs();
                this.addLog('📁 Logs cargados', 'info');
            }
        } catch (error) {
            console.error('Error cargando logs:', error);
        }
    }

    renderLogs() {
        const logsContainer = document.getElementById('logs-container');
        if (logsContainer && this.logs.length > 0) {
            logsContainer.innerHTML = '';
            this.logs.forEach(log => {
                const logEntry = document.createElement('div');
                logEntry.className = `log-entry ${log.type}`;
                logEntry.textContent = log.message;
                logsContainer.appendChild(logEntry);
            });
            logsContainer.scrollTop = logsContainer.scrollHeight;
        }
    }

    createCampaign(name, description, messages, users, delay) {
        const campaign = {
            id: 'campaign_' + Date.now(),
            name: name,
            description: description || '',
            createdAt: new Date().toISOString(),
            status: 'active',
            totalUsers: users.length,
            sentMessages: 0,
            remainingUsers: users.length,
            users: users.map(username => ({
                username: username.trim(),
                status: 'pending',
                sentAt: null,
                messageUsed: null
            })),
            messages: messages,
            delay: delay
        };

        this.campaigns.push(campaign);
        this.saveCampaigns();
        this.renderCampaigns();
        this.addLog(`✅ Campaña "${name}" creada con ${users.length} usuarios`, 'success');
        
        return campaign;
    }

    showCampaignModal() {
        // Resetear el modal para nueva campaña
        document.querySelector('#campaign-modal .campaign-modal-title h3').textContent = 'Nueva Campaña';
        const saveBtn = document.getElementById('save-campaign-btn');
        saveBtn.querySelector('.btn-text').textContent = 'Guardar Campaña';
        saveBtn.onclick = () => this.saveCampaign();
        
        document.getElementById('campaign-modal').classList.remove('hidden');
    }

    hideCampaignModal() {
        document.getElementById('campaign-modal').classList.add('hidden');
        
        // Resetear el modal para nueva campaña
        document.querySelector('#campaign-modal .campaign-modal-title h3').textContent = 'Nueva Campaña';
        const saveBtn = document.getElementById('save-campaign-btn');
        saveBtn.querySelector('.btn-text').textContent = 'Guardar Campaña';
        saveBtn.onclick = () => this.saveCampaign();
        
        // Limpiar campos
        document.getElementById('campaign-name').value = '';
        document.getElementById('campaign-description').value = '';
        document.getElementById('campaign-messages').value = '';
        document.getElementById('campaign-users').value = '';
        document.getElementById('campaign-delay').value = '30';
    }

    saveCampaign() {
        const name = document.getElementById('campaign-name').value.trim();
        const description = document.getElementById('campaign-description').value.trim();
        const messagesText = document.getElementById('campaign-messages').value.trim();
        const usersText = document.getElementById('campaign-users').value.trim();
        const delay = parseInt(document.getElementById('campaign-delay').value);

        if (!name) {
            this.addLog('❌ Debes ingresar un nombre para la campaña', 'error');
                return;
            }
            
        if (!messagesText) {
            this.addLog('❌ Debes ingresar al menos un mensaje', 'error');
                return;
            }
            
        if (!usersText) {
            this.addLog('❌ Debes ingresar al menos un usuario', 'error');
            return;
        }

        const messages = messagesText.split('\n').map(m => m.trim()).filter(m => m.length > 0);
        const users = usersText.split('\n').map(u => u.trim()).filter(u => u.length > 0);

        if (messages.length === 0) {
            this.addLog('❌ Debes ingresar al menos un mensaje válido', 'error');
            return;
        }

        if (users.length === 0) {
            this.addLog('❌ Debes ingresar al menos un usuario válido', 'error');
            return;
        }

        if (isNaN(delay) || delay < 10 || delay > 300) {
            this.addLog('❌ El delay debe estar entre 10 y 300 segundos', 'error');
            return;
        }

        this.createCampaign(name, description, messages, users, delay);
        this.hideCampaignModal();
    }

    // Función auxiliar para renderizar una campaña individual
    renderSingleCampaign(campaign, sentUsers, totalUsers, remainingUsers, progressPercentage) {
        const statusClass = campaign.status === 'active' ? 'active' : 
                          campaign.status === 'enviando' ? 'enviando' :
                          campaign.status === 'paused' ? 'paused' : 'completed';
        
        const statusText = campaign.status === 'active' ? 'Activa' : 
                         campaign.status === 'enviando' ? 'Enviando' :
                         campaign.status === 'paused' ? 'Pausada' : 'Completada';

        return `
            <div class="campaign-item" data-campaign-id="${campaign.id}">
                <div class="campaign-header">
                    <div class="campaign-name">${campaign.name}</div>
                    <div class="campaign-status ${statusClass}">${statusText}</div>
                </div>
                
                ${campaign.description ? `<div style="color: #6c757d; font-size: 14px; margin-bottom: 10px;">${campaign.description}</div>` : ''}
                
                <div class="campaign-progress">
                    <div class="progress-info">
                        <span class="campaign-progress-text">Progreso: ${sentUsers}/${totalUsers} (${remainingUsers} restantes)</span>
                        <span class="campaign-percentage">${Math.round(progressPercentage)}%</span>
                    </div>
                    <div class="progress-bar-campaign">
                        <div class="progress-fill-campaign progress-bar-fill" style="width: ${progressPercentage}%"></div>
                    </div>
                </div>
                
                <div class="campaign-actions">
                    ${campaign.status === 'active' ? 
                        `<button class="btn-play" data-action="execute" data-campaign-id="${campaign.id}">▶️ Ejecutar</button>
                         <button class="btn-pause" data-action="pause" data-campaign-id="${campaign.id}">⏸️ Pausar</button>
                         <button class="btn-stop" data-action="stop" data-campaign-id="${campaign.id}">⏹️ Detener</button>` :
                        campaign.status === 'enviando' ? 
                        `<button class="btn-stop" data-action="stop" data-campaign-id="${campaign.id}">⏹️ Detener</button>` :
                        campaign.status === 'paused' ? 
                        `<button class="btn-play" data-action="resume" data-campaign-id="${campaign.id}">▶️ Reanudar</button>` : 
                        campaign.status === 'completed' ? 
                        `<button class="btn-success" disabled>✅ Completada</button>` : ''
                    }
                    <button class="btn-download" data-action="download" data-campaign-id="${campaign.id}">📥 Descargar CSV</button>
                    <button class="btn-edit" data-action="edit" data-campaign-id="${campaign.id}">✏️ Editar</button>
                    <button class="btn-delete" data-action="delete" data-campaign-id="${campaign.id}">🗑️ Eliminar</button>
                </div>
            </div>
        `;
    }

    renderCampaigns() {
        const campaignsList = document.getElementById('campaigns-list');
        if (!campaignsList) return;

        if (this.campaigns.length === 0) {
            campaignsList.innerHTML = `
                <div class="empty-campaigns">
                    <h4>📋 No hay campañas</h4>
                    <p>Crea tu primera campaña para empezar a enviar mensajes</p>
                </div>
            `;
            return;
        }

        campaignsList.innerHTML = this.campaigns.map(campaign => {
            // ARREGLO: Mantener progreso final para campañas completadas
            if (campaign.status === 'completed' && campaign.finalProgress) {
                // Usar progreso final guardado para campañas completadas
                const sentUsers = campaign.finalProgress.sent;
                const totalUsers = campaign.finalProgress.total;
                const remainingUsers = 0; // Ya terminó
                const progressPercentage = 100;
                
                return this.renderSingleCampaign(campaign, sentUsers, totalUsers, remainingUsers, progressPercentage);
            } else {
                // ARREGLADO: Usar nueva estructura con completedUsers separado
                const completedUsersCount = campaign.completedUsers ? campaign.completedUsers.length : 0;
                const remainingUsersCount = campaign.users.length; // Solo usuarios pendientes
                const totalUsers = completedUsersCount + remainingUsersCount;
                const sentUsers = completedUsersCount;
                const remainingUsers = remainingUsersCount;
                const progressPercentage = totalUsers > 0 ? 
                    ((sentUsers / totalUsers) * 100) : 0;
                
                return this.renderSingleCampaign(campaign, sentUsers, totalUsers, remainingUsers, progressPercentage);
            }
        }).join('');

        // Agregar event listeners usando event delegation SOLO UNA VEZ
        if (!campaignsList.hasAttribute('data-listeners-added')) {
        campaignsList.addEventListener('click', (e) => {
            const button = e.target.closest('button');
            if (!button) return;

            const action = button.dataset.action;
            const campaignId = button.dataset.campaignId;

            if (!action || !campaignId) return;

            this.showDebug(`Campaign button clicked: ${action} for campaign ${campaignId}`, 'success');

            switch (action) {
                case 'execute':
                    this.executeCampaign(campaignId);
                    break;
                case 'pause':
                    this.pauseCampaign(campaignId);
                    break;
                case 'stop':
                    this.stopCampaign(campaignId);
                    break;
                case 'resume':
                    this.resumeCampaign(campaignId);
                    break;
                case 'edit':
                    this.editCampaign(campaignId);
                    break;
                case 'download':
                    this.downloadCampaignCSV(campaignId);
                    break;
                case 'delete':
                    this.deleteCampaign(campaignId);
                    break;
            }
        });
        
        // Marcar que los listeners ya fueron agregados
        campaignsList.setAttribute('data-listeners-added', 'true');
        }
    }

    async executeCampaign(campaignId) {
        // EVITAR EJECUCIONES MÚLTIPLES CON PROTECCIÓN MEJORADA
        const executionKey = `executing_${campaignId}`;
        
        if (this.isExecuting || this[executionKey]) {
            this.addLog('⚠️ Campaña ya se está ejecutando, espera...', 'warning');
            return;
        }
        
        // Marcar como ejecutándose
        this.isExecuting = true;
        this[executionKey] = true;
        
        try {
            const campaign = this.campaigns.find(c => c.id === campaignId);
            if (!campaign) {
                this.addLog('❌ Campaña no encontrada', 'error');
                return;
            }

            // NUEVO: Verificar límites de mensajes (local + global) con Firebase
            this.addLog('🔍 Verificando límites de mensajes con Firebase...', 'info');
            
            // Verificar si se pueden enviar más mensajes (incluye recarga desde Firebase)
            const canSend = await this.canSendMessages();
            if (!canSend) {
                this.addLog('❌ No se puede iniciar campaña - Límites alcanzados', 'error');
                campaign.status = 'paused';
                this.saveCampaigns();
                this.renderCampaigns();
                return;
            }
            
            this.addLog(`✅ Límites verificados: ${this.dailyMessageCount}/${this.messageLimit} mensajes`, 'success');

            // Verificar si hay usuarios pendientes
            if (campaign.users.length === 0) {
                this.addLog('✅ Campaña completada - No hay más usuarios pendientes', 'success');
                campaign.status = 'completed';
                this.saveCampaigns();
                this.renderCampaigns();
                return;
            }

            this.addLog(`🚀 Iniciando campaña: ${campaign.name}`, 'success');
            campaign.status = 'enviando';
            this.isRunning = true;
            this.saveCampaigns();
            this.renderCampaigns();

            // Buscar pestaña de Instagram existente
            const tabs = await chrome.tabs.query({ url: '*://*.instagram.com/*' });
            let instagramTab;

            if (tabs.length > 0) {
                instagramTab = tabs[0];
                this.addLog('📱 Usando pestaña de Instagram existente', 'info');
            } else {
                instagramTab = await chrome.tabs.create({ url: 'https://www.instagram.com' });
                this.addLog('📱 Abriendo nueva pestaña de Instagram', 'info');
            }

            // SIEMPRE INYECTAR CONTENT SCRIPT FRESCO (matar instancias anteriores)
            this.addLog('🔄 Inyectando content script fresco...', 'info');
            
            try {
                // Primero, intentar detener cualquier campaña anterior
                try {
                    await chrome.tabs.sendMessage(instagramTab.id, {
                        action: 'stopCampaign'
                    });
                    this.addLog('⏹️ Deteniendo campañas anteriores...', 'info');
                    await new Promise(resolve => setTimeout(resolve, 1000)); // Esperar que se detenga
                } catch (error) {
                    // No hay content script anterior, está bien
                }
                
                // Inyectar nuevo content script (siempre)
                await chrome.scripting.executeScript({
                    target: { tabId: instagramTab.id },
                    files: ['content/content.js']
                });
                this.addLog('✅ Content script fresco inyectado', 'success');
                
                // Esperar inicialización
                this.addLog('⏳ Esperando 2 segundos para inicialización...', 'info');
                await new Promise(resolve => setTimeout(resolve, 2000));
                
            } catch (injectionError) {
                this.addLog(`❌ Error inyectando content script: ${injectionError.message}`, 'error');
                return;
            }

            // Ejecutar campaña con el nuevo sistema
            this.addLog('📋 Iniciando campaña con sistema v2.0...', 'info');
            
            try {
                // Enviar mensaje al content script para iniciar la campaña
                const response = await chrome.tabs.sendMessage(instagramTab.id, {
                    action: 'executeCampaign',
                    campaign: campaign,
                    deviceId: this.deviceId,  // NUEVO: Pasar deviceId para storage local
                    userId: this.userId,      // NUEVO: Mantener compatibilidad
                    teamMemberName: this.teamMemberName || 'Usuario'  // NUEVO: Pasar nombre del miembro del equipo
                });
                
                if (response && response.success) {
                    this.addLog('✅ Campaña iniciada con el nuevo sistema', 'success');
                    this.addLog('🔄 Monitoreo automático del progreso activado', 'info');
                    
                    // TEMPORALMENTE DESHABILITADO: Monitoreo inteligente del progreso
                    // await this.monitorCampaignProgress(campaignId, campaign.users.length);
                    this.addLog('📊 Sistema de progreso simplificado - usando auto-refresh', 'info');
                    
                } else {
                    this.addLog(`❌ Error iniciando campaña: ${response?.error || 'Sin respuesta del content script'}`, 'error');
                }
                
            } catch (error) {
                this.addLog(`❌ Error de comunicación: ${error.message}`, 'error');
                this.addLog('💡 Asegúrate de estar en una pestaña de Instagram', 'info');
            }
            
            // Limpiar estado
            this.isRunning = false;
            this.isExecuting = false;
            // Limpiar flag específico de la campaña
            const executionKey = `executing_${campaignId}`;
            this[executionKey] = false;
            this.saveCampaigns();
            this.renderCampaigns();
            
        } catch (error) {
            this.addLog(`❌ Error ejecutando campaña: ${error.message}`, 'error');
            this.isRunning = false;
            this.isExecuting = false;
            // Limpiar flag específico de la campaña también en error
            const executionKey = `executing_${campaignId}`;
            this[executionKey] = false;
            this.saveCampaigns();
            this.renderCampaigns();
        }
    }

    async pauseCampaign(campaignId) {
        const campaign = this.campaigns.find(c => c.id === campaignId);
        if (campaign) {
            // Cambiar estado
            this.isRunning = false;
            this.isExecuting = false;
            campaign.status = 'paused';
            
            // Enviar comando de pausa al content script
            try {
                const tabs = await chrome.tabs.query({ url: '*://*.instagram.com/*' });
                if (tabs.length > 0) {
                    await chrome.tabs.sendMessage(tabs[0].id, {
                        action: 'pauseCampaign'
                    });
                    this.addLog(`✅ Comando de pausa enviado al bot`, 'success');
                } else {
                    this.addLog(`⚠️ No hay pestañas de Instagram abiertas`, 'warning');
                }
            } catch (error) {
                this.addLog(`❌ Error enviando comando pause: ${error.message}`, 'error');
            }
            
            await this.saveCampaigns();
            this.renderCampaigns();
            this.addLog(`⏸️ Campaña "${campaign.name}" pausada`, 'info');
        }
    }

    async stopCampaign(campaignId) {
        const campaign = this.campaigns.find(c => c.id === campaignId);
        if (campaign) {
            this.addLog(`⏹️ Deteniendo campaña "${campaign.name}"...`, 'info');
            
            // Cambiar estado en popup
            this.isRunning = false;
            this.isExecuting = false;
            campaign.status = 'paused';
            
            // Enviar comando de stop al content script
            try {
                const tabs = await chrome.tabs.query({ url: '*://*.instagram.com/*' });
                if (tabs.length > 0) {
                    await chrome.tabs.sendMessage(tabs[0].id, {
                        action: 'stopCampaign'
                    });
                    this.addLog(`✅ Comando de stop enviado al bot`, 'success');
                } else {
                    this.addLog(`⚠️ No hay pestañas de Instagram abiertas`, 'warning');
                }
            } catch (error) {
                this.addLog(`❌ Error enviando comando stop: ${error.message}`, 'error');
            }
            
            this.saveCampaigns();
            this.renderCampaigns();
            this.addLog(`⏹️ Campaña "${campaign.name}" detenida`, 'success');
        }
    }

    async resumeCampaign(campaignId) {
        const campaign = this.campaigns.find(c => c.id === campaignId);
        if (campaign) {
            this.addLog(`▶️ Reanudando campaña "${campaign.name}"...`, 'info');
            
            // Cambiar estado a activo
            campaign.status = 'enviando';
            this.saveCampaigns();
            this.renderCampaigns();
            
            // Ejecutar campaña desde donde se detuvo
            await this.executeCampaign(campaignId);
        }
    }

    async deleteCampaign(campaignId) {
        if (!confirm('¿Estás seguro de eliminar esta campaña?')) {
            return;
        }
        
        console.log(`🗑️ Eliminando campaña: ${campaignId}`);
        
        // Detener la campaña si está ejecutándose
        if (this.isExecuting) {
            await this.stopCampaign(campaignId);
        }
        
        // Filtrar campañas locales
        this.campaigns = this.campaigns.filter(c => c.id !== campaignId);
        
        // Limpiar también del storage específico del dispositivo
        try {
            const deviceKey = `campaigns_${this.deviceId || 'unknown'}`;
            const deviceData = await chrome.storage.local.get([deviceKey]);
            
            if (deviceData[deviceKey]) {
                deviceData[deviceKey].campaigns = deviceData[deviceKey].campaigns.filter(c => c.id !== campaignId);
                await chrome.storage.local.set({[deviceKey]: deviceData[deviceKey]});
                console.log(`✅ Campaña eliminada del storage del dispositivo: ${deviceKey}`);
            }
        } catch (error) {
            console.error('Error limpiando storage del dispositivo:', error);
        }
        
        // Guardar y re-renderizar
        await this.saveCampaigns();
        this.renderCampaigns();
        this.addLog('🗑️ Campaña eliminada completamente', 'success');
    }

    editCampaign(campaignId) {
        const campaign = this.campaigns.find(c => c.id === campaignId);
        if (campaign) {
            // Llenar el modal con los datos de la campaña
            document.querySelector('#campaign-modal .campaign-modal-title h3').textContent = 'Editar Campaña';
            const saveBtn = document.getElementById('save-campaign-btn');
            saveBtn.querySelector('.btn-text').textContent = 'Actualizar Campaña';
            saveBtn.onclick = () => this.updateCampaign(campaignId);
            
            document.getElementById('campaign-name').value = campaign.name;
            document.getElementById('campaign-description').value = campaign.description || '';
            document.getElementById('campaign-messages').value = campaign.messages.join('\n');
            document.getElementById('campaign-users').value = campaign.users.map(u => u.username).join('\n');
            document.getElementById('campaign-delay').value = campaign.delay || 30;
            
            document.getElementById('campaign-modal').classList.remove('hidden');
        }
    }

    updateCampaign(campaignId) {
        const name = document.getElementById('campaign-name').value.trim();
        const description = document.getElementById('campaign-description').value.trim();
        const messagesText = document.getElementById('campaign-messages').value.trim();
        const usersText = document.getElementById('campaign-users').value.trim();
        const delay = parseInt(document.getElementById('campaign-delay').value) || 30;

        if (!name) {
            this.addLog('❌ Debes ingresar un nombre para la campaña', 'error');
            return;
        }

        if (!messagesText) {
            this.addLog('❌ Debes ingresar al menos un mensaje', 'error');
            return;
        }

        if (!usersText) {
            this.addLog('❌ Debes ingresar al menos un usuario', 'error');
            return;
        }

        const messages = messagesText.split('\n').filter(msg => msg.trim());
        const users = usersText.split('\n').filter(user => user.trim());

        const campaign = this.campaigns.find(c => c.id === campaignId);
        if (campaign) {
            campaign.name = name;
            campaign.description = description;
            campaign.messages = messages;
            campaign.users = users.map(username => ({
                username: username.trim(),
                status: 'pending',
                sentAt: null,
                messageUsed: null
            }));
            campaign.delay = delay;
            campaign.totalUsers = users.length;
            campaign.remainingUsers = users.length;

            this.saveCampaigns();
            this.renderCampaigns();
            this.hideCampaignModal();
            this.addLog(`✅ Campaña "${name}" actualizada`, 'success');
        }
    }

    updateInstagramLogs(tabId, message, type = 'info') {
        // Función simplificada
    }

    updateInstagramProgress(tabId, current, total) {
        // Función simplificada
    }

    updateInstagramStatus(tabId, status) {
        // Función simplificada
    }

    setupProgressListener() {
        // Función simplificada
    }

    handleCampaignProgress(progress) {
        // Función simplificada
    }

    updateCampaignProgress(campaignId, current, total) {
        // Función simplificada
    }

    // Función para actualizar progreso en tiempo real
    updateCampaignProgressInRealTime(campaignId, processedUsers, totalUsers, progressPercent) {
        // Buscar la campaña en el DOM y actualizar su progreso
        const campaignElement = document.querySelector(`[data-campaign-id="${campaignId}"]`);
        if (campaignElement) {
            // Actualizar texto de progreso
            const progressElement = campaignElement.querySelector('.campaign-progress');
            if (progressElement) {
                progressElement.textContent = `Progreso: ${processedUsers}/${totalUsers} (${totalUsers - processedUsers} restantes)`;
            }
            
            // Actualizar porcentaje
            const percentElement = campaignElement.querySelector('.campaign-percentage');
            if (percentElement) {
                percentElement.textContent = `${progressPercent}%`;
            }
            
            // Actualizar barra de progreso si existe
            const progressBar = campaignElement.querySelector('.progress-bar-fill');
            if (progressBar) {
                progressBar.style.width = `${progressPercent}%`;
            }
            
            // Cambiar estado si está completado
            if (processedUsers === totalUsers) {
                const statusElement = campaignElement.querySelector('.campaign-status');
                if (statusElement) {
                    statusElement.textContent = 'Completada';
                    statusElement.className = 'campaign-status completed';
                }
                
                // GUARDAR PROGRESO FINAL para mantenerlo después
                this.saveFinalProgress(campaignId, processedUsers, totalUsers);
            }
        }
    }

    // MEJORADO: Guardar progreso individual de usuarios en campaña
    async saveUserProgress(campaignId, userName, status, messageUsed = null) {
        try {
            const campaignIndex = this.campaigns.findIndex(c => c.id === campaignId);
            if (campaignIndex !== -1) {
                const campaign = this.campaigns[campaignIndex];
                const userIndex = campaign.users.findIndex(u => u.username === userName);
                
                if (userIndex !== -1) {
                    // Actualizar estado del usuario
                    campaign.users[userIndex].status = status;
                    campaign.users[userIndex].sentAt = new Date().toISOString();
                    campaign.users[userIndex].sentByMember = this.teamMemberName || 'Usuario';
                    campaign.users[userIndex].sentByDeviceId = this.deviceId || 'Unknown';
                    if (messageUsed) {
                        campaign.users[userIndex].messageUsed = messageUsed;
                    }
                    
                    // Actualizar estadísticas de la campaña
                    const completedUsers = campaign.users.filter(u => u.status === 'completed').length;
                    campaign.sentMessages = completedUsers;
                    campaign.remainingUsers = campaign.users.length - completedUsers;
                    
                    // Guardar inmediatamente
                    await this.saveCampaigns();
                    
                    console.log(`💾 Progreso guardado: ${userName} -> ${status}`);
                    this.addLog(`📈 Usuario ${userName}: ${status}`, 'success');
                }
            }
        } catch (error) {
            console.error('Error guardando progreso de usuario:', error);
            this.addLog(`❌ Error guardando progreso: ${error.message}`, 'error');
        }
    }

    // Función para guardar el progreso final de una campaña completada
    async saveFinalProgress(campaignId, sentUsers, totalUsers) {
        try {
            // Buscar la campaña y guardar su progreso final
            const campaignIndex = this.campaigns.findIndex(c => c.id === campaignId);
            if (campaignIndex !== -1) {
                this.campaigns[campaignIndex].status = 'completed';
                this.campaigns[campaignIndex].finalProgress = {
                    sent: sentUsers,
                    total: totalUsers,
                    completed: true,
                    completedAt: new Date().toISOString()
                };
                
                // Usar la función mejorada de guardar
                await this.saveCampaigns();
                this.addLog(`💾 [FINAL] Progreso final guardado: ${sentUsers}/${totalUsers}`, 'success');
            }
        } catch (error) {
            this.addLog(`❌ Error guardando progreso final: ${error.message}`, 'error');
        }
    }

    async monitorCampaignProgress(campaignId, totalUsers) {
        const startTime = Date.now();
        const maxMonitorTime = 30 * 60 * 1000; // 30 minutos máximo
        let lastUserCount = totalUsers;
        let noProgressCount = 0;
        
        this.addLog(`📊 Iniciando monitoreo: ${totalUsers} usuarios a procesar`, 'info');
        
        while (Date.now() - startTime < maxMonitorTime) {
            await new Promise(resolve => setTimeout(resolve, 2000)); // Check cada 2 segundos (más rápido)
            
            try {
                // Obtener estado actual de la campaña
                const result = await chrome.storage.local.get(['campaigns']);
                const campaigns = result.campaigns || [];
                const currentCampaign = campaigns.find(c => c.id === campaignId);
                
                if (!currentCampaign) {
                    this.addLog('❌ Campaña no encontrada en storage', 'error');
                    break;
                }
                
                // ARREGLADO: Calcular progreso correctamente basado en nueva estructura
                const completedUsers = currentCampaign.completedUsers ? currentCampaign.completedUsers.length : 0;
                const remainingUsers = currentCampaign.users ? currentCampaign.users.length : 0;
                const totalUsers = completedUsers + remainingUsers;
                const progressPercent = totalUsers > 0 ? Math.round((completedUsers / totalUsers) * 100) : 0;
                
                console.log(`📊 PROGRESO CORREGIDO: ${completedUsers}/${totalUsers} (${progressPercent}%)`);
                
                // ACTUALIZAR PROGRESO EN TIEMPO REAL CON DATOS CORRECTOS
                this.updateCampaignProgressInRealTime(campaignId, completedUsers, totalUsers, progressPercent);
                
                // Solo log de progreso cada 10 segundos para no saturar
                const shouldLogProgress = Math.floor((Date.now() - startTime) / 2000) % 5 === 0; // Cada 10s
                if (shouldLogProgress) {
                    this.addLog(`📈 Progreso: ${completedUsers}/${totalUsers} (${progressPercent}%)`, 'info');
                }
                
                // Verificar si hay progreso
                if (currentUserCount < lastUserCount) {
                    lastUserCount = currentUserCount;
                    noProgressCount = 0;
                    this.addLog(`✅ Usuario procesado. Restantes: ${currentUserCount}`, 'success');
                } else {
                    noProgressCount++;
                }
                
                // Verificar si la campaña está completada
                if (currentCampaign.status === 'completed' || currentUserCount === 0) {
                    this.addLog('🎉 Campaña completada exitosamente', 'success');
                    this.addLog(`📊 Resultado final: ${processedUsers} mensajes enviados`, 'success');
                    break;
                }
                
                // Verificar si no hay progreso por mucho tiempo
                if (noProgressCount >= 6) { // 1 minuto sin progreso
                    this.addLog('⚠️ No hay progreso detectado. Verificando estado...', 'warning');
                    
                    // Intentar obtener estado del content script
                    const tabs = await chrome.tabs.query({ url: '*://*.instagram.com/*' });
                    if (tabs.length > 0) {
                        try {
                            const response = await chrome.tabs.sendMessage(tabs[0].id, {
                                action: 'getStatus'
                            });
                            this.addLog(`🔍 Estado del bot: ${response?.isActive ? 'Activo' : 'Inactivo'}`, 'info');
                        } catch (error) {
                            this.addLog('⚠️ No se pudo comunicar con el content script', 'warning');
                        }
                    }
                    
                    noProgressCount = 0; // Reset counter
                }
                
            } catch (error) {
                this.addLog(`❌ Error monitoreando progreso: ${error.message}`, 'error');
            }
        }
        
        // Timeout del monitoreo
        if (Date.now() - startTime >= maxMonitorTime) {
            this.addLog('⏰ Tiempo de monitoreo agotado (30 minutos)', 'warning');
        }
        
        this.addLog('📊 Monitoreo de campaña finalizado', 'info');
    }

    finishCampaign(campaignId) {
        const campaign = this.campaigns.find(c => c.id === campaignId);
        if (campaign) {
            campaign.status = 'completed';
            this.isRunning = false;
            this.saveCampaigns();
            this.renderCampaigns();
        }
    }

    // ========================================
    // SISTEMA DE LÍMITES DE MENSAJES
    // ========================================

    // Obtener fecha actual en zona horaria Argentina (UTC-3)
    getArgentinaDate() {
        const now = new Date();
        const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
        const argentina = new Date(utc + (-3 * 3600000)); // UTC-3
        return argentina.toISOString().split('T')[0]; // Solo la fecha (YYYY-MM-DD)
    }
    
    // FUTURO: Versión con servidor Firebase (por ahora desactivada)
    async getArgentinaDateFromServerFuture() {
        // Esta función está lista para cuando se necesite mayor seguridad
        // Por ahora usamos fecha local para evitar problemas de login
        return this.getArgentinaDate();
    }

    // Verificar si necesita reset diario
    needsDailyReset() {
        const today = this.getArgentinaDate();
        return this.lastResetDate !== today;
    }

    // SISTEMA LIMPIO: Cargar contador de mensajes del usuario desde Firebase
    async loadMessageCounters() {
        try {
            console.log('📊 Cargando contador de mensajes del usuario...');
            
            if (!this.isAuthenticated || !this.userId || !this.db) {
                console.log('⚠️ Usuario no autenticado, intentando cargar desde local...');
                
                // Intentar cargar desde storage local
                const localLoaded = await this.loadCountersFromLocal();
                if (!localLoaded) {
                    this.dailyMessageCount = 0;
                    this.messageLimit = 80;
                }
                this.updateMessageCountersUI();
                return;
            }
            
            // Cargar datos del usuario desde su documento principal
            const userRef = this.db.collection('users').doc(this.userId);
            const userDoc = await userRef.get();
            
            if (userDoc.exists) {
                const userData = userDoc.data();
                this.dailyMessageCount = userData.messagesSent || 0;
                this.messageLimit = userData.messageLimit || 80;
                this.lastResetDate = userData.lastResetDate;
                
                console.log(`📊 Contadores cargados: ${this.dailyMessageCount}/${this.messageLimit}`);
                console.log(`📅 Último reset: ${this.lastResetDate}`);
                
                // Verificar si necesita reset automático (por si acaso)
                const serverTimestamp = firebase.firestore.FieldValue.serverTimestamp();
                const tempRef = this.db.collection('temp').doc('check-' + Date.now());
                await tempRef.set({ timestamp: serverTimestamp });
                const tempDoc = await tempRef.get();
                const serverTime = tempDoc.data().timestamp.toDate();
                await tempRef.delete();
                
                const argentinaTime = new Date(serverTime.getTime() - (3 * 60 * 60 * 1000));
                const todayArgentina = argentinaTime.toLocaleDateString('en-US', {
                    timeZone: 'America/Argentina/Buenos_Aires'
                });
                
                if (userData.lastResetDate !== todayArgentina) {
                    console.log('🔄 Detectado nuevo día - Reset automático');
                    await userRef.update({
                        messagesSent: 0,
                        lastResetDate: todayArgentina
                    });
                    this.dailyMessageCount = 0;
                    this.addLog('🔄 Contador reseteado automáticamente (nuevo día)', 'info');
                }
                
            } else {
                console.log('⚠️ Usuario no encontrado en Firestore');
                this.dailyMessageCount = 0;
                this.messageLimit = 80;
            }
            
            // NUEVO: Sincronizar con storage local después de cargar
            await this.syncCountersToLocal(this.dailyMessageCount, this.messageLimit);
            
            this.updateMessageCountersUI();
            
        } catch (error) {
            console.error('❌ Error cargando contadores:', error);
            this.dailyMessageCount = 0;
            this.messageLimit = 80;
            this.updateMessageCountersUI();
        }
    }

    // NUEVO: Sincronizar contadores de Firebase con storage local
    async syncCountersToLocal(messagesSent, messageLimit) {
        try {
            const counterData = {
                messagesSent: messagesSent,
                messageLimit: messageLimit,
                lastSync: new Date().toISOString(),
                userId: this.userId,
                userEmail: this.userEmail
            };
            
            await chrome.storage.local.set({
                userCounters: counterData,
                [`counters_${this.userId}`]: counterData
            });
            
            console.log(`💾 Contadores sincronizados: ${messagesSent}/${messageLimit}`);
        } catch (error) {
            console.error('❌ Error sincronizando contadores:', error);
        }
    }
    
    // NUEVO: Cargar contadores desde storage local si Firebase falla
    async loadCountersFromLocal() {
        try {
            const result = await chrome.storage.local.get([
                'userCounters', 
                `counters_${this.userId}`
            ]);
            
            const counterData = result[`counters_${this.userId}`] || result.userCounters;
            
            if (counterData && counterData.userId === this.userId) {
                this.dailyMessageCount = counterData.messagesSent || 0;
                this.messageLimit = counterData.messageLimit || 80;
                
                console.log(`📱 Contadores cargados desde local: ${this.dailyMessageCount}/${this.messageLimit}`);
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('❌ Error cargando contadores locales:', error);
            return false;
        }
    }



    // SISTEMA LIMPIO: Verificar límites de mensajes del usuario
    async canSendMessages() {
        console.log('🔍 Verificando límites de mensajes...');
        
        // Recargar contadores actuales
        await this.loadMessageCounters();
        
        const currentCount = this.dailyMessageCount || 0;
        const messageLimit = this.messageLimit || 80;
        
        console.log(`🔍 Estado actual: ${currentCount}/${messageLimit} mensajes`);
        
        // Verificar límite diario del usuario
        if (currentCount >= messageLimit) {
            this.addLog(`🚫 Límite diario alcanzado: ${currentCount}/${messageLimit} mensajes`, 'warning');
            this.addLog(`⏰ El límite se resetea mañana a las 00:00 (Argentina)`, 'info');
            return false;
        }
        
        console.log('✅ Límites OK: se pueden enviar más mensajes');
        return true;
    }

    // SISTEMA LIMPIO: Actualizar interfaz con contador personalizado
    updateMessageCountersUI() {
        const currentCount = this.dailyMessageCount || 0;
        const limit = this.messageLimit || 80;
        const percent = Math.round((currentCount / limit) * 100);
        
        // Actualizar contador principal
        const messageCountElement = document.getElementById('mensajes-enviados');
        if (messageCountElement) {
            messageCountElement.textContent = currentCount;
        }
        
        const messageRemainingElement = document.getElementById('mensajes-restantes');
        if (messageRemainingElement) {
            messageRemainingElement.textContent = limit;
        }
        
        // Actualizar barra de progreso
        const progressBarFill = document.getElementById('progress-bar-fill');
        if (progressBarFill) {
            progressBarFill.style.width = `${percent}%`;
            
            // Cambiar color si está cerca del límite
            if (percent >= 100) {
                progressBarFill.style.backgroundColor = '#ff4757'; // Rojo
            } else if (percent >= 80) {
                progressBarFill.style.backgroundColor = '#ffa726'; // Naranja
            } else {
                progressBarFill.style.backgroundColor = '#4caf50'; // Verde
            }
        }
        
        // Actualizar timer de reset
        this.updateResetTimer();
        
        console.log(`🎨 UI ACTUALIZADA: ${currentCount}/${limit} mensajes (${percent}%)`);
    }

    // Actualizar timer hasta próximo reset
    updateResetTimer() {
        const resetTimerElement = document.getElementById('reset-timer');
        if (resetTimerElement) {
            const timeUntilReset = this.getTimeUntilReset();
            resetTimerElement.textContent = `Reset en: ${timeUntilReset}`;
        }
    }

    // Obtener tiempo hasta próximo reset (00:00 Argentina) - versión simplificada
    getTimeUntilReset() {
        // Para el timer usamos hora local (menos operaciones), 
        // pero para reset real usamos servidor Firebase
        const now = new Date();
        const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
        const argentina = new Date(utc + (-3 * 3600000));
        
        // Próximo reset a las 00:00 de mañana
        const nextReset = new Date(argentina);
        nextReset.setDate(nextReset.getDate() + 1);
        nextReset.setHours(0, 0, 0, 0);
        
        const diff = nextReset.getTime() - argentina.getTime();
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        
        return `${hours}h ${minutes}m`;
    }

    // Iniciar timer para actualizar countdown cada minuto
    startResetTimer() {
        // Actualizar inmediatamente
        this.updateResetTimer();
        
        // Actualizar cada minuto
        setInterval(async () => {
            this.updateResetTimer();
            
            // También verificar si necesita reset diario
            if (this.needsDailyReset()) {
                console.log('🔄 Reset diario automático detectado');
                await this.loadMessageCounters();
            }
        }, 60000); // 60 segundos
    }

    // NUEVO: Sistema de sincronización en tiempo real entre exploradores
    startRealtimeSync() {
        if (!this.isAuthenticated || !this.userId || !this.db) {
            console.log('⚠️ No se puede iniciar sync - usuario no autenticado');
            return;
        }
        
        console.log('🔄 Iniciando sincronización en tiempo real...');
        this.addLog('🔄 Sincronización multi-explorador activada', 'info');
        
        // Listener para cambios en el documento del usuario
        const userRef = this.db.collection('users').doc(this.userId);
        
        this.realtimeListener = userRef.onSnapshot((doc) => {
            if (doc.exists) {
                const userData = doc.data();
                const newMessageCount = userData.messagesSent || 0;
                const newMessageLimit = userData.messageLimit || 80;
                const lastMessageAt = userData.lastMessageAt;
                
                // Solo actualizar si hay cambios reales y no es nuestro propio cambio
                if (this.dailyMessageCount !== newMessageCount) {
                    const oldCount = this.dailyMessageCount;
                    this.dailyMessageCount = newMessageCount;
                    this.messageLimit = newMessageLimit;
                    
                    console.log(`🔄 SYNC: Contador actualizado de ${oldCount} a ${newMessageCount}`);
                    this.addLog(`🔄 Contador sincronizado: ${newMessageCount}/${newMessageLimit} (cambio externo)`, 'info');
                    
                    // Actualizar interfaz
                    this.updateMessageCountersUI();
                    
                    // Sincronizar con storage local
                    this.syncCountersToLocal(newMessageCount, newMessageLimit);
                    
                    // Broadcast a otras pestañas del mismo explorador
                    this.broadcastCounterUpdate(newMessageCount, newMessageLimit);
                }
            }
        }, (error) => {
            console.error('❌ Error en listener de sincronización:', error);
            this.addLog('❌ Error en sincronización en tiempo real', 'error');
        });
        
        console.log('✅ Listener de sincronización iniciado');
        
        // ADICIONAL: Listener de localStorage para sincronización entre pestañas del mismo explorador
        window.addEventListener('storage', (e) => {
            if (e.key === 'counterSync' && e.newValue) {
                try {
                    const syncData = JSON.parse(e.newValue);
                    
                    // Solo procesar si es del mismo usuario y es reciente
                    if (syncData.userId === this.userId) {
                        const timeDiff = Date.now() - syncData.timestamp;
                        if (timeDiff < 3000 && syncData.messagesSent !== this.dailyMessageCount) {
                            this.dailyMessageCount = syncData.messagesSent;
                            this.messageLimit = syncData.messageLimit;
                            this.updateMessageCountersUI();
                            
                            console.log(`🔄 STORAGE SYNC: ${syncData.messagesSent}/${syncData.messageLimit}`);
                        }
                    }
    } catch (error) {
                    console.error('❌ Error procesando sync de localStorage:', error);
                }
            }
        });
    }
    
    // NUEVO: Broadcast a otras pestañas/extensiones del mismo explorador
    broadcastCounterUpdate(messagesSent, messageLimit) {
        try {
            // Usar chrome.runtime para comunicación entre pestañas
            chrome.runtime.sendMessage({
                action: 'counterUpdated',
                messagesSent: messagesSent,
                messageLimit: messageLimit,
                userId: this.userId,
                timestamp: Date.now()
            }).catch(() => {
                // No hay otras extensiones escuchando, está bien
            });
            
            // También usar localStorage como backup para comunicación entre pestañas
            const syncData = {
                messagesSent: messagesSent,
                messageLimit: messageLimit,
                userId: this.userId,
                timestamp: Date.now(),
                syncId: Math.random().toString(36)
            };
            
            localStorage.setItem('counterSync', JSON.stringify(syncData));
            
            console.log('📡 Broadcast enviado a otras extensiones');
        } catch (error) {
            console.error('❌ Error en broadcast:', error);
        }
    }
    
    // NUEVO: Detener sincronización cuando se cierra sesión
    stopRealtimeSync() {
        if (this.realtimeListener) {
            this.realtimeListener();
            this.realtimeListener = null;
            console.log('🔄 Sincronización en tiempo real detenida');
            this.addLog('🔄 Sincronización desactivada', 'info');
        }
    }
    
    // NUEVO: Generar ID único del dispositivo
    generateDeviceFingerprint() {
        try {
            const fingerprint = [
                navigator.userAgent,                    // Navegador y OS
                screen.width + 'x' + screen.height,     // Resolución de pantalla  
                new Date().getTimezoneOffset(),         // Zona horaria
                navigator.language,                     // Idioma del navegador
                navigator.hardwareConcurrency || 4,     // Núcleos del CPU
                navigator.platform,                     // Plataforma
                window.devicePixelRatio || 1            // Densidad de píxeles
            ].join('|');
            
            // Crear hash simple del fingerprint
            let hash = 0;
            for (let i = 0; i < fingerprint.length; i++) {
                const char = fingerprint.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash; // Convertir a 32-bit integer
            }
            
            // Convertir a string más amigable
            const deviceId = Math.abs(hash).toString(36).substring(0, 8).toUpperCase();
            
            console.log('🔑 Device ID generado:', deviceId);
            return deviceId;
        } catch (error) {
            console.error('❌ Error generando device ID:', error);
            // Fallback: usar timestamp + random
            return Date.now().toString(36).substring(-6).toUpperCase();
        }
    }
    
    // NUEVO: Verificar si es primera vez y pedir nombre
    async checkTeamMemberStatus() {
        try {
            // Generar device ID
            this.deviceId = this.generateDeviceFingerprint();
            console.log('🆔 Device ID:', this.deviceId);
            
            if (!this.isAuthenticated || !this.userId || !this.db) {
                return;
            }
            
            // PRIMERO: Verificar si hay bloqueo
            const isBlocked = await this.checkIfBlocked();
            if (isBlocked) {
                return; // No continuar si está bloqueado
            }
            
            // SEGUNDO: Verificar quién es el administrador
            await this.checkAdminStatus();
            
            // TERCERO: Buscar si ya existe este dispositivo en el equipo
            const teamRef = this.db.collection('users').doc(this.userId).collection('teamMembers');
            const snapshot = await teamRef.where('deviceId', '==', this.deviceId).get();
            
            if (snapshot.empty) {
                // Primera vez - mostrar modal para pedir nombre
                console.log('🆕 Primera vez de este dispositivo');
                this.showTeamMemberModal();
            } else {
                // Ya existe - cargar datos del miembro
                const memberDoc = snapshot.docs[0];
                const memberData = memberDoc.data();
                
                this.teamMemberName = memberData.name;
                this.isTeamMember = true;
                
                console.log(`👋 Miembro existente: ${this.teamMemberName}`);
                this.addLog(`👋 ¡Hola ${this.teamMemberName}! Bienvenido de vuelta`, 'success');
                
                // Mostrar botón del panel de equipo
                this.showTeamPanelButton();
                
                // Actualizar última actividad
                await memberDoc.ref.update({
                    lastActive: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
            
        } catch (error) {
            console.error('❌ Error verificando estado de equipo:', error);
        }
    }
    
    // NUEVO: Verificar si el dispositivo está bloqueado
    async checkIfBlocked() {
        try {
            const blockedRef = this.db.collection('users').doc(this.userId).collection('blockedDevices').doc(this.deviceId);
            const blockedDoc = await blockedRef.get();
            
            if (blockedDoc.exists) {
                const blockedData = blockedDoc.data();
                
                // Verificar si es suspensión temporal
                if (blockedData.suspendedUntil) {
                    const suspendedUntil = blockedData.suspendedUntil.toDate();
                    const now = new Date();
                    
                    if (now < suspendedUntil) {
                        // Aún suspendido
                        this.showBlockedScreen('suspended', blockedData);
                        return true;
                    } else {
                        // Suspensión expirada - reactivar automáticamente
                        await this.reactivateMember(this.deviceId);
                        return false;
                    }
                } else {
                    // Bloqueado permanentemente
                    this.showBlockedScreen('blocked', blockedData);
                    return true;
                }
            }
            
            return false; // No está bloqueado
        } catch (error) {
            console.error('❌ Error verificando bloqueo:', error);
            return false;
        }
    }
    
    // NUEVO: Verificar quién es el administrador del equipo
    async checkAdminStatus() {
        try {
            const userRef = this.db.collection('users').doc(this.userId);
            const userDoc = await userRef.get();
            
            if (userDoc.exists) {
                const userData = userDoc.data();
                
                if (userData.teamAdminDeviceId) {
                    // Ya hay un administrador definido
                    this.teamAdminDeviceId = userData.teamAdminDeviceId;
                    this.isTeamAdmin = (this.deviceId === userData.teamAdminDeviceId);
                    
                    console.log(`👑 Admin del equipo: ${this.teamAdminDeviceId}`);
                    console.log(`🔑 Soy admin: ${this.isTeamAdmin}`);
                } else {
                    // No hay administrador - este dispositivo se convierte en admin
                    this.teamAdminDeviceId = this.deviceId;
                    this.isTeamAdmin = true;
                    
                    await userRef.update({
                        teamAdminDeviceId: this.deviceId,
                        teamAdminSetAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    
                    console.log('👑 ¡Este dispositivo es ahora el administrador del equipo!');
                    this.addLog('👑 ¡Eres el administrador de este equipo!', 'success');
                }
            }
        } catch (error) {
            console.error('❌ Error verificando estado de administrador:', error);
        }
    }
    
    // NUEVO: Mostrar pantalla de bloqueo
    showBlockedScreen(type, blockedData) {
        // Ocultar toda la interfaz normal
        const mainContent = document.querySelector('.container');
        if (mainContent) {
            mainContent.style.display = 'none';
        }
        
        // Crear pantalla de bloqueo
        const blockedScreen = document.createElement('div');
        blockedScreen.className = 'blocked-screen';
        
        let title, message, icon;
        
        if (type === 'suspended') {
            icon = '⏸️';
            title = 'Cuenta Suspendida';
            const suspendedUntil = blockedData.suspendedUntil.toDate();
            message = `
                <p>Tu acceso ha sido suspendido temporalmente.</p>
                <p><strong>Hasta:</strong> ${suspendedUntil.toLocaleDateString('es-ES')} ${suspendedUntil.toLocaleTimeString('es-ES')}</p>
                <p><strong>Razón:</strong> ${blockedData.reason || 'No especificada'}</p>
                <p>Contacta al administrador si hay un error.</p>
            `;
        } else {
            icon = '🚫';
            title = 'Acceso Denegado';
            message = `
                <p>Tu acceso a esta cuenta ha sido revocado.</p>
                <p><strong>Razón:</strong> ${blockedData.reason || 'No especificada'}</p>
                <p><strong>Fecha:</strong> ${blockedData.blockedAt ? blockedData.blockedAt.toDate().toLocaleDateString('es-ES') : 'N/A'}</p>
                <p>Contacta al administrador para más información.</p>
            `;
        }
        
        blockedScreen.innerHTML = `
            <div class="blocked-content">
                <div class="blocked-icon">${icon}</div>
                <h2 class="blocked-title">${title}</h2>
                <div class="blocked-message">${message}</div>
                <button onclick="window.close()" class="blocked-close-btn">Cerrar</button>
            </div>
        `;
        
        document.body.appendChild(blockedScreen);
    }
    
    // NUEVO: Mostrar modal para pedir nombre del miembro del equipo
    showTeamMemberModal() {
        const modal = document.getElementById('team-member-modal');
        const input = document.getElementById('team-member-name');
        
        if (modal && input) {
            modal.classList.remove('hidden');
            
            // AGREGAR EVENT LISTENER AL BOTÓN SOLO UNA VEZ
            const saveBtn = document.getElementById('save-team-member-btn');
            if (saveBtn && !saveBtn.hasAttribute('data-listener-added')) {
                saveBtn.addEventListener('click', () => {
                    this.saveTeamMember();
                });
                saveBtn.setAttribute('data-listener-added', 'true');
                console.log('✅ Event listener agregado al botón (una sola vez)');
            }
            
            // Focus en el input después de la animación
            setTimeout(() => {
                input.focus();
            }, 300);
            
            // Manejar Enter key
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.saveTeamMember();
                }
            });
        }
    }
    
    // NUEVO: Ocultar modal del equipo
    hideTeamMemberModal() {
        const modal = document.getElementById('team-member-modal');
        if (modal) {
            modal.classList.add('hidden');
            console.log('🔄 Modal del equipo ocultado');
        }
    }
    
    // NUEVO: Función de emergencia para saltear el sistema de equipo
    bypassTeamSystem() {
        console.log('🚨 BYPASS: Saltando sistema de equipo');
        this.teamMemberName = 'Usuario Solo';
        this.isTeamMember = false;
        this.isTeamAdmin = true;
        this.hideTeamMemberModal();
        this.addLog('⚠️ Sistema de equipo bypaseado - funcionando en modo individual', 'warning');
    }
    
    // NUEVO: Guardar nuevo miembro del equipo
    async saveTeamMember() {
        try {
            const nameInput = document.getElementById('team-member-name');
            const name = nameInput.value.trim();
            
            // Validar nombre
            if (!name) {
                this.addLog('❌ Por favor ingresa tu nombre', 'error');
                return;
            }
            
            if (name.length > 20) {
                this.addLog('❌ El nombre debe tener máximo 20 caracteres', 'error');
                return;
            }
            
            // Solo letras y espacios
            if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(name)) {
                this.addLog('❌ El nombre solo puede contener letras y espacios', 'error');
                return;
            }
            
            this.addLog('💾 Guardando tu información en el equipo...', 'info');
            
            // Crear documento del miembro del equipo
            const teamRef = this.db.collection('users').doc(this.userId).collection('teamMembers');
            const memberDocId = `${this.deviceId}_${name.replace(/\s+/g, '_')}`;
            
            await teamRef.doc(memberDocId).set({
                name: name,
                deviceId: this.deviceId,
                messagesSent: 0,
                joinedAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastActive: firebase.firestore.FieldValue.serverTimestamp(),
                isActive: true,
                isAdmin: this.isTeamAdmin,
                role: this.isTeamAdmin ? 'admin' : 'member'
            });
            
            // Actualizar estado local
            this.teamMemberName = name;
            this.isTeamMember = true;
            
            // Mostrar botón del panel de equipo
            this.showTeamPanelButton();
            
            // Ocultar modal
            this.hideTeamMemberModal();
            
            // DEBUGGING: Verificar que el modal se ocultó
            console.log('✅ Modal del equipo debería estar oculto ahora');
            const modal = document.getElementById('team-member-modal');
            console.log('🔍 Estado del modal:', modal ? modal.classList.contains('hidden') : 'No encontrado');
            
            this.addLog(`✅ ¡Bienvenido al equipo, ${name}!`, 'success');
            console.log(`👥 Nuevo miembro registrado: ${name} (${this.deviceId})`);
            
        } catch (error) {
            console.error('❌ Error guardando miembro del equipo:', error);
            this.addLog('❌ Error registrando en el equipo. Inténtalo de nuevo.', 'error');
            
            // FORZAR ocultación del modal en caso de error
            this.hideTeamMemberModal();
        }
    }
    
    // NUEVO: Actualizar SOLO contador individual del miembro del equipo (SIN tocar el contador principal)
    async updateTeamMemberCounterOnly() {
        try {
            if (!this.isTeamMember || !this.deviceId || !this.teamMemberName) {
                return;
            }
            
            const teamRef = this.db.collection('users').doc(this.userId).collection('teamMembers');
            const memberDocId = `${this.deviceId}_${this.teamMemberName.replace(/\s+/g, '_')}`;
            
            // IMPORTANTE: Solo incrementamos el contador individual del miembro
            // NO tocamos el contador principal del cliente (ya se incrementó antes)
            await teamRef.doc(memberDocId).update({
                messagesSent: firebase.firestore.FieldValue.increment(1),
                lastActive: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            console.log(`👥 Contador individual actualizado para ${this.teamMemberName} (sin afectar límite principal)`);
            
        } catch (error) {
            console.error('❌ Error actualizando contador individual del equipo:', error);
        }
    }
    
    // NUEVO: Mostrar botón del panel de equipo
    showTeamPanelButton() {
        const teamPanelBtn = document.getElementById('team-panel-btn');
        if (teamPanelBtn) {
            teamPanelBtn.classList.remove('hidden');
        }
    }
    
    // NUEVO: Mostrar panel de equipo
    async showTeamPanel() {
        const modal = document.getElementById('team-panel-modal');
        if (modal) {
            modal.classList.remove('hidden');
            
            // Cargar datos del equipo
            await this.loadTeamData();
            
            // Iniciar actualizaciones en tiempo real
            this.startTeamRealtimeUpdates();
        }
    }
    
    // NUEVO: Ocultar panel de equipo
    hideTeamPanel() {
        const modal = document.getElementById('team-panel-modal');
        if (modal) {
            modal.classList.add('hidden');
            
            // Detener actualizaciones en tiempo real
            this.stopTeamRealtimeUpdates();
        }
    }
    
    // NUEVO: Cargar datos del equipo
    async loadTeamData() {
        try {
            if (!this.isAuthenticated || !this.userId || !this.db) {
                return;
            }
            
            console.log('📊 Cargando datos del equipo...');
            
            // Actualizar información personal
            this.updatePersonalInfo();
            
            // Cargar todos los miembros del equipo
            const teamRef = this.db.collection('users').doc(this.userId).collection('teamMembers');
            const snapshot = await teamRef.orderBy('lastActive', 'desc').get();
            
            let totalMessages = 0;
            let activeMembers = 0;
            const members = [];
            
            snapshot.forEach(doc => {
                const memberData = doc.data();
                const messagesSent = memberData.messagesSent || 0;
                totalMessages += messagesSent;
                
                // Considerar activo si fue activo en las últimas 24 horas
                const lastActive = memberData.lastActive ? memberData.lastActive.toDate() : new Date(0);
                const isActive = (Date.now() - lastActive.getTime()) < (24 * 60 * 60 * 1000);
                if (isActive) activeMembers++;
                
                members.push({
                    id: doc.id,
                    name: memberData.name,
                    deviceId: memberData.deviceId,
                    messagesSent: messagesSent,
                    lastActive: lastActive,
                    isActive: isActive,
                    isCurrentUser: memberData.deviceId === this.deviceId,
                    isAdmin: memberData.isAdmin || false,
                    role: memberData.role || 'member'
                });
            });
            
            // Actualizar estadísticas generales
            this.updateTeamStats(totalMessages, activeMembers, this.messageLimit - this.dailyMessageCount);
            
            // Renderizar lista de miembros
            this.renderTeamMembers(members);
            
        } catch (error) {
            console.error('❌ Error cargando datos del equipo:', error);
        }
    }
    
    // NUEVO: Actualizar información personal
    updatePersonalInfo() {
        const nameElement = document.getElementById('personal-member-name');
        const deviceElement = document.getElementById('personal-device-id');
        const messagesElement = document.getElementById('personal-messages-sent');
        const activeElement = document.getElementById('personal-last-active');
        
        if (nameElement) nameElement.textContent = this.teamMemberName || 'Sin nombre';
        if (deviceElement) deviceElement.textContent = `ID: ${this.deviceId}`;
        if (messagesElement) messagesElement.textContent = `${this.dailyMessageCount || 0} mensajes`;
        if (activeElement) activeElement.textContent = 'Ahora mismo';
    }
    
    // NUEVO: Actualizar estadísticas del equipo
    updateTeamStats(totalMessages, activeMembers, remainingMessages) {
        const totalElement = document.getElementById('team-total-messages');
        const activeMembersElement = document.getElementById('team-active-members');
        const remainingElement = document.getElementById('team-limit-remaining');
        
        if (totalElement) totalElement.textContent = totalMessages;
        if (activeMembersElement) activeMembersElement.textContent = activeMembers;
        if (remainingElement) remainingElement.textContent = Math.max(0, remainingMessages);
    }
    
    // NUEVO: Renderizar lista de miembros del equipo
    renderTeamMembers(members) {
        const listContainer = document.getElementById('team-members-list');
        if (!listContainer) return;
        
        if (members.length === 0) {
            listContainer.innerHTML = '<div class="loading-team">No hay miembros en el equipo</div>';
            return;
        }
        
        const membersHTML = members.map(member => {
            const timeAgo = this.getTimeAgo(member.lastActive);
            const statusClass = member.isCurrentUser ? 'personal' : (member.isActive ? '' : 'inactive');
            
            // Botones de administración (solo para admin y no para sí mismo)
            let adminButtons = '';
            if (this.isTeamAdmin && !member.isCurrentUser) {
                adminButtons = `
                    <div class="admin-buttons">
                        <button class="btn-suspend" data-action="suspend" data-device-id="${member.deviceId}" data-member-name="${member.name}" title="Suspender">
                            ⏸️
                        </button>
                        <button class="btn-block" data-action="block" data-device-id="${member.deviceId}" data-member-name="${member.name}" title="Despedir">
                            ❌
                        </button>
                    </div>
                `;
            }
            
            const roleLabel = member.isAdmin ? '👑 ADMIN' : (member.isCurrentUser ? '(Tú)' : '');
            
            return `
                <div class="team-member-card ${statusClass}">
                    <div class="member-info">
                        <span class="member-name">
                            ${member.name} ${roleLabel}
                        </span>
                        <span class="member-device">ID: ${member.deviceId}</span>
                    </div>
                    <div class="member-stats">
                        <span class="messages-sent">${member.messagesSent} mensajes</span>
                        <span class="last-active">${timeAgo}</span>
                    </div>
                    ${adminButtons}
                </div>
            `;
        }).join('');
        
        listContainer.innerHTML = membersHTML;
        
        // NUEVO: Agregar event listeners para botones de admin
        const suspendButtons = listContainer.querySelectorAll('.btn-suspend');
        const blockButtons = listContainer.querySelectorAll('.btn-block');
        
        suspendButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const deviceId = e.target.getAttribute('data-device-id');
                const memberName = e.target.getAttribute('data-member-name');
                this.suspendMember(deviceId, memberName);
            });
        });
        
        blockButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const deviceId = e.target.getAttribute('data-device-id');
                const memberName = e.target.getAttribute('data-member-name');
                this.blockMember(deviceId, memberName);
            });
        });
    }
    
    // NUEVO: Calcular tiempo transcurrido
    getTimeAgo(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        
        if (diffMins < 1) return 'Ahora mismo';
        if (diffMins < 60) return `Hace ${diffMins}m`;
        if (diffHours < 24) return `Hace ${diffHours}h`;
        return `Hace ${diffDays}d`;
    }
    
    // NUEVO: Refrescar datos del equipo
    async refreshTeamData() {
        const refreshBtn = document.getElementById('refresh-team-btn');
        if (refreshBtn) {
            refreshBtn.textContent = '⏳';
            refreshBtn.disabled = true;
        }
        
        await this.loadTeamData();
        
        if (refreshBtn) {
            refreshBtn.textContent = '🔄';
            refreshBtn.disabled = false;
        }
    }
    
    // NUEVO: Iniciar actualizaciones en tiempo real del equipo
    startTeamRealtimeUpdates() {
        if (!this.isAuthenticated || !this.userId || !this.db) return;
        
        // Detener listener anterior si existe
        this.stopTeamRealtimeUpdates();
        
        const teamRef = this.db.collection('users').doc(this.userId).collection('teamMembers');
        this.teamRealtimeListener = teamRef.onSnapshot((snapshot) => {
            console.log('🔄 Actualización del equipo detectada');
            this.loadTeamData(); // Recargar datos cuando hay cambios
        }, (error) => {
            console.error('❌ Error en listener del equipo:', error);
        });
        
        console.log('✅ Listener del equipo iniciado');
    }
    
    // NUEVO: Detener actualizaciones en tiempo real del equipo
    stopTeamRealtimeUpdates() {
        if (this.teamRealtimeListener) {
            this.teamRealtimeListener();
            this.teamRealtimeListener = null;
            console.log('🔄 Listener del equipo detenido');
        }
    }
    
    // NUEVO: Descargar CSV de campaña con detalles de contactos
    async downloadCampaignCSV(campaignId) {
        try {
            console.log('📥 Descargando CSV para campaña:', campaignId);
            
            const campaign = this.campaigns.find(c => c.id === campaignId);
            if (!campaign) {
                this.addLog('❌ Campaña no encontrada', 'error');
                return;
            }
            
            // ARREGLADO: Usar completedUsers en lugar de filtrar por status
            const contactedUsers = campaign.completedUsers || [];
            
            if (contactedUsers.length === 0) {
                this.addLog('⚠️ No hay contactos realizados en esta campaña', 'warning');
                return;
            }
            
            // Crear encabezados del CSV
            const headers = ['Fecha', 'Hora', 'URL Usuario', 'Nombre Miembro Equipo', 'Username Contactado'];
            
            // Crear filas del CSV
            const rows = contactedUsers.map(user => {
                const date = new Date(user.sentAt);
                const fecha = date.toLocaleDateString('es-ES', { 
                    year: 'numeric', 
                    month: '2-digit', 
                    day: '2-digit' 
                });
                const hora = date.toLocaleTimeString('es-ES', { 
                    hour: '2-digit', 
                    minute: '2-digit', 
                    second: '2-digit' 
                });
                const urlUsuario = `https://instagram.com/${user.username}`;
                const nombreMiembro = user.sentByMember || 'Usuario';
                const username = user.username;
                
                return [fecha, hora, urlUsuario, nombreMiembro, username];
            });
            
            // Combinar encabezados y filas
            const csvContent = [headers, ...rows]
                .map(row => row.map(field => `"${field}"`).join(','))
                .join('\n');
            
            // Crear nombre del archivo incluyendo el nombre del miembro
            const campaignName = campaign.name.replace(/[^a-zA-Z0-9]/g, '_');
            const memberName = (this.teamMemberName || 'Usuario').replace(/[^a-zA-Z0-9]/g, '_');
            const timestamp = new Date().toISOString().slice(0, 10);
            const fileName = `Campaña_${campaignName}_${memberName}_${timestamp}.csv`;
            
            // Descargar archivo
            this.downloadFile(csvContent, fileName, 'text/csv');
            
            this.addLog(`📥 CSV descargado: ${contactedUsers.length} contactos`, 'success');
            console.log(`📥 CSV generado para campaña "${campaign.name}" con ${contactedUsers.length} contactos`);
            
        } catch (error) {
            console.error('❌ Error descargando CSV:', error);
            this.addLog('❌ Error descargando CSV', 'error');
        }
    }
    
    // NUEVO: Función auxiliar para descargar archivos
    downloadFile(content, fileName, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.style.display = 'none';
        
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(url);
    }
    
    // NUEVO: Iniciar sincronización en tiempo real de campañas
    startCampaignRealtimeSync() {
        if (!this.isAuthenticated || !this.userId || !this.db) {
            console.log('⚠️ No se puede iniciar sync de campañas - usuario no autenticado');
            return;
        }
        
        // Detener listener anterior si existe
        this.stopCampaignRealtimeSync();
        
        console.log('🔄 Iniciando sincronización de campañas en tiempo real...');
        
        const userRef = this.db.collection('users').doc(this.userId);
        this.campaignRealtimeListener = userRef.onSnapshot((doc) => {
            if (doc.exists) {
                const userData = doc.data();
                
                // Verificar si las campañas cambiaron
                if (userData.campaigns && JSON.stringify(userData.campaigns) !== JSON.stringify(this.campaigns)) {
                    console.log('🔄 SYNC: Campañas actualizadas desde otro dispositivo');
                    this.campaigns = userData.campaigns;
                    this.renderCampaigns();
                    this.addLog('🔄 Campañas sincronizadas desde otro miembro del equipo', 'info');
                    
                    // Actualizar storage local
                    const campaignData = {
                        campaigns: this.campaigns,
                        lastUpdated: new Date().toISOString(),
                        userId: this.userId,
                        userEmail: this.userEmail,
                        version: '2.0'
                    };
                    chrome.storage.local.set({
                        [`campaigns_${this.userId}`]: campaignData
                    });
                }
            }
        }, (error) => {
            console.error('❌ Error en listener de campañas:', error);
        });
        
        console.log('✅ Listener de campañas iniciado');
    }
    
    // NUEVO: Detener sincronización en tiempo real de campañas
    stopCampaignRealtimeSync() {
        if (this.campaignRealtimeListener) {
            this.campaignRealtimeListener();
            this.campaignRealtimeListener = null;
            console.log('🔄 Listener de campañas detenido');
        }
    }
    
    // NUEVO: Auto-refresh de campañas
    startCampaignAutoRefresh() {
        // Detener cualquier refresh anterior
        this.stopCampaignAutoRefresh();
        
        console.log('🔄 Iniciando auto-refresh de campañas cada 10 segundos...');
        this.campaignRefreshInterval = setInterval(async () => {
            if (this.isAuthenticated && this.userId && !this.isExecuting) {
                console.log('🔄 Auto-refresh: Recargando campañas...');
                await this.loadCampaigns();
            }
        }, 10000); // Cada 10 segundos (reducido para evitar conflictos)
    }
    
    stopCampaignAutoRefresh() {
        if (this.campaignRefreshInterval) {
            clearInterval(this.campaignRefreshInterval);
            this.campaignRefreshInterval = null;
            console.log('⏹️ Auto-refresh de campañas detenido');
        }
    }

    // NUEVO: Suspender miembro
    async suspendMember(deviceId, memberName) {
        try {
            const days = prompt(`¿Por cuántos días suspender a ${memberName}? (Ej: 1, 7, 30)`);
            if (!days || isNaN(days)) return;
            
            const reason = prompt(`Razón de la suspensión:`) || 'No especificada';
            
            const suspendedUntil = new Date();
            suspendedUntil.setDate(suspendedUntil.getDate() + parseInt(days));
            
            // Agregar a lista de bloqueados
            await this.db.collection('users').doc(this.userId).collection('blockedDevices').doc(deviceId).set({
                name: memberName,
                deviceId: deviceId,
                suspendedUntil: firebase.firestore.Timestamp.fromDate(suspendedUntil),
                reason: reason,
                suspendedAt: firebase.firestore.FieldValue.serverTimestamp(),
                suspendedBy: this.teamMemberName,
                type: 'suspended'
            });
            
            this.addLog(`⏸️ ${memberName} suspendido por ${days} días`, 'warning');
            
            // Recargar datos del equipo
            await this.loadTeamData();
            
        } catch (error) {
            console.error('❌ Error suspendiendo miembro:', error);
            this.addLog('❌ Error suspendiendo miembro', 'error');
        }
    }
    
    // NUEVO: Bloquear miembro permanentemente
    async blockMember(deviceId, memberName) {
        try {
            if (!confirm(`¿Estás seguro de DESPEDIR permanentemente a ${memberName}?`)) {
                return;
            }
            
            const reason = prompt(`Razón del despido:`) || 'No especificada';
            
            // Agregar a lista de bloqueados
            await this.db.collection('users').doc(this.userId).collection('blockedDevices').doc(deviceId).set({
                name: memberName,
                deviceId: deviceId,
                reason: reason,
                blockedAt: firebase.firestore.FieldValue.serverTimestamp(),
                blockedBy: this.teamMemberName,
                type: 'blocked'
            });
            
            // Remover de la lista de miembros activos
            const teamRef = this.db.collection('users').doc(this.userId).collection('teamMembers');
            const snapshot = await teamRef.where('deviceId', '==', deviceId).get();
            
            snapshot.forEach(async (doc) => {
                await doc.ref.delete();
            });
            
            this.addLog(`❌ ${memberName} ha sido despedido`, 'error');
            
            // Recargar datos del equipo
            await this.loadTeamData();
            
        } catch (error) {
            console.error('❌ Error bloqueando miembro:', error);
            this.addLog('❌ Error despidiendo miembro', 'error');
        }
    }
    
    // NUEVO: Reactivar miembro
    async reactivateMember(deviceId) {
        try {
            // Eliminar de la lista de bloqueados
            await this.db.collection('users').doc(this.userId).collection('blockedDevices').doc(deviceId).delete();
            
            console.log(`✅ Miembro ${deviceId} reactivado automáticamente`);
            
        } catch (error) {
            console.error('❌ Error reactivando miembro:', error);
        }
    }
    
    // SISTEMA LIMPIO: Sin necesidad de listeners complejos de storage
    
    // ============================================
    // SISTEMA DE PLANTILLAS DE MENSAJES
    // ============================================
    
    // Cargar plantillas guardadas al inicializar
    async loadMessageTemplates() {
        try {
            const result = await chrome.storage.local.get(['messageTemplates']);
            const templates = result.messageTemplates || [];
            
            const select = document.getElementById('message-templates-select');
            if (!select) return;
            
            // Limpiar opciones existentes (excepto la primera)
            while (select.children.length > 1) {
                select.removeChild(select.lastChild);
            }
            
            // Agregar plantillas
            templates.forEach(template => {
                const option = document.createElement('option');
                option.value = template.id;
                option.textContent = `📝 ${template.name}`;
                select.appendChild(option);
            });
            
            console.log(`📝 ${templates.length} plantillas cargadas`);
        } catch (error) {
            console.error('Error cargando plantillas:', error);
        }
    }
    
    // Guardar nueva plantilla
    async saveMessageTemplate() {
        const messagesTextarea = document.getElementById('campaign-messages');
        if (!messagesTextarea || !messagesTextarea.value.trim()) {
            alert('⚠️ Primero escribe algunos mensajes para guardar como plantilla');
            return;
        }
        
        const templateName = prompt('📝 Nombre para esta plantilla:', 'Mi plantilla');
        if (!templateName || !templateName.trim()) {
            return;
        }
        
        try {
            const result = await chrome.storage.local.get(['messageTemplates']);
            const templates = result.messageTemplates || [];
            
            const newTemplate = {
                id: `template_${Date.now()}`,
                name: templateName.trim(),
                messages: messagesTextarea.value.trim(),
                createdAt: new Date().toISOString(),
                messageCount: messagesTextarea.value.trim().split('\n').filter(m => m.trim()).length
            };
            
            templates.push(newTemplate);
            await chrome.storage.local.set({ messageTemplates: templates });
            
            // Recargar lista
            await this.loadMessageTemplates();
            
            alert(`✅ Plantilla "${templateName}" guardada correctamente`);
            console.log('📝 Plantilla guardada:', newTemplate);
        } catch (error) {
            console.error('Error guardando plantilla:', error);
            alert('❌ Error guardando plantilla');
        }
    }
    
    // Cargar plantilla seleccionada
    async loadTemplate(templateId) {
        if (!templateId) return;
        
        try {
            const result = await chrome.storage.local.get(['messageTemplates']);
            const templates = result.messageTemplates || [];
            const template = templates.find(t => t.id === templateId);
            
            if (!template) {
                alert('❌ Plantilla no encontrada');
                return;
            }
            
            const messagesTextarea = document.getElementById('campaign-messages');
            if (messagesTextarea) {
                messagesTextarea.value = template.messages;
                console.log(`📝 Plantilla "${template.name}" cargada`);
            }
        } catch (error) {
            console.error('Error cargando plantilla:', error);
            alert('❌ Error cargando plantilla');
        }
    }
    
    // Mostrar gestor de plantillas
    async showTemplateManager() {
        const modal = document.getElementById('template-manager-modal');
        if (!modal) return;
        
        modal.classList.remove('hidden');
        await this.refreshTemplatesList();
        
        // Asegurar que el event listener del botón "Nueva" esté configurado
        setTimeout(() => {
            const addNewTemplateBtn = document.getElementById('add-new-template-btn');
            if (addNewTemplateBtn && !addNewTemplateBtn.hasAttribute('data-listener-added')) {
                addNewTemplateBtn.addEventListener('click', () => {
                    this.createNewTemplate();
                });
                addNewTemplateBtn.setAttribute('data-listener-added', 'true');
                console.log('✅ Event listener agregado al botón Nueva plantilla');
            }
        }, 100);
    }
    
    // Ocultar gestor de plantillas
    hideTemplateManager() {
        const modal = document.getElementById('template-manager-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }
    
    // Actualizar lista de plantillas en el gestor
    async refreshTemplatesList() {
        try {
            const result = await chrome.storage.local.get(['messageTemplates']);
            const templates = result.messageTemplates || [];
            
            const templatesList = document.getElementById('templates-list');
            if (!templatesList) return;
            
            if (templates.length === 0) {
                templatesList.innerHTML = '<div class="no-templates">📝 No hay plantillas guardadas<br><small>Crea tu primera plantilla haciendo clic en "Nueva Plantilla"</small></div>';
                return;
            }
            
            templatesList.innerHTML = templates.map(template => {
                const preview = template.messages.split('\n')[0].substring(0, 60);
                const previewText = preview.length < template.messages.split('\n')[0].length ? preview + '...' : preview;
                
                return `
                <div class="template-item" data-template-id="${template.id}">
                    <div class="template-header">
                        <span class="template-name">${template.name}</span>
                        <div class="template-actions-list">
                            <button class="template-action-btn edit" data-template-id="${template.id}" title="Editar plantilla">✏️ Editar</button>
                            <button class="template-action-btn delete" data-template-id="${template.id}" title="Eliminar plantilla">🗑️ Eliminar</button>
                        </div>
                    </div>
                    <div class="template-preview">
                        <strong>${template.messageCount} mensajes</strong> • Creada: ${new Date(template.createdAt).toLocaleDateString()}
                        <br><em>"${previewText}"</em>
                    </div>
                </div>
                `;
            }).join('');
            
            // Agregar event listeners a los botones
            this.attachTemplateActionListeners();
            
        } catch (error) {
            console.error('Error actualizando lista de plantillas:', error);
        }
    }
    
    // Agregar event listeners a los botones de acción
    attachTemplateActionListeners() {
        // Botones de editar
        document.querySelectorAll('.template-action-btn.edit').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const templateId = btn.getAttribute('data-template-id');
                this.showTemplateEditor(templateId);
            });
        });
        
        // Botones de eliminar
        document.querySelectorAll('.template-action-btn.delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const templateId = btn.getAttribute('data-template-id');
                this.deleteTemplate(templateId);
            });
        });
    }
    
    
    // Eliminar plantilla
    async deleteTemplate(templateId) {
        try {
            const result = await chrome.storage.local.get(['messageTemplates']);
            const templates = result.messageTemplates || [];
            const template = templates.find(t => t.id === templateId);
            
            if (!template) {
                alert('❌ Plantilla no encontrada');
                return;
            }
            
            if (!confirm(`¿Estás seguro de eliminar la plantilla "${template.name}"?`)) {
                return;
            }
            
            // Remover plantilla
            const updatedTemplates = templates.filter(t => t.id !== templateId);
            await chrome.storage.local.set({ messageTemplates: updatedTemplates });
            
            // Actualizar listas
            await this.loadMessageTemplates();
            await this.refreshTemplatesList();
            
            alert(`✅ Plantilla "${template.name}" eliminada correctamente`);
        } catch (error) {
            console.error('Error eliminando plantilla:', error);
            alert('❌ Error eliminando plantilla');
        }
    }
    
    // Crear nueva plantilla desde el gestor
    async createNewTemplate() {
        this.showTemplateEditor();
    }
    
    // Mostrar editor de plantillas (crear o editar)
    async showTemplateEditor(templateId = null) {
        const modal = document.getElementById('template-editor-modal');
        const title = document.getElementById('template-editor-title');
        const nameInput = document.getElementById('template-editor-name');
        const messagesTextarea = document.getElementById('template-editor-messages');
        
        if (!modal || !title || !nameInput || !messagesTextarea) return;
        
        // Configurar modal según si es edición o creación
        if (templateId) {
            // Modo edición
            title.textContent = 'Editar Plantilla';
            const result = await chrome.storage.local.get(['messageTemplates']);
            const templates = result.messageTemplates || [];
            const template = templates.find(t => t.id === templateId);
            
            if (template) {
                nameInput.value = template.name;
                messagesTextarea.value = template.messages;
                this.updateMessageCounter();
            }
        } else {
            // Modo creación
            title.textContent = 'Nueva Plantilla';
            nameInput.value = '';
            messagesTextarea.value = '';
            this.updateMessageCounter();
        }
        
        // Guardar el ID de la plantilla en el modal para referencia
        modal.setAttribute('data-template-id', templateId || '');
        
        modal.classList.remove('hidden');
        
        // Configurar event listeners del editor
        this.setupTemplateEditorListeners();
    }
    
    // Configurar event listeners del editor
    setupTemplateEditorListeners() {
        const messagesTextarea = document.getElementById('template-editor-messages');
        const saveBtn = document.getElementById('save-template-editor-btn');
        const cancelBtn = document.getElementById('cancel-template-editor-btn');
        const closeBtn = document.getElementById('close-template-editor-btn');
        
        // Contador de mensajes en tiempo real
        if (messagesTextarea && !messagesTextarea.hasAttribute('data-listener-added')) {
            messagesTextarea.addEventListener('input', () => {
                this.updateMessageCounter();
            });
            messagesTextarea.setAttribute('data-listener-added', 'true');
        }
        
        // Botón guardar
        if (saveBtn && !saveBtn.hasAttribute('data-listener-added')) {
            saveBtn.addEventListener('click', () => {
                this.saveTemplateFromEditor();
            });
            saveBtn.setAttribute('data-listener-added', 'true');
        }
        
        // Botón cancelar
        if (cancelBtn && !cancelBtn.hasAttribute('data-listener-added')) {
            cancelBtn.addEventListener('click', () => {
                this.hideTemplateEditor();
            });
            cancelBtn.setAttribute('data-listener-added', 'true');
        }
        
        // Botón cerrar
        if (closeBtn && !closeBtn.hasAttribute('data-listener-added')) {
            closeBtn.addEventListener('click', () => {
                this.hideTemplateEditor();
            });
            closeBtn.setAttribute('data-listener-added', 'true');
        }
    }
    
    // Actualizar contador de mensajes
    updateMessageCounter() {
        const messagesTextarea = document.getElementById('template-editor-messages');
        const counter = document.getElementById('message-count');
        
        if (messagesTextarea && counter) {
            const messages = messagesTextarea.value.split('\n').filter(m => m.trim()).length;
            counter.textContent = messages;
        }
    }
    
    // Guardar plantilla desde el editor
    async saveTemplateFromEditor() {
        const modal = document.getElementById('template-editor-modal');
        const nameInput = document.getElementById('template-editor-name');
        const messagesTextarea = document.getElementById('template-editor-messages');
        
        if (!nameInput || !messagesTextarea) return;
        
        const name = nameInput.value.trim();
        const messages = messagesTextarea.value.trim();
        
        if (!name || !messages) {
            alert('⚠️ Por favor completa el nombre y los mensajes de la plantilla');
            return;
        }
        
        try {
            const result = await chrome.storage.local.get(['messageTemplates']);
            const templates = result.messageTemplates || [];
            const templateId = modal.getAttribute('data-template-id');
            
            if (templateId) {
                // Editar plantilla existente
                const templateIndex = templates.findIndex(t => t.id === templateId);
                if (templateIndex !== -1) {
                    templates[templateIndex] = {
                        ...templates[templateIndex],
                        name: name,
                        messages: messages,
                        messageCount: messages.split('\n').filter(m => m.trim()).length,
                        updatedAt: new Date().toISOString()
                    };
                }
            } else {
                // Crear nueva plantilla
                const newTemplate = {
                    id: `template_${Date.now()}`,
                    name: name,
                    messages: messages,
                    createdAt: new Date().toISOString(),
                    messageCount: messages.split('\n').filter(m => m.trim()).length
                };
                templates.push(newTemplate);
            }
            
            await chrome.storage.local.set({ messageTemplates: templates });
            
            // Actualizar listas
            await this.loadMessageTemplates();
            await this.refreshTemplatesList();
            
            // Cerrar modal
            this.hideTemplateEditor();
            
            const action = templateId ? 'actualizada' : 'creada';
            alert(`✅ Plantilla "${name}" ${action} correctamente`);
            
        } catch (error) {
            console.error('Error guardando plantilla:', error);
            alert('❌ Error guardando plantilla');
        }
    }
    
    // Ocultar editor de plantillas
    hideTemplateEditor() {
        const modal = document.getElementById('template-editor-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }
}

// NUEVO: Objeto global para manejar administración de equipo
window.teamManager = null;



// ELIMINADO: Inicialización duplicada que causaba logs dobles