// Instagram Bot Content Script v2.0 - Sistema Robusto de Destacadas
(function() {
    if (typeof window.SCRIPT_INSTANCE_ID !== 'undefined') {
        console.log('⚠️ Content script ya está cargado, evitando duplicación');
        return;
    }

const SCRIPT_INSTANCE_ID = `script_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
window.SCRIPT_INSTANCE_ID = SCRIPT_INSTANCE_ID;
console.log(`🚀 Instagram Bot Content Script v2.0 iniciando... [ID: ${SCRIPT_INSTANCE_ID}]`);

// SISTEMA BRUTAL: SOLO UNA INSTANCIA ACTIVA
console.log(`🎯 Registrando como instancia MAESTRA: ${SCRIPT_INSTANCE_ID}`);

// Forzar que SOY la instancia más reciente
window.LATEST_SCRIPT_ID = SCRIPT_INSTANCE_ID;
window.CONTENT_SCRIPT_ID = SCRIPT_INSTANCE_ID;

// Bloquear todas las instancias anteriores
if (window.ALL_INSTANCES) {
    console.log(`🚫 Bloqueando ${window.ALL_INSTANCES.length} instancias anteriores`);
    window.ALL_INSTANCES.forEach(oldId => {
        if (oldId !== SCRIPT_INSTANCE_ID) {
            console.log(`💀 Bloqueando instancia: ${oldId}`);
        }
    });
} else {
    window.ALL_INSTANCES = [];
}

// Registrar mi instancia
window.ALL_INSTANCES.push(SCRIPT_INSTANCE_ID);
console.log(`📋 Instancias registradas: ${window.ALL_INSTANCES.length} | Activa: ${SCRIPT_INSTANCE_ID}`);

// Formatear el progreso de mensajes respetando si existe un límite definido
const formatLimitProgress = (count, limit) => {
    const progreso = Number.isFinite(count) && count >= 0 ? Math.floor(count) : 0;
    if (Number.isFinite(limit) && limit > 0) {
        return `${progreso}/${Math.floor(limit)}`;
    }
    return `${progreso} mensajes`;
};

// Estado global del bot
const InstagramBot = {
    isActive: false,
    isStopping: false,  // NUEVO: Flag para evitar loops infinitos
    currentCampaign: null,
    currentUserIndex: 0,
    retryCount: 0,
    maxRetries: 3,
    
    // Selectores actualizados para Instagram 2024
    selectors: {
        highlights: [
            // SELECTORES EXACTOS DE INSTAGRAM (basados en XPath real)
            'ul._acay li._acaz', // Lista de destacadas exacta
            'ul._acay li._acaz div[class*="x1i10hfl"]', // Elemento clickeable específico
            'img.xz74otr.x15mokao.x1ga7v0g.x16uus16.xbiv7yw', // Imagen de destacada exacta
            'div.x1i10hfl.xjbqb8w.xjqpnuy.xc5r6h4.xqeqjp1', // Div clickeable específico
            // Selectores padre del elemento clickeable
            'ul._acay li div[class*="x1i10hfl"][class*="xjbqb8w"]',
            'div[class*="xnz67gz"][class*="x1c9tyrk"] img[class*="xz74otr"]',
            // Selectores tradicionales (fallback)
            'a[href*="/stories/highlights/"]',
            'div[role="button"][aria-label*="highlight"]',
            'button[aria-label*="highlight"]',
            'div[data-testid="highlight"]',
            // Selectores más específicos basados en la estructura actual
            'div._ac69 a[href*="/stories/highlights/"]', // Estructura común de highlights
            'div[style*="width: 77px"] a[href*="/stories/highlights/"]', // Tamaño específico de highlights
            'div[class*="highlight"] a',
            'a[role="link"][href*="/stories/highlights/"]',
            // Selectores alternativos
            'section div div div div a[href*="/stories/highlights/"]',
            'div[style*="border-radius"] a[href*="/stories/highlights/"]',
            // Selectores más genéricos
            'main a[href*="/stories/highlights/"]',
            'article a[href*="/stories/highlights/"]'
        ],
        storyReplyButton: [
            // SELECTOR EXACTO DE INSTAGRAM STORIES - TEXTAREA CLICKEABLE (basado en XPath real)
            'textarea.x1i10hfl.xjbqb8w.x972fbf.x10w94by.x1qhh985.x14e42zd.x7e90pr.x2fvf9.x1a2a7pz.xw2csxc.x1odjw0f.x1y1aw1k.xrw5ot4.xwib8y2.x7coems.xtt52l0.xh8yej3.xomwbyg',
            // Selectores alternativos para textarea clickeable
            'div[class*="x6s0dn4"][class*="xl4qmuc"] textarea',
            'div[class*="x78zum5"][class*="x3ieub6"] textarea',
            'textarea[class*="x1i10hfl"][class*="xjbqb8w"]',
            // Selectores tradicionales (fallback)
            'button[aria-label*="Send message"]',
            'button[aria-label*="Enviar mensaje"]',
            'button[aria-label*="Message"]',
            'div[role="button"][aria-label*="Message"]',
            'svg[aria-label*="Direct"]',
            'button:has(svg[aria-label*="Direct"])',
            // Selectores genéricos de textarea
            'textarea[placeholder*="Reply"]',
            'textarea[placeholder*="Message"]',
            'textarea'
        ],
        messageInput: [
            // SELECTOR EXACTO DE INSTAGRAM STORIES (basado en XPath real)
            'textarea.x1i10hfl.xjbqb8w.x972fbf.x10w94by.x1qhh985.x14e42zd.x7e90pr.x2fvf9.x1a2a7pz.xw2csxc.x1odjw0f.x1y1aw1k.xrw5ot4.xwib8y2.x7coems.xtt52l0.xh8yej3.xomwbyg',
            // Selectores alternativos para textarea en stories
            'textarea[class*="x1i10hfl"][class*="xjbqb8w"]',
            'div[class*="x6s0dn4"][class*="xl4qmuc"] textarea',
            'div[class*="x78zum5"][class*="x3ieub6"] textarea',
            'div[class*="x12svp7l"] textarea',
            // Selectores tradicionales (fallback)
            'textarea[placeholder*="Message"]',
            'textarea[placeholder*="Mensaje"]',
            'div[contenteditable="true"][aria-label*="Message"]',
            'div[contenteditable="true"][data-testid="message-input"]',
            'textarea[data-testid="message-input"]',
            // Selectores más genéricos
            'textarea',
            'div[contenteditable="true"]'
        ],
        sendButton: [
            // SELECTOR EXACTO DE INSTAGRAM STORIES (basado en XPath real)
            'div.x1i10hfl.x972fbf.x10w94by.x1qhh985.x14e42zd.x9f619.xe8uvvx.xdj266r.x14z9mp.xat24cr.x1lziwak.x16tdsg8.x1hl2dhg.xggy1nq.x1a2a7pz.x6s0dn4.xjbqb8w.x1ejq31n.x18oe1m7.x1sy0etr.xstzfhl.x1ypdohk.x78zum5.xl56j7k.x1y1aw1k.xf159sx.xwib8y2.xmzvs34.xcdnw81',
            // Selectores alternativos para el botón de envío
            'div[class*="x1i10hfl"][class*="x972fbf"] svg',
            'div[class*="x6s0dn4"][class*="x78zum5"][class*="xdt5ytf"] svg',
            'div[class*="x78zum5"][class*="xvc5jky"] div[class*="x1i10hfl"]',
            'svg[class*="SVGAnimatedString"]',
            // Selectores más genéricos
            'div[class*="x1i10hfl"][class*="xjbqb8w"] svg',
            'div[role="button"] svg',
            // Selectores tradicionales (fallback)
            'button[type="submit"]',
            'button[aria-label*="Send"]',
            'button[aria-label*="Enviar"]',
            'div[role="button"][tabindex="0"]:has(svg)',
            'button:has(svg[aria-label*="Send"])'
        ],
        storyCloseButton: [
            'button[aria-label*="Close"]',
            'button[aria-label*="Cerrar"]',
            'svg[aria-label*="Close"]',
            'button:has(svg[aria-label*="Close"])'
        ]
    }
};

// Prevenir múltiples inicializaciones
if (window.instagramBotActive) {
    console.log('⚠️ Bot ya está activo, ignorando nueva inicialización');
} else {
    window.instagramBotActive = true;
    console.log('✅ Bot inicializado correctamente');

    // Listener principal
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        console.log('📨 Mensaje recibido:', request.action);

                switch (request.action) {
            case 'ping':
                // Responder para verificar que el content script está activo
                sendResponse({ pong: true, active: true });
                return true; // Indicar que enviamos respuesta
                
            case 'executeCampaign':
            console.log('🎯 Iniciando campaña:', request.campaign.name);
                // NUEVO: Pasar deviceId, userId y teamMemberName
                InstagramBot.executeCampaign(request.campaign, request.deviceId, request.userId, request.teamMemberName);
                sendResponse({ success: true, message: 'Campaña iniciada correctamente' });
                return true; // Indicar que enviamos respuesta
            
            case 'stopCampaign':
                InstagramBot.stopCampaign();
                sendResponse({ success: true, message: 'Campaña detenida' });
                return true; // Indicar que enviamos respuesta
            
            case 'pauseCampaign':
                InstagramBot.pauseCampaign();
                sendResponse({ success: true, message: 'Campaña pausada' });
                return true; // Indicar que enviamos respuesta
                
            case 'getStatus':
                sendResponse({ 
                    success: true, 
                    isActive: InstagramBot.isActive,
                    currentCampaign: InstagramBot.currentCampaign?.name || null,
                    currentUserIndex: InstagramBot.currentUserIndex,
                    currentUrl: window.location.href
                });
                return true; // Indicar que enviamos respuesta
                
            case 'diagnose':
                InstagramBot.diagnose();
                sendResponse({ success: true, message: 'Diagnóstico ejecutado (ver consola)' });
                return true; // Indicar que enviamos respuesta
                
            default:
                console.log('📨 CONTENT: Mensaje no para mí, ignorando:', request.action);
                // NO enviar respuesta para que otros listeners puedan manejar el mensaje
                return false; // No interceptar el mensaje
        }
    });
}

// Métodos principales del bot
InstagramBot.executeCampaign = async function(campaign, deviceId, userId, teamMemberName) {
    console.log(`🚀 ===== EJECUTANDO CAMPAÑA [${SCRIPT_INSTANCE_ID}] =====`);
    
    // NUEVO: Guardar deviceId, userId y teamMemberName para usar en updateProgress
    this.currentDeviceId = deviceId;
    this.currentUserId = userId;
    this.teamMemberName = teamMemberName || 'Usuario';
    
    // Información de campaña
    console.log(`📱 Device ID: ${deviceId}, User ID: ${userId}, Team Member: ${this.teamMemberName}`);
    
    // Detener cualquier campaña anterior
    if (this.isActive) {
        console.log('⚠️ Deteniendo campaña anterior');
        this.isActive = false;
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    this.isActive = true;
    this.currentCampaign = campaign;
    this.currentUserIndex = 0;

    console.log(`🎯 Campaña: ${campaign.name}`);
    console.log(`👥 Usuarios: ${campaign.users.length}`);
    console.log(`💬 Mensajes: ${campaign.messages.length}`);
    
    // Delay configurado
    const delayReceived = campaign.delay || 30;
    await this.sendLogToPopup(`⏰ Delay configurado: ${delayReceived} segundos`, 'info');
    console.log(`⏰ Delay configurado: ${delayReceived} segundos [${SCRIPT_INSTANCE_ID}]`);

    try {
    for (let i = 0; i < campaign.users.length; i++) {
            if (!this.isActive) {
                console.log('⏹️ Campaña detenida por el usuario');
                break;
            }

            this.currentUserIndex = i;
        // MEJORADO: Solo procesar usuarios pendientes
        const user = campaign.users[i];
        
        // Saltar usuarios ya completados
        if (user.status === 'completed') {
            console.log(`⏭️ [SKIP] @${user.username} ya fue completado anteriormente`);
            continue;
        }
        
        const message = campaign.messages[i % campaign.messages.length];
        const pendingCount = campaign.users.filter(u => u.status !== 'completed').length;

        console.log(`\n📤 [${i + 1}/${campaign.users.length}] Procesando @${user.username} (${pendingCount} pendientes)`);

        const result = await this.processUser(user.username, message);
            
            if (result === 'skip') {
                await this.sendLogToPopup(`⏭️ [SKIP] Usuario @${user.username} saltado, continuando...`, 'info');
                await this.updateProgress(campaign.id, user.username, false);
                
                // ARREGLADO: NO aplicar delay cuando se salta usuario
                await this.sendLogToPopup(`⚡ [SKIP] Sin delay - Continuando inmediatamente al siguiente usuario`, 'info');
                continue; // Continuar inmediatamente sin delay
            } else {
                const success = result === true;
                await this.updateProgress(campaign.id, user.username, success);
                
                // ARREGLADO: Solo aplicar delay cuando el mensaje fue enviado exitosamente
                if (success) {
                    // Delay entre usuarios (excepto el último)
                    if (i < campaign.users.length - 1 && this.isActive) {
                        const campaignDelay = campaign.delay || 30;
                        await this.sendLogToPopup(`⏰ [DELAY] Configurado: ${campaignDelay}s entre usuarios`, 'info');
                        await this.sendLogToPopup(`⏳ [DELAY] Esperando ${campaignDelay}s antes del siguiente usuario...`, 'info');
                        
                        // Mostrar countdown
                        for (let countdown = campaignDelay; countdown > 0; countdown--) {
                            if (!this.isActive) {
                                await this.sendLogToPopup(`⏹️ Delay interrumpido - Campaña detenida por el usuario`, 'warning');
                                break; // Permitir cancelar durante delay
                            }
                            
                            await this.sendLogToPopup(`⏱️ [COUNTDOWN] ${countdown}s restantes...`, 'info');
                            await this.delay(1000); // 1 segundo
                        }
                        
                        if (this.isActive) {
                            await this.sendLogToPopup(`✅ [DELAY] Delay completado. Procesando siguiente usuario...`, 'success');
                        } else {
                            await this.sendLogToPopup(`⏹️ Campaña detenida durante el delay`, 'warning');
                        }
                    }
                } else {
                    // Si hubo error pero no es skip, continuar sin delay
                    await this.sendLogToPopup(`⚡ [ERROR] Sin delay por error - Continuando al siguiente usuario`, 'warning');
                }
            }
        }

        console.log('✅ ===== CAMPAÑA COMPLETADA =====');
    } catch (error) {
        console.log(`❌ Error en campaña: ${error.message}`);
    } finally {
        this.isActive = false;
        this.currentCampaign = null;
    }
};

InstagramBot.processUser = async function(username, message) {
    try {
        await this.sendLogToPopup(`🔄 [INICIO] Procesando @${username}`, 'info');

        // PASO 1: Navegar al perfil usando pushState (sin recargar)
        const profileUrl = `https://www.instagram.com/${username}/`;
        await this.sendLogToPopup(`📍 [PASO 1] Navegando a: ${profileUrl}`, 'info');
        
        window.history.pushState({}, '', profileUrl);
        window.dispatchEvent(new PopStateEvent('popstate'));
        
        await this.sendLogToPopup(`⏳ [PASO 1] Esperando carga del perfil (4s)...`, 'info');
        await this.delay(4000);
        
        // NUEVO: Verificar si el perfil existe
        if (await this.checkIfProfileExists()) {
            await this.sendLogToPopup(`✅ [PASO 1] Perfil cargado. URL actual: ${window.location.href}`, 'success');
        } else {
            await this.sendLogToPopup(`❌ [ERROR] El perfil @${username} no existe o fue eliminado`, 'error');
            await this.sendLogToPopup(`⏭️ [SKIP] Saltando a siguiente usuario...`, 'warning');
            return 'skip';
        }
        
        // PASO 2: Buscar destacadas con análisis detallado
        await this.sendLogToPopup(`🔍 [PASO 2] Iniciando búsqueda de destacadas...`, 'info');
        
        // Analizar la página actual
        await this.analyzePageForHighlights();
        
        // Buscar destacadas con múltiples estrategias
        const highlight = await this.findHighlightWithMultipleStrategies();
        
        if (!highlight) {
            await this.sendLogToPopup(`❌ [PASO 2] No se encontraron destacadas para @${username}`, 'warning');
            await this.sendLogToPopup(`⏭️ [SKIP] Saltando a siguiente usuario...`, 'info');
            
            // DEBUG FINAL: Hacer una inspección completa
            await this.debugNoHighlightsFound();
            
            // NO devolver false, devolver 'skip' para continuar con el siguiente
            return 'skip';
        }

        await this.sendLogToPopup(`✅ [PASO 2] Destacada encontrada: ${highlight.tagName} con clase "${highlight.className}"`, 'success');
        
        // PASO 3: Abrir historia destacada
        await this.sendLogToPopup(`🖱️ [PASO 3] Haciendo clic en destacada...`, 'info');
        await this.simulateClick(highlight);
        await this.sendLogToPopup(`⏳ [PASO 3] Esperando carga de historia (3s)...`, 'info');
        await this.delay(3000);
        
        // Verificar que se abrió la historia
        if (window.location.href.includes('/stories/')) {
            await this.sendLogToPopup(`✅ [PASO 3] Historia abierta correctamente`, 'success');
        } else {
            await this.sendLogToPopup(`⚠️ [PASO 3] La URL no cambió a historia, pero continuando...`, 'warning');
        }

        // PASO 3.5: SISTEMA DE ENVÍO INMEDIATO INTELIGENTE (Anti-Historia-Rápida)
        await this.sendLogToPopup(`🎯 [TURBO] Iniciando sistema de envío TURBO para historias rápidas...`, 'info');
        
        // Función para intentar enviar mensaje INSTANTÁNEAMENTE
        const attemptInstantSend = async () => {
            // Buscar textarea con todos los métodos conocidos
            let textInput = null;
            
            // Método 1: Contenedor específico
            const container = document.querySelector('div.x6s0dn4.xl4qmuc.xm4i03v.xd18jyu.xrgb9v1');
            if (container) {
                textInput = container.querySelector('textarea');
            }
            
            // Método 2: Selector directo
            if (!textInput) {
                textInput = document.querySelector('textarea.x1i10hfl.xjbqb8w.x972fbf.x10w94by.x1qhh985.x14e42zd.x7e90pr.x2fvf9.x1a2a7pz.xw2csxc.x1odjw0f.x1y1aw1k.xrw5ot4.xwib8y2.x7coems.xtt52l0.xh8yej3.xomwbyg');
            }
            
            // Método 3: Cualquier textarea con placeholder relevante
            if (!textInput) {
                const textareas = document.querySelectorAll('textarea');
                for (let ta of textareas) {
                    if (this.isElementVisible(ta) && ta.placeholder && (ta.placeholder.includes('Reply') || ta.placeholder.includes('Message'))) {
                        textInput = ta;
                        break;
                    }
                }
            }
            
            // Método 4: Cualquier textarea visible
            if (!textInput) {
                const textareas = document.querySelectorAll('textarea');
                for (let ta of textareas) {
                    if (this.isElementVisible(ta)) {
                        textInput = ta;
                        break;
                    }
                }
            }
            
            if (!textInput) {
                return false; // No encontrado
            }
            
            // ENVÍO INSTANTÁNEO SIN DELAYS
            await this.sendLogToPopup(`⚡ [TURBO] ¡TEXTAREA DETECTADO! Enviando AHORA...`, 'info');
            
            // Focus y escribir inmediatamente
            textInput.focus();
            textInput.value = message;
            textInput.dispatchEvent(new Event('input', { bubbles: true }));
            
            // Enter inmediato
            textInput.dispatchEvent(new KeyboardEvent('keydown', { 
                key: 'Enter', 
                keyCode: 13, 
                bubbles: true,
                cancelable: true 
            }));
            
            textInput.dispatchEvent(new KeyboardEvent('keyup', { 
                key: 'Enter', 
                keyCode: 13, 
                bubbles: true,
                cancelable: true 
            }));
            
            await this.sendLogToPopup(`🚀 [TURBO] ¡MENSAJE ENVIADO INSTANTÁNEAMENTE!`, 'success');
            return true;
        };
        
        // BUCLE DE DETECCIÓN RÁPIDA - Intentar cada 100ms durante 15 segundos máximo
        let messageSent = false;
        let attempts = 0;
        const maxAttempts = 150; // 15 segundos (150 * 100ms)
        
        await this.sendLogToPopup(`🔄 [TURBO] Iniciando detección rápida (${maxAttempts} intentos, 100ms c/u)...`, 'info');
        
        while (!messageSent && attempts < maxAttempts) {
            attempts++;
            
            // Verificar si la historia sigue abierta
            if (!window.location.href.includes('/stories/')) {
                await this.sendLogToPopup(`⚠️ [TURBO] Historia se cerró automáticamente en intento ${attempts}`, 'warning');
                break;
            }
            
            // Intentar envío instantáneo
            try {
                messageSent = await attemptInstantSend();
                if (messageSent) {
                    await this.sendLogToPopup(`🎉 [TURBO] ¡ÉXITO! Mensaje enviado en intento ${attempts} (${attempts*100}ms)`, 'success');
                    break;
                }
            } catch (error) {
                // Ignorar errores silenciosamente para no saturar logs
            }
            
            // Esperar solo 100ms antes del siguiente intento (súper rápido)
            await this.delay(100);
        }
        
        if (!messageSent) {
            await this.sendLogToPopup(`❌ [TURBO] TIMEOUT: No se pudo enviar a @${username} en ${attempts} intentos`, 'warning');
            await this.sendLogToPopup(`💡 [SKIP] Historia demasiado rápida o sin textarea, saltando...`, 'info');
            await this.closeStory();
            return 'skip';
        }

        // PASO 7: Cerrar historia y regresar al perfil
        await this.sendLogToPopup(`🔄 [PASO 7] Cerrando historia...`, 'info');
        await this.closeStory();
        
        // PASO 8: Verificar límites ANTES de incrementar contadores
        await this.sendLogToPopup(`🔍 [VERIFICACIÓN] Verificando límites globales...`, 'info');
        
        try {
            const checkResult = await chrome.runtime.sendMessage({ action: 'checkGlobalLimit' });
            if (checkResult && checkResult.limitReached) {
                const {
                    message,
                    sessionLimitEnabled,
                    sessionCount,
                    sessionLimit,
                    globalCount,
                    globalLimit
                } = checkResult;

                const detalle = sessionLimitEnabled && Number.isFinite(sessionLimit) && sessionLimit > 0 && Number.isFinite(sessionCount)
                    ? `Límite por credencial alcanzado: ${formatLimitProgress(sessionCount, sessionLimit)}`
                    : Number.isFinite(globalLimit) && globalLimit > 0 && Number.isFinite(globalCount)
                        ? `Límite global alcanzado: ${formatLimitProgress(globalCount, globalLimit)}`
                        : 'Límite de mensajes alcanzado para tu cuenta.';
                const mensajeFinal = message || detalle;

                await this.sendLogToPopup(`🚫 [LÍMITE] ${mensajeFinal}`, 'error');
                await this.sendLogToPopup(`⚠️ [LÍMITE] Mensaje enviado pero límite alcanzado. Deteniendo campaña.`, 'warning');
                this.isActive = false;
                return false;
            }
        } catch (error) {
            await this.sendLogToPopup(`⚠️ [VERIFICACIÓN] Error verificando límites: ${error.message}`, 'warning');
        }

        // PASO 9: Actualizar progreso y confirmar éxito
        await this.sendLogToPopup(`✅ [FIN] Mensaje enviado exitosamente a @${username}`, 'success');
        
        // SISTEMA LIMPIO: Incrementar contadores (Local + Global)
        await this.sendLogToPopup(`📊 [CONTADORES] Incrementando contadores...`, 'info');
        try {
            console.log('🔄 CONTENT: Enviando incrementMessageCounters al popup...');
            
            const response = await chrome.runtime.sendMessage({
                action: 'incrementMessageCounters'
            });
            
            console.log('🔄 CONTENT: Respuesta recibida:', response);
            
            if (response && response.success) {
                const {
                    message,
                    resetOccurred,
                    sessionLimitEnabled,
                    sessionCount,
                    sessionLimit,
                    globalCount,
                    globalLimit
                } = response;

                const progresoCredencial = sessionLimitEnabled
                    ? formatLimitProgress(sessionCount, sessionLimit)
                    : 'sin límite';
                const progresoGlobal = formatLimitProgress(globalCount, globalLimit);

                console.log(`✅ Contadores incrementados · Credencial: ${progresoCredencial} · Global: ${progresoGlobal}`);

                if (message) {
                    await this.sendLogToPopup(`📈 [CONTADORES] ${message}`, 'success');
                } else if (sessionLimitEnabled) {
                    await this.sendLogToPopup(`📈 [CONTADORES] Contador de tu credencial: ${progresoCredencial}`, 'success');
                } else {
                    await this.sendLogToPopup(`📈 [CONTADORES] Contador global: ${progresoGlobal}`, 'success');
                }

                if (resetOccurred) {
                    await this.sendLogToPopup('🔄 [CONTADORES] El contador global se reseteó automáticamente (nuevo día).', 'info');
                }

                const limiteCredencialAlcanzado = sessionLimitEnabled
                    && Number.isFinite(sessionLimit)
                    && sessionLimit > 0
                    && Number.isFinite(sessionCount)
                    && sessionCount >= sessionLimit;

                if (limiteCredencialAlcanzado) {
                    await this.sendLogToPopup(`🚫 [LÍMITE] Límite por credencial alcanzado: ${progresoCredencial}`, 'warning');
                    await this.sendLogToPopup('💡 [LÍMITE] Pedile al owner que amplíe tu cupo o espera a que se reinicie.', 'info');
                    this.isActive = false;
                }

                const limiteGlobalAlcanzado = Number.isFinite(globalLimit)
                    && globalLimit > 0
                    && Number.isFinite(globalCount)
                    && globalCount >= globalLimit;

                if (limiteGlobalAlcanzado) {
                    await this.sendLogToPopup(`🚫 [LÍMITE] Límite global alcanzado: ${progresoGlobal}`, 'warning');
                    await this.sendLogToPopup('⏰ [LÍMITE] Se resetea mañana a las 00:00 (Argentina).', 'info');
                    this.isActive = false;
                }

            } else {
                console.log(`⚠️ Error incrementando contadores:`, response);
                await this.sendLogToPopup(`⚠️ [CONTADORES] Error: ${response?.error || 'Sin respuesta'}`, 'warning');
            }

        } catch (error) {
            console.log(`⚠️ Error crítico enviando mensaje:`, error);
            await this.sendLogToPopup(`⚠️ [CONTADORES] Error crítico: ${error.message}`, 'warning');
        }
        
        // Marcar usuario como procesado exitosamente
        await this.markUserAsProcessed(username);
        
        await this.sendLogToPopup(`🎉 [COMPLETO] Usuario @${username} procesado exitosamente`, 'success');
        return true;

    } catch (error) {
        await this.sendLogToPopup(`❌ [ERROR] Error procesando @${username}: ${error.message}`, 'warning');
        await this.sendLogToPopup(`⏭️ [SKIP] Continuando con siguiente usuario...`, 'info');
        await this.closeStory();
        return 'skip';
    }
};

