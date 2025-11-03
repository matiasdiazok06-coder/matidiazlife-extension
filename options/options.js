/*
 * Gestión de equipo para md outbound.
 * Todos los datos se guardan en chrome.storage.local con el prefijo matidiaz_.
 * Si la extensión llegara a sincronizarse con un servidor remoto,
 * revisar estas funciones para replicar la lógica de permisos en el backend.
 */

const STORAGE_KEY = 'matidiaz_members';
const CURRENT_USER_KEY = 'matidiaz_current_user';

let estado = {
    owner: '',
    members: []
};

let usuarioActual = '';

// Utilidades de almacenamiento ------------------------------------------------
function obtenerDesdeStorage(clave) {
    return new Promise((resolve, reject) => {
        try {
            chrome.storage.local.get(clave, (resultado) => {
                const error = chrome.runtime.lastError;
                if (error) {
                    reject(new Error(`No se pudo leer ${clave}: ${error.message}`));
                    return;
                }
                resolve(resultado[clave]);
            });
        } catch (error) {
            reject(error);
        }
    });
}

function guardarEnStorage(objeto) {
    return new Promise((resolve, reject) => {
        try {
            chrome.storage.local.set(objeto, () => {
                const error = chrome.runtime.lastError;
                if (error) {
                    reject(new Error(`No se pudo guardar: ${error.message}`));
                    return;
                }
                resolve(true);
            });
        } catch (error) {
            reject(error);
        }
    });
}

async function inicializarEstructura() {
    try {
        const datos = await obtenerDesdeStorage(STORAGE_KEY);
        if (!datos) {
            const estructuraBase = { owner: '', members: [] };
            await guardarEnStorage({ [STORAGE_KEY]: estructuraBase });
            estado = estructuraBase;
        } else {
            estado = normalizarEstructura(datos);
            await guardarEnStorage({ [STORAGE_KEY]: estado });
        }
    } catch (error) {
        mostrarEstado(`Error inicializando datos: ${error.message}`, 'error');
        throw error;
    }
}

function normalizarEstructura(datos) {
    const normalizado = {
        owner: typeof datos.owner === 'string' ? datos.owner : '',
        members: Array.isArray(datos.members) ? datos.members : []
    };

    normalizado.members = normalizado.members
        .filter(item => item && typeof item.email === 'string' && item.email.trim().length > 0)
        .map(item => ({
            email: item.email.trim().toLowerCase(),
            role: ['owner', 'admin', 'member'].includes(item.role) ? item.role : 'member'
        }));

    if (normalizado.owner && !normalizado.members.some(miembro => miembro.email === normalizado.owner)) {
        normalizado.members.push({ email: normalizado.owner, role: 'owner' });
    }

    // Asegurarnos de que sólo haya un owner en la lista
    let ownerEncontrado = false;
    normalizado.members = normalizado.members.map(miembro => {
        if (miembro.email === normalizado.owner) {
            ownerEncontrado = true;
            return { ...miembro, role: 'owner' };
        }
        if (miembro.role === 'owner') {
            return { ...miembro, role: 'admin' };
        }
        return miembro;
    });

    if (!ownerEncontrado && normalizado.owner) {
        normalizado.members.push({ email: normalizado.owner, role: 'owner' });
    }

    return normalizado;
}

async function cargarUsuarioActual() {
    try {
        const email = await obtenerDesdeStorage(CURRENT_USER_KEY);
        if (typeof email === 'string') {
            usuarioActual = email.trim().toLowerCase();
            const input = document.getElementById('emailActual');
            if (input) {
                input.value = usuarioActual;
            }
        }
    } catch (error) {
        mostrarEstado(`No se pudo cargar tu email: ${error.message}`, 'error');
    }
}

function esOwnerActual() {
    return usuarioActual && estado.owner && usuarioActual === estado.owner.toLowerCase();
}

function actualizarBloqueoPorPermisos() {
    const boton = document.getElementById('btnAgregar');
    const nota = document.getElementById('notaPermisos');
    if (!boton || !nota) return;

    if (esOwnerActual()) {
        boton.disabled = false;
        nota.textContent = 'Podés administrar tu equipo. Todos los cambios son locales.';
    } else {
        boton.disabled = true;
        nota.textContent = 'Sólo el owner puede agregar, eliminar o promover miembros.';
    }
}

