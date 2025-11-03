// Background Script simplificado para Instagram DM Bot Simple
class InstagramBackgroundScript {
    constructor() {
        this.init();
    }

    init() {
        // Escuchar mensajes del popup
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            this.handleMessage(request, sender, sendResponse);
            return true; // Mantener canal abierto para respuestas asíncronas
        });

        console.log('Background script inicializado');
    }

    async handleMessage(request, sender, sendResponse) {
        try {
            console.log('Mensaje recibido:', request.action);
            
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
}

// Inicializar el background script
console.log('Inicializando Instagram Background Script...');

try {
    const backgroundScript = new InstagramBackgroundScript();
    console.log('✅ Background script inicializado correctamente');
} catch (error) {
    console.error('❌ Error inicializando background script:', error);
} 