// Métodos utilitarios
InstagramBot.delay = function(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
};

// Sistema de logs simplificado y amigable para usuarios

// SISTEMA SIMPLE: ENVÍO DIRECTO DE LOGS ÚNICOS
InstagramBot.sendLogToPopup = async function(message, type = 'info') {
    console.log(`🔗 [${SCRIPT_INSTANCE_ID}] ${message}`);
    
    // FILTRO 1: Hacer el mensaje amigable al usuario
    const userFriendlyMessage = this.makeLogUserFriendly(message);
    if (!userFriendlyMessage) return; // Skip technical logs
    
    try {
        // Enviar log simple
        console.log(`📤 [${SCRIPT_INSTANCE_ID}] ENVIANDO: ${userFriendlyMessage}`);
        await chrome.runtime.sendMessage({
            action: 'logUpdate',
            message: userFriendlyMessage,
            type: type,
            timestamp: new Date().toISOString(),
            instanceId: SCRIPT_INSTANCE_ID
        });
        console.log(`✅ [${SCRIPT_INSTANCE_ID}] ENVIADO: ${userFriendlyMessage}`);
        
    } catch (error) {
        console.log(`❌ [${SCRIPT_INSTANCE_ID}] ERROR: ${error.message}`);
    }
};

// FUNCIÓN PARA HACER LOGS AMIGABLES AL USUARIO FINAL
InstagramBot.makeLogUserFriendly = function(message) {
    // FILTRAR LOGS TÉCNICOS QUE NO DEBE VER EL USUARIO
    const technicalFilters = [
        'Click en (',
        'elemento clickeable',
        'con clase "',
        'DIV con clase',
        'Elemento encontrado:',
        'Total elementos encontrados:',
        'Links de destacadas directos:',
        'Elementos con texto de destacadas:',
        'Elementos circulares:',
        'ESTRATEGIA 0',
        'Lista de destacadas encontrada:',
        'Destacada 1 encontrada',
        '[ANÁLISIS]',
        '[CONTENEDOR]',
        '[TEXTAREA]',
        '[CLICK]',
        '[CLOSE]',
        'URL actual:',
        'Placeholder:',
        'Texto en campo:',
        'Tecla Enter enviada',
        'detección rápida (150 intentos',
        'intento 1 (100ms)',
        'Historia cerrada exitosamente',
        'Esperando confirmación de envío',
        '[DESTACADAS] Iniciando búsqueda',
        'encontradas encontradas',
        '[TURBO] Iniciando detección',
        '[TURBO] ¡TEXTAREA DETECTADO!',
        '[TURBO] ¡MENSAJE ENVIADO',
        '[TURBO] ¡ÉXITO! Mensaje enviado',
        '[PASO 2] Destacada encontrada:'
    ];
    
    // Si contiene filtros técnicos, no mostrar
    if (technicalFilters.some(filter => message.includes(filter))) {
        return null;
    }
    
    // SIMPLIFICAR MENSAJES PARA USUARIO FINAL
    const simplifications = {
        '🔄 [INICIO] Procesando @': '👤 Procesando @',
        '📍 [PASO 1] Navegando a: https://www.instagram.com/': '🌐 Visitando @',
        '⏳ [PASO 1] Esperando carga del perfil': '⏳ Cargando perfil',
        '✅ [PASO 1] Perfil cargado.': '✅ Perfil cargado',
        '🔍 [PASO 2] Iniciando búsqueda de destacadas': '🔍 Buscando historias destacadas',
        '🖱️ [PASO 3] Haciendo clic en destacada': '📱 Abriendo historia destacada',
        '⏳ [PASO 3] Esperando carga de historia': '⏳ Cargando historia',
        '✅ [PASO 3] Historia abierta correctamente': '✅ Historia abierta',
        '🎯 [TURBO] Iniciando sistema de envío TURBO': '⚡ Preparando envío rápido',
        '🔄 [PASO 7] Cerrando historia': '📱 Cerrando historia',
        '✅ [FIN] Mensaje enviado exitosamente a @': '🎉 ¡Completado! @',
        '🎉 [COMPLETO] Usuario @': '✅ @',
        '⏰ [DELAY] Configurado:': '⏰ Espera configurada:',
        '⏳ [DELAY] Esperando': '⏳ Esperando',
        '⏱️ [COUNTDOWN]': '⏱️',
        '✅ [DELAY] Delay completado.': '➡️ Siguiente usuario',
        '⏰ Delay configurado:': '⏰ Tiempo entre mensajes:'
    };
    
    let friendlyMessage = message;
    
    // Aplicar simplificaciones
    for (const [technical, friendly] of Object.entries(simplifications)) {
        if (friendlyMessage.includes(technical)) {
            friendlyMessage = friendlyMessage.replace(technical, friendly);
            break; // Solo una simplificación por mensaje
        }
    }
    
    // Limpiar patrones adicionales
    friendlyMessage = friendlyMessage
        .replace(/destacadas encontradas$/, 'historias destacadas')
        .replace(/\/.*?\//, '') // Remover URLs largas
        .replace(/\(.*?\)$/, ''); // Remover parámetros técnicos al final
    
    return friendlyMessage.length > 5 ? friendlyMessage : null;
};

// Análisis detallado de la página para encontrar destacadas
InstagramBot.analyzePageForHighlights = async function() {
    await this.sendLogToPopup(`🔍 [ANÁLISIS] Analizando página actual...`, 'info');
    
    // Buscar todos los elementos que podrían ser destacadas
    const possibleHighlights = [
        ...document.querySelectorAll('a[href*="/stories/highlights/"]'),
        ...document.querySelectorAll('div[role="button"]'),
        ...document.querySelectorAll('button'),
        ...document.querySelectorAll('[data-testid]'),
        ...document.querySelectorAll('svg')
    ];
    
    await this.sendLogToPopup(`📊 [ANÁLISIS] Total elementos encontrados: ${possibleHighlights.length}`, 'info');
    
    // Analizar elementos específicos
    let highlightLinks = document.querySelectorAll('a[href*="/stories/highlights/"]');
    await this.sendLogToPopup(`🎯 [ANÁLISIS] Links de destacadas directos: ${highlightLinks.length}`, 'info');
    
    // Buscar por texto "Resultados", "Lifestyle", etc.
    const textElements = document.querySelectorAll('*');
    let highlightTexts = 0;
    for (let el of textElements) {
        if (el.textContent && (
            el.textContent.includes('Resultados') || 
            el.textContent.includes('Lifestyle') ||
            el.textContent.includes('Mi historia') ||
            el.textContent.toLowerCase().includes('highlight')
        )) {
            highlightTexts++;
        }
    }
    await this.sendLogToPopup(`📝 [ANÁLISIS] Elementos con texto de destacadas: ${highlightTexts}`, 'info');
    
    // Buscar elementos circulares (destacadas suelen ser círculos)
    const circularElements = document.querySelectorAll('div[style*="border-radius"], div[class*="circle"], div[class*="round"]');
    await this.sendLogToPopup(`⭕ [ANÁLISIS] Elementos circulares: ${circularElements.length}`, 'info');
    
    // Mostrar algunos ejemplos de lo que encontramos
    if (highlightLinks.length > 0) {
        for (let i = 0; i < Math.min(3, highlightLinks.length); i++) {
            const link = highlightLinks[i];
            await this.sendLogToPopup(`🔗 [ANÁLISIS] Destacada ${i+1}: ${link.href}`, 'info');
        }
    }
};

// Búsqueda de elementos con logging detallado
InstagramBot.findElementWithDetailedLogging = async function(selectors, timeout = 5000, elementName = 'elemento') {
    const startTime = Date.now();
    await this.sendLogToPopup(`🔍 [BÚSQUEDA] Iniciando búsqueda de ${elementName} (timeout: ${timeout}ms)...`, 'info');
    
    let attempts = 0;
    while (Date.now() - startTime < timeout) {
        attempts++;
        
        for (let i = 0; i < selectors.length; i++) {
            const selector = selectors[i];
            const elements = document.querySelectorAll(selector);
            
            if (elements.length > 0) {
                await this.sendLogToPopup(`📋 [BÚSQUEDA] Selector "${selector}": ${elements.length} elementos encontrados`, 'info');
                
                for (let j = 0; j < elements.length; j++) {
                    const element = elements[j];
                    if (this.isElementVisible(element)) {
                        await this.sendLogToPopup(`✅ [BÚSQUEDA] ${elementName} encontrado con selector "${selector}" (elemento ${j+1}/${elements.length})`, 'success');
                        return element;
                    }
                }
                await this.sendLogToPopup(`⚠️ [BÚSQUEDA] Elementos encontrados con "${selector}" pero ninguno visible`, 'warning');
            }
        }
        
        // Log cada 20 intentos para no saturar
        if (attempts % 20 === 0) {
            const elapsed = Date.now() - startTime;
            await this.sendLogToPopup(`⏳ [BÚSQUEDA] Buscando ${elementName}... (${elapsed}ms/${timeout}ms)`, 'info');
        }
        
        await this.delay(200);
    }
    
    await this.sendLogToPopup(`❌ [BÚSQUEDA] ${elementName} no encontrado después de ${timeout}ms`, 'error');
    await this.sendLogToPopup(`🔍 [BÚSQUEDA] Selectores probados: ${selectors.join(', ')}`, 'error');
    
    return null;
};

// Búsqueda especializada para destacadas con múltiples estrategias
InstagramBot.findHighlightWithMultipleStrategies = async function() {
    await this.sendLogToPopup(`🎯 [DESTACADAS] Iniciando búsqueda especializada...`, 'info');
    
    // ESTRATEGIA 0: Búsqueda EXACTA por estructura Instagram real
    await this.sendLogToPopup(`🎯 [ESTRATEGIA 0] Búsqueda exacta por estructura Instagram...`, 'info');
    
    // Buscar la lista específica de destacadas de Instagram
    const highlightsList = document.querySelector('ul._acay');
    if (highlightsList) {
        await this.sendLogToPopup(`✅ [ESTRATEGIA 0] Lista de destacadas encontrada: ul._acay`, 'success');
        
        // Buscar items individuales de destacadas
        const highlightItems = highlightsList.querySelectorAll('li._acaz');
        await this.sendLogToPopup(`📋 [ESTRATEGIA 0] ${highlightItems.length} destacadas encontradas`, 'info');
        
        for (let i = 0; i < highlightItems.length; i++) {
            const item = highlightItems[i];
            
            // Buscar el elemento clickeable específico dentro del item
            const clickableDiv = item.querySelector('div[class*="x1i10hfl"][class*="xjbqb8w"]');
            if (clickableDiv && this.isElementVisible(clickableDiv)) {
                await this.sendLogToPopup(`✅ [ESTRATEGIA 0] Destacada ${i+1} encontrada (elemento clickeable)`, 'success');
                return clickableDiv;
            }
            
            // Buscar la imagen específica dentro del item
            const highlightImg = item.querySelector('img.xz74otr');
            if (highlightImg && this.isElementVisible(highlightImg)) {
                // Buscar el contenedor clickeable de la imagen
                const clickableParent = highlightImg.closest('div[class*="x1i10hfl"]');
                if (clickableParent) {
                    await this.sendLogToPopup(`✅ [ESTRATEGIA 0] Destacada ${i+1} encontrada (vía imagen)`, 'success');
                    return clickableParent;
                }
            }
                }
            } else {
        await this.sendLogToPopup(`❌ [ESTRATEGIA 0] Lista ul._acay no encontrada`, 'warning');
    }
    
    // ESTRATEGIA 0B: Búsqueda VISUAL por círculos e imágenes (fallback)
    await this.sendLogToPopup(`🔍 [ESTRATEGIA 0B] Búsqueda visual por elementos circulares...`, 'info');
    
    // Buscar imágenes circulares típicas de destacadas
    const visualSelectors = [
        'img[style*="border-radius"]', // Imágenes con border-radius
        'canvas[style*="border-radius"]', // Canvas circulares (Instagram a veces usa canvas)
        'div[style*="width: 77px"]', // Tamaño típico de destacadas
        'div[style*="width: 87px"]', // Tamaño alternativo
        'img[alt*="highlight"]', // Alt text que mencione highlight
        'img[alt*="historia"]', // Alt text en español
        'img[width="77"]', // Ancho específico de destacadas
        'img[height="77"]', // Alto específico de destacadas
    ];
    
    for (let selector of visualSelectors) {
        const elements = document.querySelectorAll(selector);
        await this.sendLogToPopup(`🔍 [VISUAL] ${selector}: ${elements.length} elementos`, 'info');
        
        for (let element of elements) {
            if (this.isElementVisible(element)) {
                // Buscar el link padre o contenedor que tenga este elemento visual
                let current = element;
                for (let i = 0; i < 7; i++) { // Buscar hasta 7 niveles arriba
                    if (current.tagName === 'A' && current.href) {
                        await this.sendLogToPopup(`✅ [ESTRATEGIA 0] Destacada visual encontrada: ${current.href}`, 'success');
                        return current;
                    }
                    
                    // Buscar links hermanos o hijos
                    const linkInParent = current.querySelector && current.querySelector('a');
                    if (linkInParent && linkInParent.href) {
                        await this.sendLogToPopup(`✅ [ESTRATEGIA 0] Destacada visual encontrada (link hijo): ${linkInParent.href}`, 'success');
                        return linkInParent;
                    }
                    
                    const linkParent = current.closest && current.closest('a');
                    if (linkParent && linkParent.href) {
                        await this.sendLogToPopup(`✅ [ESTRATEGIA 0] Destacada visual encontrada (link padre): ${linkParent.href}`, 'success');
                        return linkParent;
                    }
                    
                    current = current.parentElement;
                    if (!current) break;
                }
            }
        }
    }
    
    // ESTRATEGIA 1: Selectores directos de highlights
    await this.sendLogToPopup(`🔍 [ESTRATEGIA 1] Buscando con selectores directos...`, 'info');
    let highlight = await this.findElementWithDetailedLogging(this.selectors.highlights, 3000, 'destacadas');
    if (highlight) return highlight;
    
    // ESTRATEGIA 2: Buscar por estructura de DOM (elementos circulares con links)
    await this.sendLogToPopup(`🔍 [ESTRATEGIA 2] Buscando por estructura DOM...`, 'info');
    const circularContainers = document.querySelectorAll('div[style*="border-radius"], div[class*="circle"]');
    for (let container of circularContainers) {
        const link = container.querySelector('a[href*="/stories/"]');
        if (link && this.isElementVisible(link)) {
            await this.sendLogToPopup(`✅ [ESTRATEGIA 2] Destacada encontrada en contenedor circular`, 'success');
            return link;
        }
    }
    
    // ESTRATEGIA 3: Buscar por texto de las destacadas (método correcto)
    await this.sendLogToPopup(`🔍 [ESTRATEGIA 3] Buscando por texto...`, 'info');
    const textTargets = ['Resultados', 'Lifestyle', 'Mi historia'];
    for (let text of textTargets) {
        // Buscar elementos que contengan el texto específico
        const allElements = document.querySelectorAll('div, span, p, a');
        for (let el of allElements) {
            if (el.textContent && el.textContent.trim() === text) {
                // Buscar el link más cercano que apunte a stories
                let parent = el;
                for (let i = 0; i < 5; i++) { // Buscar hasta 5 niveles arriba
                    if (parent.tagName === 'A' && parent.href && parent.href.includes('/stories/')) {
                        if (this.isElementVisible(parent)) {
                            await this.sendLogToPopup(`✅ [ESTRATEGIA 3] Destacada encontrada por texto "${text}"`, 'success');
                            return parent;
                        }
                    }
                    const linkInParent = parent.querySelector('a[href*="/stories/"]');
                    if (linkInParent && this.isElementVisible(linkInParent)) {
                        await this.sendLogToPopup(`✅ [ESTRATEGIA 3] Destacada encontrada por texto "${text}" (link hijo)`, 'success');
                        return linkInParent;
                    }
                    parent = parent.parentElement;
                    if (!parent) break;
                }
            }
        }
    }
    
    // ESTRATEGIA 4: Buscar todos los links de stories y filtrar
    await this.sendLogToPopup(`🔍 [ESTRATEGIA 4] Buscando todos los links de stories...`, 'info');
    const storyLinks = document.querySelectorAll('a[href*="/stories/"]');
    await this.sendLogToPopup(`📋 [ESTRATEGIA 4] ${storyLinks.length} links de stories encontrados`, 'info');
    
    for (let i = 0; i < storyLinks.length; i++) {
        const link = storyLinks[i];
        if (this.isElementVisible(link) && link.href.includes('/stories/highlights/')) {
            await this.sendLogToPopup(`✅ [ESTRATEGIA 4] Destacada encontrada (link ${i+1}): ${link.href}`, 'success');
            return link;
        }
    }
    
    // ESTRATEGIA 5: Buscar en secciones específicas
    await this.sendLogToPopup(`🔍 [ESTRATEGIA 5] Buscando en secciones específicas...`, 'info');
    const sections = document.querySelectorAll('section, main, div[role="main"]');
    for (let section of sections) {
        const links = section.querySelectorAll('a[href*="/stories/"]');
        for (let link of links) {
            if (this.isElementVisible(link)) {
                await this.sendLogToPopup(`✅ [ESTRATEGIA 5] Destacada encontrada en sección`, 'success');
                return link;
            }
        }
    }
    
    // ESTRATEGIA 6: Buscar CUALQUIER link que contenga "/stories/" (más agresivo)
    await this.sendLogToPopup(`🔍 [ESTRATEGIA 6] Búsqueda agresiva de cualquier story...`, 'info');
    const allLinks = document.querySelectorAll('a');
    for (let link of allLinks) {
        if (link.href && link.href.includes('/stories/') && this.isElementVisible(link)) {
            await this.sendLogToPopup(`✅ [ESTRATEGIA 6] Story encontrada: ${link.href}`, 'success');
            return link;
        }
    }
    
    // ESTRATEGIA 7: Inspección manual detallada
    await this.sendLogToPopup(`🔍 [ESTRATEGIA 7] Inspección manual detallada...`, 'info');
    
    // Buscar elementos con clases típicas de Instagram
    const instagramClasses = [
        'div[class*="_ac69"]', // Clase común de Instagram
        'div[class*="_ac6"]',  // Variación
        'div[class*="highlight"]', // Puede contener highlight
        'div[role="button"]', // Botones
        'span[class*="_ac"]' // Spans de Instagram
    ];
    
    for (let selector of instagramClasses) {
        const elements = document.querySelectorAll(selector);
        await this.sendLogToPopup(`📋 [ESTRATEGIA 7] ${selector}: ${elements.length} elementos`, 'info');
        
        for (let el of elements) {
            const link = el.querySelector('a') || (el.tagName === 'A' ? el : null);
            if (link && link.href && this.isElementVisible(link)) {
                await this.sendLogToPopup(`🔗 [ESTRATEGIA 7] Link encontrado: ${link.href}`, 'info');
                if (link.href.includes('/stories/')) {
                    await this.sendLogToPopup(`✅ [ESTRATEGIA 7] Story encontrada!`, 'success');
                    return link;
                }
            }
        }
    }
    
    // ESTRATEGIA 8: Búsqueda EXTREMA - buscar CUALQUIER elemento clickeable en área de perfil
    await this.sendLogToPopup(`🔍 [ESTRATEGIA 8] Búsqueda extrema de elementos clickeables...`, 'info');
    
    // Buscar cualquier elemento clickeable (divs, spans, etc.)
    const clickableElements = document.querySelectorAll('div, span, button, a');
    let highlightCandidates = [];
    
    for (let element of clickableElements) {
        // Si tiene un evento click o cursor pointer, podría ser clickeable
        const style = window.getComputedStyle(element);
        const hasPointer = style.cursor === 'pointer';
        const hasClick = element.onclick || element.addEventListener;
        const isInTopArea = element.getBoundingClientRect().top < window.innerHeight / 2; // En la parte superior
        
        if ((hasPointer || hasClick) && isInTopArea && this.isElementVisible(element)) {
            // Verificar si podría ser una destacada por posición/tamaño
            const rect = element.getBoundingClientRect();
            const isCircularSize = (rect.width >= 60 && rect.width <= 100) && (rect.height >= 60 && rect.height <= 100);
            
            if (isCircularSize) {
                highlightCandidates.push({element, rect, text: element.textContent?.substring(0, 30)});
            }
        }
    }
    
    await this.sendLogToPopup(`🎯 [ESTRATEGIA 8] ${highlightCandidates.length} candidatos circulares encontrados`, 'info');
    
    for (let i = 0; i < Math.min(3, highlightCandidates.length); i++) {
        const candidate = highlightCandidates[i];
        await this.sendLogToPopup(`🎯 [ESTRATEGIA 8] Candidato ${i+1}: ${candidate.rect.width}x${candidate.rect.height} - "${candidate.text}"`, 'info');
        
        // Intentar hacer click en el candidato
        try {
            await this.sendLogToPopup(`🖱️ [ESTRATEGIA 8] Probando click en candidato ${i+1}...`, 'info');
            candidate.element.click();
            await this.delay(2000); // Esperar a ver si se abre algo
            
            // Verificar si se abrió una historia
            if (window.location.href.includes('/stories/') || document.querySelector('[aria-label*="Close"]')) {
                await this.sendLogToPopup(`✅ [ESTRATEGIA 8] ¡Destacada encontrada haciendo click experimental!`, 'success');
                return candidate.element;
            }
        } catch (error) {
            await this.sendLogToPopup(`⚠️ [ESTRATEGIA 8] Error en click candidato ${i+1}: ${error.message}`, 'warning');
        }
    }
    
    await this.sendLogToPopup(`❌ [DESTACADAS] Ninguna estrategia funcionó`, 'error');
    await this.sendLogToPopup(`🔍 [DEBUG] ¿Está en el perfil correcto? URL: ${window.location.href}`, 'info');
    return null;
};

// Función de debugging cuando no se encuentran destacadas
InstagramBot.debugNoHighlightsFound = async function() {
    await this.sendLogToPopup(`🔍 [DEBUG FINAL] Analizando por qué no se encuentran destacadas...`, 'error');
    
    // 1. Verificar si estamos en la página correcta
    const currentUrl = window.location.href;
    await this.sendLogToPopup(`📍 [DEBUG] URL actual: ${currentUrl}`, 'info');
    
    if (!currentUrl.includes('instagram.com/')) {
        await this.sendLogToPopup(`❌ [DEBUG] No estamos en Instagram!`, 'error');
        return;
    }
    
    // 2. Contar todos los elementos de la página
    const allElements = document.querySelectorAll('*');
    await this.sendLogToPopup(`📊 [DEBUG] Total elementos en página: ${allElements.length}`, 'info');
    
    // 3. Buscar TODOS los links
    const allLinks = document.querySelectorAll('a');
    await this.sendLogToPopup(`🔗 [DEBUG] Total links en página: ${allLinks.length}`, 'info');
    
    // 4. Analizar los primeros 10 links
    for (let i = 0; i < Math.min(10, allLinks.length); i++) {
        const link = allLinks[i];
        await this.sendLogToPopup(`🔗 [DEBUG] Link ${i+1}: ${link.href || 'sin href'}`, 'info');
    }
    
    // 5. Buscar elementos que contengan "stories" en cualquier parte
    let storyCount = 0;
    for (let link of allLinks) {
        if (link.href && link.href.includes('stories')) {
            storyCount++;
            if (storyCount <= 5) { // Mostrar los primeros 5
                await this.sendLogToPopup(`📱 [DEBUG] Story link ${storyCount}: ${link.href}`, 'info');
            }
        }
    }
    await this.sendLogToPopup(`📱 [DEBUG] Total links con 'stories': ${storyCount}`, 'info');
    
    // 6. Buscar elementos con clases de Instagram típicas
    const commonInstagramClasses = ['_ac69', '_ac6', '_ab6-', '_ab8-'];
    for (let className of commonInstagramClasses) {
        const elements = document.querySelectorAll(`[class*="${className}"]`);
        await this.sendLogToPopup(`🎨 [DEBUG] Elementos con clase *${className}*: ${elements.length}`, 'info');
    }
    
    // 7. Buscar el texto de las destacadas que vimos en la imagen
    const highlightTexts = ['Resultados', 'Lifestyle', 'Mi historia'];
    for (let text of highlightTexts) {
        const elementsWithText = [];
        for (let el of allElements) {
            if (el.textContent && el.textContent.includes(text)) {
                elementsWithText.push(el);
            }
        }
        await this.sendLogToPopup(`📝 [DEBUG] Elementos con texto "${text}": ${elementsWithText.length}`, 'info');
    }
    
    // 8. Verificar si hay elementos ocultos
    const hiddenElements = document.querySelectorAll('[style*="display: none"], [style*="visibility: hidden"]');
    await this.sendLogToPopup(`👻 [DEBUG] Elementos ocultos: ${hiddenElements.length}`, 'info');
    
    await this.sendLogToPopup(`🔍 [DEBUG FINAL] Análisis completo. ¿Necesitas que busque algo específico?`, 'info');
};

InstagramBot.findElement = async function(selectors, timeout = 5000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
        for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element && this.isElementVisible(element)) {
                console.log(`✅ Elemento encontrado con selector: ${selector}`);
                return element;
            }
        }
        await this.delay(200);
    }
    
    console.log(`❌ Elemento no encontrado después de ${timeout}ms`);
    return null;
};