// Gestión de UI ---------------------------------------------------------------
function mostrarEstado(mensaje, tipo = 'info', duracion = 3000) {
    const contenedor = document.getElementById('estadoGeneral');
    if (!contenedor) return;

    contenedor.textContent = mensaje;
    contenedor.className = `estado ${tipo}`;
    contenedor.hidden = false;

    if (duracion > 0) {
        setTimeout(() => {
            contenedor.hidden = true;
        }, duracion);
    }
}

function renderizarMiembros() {
    const cuerpo = document.getElementById('listaMiembros');
    const ownerLabel = document.getElementById('ownerActual');
    if (!cuerpo) return;

    cuerpo.innerHTML = '';

    if (!estado.members.length) {
        const fila = document.createElement('tr');
        const columna = document.createElement('td');
        columna.colSpan = 3;
        columna.textContent = 'Sin miembros registrados todavía.';
        fila.appendChild(columna);
        cuerpo.appendChild(fila);
    } else {
        const ordenados = [...estado.members].sort((a, b) => {
            if (a.role === 'owner') return -1;
            if (b.role === 'owner') return 1;
            return a.email.localeCompare(b.email);
        });

        ordenados.forEach(miembro => {
            const fila = document.createElement('tr');

            const emailTd = document.createElement('td');
            emailTd.textContent = miembro.email;
            fila.appendChild(emailTd);

            const rolTd = document.createElement('td');
            rolTd.textContent = formatearRol(miembro.role);
            fila.appendChild(rolTd);

            const accionesTd = document.createElement('td');
            accionesTd.className = 'acciones';

            const botonEliminar = document.createElement('button');
            botonEliminar.textContent = 'Eliminar';
            botonEliminar.className = 'eliminar';
            botonEliminar.type = 'button';
            botonEliminar.disabled = !esOwnerActual();
            botonEliminar.addEventListener('click', () => confirmarYEliminar(miembro.email));
            accionesTd.appendChild(botonEliminar);

            if (miembro.role !== 'owner') {
                const botonOwner = document.createElement('button');
                botonOwner.textContent = 'Hacer owner';
                botonOwner.className = 'hacer-owner';
                botonOwner.type = 'button';
                botonOwner.disabled = !esOwnerActual();
                botonOwner.addEventListener('click', () => confirmarYAsignarOwner(miembro.email));
                accionesTd.appendChild(botonOwner);
            }

            fila.appendChild(accionesTd);
            cuerpo.appendChild(fila);
        });
    }

    if (ownerLabel) {
        ownerLabel.textContent = estado.owner || '(sin definir)';
    }

    actualizarBloqueoPorPermisos();
}

function formatearRol(rol) {
    switch (rol) {
        case 'owner':
            return 'Owner';
        case 'admin':
            return 'Admin';
        default:
            return 'Miembro';
    }
}

async function confirmarYEliminar(email) {
    if (!esOwnerActual()) {
        mostrarEstado('Sólo el owner puede eliminar miembros.', 'error');
        return;
    }

    const confirmado = confirm(`¿Eliminar a ${email}? Esta acción no se puede deshacer.`);
    if (!confirmado) {
        return;
    }

    try {
        await eliminarMiembro(email);
        mostrarEstado(`Se eliminó a ${email}.`, 'ok');
        await sincronizarEstado();
    } catch (error) {
        mostrarEstado(error.message, 'error', 6000);
    }
}

async function confirmarYAsignarOwner(email) {
    if (!esOwnerActual()) {
        mostrarEstado('Sólo el owner puede asignar a otra persona como owner.', 'error');
        return;
    }

    const confirmado = confirm(`¿Querés que ${email} sea el nuevo owner? Perderás los permisos especiales.`);
    if (!confirmado) {
        return;
    }

    try {
        await asignarOwner(email);
        mostrarEstado(`${email} ahora es el owner de md outbound.`, 'ok');
        if (usuarioActual !== email.toLowerCase()) {
            mostrarEstado('Tu usuario ya no es owner. Actualizá tu email si corresponde.', 'info', 6000);
        }
        await sincronizarEstado();
    } catch (error) {
        mostrarEstado(error.message, 'error', 6000);
    }
}

// Lógica de negocio ----------------------------------------------------------
async function sincronizarEstado() {
    try {
        const datos = await obtenerDesdeStorage(STORAGE_KEY);
        if (datos) {
            estado = normalizarEstructura(datos);
        }
        renderizarMiembros();
    } catch (error) {
        mostrarEstado(`No se pudo sincronizar: ${error.message}`, 'error', 6000);
    }
}

function validarEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
}

