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
                    await this.addMember(request.payload?.email, request.payload?.role);
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
            if (!datos) {
                const estructura = { owner: '', members: [] };
                await this.writeTeamStorage(estructura);
                console.log('⚙️  md outbound: almacenamiento de equipo inicializado.');
            }
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

    async addMember(email, role) {
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

        const actualizados = {
            owner: datos.owner,
            members: [...datos.members, { email: limpio, role: role || 'member' }]
        };

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
        await this.writeTeamStorage({ owner: datos.owner, members: filtrados });
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
                return { ...miembro, role: 'owner' };
            }
            if (miembro.role === 'owner') {
                return { ...miembro, role: 'admin' };
            }
            return miembro;
        });

        const existe = miembrosActualizados.some(miembro => miembro.email === limpio);
        if (!existe) {
            miembrosActualizados.push({ email: limpio, role: 'owner' });
        }

        await this.writeTeamStorage({
            owner: limpio,
            members: miembrosActualizados
        });
    }

    normalizeTeamData(data) {
        const owner = typeof data.owner === 'string' ? data.owner.trim().toLowerCase() : '';
        const members = Array.isArray(data.members) ? data.members : [];

        const lista = members
            .filter(item => item && typeof item.email === 'string')
            .map(item => ({
                email: item.email.trim().toLowerCase(),
                role: ['owner', 'admin', 'member'].includes(item.role) ? item.role : 'member'
            }));

        const resultado = { owner, members: lista };

        if (owner && !lista.some(miembro => miembro.email === owner)) {
            resultado.members.push({ email: owner, role: 'owner' });
        } else {
            resultado.members = resultado.members.map(miembro => {
                if (miembro.email === owner) {
                    return { ...miembro, role: 'owner' };
                }
                if (miembro.role === 'owner') {
                    return { ...miembro, role: 'admin' };
                }
                return miembro;
            });
        }

        return resultado;
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