InstagramBot.isElementVisible = function(element) {
    if (!element) return false;
    
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    
    return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        style.opacity !== '0'
    );
};

InstagramBot.simulateClick = async function(element) {
    if (!element) return false;

    try {
        // Scroll al elemento si es necesario
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await this.delay(300);

        // Obtener coordenadas con validación
        const rect = element.getBoundingClientRect();
        const x = rect.left + (rect.width / 2);
        const y = rect.top + (rect.height / 2);
        
        // Validar que las coordenadas sean válidas
        if (!isFinite(x) || !isFinite(y) || x < 0 || y < 0) {
            await this.sendLogToPopup(`⚠️ [CLICK] Coordenadas inválidas, usando click simple`, 'warning');
            element.click();
            return true;
        }

        await this.sendLogToPopup(`🖱️ [CLICK] Click en (${Math.round(x)}, ${Math.round(y)})`, 'info');

        // Focus primero si es posible
        if (element.focus) {
            element.focus();
            await this.delay(100);
        }

        // Click simple y efectivo
        const clickEvent = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window,
            clientX: x,
            clientY: y,
            button: 0
        });
        
        element.dispatchEvent(clickEvent);
        
        // También hacer click nativo como respaldo
        element.click();
        
        return true;
        
    } catch (error) {
        await this.sendLogToPopup(`⚠️ [CLICK] Error: ${error.message}, usando click nativo`, 'warning');
        element.click();
        return true;
    }
};