async function agregarMiembro(email, rol) {
    if (!esOwnerActual()) {
        throw new Error('Sólo el owner puede agregar miembros.');
    }

    if (!email) {
        throw new Error('El email es obligatorio.');
    }

    const emailLimpio = email.trim().toLowerCase();
    if (!validarEmail(emailLimpio)) {
        throw new Error('Ingresá un email válido.');
    }

    if (!['owner', 'admin', 'member'].includes(rol)) {
        throw new Error('Seleccioná un rol válido.');
    }

    const existe = estado.members.some(miembro => miembro.email === emailLimpio);
    if (existe) {
        throw new Error('Ese email ya está registrado.');
    }

    if (rol === 'owner') {
        await asignarOwner(emailLimpio);
        return;
    }

    estado.members.push({ email: emailLimpio, role: rol });
    await guardarEnStorage({
        [STORAGE_KEY]: {
            owner: estado.owner,
            members: [...estado.members]
        }
    });
}

async function eliminarMiembro(email) {
    const emailLimpio = email.trim().toLowerCase();
    if (emailLimpio === estado.owner.toLowerCase()) {
        throw new Error('No podés eliminar al owner actual. Asigná otro owner antes.');
    }

    const filtrados = estado.members.filter(miembro => miembro.email !== emailLimpio);
    estado = { ...estado, members: filtrados };
    await guardarEnStorage({ [STORAGE_KEY]: estado });
}

async function asignarOwner(email) {
    const emailLimpio = email.trim().toLowerCase();
    if (!validarEmail(emailLimpio)) {
        throw new Error('Ingresá un email válido para el owner.');
    }

    const miembrosSinOwner = estado.members.map(miembro => {
        if (miembro.email === emailLimpio) {
            return { ...miembro, role: 'owner' };
        }
        if (miembro.role === 'owner') {
            return { ...miembro, role: 'admin' };
        }
        return miembro;
    });

    const existe = miembrosSinOwner.some(miembro => miembro.email === emailLimpio);
    const listaActualizada = existe ? miembrosSinOwner : [...miembrosSinOwner, { email: emailLimpio, role: 'owner' }];

    estado = {
        owner: emailLimpio,
        members: listaActualizada
    };

    await guardarEnStorage({ [STORAGE_KEY]: estado });
}

async function guardarUsuarioActual(email) {
    if (!email) {
        throw new Error('El email actual no puede quedar vacío.');
    }
    if (!validarEmail(email)) {
        throw new Error('Ingresá un email válido.');
    }
    usuarioActual = email.trim().toLowerCase();
    await guardarEnStorage({ [CURRENT_USER_KEY]: usuarioActual });
    actualizarBloqueoPorPermisos();
}

// Eventos --------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await inicializarEstructura();
        await cargarUsuarioActual();
        await sincronizarEstado();
        registrarEventos();
        mostrarEstado('Datos cargados correctamente.', 'ok');
    } catch (error) {
        mostrarEstado(`Fallo al cargar la pantalla: ${error.message}`, 'error', 6000);
    }
});

function registrarEventos() {
    const formulario = document.getElementById('formAgregar');
    const formularioUsuario = document.getElementById('formUsuarioActual');

    if (formulario) {
        formulario.addEventListener('submit', async (evento) => {
            evento.preventDefault();
            const email = document.getElementById('emailMiembro').value;
            const rol = document.getElementById('rolMiembro').value;

            try {
                await agregarMiembro(email, rol);
                formulario.reset();
                renderizarMiembros();
                mostrarEstado(`Se agregó a ${email} como ${formatearRol(rol)}.`, 'ok');
            } catch (error) {
                mostrarEstado(error.message, 'error', 6000);
            }
        });
    }

    if (formularioUsuario) {
        formularioUsuario.addEventListener('submit', async (evento) => {
            evento.preventDefault();
            const email = document.getElementById('emailActual').value;
            try {
                await guardarUsuarioActual(email);
                mostrarEstado('Tu email se guardó correctamente.', 'ok');
            } catch (error) {
                mostrarEstado(error.message, 'error', 6000);
            }
        });
    }
}

// Escucha cambios externos ---------------------------------------------------
chrome.storage.onChanged.addListener((cambios, area) => {
    if (area !== 'local' || !cambios[STORAGE_KEY]) {
        return;
    }
    const nuevoValor = cambios[STORAGE_KEY].newValue;
    if (!nuevoValor) {
        return;
    }
    estado = normalizarEstructura(nuevoValor);
    renderizarMiembros();
});
