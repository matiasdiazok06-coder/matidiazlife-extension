// Background Script simplificado para md outbound
class MdOutboundBackgroundScript {
    constructor() {
        this.TEAM_STORAGE_KEY = 'matidiaz_members';
        this.init();
    }

    init() {
        // Escuchar mensajes del popup
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            this.handleMessage(request, sender, sendResponse);
            return true; // Mantener canal abierto para respuestas asíncronas
        });

        this.initializeTeamStorage();

        console.log('Background script de md outbound inicializado');
    }

    async handleMessage(request, sender, sendResponse) {
        try {
            console.log('Mensaje recibido en background:', request.action);

            switch (request.action) {
                case 'test':
                    sendResponse({ success: true, message: 'Background script funcionando correctamente' });
                    break;

                case 'incrementMessageCounters':
                    console.log('📈 Background recibió: incrementMessageCounters');
                    // NO reenviar - el content ya se conecta directamente al popup
                    sendResponse({
                        success: true,
                        message: 'Background procesado (sin reenvío)'
                    });
                    break;

                case 'counterUpdated':
                    console.log('🔄 Background recibió: counterUpdated - Broadcasting...');
                    // Reenviar a todas las extensiones abiertas
                    this.broadcastToAllExtensions(request);
                    sendResponse({ success: true });
                    break;
                    
                case 'campaignProgress':
                    console.log('📈 Background recibió: campaignProgress - Reenviando al popup...');
                    // Simplemente pasar el mensaje - el popup lo manejará si está abierto
                    try {
                        chrome.runtime.sendMessage(request);
                        sendResponse({ success: true, message: 'campaignProgress reenviado' });
                    } catch (error) {
                        sendResponse({ success: true, message: 'campaignProgress enviado (popup posiblemente cerrado)' });
                    }
                    break;

                case 'matidiaz_getMembers':
                    sendResponse({ success: true, data: await this.getMembers() });
                    break;

                case 'matidiaz_addMember':
                    await this.addMember(
                        request.payload?.email,
                        request.payload?.role,
                        request.payload?.messageLimit
                    );
                    sendResponse({ success: true });
                    break;

                case 'matidiaz_removeMember':
                    await this.removeMember(request.payload?.email);
                    sendResponse({ success: true });
                    break;

                case 'matidiaz_setOwner':
                    await this.setOwner(request.payload?.email);
                    sendResponse({ success: true });
                    break;

                case 'matidiaz_validateCredential':
                    sendResponse({ success: true, data: await this.validateCredential(request.payload) });
                    break;

                default:
                    sendResponse({ success: false, error: 'Acción no reconocida' });
            }
        } catch (error) {
            console.error('Error en background script:', error);
            sendResponse({ success: false, error: error.message });
        }
    }
    
    async forwardToPopup(request, sendResponse) {
        console.log('🔄 Background: Intentando reenviar al popup...');
        
        try {
            // En Manifest V3, usamos chrome.runtime.sendMessage directamente
            // El background script simplemente reenvía el mensaje
            console.log('✅ Background: Reenviando mensaje al popup...');
            
            // En lugar de usar getViews(), enviamos un mensaje broadcast
            // que el popup puede escuchar si está abierto
            chrome.runtime.sendMessage({
                action: 'incrementMessageCountersFromBackground',
                originalRequest: request
            }).then(response => {
                console.log('✅ Background: Respuesta del popup:', response);
                sendResponse(response);
            }).catch(error => {
                console.log('⚠️ Background: Popup no disponible, manejando localmente');
                // Si el popup no está abierto, devolver error
                sendResponse({ 
                    success: false, 
                    error: 'Popup no está abierto. Abre la extensión para que los contadores funcionen.' 
                });
            });
        } catch (error) {
            console.error('❌ Background: Error:', error);
            sendResponse({ success: false, error: error.message });
        }
    }
    
    // NUEVO: Broadcast a todas las pestañas/extensiones abiertas
    async broadcastToAllExtensions(message) {
        try {
            console.log('📡 Broadcasting a todas las extensiones:', message.action);

            // Obtener todas las pestañas
            const tabs = await chrome.tabs.query({});

            // Enviar mensaje a todas las pestañas que tengan la extensión
            for (const tab of tabs) {
                try {
                    // Intentar enviar mensaje a cada pestaña
                    await chrome.tabs.sendMessage(tab.id, {
                        action: 'counterSyncFromBackground',
                        data: message
                    });
                    console.log(`📡 Mensaje enviado a pestaña ${tab.id}`);
                } catch (tabError) {
                    // La pestaña no tiene nuestra extensión o no está lista, ignorar
                    // console.log(`⚠️ No se pudo enviar a pestaña ${tab.id}`);
                }
            }
            
            // También broadcast via runtime para otros contextos de la extensión
            chrome.runtime.sendMessage(message).catch(() => {
                // Ignorar errores si no hay listeners
            });
            
            console.log('✅ Broadcast completado');
        } catch (error) {
            console.error('❌ Error en broadcast:', error);
        }
    }

    async initializeTeamStorage() {
        try {
            const datos = await this.readTeamStorage();
            const estructura = this.normalizeTeamData(datos || {});
            await this.writeTeamStorage(estructura);
            console.log('⚙️  md outbound: almacenamiento de equipo inicializado.');
        } catch (error) {
            console.error('❌ Error inicializando el equipo de md outbound:', error);
        }
    }

    async getMembers() {
        // Si la extensión interactúa con un backend remoto, replicar esta consulta allí.
        const datos = await this.readTeamStorage();
        const estructura = this.normalizeTeamData(datos || {});
        return estructura;
    }

    async addMember(email, role, messageLimit) {
        if (!email) {
            throw new Error('El email es obligatorio para agregar miembros.');
        }
        const limpio = email.trim().toLowerCase();
        if (!limpio) {
            throw new Error('El email no puede estar vacío.');
        }

        const datos = await this.getMembers();
        const yaExiste = datos.members.some(miembro => miembro.email === limpio);
        if (yaExiste) {
            throw new Error('El email ya está registrado en el equipo.');
        }

        if (role === 'owner') {
            await this.setOwner(limpio);
            return;
        }

        const credencialesUsadas = new Set(datos.members.map(miembro => miembro.credential).filter(Boolean));
        const credential = this.generateUniqueCredential(credencialesUsadas);

        const limit = this.normalizeMessageLimit(messageLimit, role);

        const actualizados = this.normalizeTeamData({
            owner: datos.owner,
            members: [
                ...datos.members,
                { email: limpio, role: role || 'member', credential, messageLimit: limit }
            ]
        });

        await this.writeTeamStorage(actualizados);
    }

    async removeMember(email) {
        if (!email) {
            throw new Error('El email es obligatorio para eliminar miembros.');
        }
        const limpio = email.trim().toLowerCase();
        const datos = await this.getMembers();

        if (datos.owner && datos.owner.toLowerCase() === limpio) {
            throw new Error('No se puede eliminar al owner actual.');
        }

        const filtrados = datos.members.filter(miembro => miembro.email !== limpio);
        await this.writeTeamStorage(this.normalizeTeamData({ owner: datos.owner, members: filtrados }));
    }

    async setOwner(email) {
        // IMPORTANTE: si existe sincronización con servidor, asegurar que el owner se actualice también en el backend.
        if (!email) {
            throw new Error('Ingresá un email válido para asignar owner.');
        }

        const limpio = email.trim().toLowerCase();
        const datos = await this.getMembers();

        const miembrosActualizados = datos.members.map(miembro => {
            if (miembro.email === limpio) {
                return { ...miembro, role: 'owner', messageLimit: null };
            }
            if (miembro.role === 'owner') {
                return {
                    ...miembro,
                    role: 'admin',
                    messageLimit: this.normalizeMessageLimit(miembro.messageLimit, 'admin')
                };
            }
            return {
                ...miembro,
                messageLimit: this.normalizeMessageLimit(miembro.messageLimit, miembro.role)
            };
        });

        const existe = miembrosActualizados.some(miembro => miembro.email === limpio);
        if (!existe) {
            const credencialesUsadas = new Set(miembrosActualizados.map(miembro => miembro.credential).filter(Boolean));
            miembrosActualizados.push({
                email: limpio,
                role: 'owner',
                credential: this.generateUniqueCredential(credencialesUsadas),
                messageLimit: null
            });
        }

        const estructura = this.normalizeTeamData({
            owner: limpio,
            members: miembrosActualizados
        });

        await this.writeTeamStorage(estructura);
    }

    normalizeTeamData(data) {
        const owner = typeof data.owner === 'string' ? data.owner.trim().toLowerCase() : '';
        const members = Array.isArray(data.members) ? data.members : [];

        const credencialesUsadas = new Set();

        const lista = members
            .filter(item => item && typeof item.email === 'string')
            .map(item => {
                const email = item.email.trim().toLowerCase();
                const role = ['owner', 'admin', 'member'].includes(item.role) ? item.role : 'member';
                let credential = typeof item.credential === 'string' ? item.credential.trim().toUpperCase() : '';
                if (!credential || credencialesUsadas.has(credential)) {
                    credential = this.generateUniqueCredential(credencialesUsadas);
                } else {
                    credencialesUsadas.add(credential);
                }
                const messageLimit = this.normalizeMessageLimit(item.messageLimit, role);
                return { email, role, credential, messageLimit };
            });

        const resultado = { owner, members: lista };

        if (owner && !lista.some(miembro => miembro.email === owner)) {
            resultado.members.push({
                email: owner,
                role: 'owner',
                credential: this.generateUniqueCredential(credencialesUsadas),
                messageLimit: null
            });
        } else {
            resultado.members = resultado.members.map(miembro => {
                if (miembro.email === owner) {
                    return { ...miembro, role: 'owner', messageLimit: null };
                }
                if (miembro.role === 'owner') {
                    return {
                        ...miembro,
                        role: 'admin',
                        messageLimit: this.normalizeMessageLimit(miembro.messageLimit, 'admin')
                    };
                }
                return {
                    ...miembro,
                    messageLimit: this.normalizeMessageLimit(miembro.messageLimit, miembro.role)
                };
            });
        }

        return resultado;
    }

    generateUniqueCredential(conjunto) {
        const existentes = conjunto instanceof Set ? conjunto : new Set();
        let credencial = '';
        const caracteres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let intentos = 0;
        do {
            let aleatorio = '';
            for (let i = 0; i < 6; i += 1) {
                const indice = Math.floor(Math.random() * caracteres.length);
                aleatorio += caracteres.charAt(indice);
            }
            const anio = new Date().getFullYear();
            credencial = `MATI-${aleatorio}-${anio}`;
            intentos += 1;
        } while (existentes.has(credencial) && intentos < 50);
        existentes.add(credencial);
        return credencial;
    }

    async validateCredential(payload = {}) {
        const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
        const credential = typeof payload.credential === 'string' ? payload.credential.trim().toUpperCase() : '';
        const datos = await this.getMembers();

        if (!email) {
            return { valid: false, reason: 'Debés registrar tu email en la página de opciones.' };
        }

        if (datos.owner && datos.owner.toLowerCase() === email) {
            return { valid: true, ownerBypass: true };
        }

        const miembro = datos.members.find(item => item.email === email);

        if (!miembro) {
            return { valid: false, reason: 'Tu email no figura en el equipo configurado.' };
        }

        if (!miembro.credential) {
            return { valid: false, reason: 'El owner aún no generó tu credencial.' };
        }

        if (!credential) {
            return { valid: false, reason: 'Ingresá tu credencial local en la página de opciones.' };
        }

        if (miembro.credential !== credential) {
            return { valid: false, reason: 'La credencial proporcionada no coincide con la registrada.' };
        }

        return { valid: true, ownerBypass: false };
    }

    normalizeMessageLimit(value, role) {
        if (role === 'owner') {
            return null;
        }

        if (typeof value === 'number' && Number.isFinite(value)) {
            return value < 0 ? null : Math.floor(value);
        }

        if (typeof value === 'string' && value.trim() !== '') {
            const parsed = Number(value.trim());
            if (Number.isFinite(parsed)) {
                return parsed < 0 ? null : Math.floor(parsed);
            }
        }

        return null;
    }

    readTeamStorage() {
        return new Promise((resolve, reject) => {
            try {
                chrome.storage.local.get(this.TEAM_STORAGE_KEY, (resultado) => {
                    const error = chrome.runtime.lastError;
                    if (error) {
                        reject(new Error(`No se pudo leer ${this.TEAM_STORAGE_KEY}: ${error.message}`));
                        return;
                    }
                    resolve(resultado[this.TEAM_STORAGE_KEY]);
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    writeTeamStorage(datos) {
        return new Promise((resolve, reject) => {
            try {
                chrome.storage.local.set({ [this.TEAM_STORAGE_KEY]: datos }, () => {
                    const error = chrome.runtime.lastError;
                    if (error) {
                        reject(new Error(`No se pudo guardar ${this.TEAM_STORAGE_KEY}: ${error.message}`));
                        return;
                    }
                    resolve(true);
                });
            } catch (error) {
                reject(error);
            }
        });
    }
}

// Inicializar el background script
console.log('Inicializando background de md outbound...');

try {
    const backgroundScript = new MdOutboundBackgroundScript();
    console.log('✅ Background script de md outbound inicializado correctamente');
} catch (error) {
    console.error('❌ Error inicializando background script:', error);
}