InstagramBot.typeMessage = async function(element, message) {
    if (!element || !message) return false;

    // Focus en el elemento
    element.focus();
    await this.delay(200);

    // Limpiar contenido existente
    if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
        element.value = '';
        element.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (element.contentEditable === 'true') {
        element.textContent = '';
        element.dispatchEvent(new Event('input', { bubbles: true }));
    }

    await this.delay(300);

    // Escribir mensaje carácter por carácter (más humano)
    for (let i = 0; i < message.length; i++) {
        const char = message[i];
        
        if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
            element.value += char;
            element.dispatchEvent(new Event('input', { bubbles: true }));
        } else if (element.contentEditable === 'true') {
            element.textContent += char;
            element.dispatchEvent(new Event('input', { bubbles: true }));
        }
        
        // Delay aleatorio entre caracteres (simular escritura humana)
        await this.delay(Math.random() * 100 + 50);
    }

    // Disparar eventos finales
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
    
    return true;
};

InstagramBot.closeStory = async function() {
    try {
        await this.sendLogToPopup(`🔄 [CLOSE] Cerrando historia con ESC...`, 'info');
        
        // Método directo con ESC (más confiable)
        const escEvent = new KeyboardEvent('keydown', { 
            key: 'Escape', 
            code: 'Escape', 
            keyCode: 27,
            bubbles: true,
            cancelable: true
        });
        
        document.dispatchEvent(escEvent);
        await this.delay(1500);
        
        // Verificar si funcionó
        if (!window.location.href.includes('/stories/')) {
            await this.sendLogToPopup(`✅ [CLOSE] Historia cerrada exitosamente`, 'success');
        } else {
            await this.sendLogToPopup(`⚠️ [CLOSE] Historia podría seguir abierta`, 'warning');
        }
        
        return true;
        
    } catch (error) {
        await this.sendLogToPopup(`⚠️ [CLOSE] Error: ${error.message}`, 'warning');
        return true; // Continuar aunque falle
    }
};

// Función para marcar usuario como procesado y actualizar el progreso
InstagramBot.markUserAsProcessed = async function(username) {
    try {
        // Obtener campaña actual del storage
        const result = await chrome.storage.local.get(['campaigns']);
        const campaigns = result.campaigns || [];
        
        // Encontrar la campaña activa
        for (let campaign of campaigns) {
            if (campaign.status === 'running') {
                // Remover el usuario procesado de la lista
                campaign.users = campaign.users.filter(user => user !== username);
                
                await this.sendLogToPopup(`📊 [PROGRESO] Usuario @${username} removido de campaña`, 'info');
                await this.sendLogToPopup(`📊 [PROGRESO] Quedan ${campaign.users.length} usuarios`, 'info');
                
                // Si no quedan usuarios, marcar campaña como completada
                if (campaign.users.length === 0) {
                    campaign.status = 'completed';
                    await this.sendLogToPopup(`🏁 [CAMPAÑA] Campaña completada - todos los usuarios procesados`, 'success');
                }
                
                // Guardar cambios
                await chrome.storage.local.set({ campaigns: campaigns });
                break;
            }
        }
        
    } catch (error) {
        await this.sendLogToPopup(`⚠️ [PROGRESO] Error actualizando progreso: ${error.message}`, 'warning');
    }
};

InstagramBot.stopCampaign = async function() {
    console.log(`⏹️ [${SCRIPT_INSTANCE_ID}] Deteniendo campaña...`);
    
    // NUEVO: Protección contra loops infinitos
    if (this.isStopping) {
        console.log(`⚠️ [${SCRIPT_INSTANCE_ID}] Ya se está deteniendo la campaña, ignorando solicitud duplicada`);
        return;
    }
    
    if (this.isActive) {
        this.isStopping = true; // NUEVO: Marcar que se está deteniendo
        
        await this.sendLogToPopup('⏹️ Deteniendo campaña por solicitud del usuario', 'warning');
        console.log(`⏹️ [${SCRIPT_INSTANCE_ID}] Campaña activa detectada, deteniendo...`);
        
        // Marcar como inactivo
        this.isActive = false;
        this.currentCampaign = null;
        this.currentUserIndex = 0;
        
        await this.sendLogToPopup('✅ Campaña detenida exitosamente', 'success');
        console.log(`✅ [${SCRIPT_INSTANCE_ID}] Campaña detenida correctamente`);
        
        this.isStopping = false; // NUEVO: Resetear flag
    } else {
        console.log(`⚠️ [${SCRIPT_INSTANCE_ID}] No hay campaña activa para detener`);
        await this.sendLogToPopup('⚠️ No hay campaña activa en ejecución', 'warning');
    }
};

// NUEVO: Función para pausar campaña
InstagramBot.pauseCampaign = async function() {
    console.log(`⏸️ [${SCRIPT_INSTANCE_ID}] Pausando campaña...`);
    
    if (this.isActive) {
        await this.sendLogToPopup('⏸️ Pausando campaña...', 'warning');
        console.log(`⏸️ [${SCRIPT_INSTANCE_ID}] Campaña activa detectada, pausando...`);
        
        // Marcar como inactivo temporalmente (pausa)
        this.isActive = false;
        this.isPaused = true;
        
        await this.sendLogToPopup('✅ Campaña pausada exitosamente', 'success');
        console.log(`✅ [${SCRIPT_INSTANCE_ID}] Campaña pausada correctamente`);
    } else {
        console.log(`ℹ️ [${SCRIPT_INSTANCE_ID}] No hay campaña activa para pausar`);
        await this.sendLogToPopup('⚠️ No hay campaña activa para pausar', 'warning');
    }
};

InstagramBot.updateProgress = async function(campaignId, username, success) {
    try {
        console.log(`📊 Actualizando progreso para @${username}: ${success ? 'ÉXITO' : 'ERROR'}`);

        // NUEVO: Priorizar storage del dispositivo actual
        const deviceKey = `campaigns_${this.currentDeviceId || 'unknown'}`;
        const userKey = `campaigns_${this.currentUserId || 'unknown'}`;
        const storageKeys = [deviceKey, userKey, 'campaigns', 'campaignData'];
        
        console.log(`🔍 Buscando campaña en claves: ${storageKeys.join(', ')}`);
        
        const result = await chrome.storage.local.get(storageKeys);
        let campaigns = [];
        let foundInSpecific = false;
        let targetKey = null;

        // PRIORIDAD 1: Buscar en storage del dispositivo
        if (result[deviceKey] && result[deviceKey].campaigns) {
            const campaignIndex = result[deviceKey].campaigns.findIndex(c => c.id === campaignId);
            if (campaignIndex !== -1) {
                campaigns = result[deviceKey].campaigns;
                foundInSpecific = true;
                targetKey = deviceKey;
                console.log(`🔍 Campaña encontrada en storage del dispositivo: ${deviceKey}`);
            }
        }
        
        // PRIORIDAD 2: Buscar en storage del usuario (fallback)
        if (!foundInSpecific && result[userKey] && result[userKey].campaigns) {
            const campaignIndex = result[userKey].campaigns.findIndex(c => c.id === campaignId);
            if (campaignIndex !== -1) {
                campaigns = result[userKey].campaigns;
                foundInSpecific = true;
                targetKey = userKey;
                console.log(`🔍 Campaña encontrada en storage del usuario: ${userKey}`);
            }
        }
        
        // PRIORIDAD 3: Fallback a storage general
        if (!foundInSpecific) {
            campaigns = result.campaigns || [];
            targetKey = 'campaigns';
            console.log(`🔍 Usando storage general como fallback`);
        }

        // Encontrar campaña
        const campaignIndex = campaigns.findIndex(c => c.id === campaignId);
        if (campaignIndex === -1) {
            console.log('❌ Campaña no encontrada en ningún storage');
            return;
        }

        const campaign = campaigns[campaignIndex];

        if (success) {
            // ARREGLADO: ELIMINAR usuario completado de la lista para que desaparezca de la interfaz
            const userIndex = campaign.users.findIndex(u => u.username === username);
            if (userIndex !== -1) {
                // Guardar información del usuario antes de eliminarlo (para CSV/logs)
                const completedUser = {
                    ...campaign.users[userIndex],
                    status: 'completed',
                    sentAt: new Date().toISOString(),
                    sentByMember: this.teamMemberName || 'Usuario',
                    sentByDeviceId: this.currentDeviceId || 'Unknown'
                };
                
                // Agregar a lista de completados si no existe
                if (!campaign.completedUsers) {
                    campaign.completedUsers = [];
                }
                campaign.completedUsers.push(completedUser);
                
                // ELIMINAR de la lista activa para que desaparezca de la interfaz
                campaign.users.splice(userIndex, 1);
                
                // Recalcular estadísticas
                campaign.remainingUsers = campaign.users.length;
                campaign.sentMessages = campaign.completedUsers.length;

                console.log(`✅ @${username} eliminado de la campaña (completado)`);
                console.log(`📊 Progreso: ${campaign.sentMessages}/${campaign.sentMessages + campaign.remainingUsers} (${campaign.remainingUsers} restantes)`);

                // Si no quedan usuarios pendientes, marcar como completada
                if (campaign.users.length === 0) {
                    campaign.status = 'completed';
                    console.log(`🎉 Campaña ${campaign.name} completada`);
                }
            }
        } else {
            // Marcar como error pero mantener en la lista
            const userIndex = campaign.users.findIndex(u => u.username === username);
            if (userIndex !== -1) {
                campaign.users[userIndex].status = 'error';
                campaign.users[userIndex].errorAt = new Date().toISOString();
            }
            console.log(`❌ @${username} marcado como error`);
        }

        // NUEVO: Guardar en el storage correcto basado en la clave que encontramos
        if (foundInSpecific && targetKey !== 'campaigns') {
            // Actualizar datos específicos (dispositivo o usuario)
            const keyData = result[targetKey];
            keyData.campaigns = campaigns;
            keyData.lastUpdated = new Date().toISOString();
            
            await chrome.storage.local.set({ 
                [targetKey]: keyData,
                campaigns: campaigns  // También actualizar campaigns general para compatibilidad
            });
            console.log(`💾 Progreso guardado en storage específico: ${targetKey}`);
        } else {
            // Guardar en storage general
            await chrome.storage.local.set({ campaigns: campaigns });
            console.log('💾 Progreso guardado en storage general');
        }

        // DEBUGGING: Ver storage después de guardar
        const debugStorageAfter = await chrome.storage.local.get(null);
        console.log('🔍 STORAGE completo después de updateProgress:', debugStorageAfter);
        console.log(`🔍 Campaña actualizada en key: ${targetKey}`);
        console.log(`🔍 Users restantes en campaña:`, campaign.users.filter(u => u.status !== 'completed' && u.status !== 'error').length);

        // NUEVO: Notificar al popup sobre el progreso
        try {
            console.log('📤 CONTENT enviando campaignProgress al popup...');
            console.log('📤 CONTENT mensaje completo:', {
                action: 'campaignProgress',
                campaignId: campaignId,
                username: username,
                success: success,
                remainingUsers: campaign.remainingUsers,
                sentMessages: campaign.sentMessages,
                deviceId: this.currentDeviceId,
                userId: this.currentUserId
            });
            
            const response = await chrome.runtime.sendMessage({
                action: 'campaignProgress',
                campaignId: campaignId,
                username: username,
                success: success,
                remainingUsers: campaign.remainingUsers,
                sentMessages: campaign.sentMessages,
                deviceId: this.currentDeviceId,  // NUEVO: Pasar deviceId
                userId: this.currentUserId       // NUEVO: Pasar userId
            });
            
            console.log('✅ CONTENT notificó al popup exitosamente');
            console.log('✅ CONTENT respuesta del popup:', response);
        } catch (notifyError) {
            console.log('⚠️ No se pudo notificar al popup:', notifyError.message);
        }

    } catch (error) {
        console.log(`❌ Error actualizando progreso: ${error.message}`);
    }
};

// Función de detección de cuenta eliminada por simplicidad

// NUEVO: Función para verificar si un perfil existe
InstagramBot.checkIfProfileExists = async function() {
    try {
        // Verificar indicadores de que el perfil no existe
        const pageNotFoundIndicators = [
            "Sorry, this page isn't available.",
            'Lo sentimos, esta página no está disponible.',
            'The link you followed may be broken',
            'El enlace que seguiste puede estar roto',
            "page isn't available",
            'página no está disponible'
        ];
        
        // Verificar el contenido de la página
        const pageText = document.body.textContent || document.body.innerText || '';
        console.log(`🔍 Verificando perfil - texto de página (primeros 200 chars): ${pageText.substring(0, 200)}`);
        
        for (const indicator of pageNotFoundIndicators) {
            if (pageText.includes(indicator)) {
                console.log(`❌ Perfil no existe - encontrado indicador: "${indicator}"`);
                return false;
            }
        }
        
        // Verificar si hay elementos típicos de un perfil
        const profileElements = [
            'article[data-testid]', // Posts container
            '[data-testid="user-avatar"]', // Avatar
            'main[role="main"]', // Main content
            'section:has(img[alt*="profile picture"])', // Profile section
            '[data-testid="UserAvatar"]' // Avatar component
        ];
        
        let profileElementsFound = 0;
        for (const selector of profileElements) {
            try {
                if (document.querySelector(selector)) {
                    profileElementsFound++;
                }
            } catch (e) {
                // Ignore selector errors
            }
        }
        
        console.log(`🔍 Elementos de perfil encontrados: ${profileElementsFound}/${profileElements.length}`);
        
        // Si encontramos al menos 1 elemento de perfil, probablemente existe
        if (profileElementsFound > 0) {
            console.log(`✅ Perfil parece existir (${profileElementsFound} elementos encontrados)`);
            return true;
        }
        
        // Si no hay elementos de perfil y tampoco mensaje de error, dar más tiempo
        console.log(`⚠️ No se encontraron elementos claros - esperando 2s más...`);
        await this.delay(2000);
        
        // Verificar nuevamente
        const updatedPageText = document.body.textContent || document.body.innerText || '';
        for (const indicator of pageNotFoundIndicators) {
            if (updatedPageText.includes(indicator)) {
                console.log(`❌ Perfil no existe después de espera adicional - indicador: "${indicator}"`);
                return false;
            }
        }
        
        // Por defecto, asumir que existe si no hay indicadores claros de error
        console.log(`✅ Perfil parece existir (sin indicadores de error)`);
        return true;
        
    } catch (error) {
        console.log(`⚠️ Error verificando perfil: ${error.message}`);
        // En caso de error, asumir que existe para no bloquear el proceso
        return true;
    }
};

// Función de diagnóstico para debugging
InstagramBot.diagnose = function() {
    console.log('🔍 ===== DIAGNÓSTICO DEL BOT =====');
    console.log(`Estado activo: ${this.isActive}`);
    console.log(`Campaña actual: ${this.currentCampaign?.name || 'ninguna'}`);
    console.log(`Usuario actual: ${this.currentUserIndex}`);
    console.log(`URL actual: ${window.location.href}`);
    
    // Verificar selectores en la página actual
    for (const [type, selectors] of Object.entries(this.selectors)) {
        console.log(`\n🔍 Verificando ${type}:`);
        for (const selector of selectors) {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
                console.log(`✅ ${selector}: ${elements.length} elementos`);
            }
        }
    }
    
    console.log('🔍 ===== FIN DIAGNÓSTICO =====');
};

// Funciones de debugging globales
window.botDiagnose = () => InstagramBot.diagnose();
window.findHighlights = () => {
    console.log('🔍 Buscando destacadas manualmente...');
    
    // Buscar con diferentes selectores
    const selectors = [
        'a[href*="/stories/highlights/"]',
        'a[href*="/stories/"]',
        'div[role="button"]',
        '[class*="_ac69"]',
        '[class*="_ac6"]'
    ];
    
    let totalFound = 0;
    selectors.forEach(selector => {
        try {
            const elements = document.querySelectorAll(selector);
            console.log(`${selector}: ${elements.length} elementos encontrados`);
            if (elements.length > 0) {
                totalFound += elements.length;
                elements.forEach((el, i) => {
                    if (i < 3) { // Solo mostrar primeros 3
                        console.log(`  ${i+1}. ${el.tagName} - ${el.href || el.textContent?.substring(0, 50) || 'sin texto'}`);
                    }
                });
            }
        } catch (error) {
            console.log(`❌ Error con selector ${selector}: ${error.message}`);
        }
    });
    
    console.log(`📊 Total elementos encontrados: ${totalFound}`);
    
    // Buscar también por texto
    const textTargets = ['Resultados', 'Lifestyle', 'Mi historia'];
    textTargets.forEach(text => {
        const elements = document.querySelectorAll('*');
        let count = 0;
        for (let el of elements) {
            if (el.textContent && el.textContent.includes(text)) {
                count++;
            }
        }
        console.log(`📝 Elementos con texto "${text}": ${count}`);
    });
    
    return document.querySelectorAll('a[href*="/stories/"]');
};

// Función específica para analizar destacadas visualmente
// Función específica para buscar elementos exactos de Instagram
window.findInstagramHighlights = () => {
    console.log('🎯 BÚSQUEDA EXACTA DE DESTACADAS INSTAGRAM');
    console.log('==========================================');
    
    // Buscar lista específica de destacadas
    const highlightsList = document.querySelector('ul._acay');
    if (highlightsList) {
        console.log('✅ Lista de destacadas encontrada: ul._acay');
        
        const highlightItems = highlightsList.querySelectorAll('li._acaz');
        console.log(`📋 ${highlightItems.length} elementos li._acaz encontrados`);
        
        highlightItems.forEach((item, i) => {
            console.log(`\n--- DESTACADA ${i+1} ---`);
            
            // Buscar elemento clickeable
            const clickableDiv = item.querySelector('div[class*="x1i10hfl"][class*="xjbqb8w"]');
            console.log(`🖱️ Elemento clickeable: ${clickableDiv ? 'SÍ' : 'NO'}`);
            if (clickableDiv) {
                console.log(`   Clases: ${clickableDiv.className}`);
            }
            
            // Buscar imagen
            const img = item.querySelector('img.xz74otr');
            console.log(`🖼️ Imagen: ${img ? 'SÍ' : 'NO'}`);
            if (img) {
                console.log(`   Src: ${img.src}`);
                console.log(`   Alt: ${img.alt}`);
                console.log(`   Clases: ${img.className}`);
            }
            
            // Buscar cualquier link
            const link = item.querySelector('a');
            console.log(`🔗 Link: ${link ? link.href : 'NINGUNO'}`);
        });
        
        return highlightItems;
    } else {
        console.log('❌ Lista ul._acay NO encontrada');
        
        // Buscar elementos similares
        const similarElements = [
            'ul[class*="_ac"]',
            'div[class*="_ac"]',
            'li[class*="_ac"]'
        ];
        
        similarElements.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            console.log(`🔍 ${selector}: ${elements.length} elementos`);
        });
    }
    
    return null;
};

window.analyzeHighlights = () => {
    console.log('🎯 ANÁLISIS VISUAL DE DESTACADAS');
    console.log('===============================');
    
    // Buscar elementos circulares por tamaño
    const allElements = document.querySelectorAll('*');
    const circularCandidates = [];
    
    allElements.forEach(el => {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        
        // Características típicas de destacadas
        const isCircularSize = (rect.width >= 60 && rect.width <= 100) && (rect.height >= 60 && rect.height <= 100);
        const hasBorderRadius = style.borderRadius && style.borderRadius !== '0px';
        const hasPointer = style.cursor === 'pointer';
        const isInTopArea = rect.top < window.innerHeight / 2;
        const isVisible = rect.width > 0 && rect.height > 0;
        
        if (isCircularSize && isInTopArea && isVisible) {
            circularCandidates.push({
                element: el,
                size: `${Math.round(rect.width)}x${Math.round(rect.height)}`,
                position: `${Math.round(rect.left)},${Math.round(rect.top)}`,
                borderRadius: style.borderRadius,
                cursor: style.cursor,
                tagName: el.tagName,
                classes: el.className,
                text: el.textContent?.substring(0, 30) || '',
                hasPointer,
                hasBorderRadius
            });
        }
    });
    
    console.log(`🔍 Encontrados ${circularCandidates.length} candidatos circulares:`);
    
    circularCandidates.forEach((candidate, i) => {
        console.log(`\n${i+1}. ${candidate.tagName} (${candidate.size})`);
        console.log(`   📍 Posición: ${candidate.position}`);
        console.log(`   🎨 Border-radius: ${candidate.borderRadius}`);
        console.log(`   👆 Cursor: ${candidate.cursor}`);
        console.log(`   📝 Texto: "${candidate.text}"`);
        console.log(`   🏷️ Classes: ${candidate.classes}`);
        console.log(`   🔗 Es clickeable: ${candidate.hasPointer ? 'SÍ' : 'NO'}`);
        
        // Buscar links relacionados
        const parentLink = candidate.element.closest('a');
        const childLink = candidate.element.querySelector('a');
        if (parentLink) console.log(`   🔗 Link padre: ${parentLink.href}`);
        if (childLink) console.log(`   🔗 Link hijo: ${childLink.href}`);
    });
    
    // Buscar imágenes específicamente
    console.log('\n🖼️ ANÁLISIS DE IMÁGENES:');
    const images = document.querySelectorAll('img');
    const imageHighlights = [];
    
    images.forEach(img => {
        const rect = img.getBoundingClientRect();
        const isHighlightSize = (rect.width >= 60 && rect.width <= 100) && (rect.height >= 60 && rect.height <= 100);
        const isInTopArea = rect.top < window.innerHeight / 2;
        
        if (isHighlightSize && isInTopArea) {
            imageHighlights.push({
                src: img.src,
                alt: img.alt,
                size: `${Math.round(rect.width)}x${Math.round(rect.height)}`,
                parentLink: img.closest('a')?.href || 'ninguno'
            });
        }
    });
    
    console.log(`Encontradas ${imageHighlights.length} imágenes candidatas:`);
    imageHighlights.forEach((img, i) => {
        console.log(`${i+1}. ${img.size} - ALT: "${img.alt}" - Link: ${img.parentLink}`);
    });
    
    return { circularCandidates, imageHighlights };
};

window.testHighlightClick = (index = 0) => {
    const highlights = document.querySelectorAll('a[href*="/stories/highlights/"]');
    if (highlights[index]) {
        console.log(`Haciendo clic en destacada ${index + 1}: ${highlights[index].href}`);
        highlights[index].click();
        return true;
    } else {
        console.log(`No se encontró destacada en índice ${index}`);
        return false;
    }
};

console.log('✅ Instagram Bot Content Script v2.0 listo');
console.log('💡 Para debugging ejecuta:');
console.log('  - botDiagnose() - Diagnóstico completo');
console.log('  - findHighlights() - Buscar destacadas');
console.log('  - testHighlightClick(0) - Hacer clic en primera destacada');

// Agregar llamada a la función ejecuteCampaign dentro del bot
InstagramBot.executeCampaign = InstagramBot.executeCampaign.bind(InstagramBot);

})(); // Cerrar la función IIFE