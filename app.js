"use strict";


/* =========================================================
   CONFIGURACIÓN
   ========================================================= */

const parametros =
    new URLSearchParams(window.location.search);

const CLIENTE_ID =
    parametros.get("cliente");

const CLIENTE_CODIGO =
    parametros.get("codigo");


const URL_CLIENTES =
    "https://raw.githubusercontent.com/sanchezjoseraul770-hash/tvlegal-web-control/main/clientes-web.json";


const URL_LISTA =
    "https://raw.githubusercontent.com/sanchezjoseraul770-hash/Nombre-TVLEGAL-LG/main/LISTA-TV-LG.m3u8";


/* =========================================================
   ELEMENTOS
   ========================================================= */

const pantallaCarga =
    document.getElementById("pantallaCarga");

const pantallaSuspendida =
    document.getElementById("pantallaSuspendida");

const pantallaError =
    document.getElementById("pantallaError");

const pantallaTV =
    document.getElementById("pantallaTV");

const btnReintentar =
    document.getElementById("btnReintentar");

const videoPlayer =
    document.getElementById("videoPlayer");

const buscador =
    document.getElementById("buscador");

const canalesContainer =
    document.getElementById("canalesContainer");

const estado =
    document.getElementById("estado");

const canalActual =
    document.getElementById("canalActual");

const btnAnterior =
    document.getElementById("btnAnterior");

const btnSiguiente =
    document.getElementById("btnSiguiente");

const btnPlay =
    document.getElementById("btnPlay");

const btnPantallaCompleta =
    document.getElementById(
        "btnPantallaCompleta"
    );


/* =========================================================
   VARIABLES
   ========================================================= */

let canales = [];

let canalesVisibles = [];

let indiceSeleccionado = 0;

let indiceReproduciendo = -1;
let shakaPlayer = null;
let generacionReproduccion = 0;
let cargaAnteriorEnCurso = false;

async function cancelarCargaAnterior() {

    if (!shakaPlayer) return;

    try {

        /*
         * Pausar primero evita que el elemento de video
         * continúe intentando reproducir mientras cambiamos.
         */
        videoPlayer.pause();

        /*
         * Cancelamos la carga actual de Shaka.
         * No destruimos el reproductor.
         */
        if (cargaAnteriorEnCurso) {

            console.log(
                "TVLEGAL: cancelando carga anterior"
            );

            await shakaPlayer.cancelLoad();

            cargaAnteriorEnCurso = false;
        }

    } catch (e) {

        console.warn(
            "TVLEGAL: no se pudo cancelar la carga anterior",
            e
        );

        cargaAnteriorEnCurso = false;
    }
}


/* =========================================================
   RECUPERACIÓN AUTOMÁTICA DEL STREAM
   ========================================================= */

let recuperacionTimer = null;
let recuperacionFuerteTimer = null;
let vigilanciaCongelamientoTimer = null;

let recuperacionEnCurso = false;
let congelamientoDetectado = false;

let ultimaURLReproduciendo = "";
let ultimoTiempoVideo = 0;
let ultimoCambioVideo = Date.now();
let inicioCongelamiento = 0;

/*
 * CONTROL PROFESIONAL DE ERRORES
 *
 * Evita bucles infinitos cuando un servidor
 * deja de responder o entrega segmentos inválidos.
 */
let errorRecuperacionTimer = null;
let erroresRecuperacion = 0;
let generacionUltimoError = 0;

function limpiarRecuperacionErrores() {

    if (errorRecuperacionTimer) {

        clearTimeout(
            errorRecuperacionTimer
        );

        errorRecuperacionTimer = null;
    }

}

function programarRecuperacionError(
    generacion,
    url
) {

    if (!url) return;

    if (
        generacion !== generacionReproduccion
    ) {
        return;
    }

    if (
        errorRecuperacionTimer
    ) {
        return;
    }

    /*
     * Máximo 2 recuperaciones consecutivas
     * para evitar un bucle infinito.
     */
    if (erroresRecuperacion >= 2) {

        console.warn(
            "TVLEGAL: máximo de recuperaciones por error alcanzado"
        );

        return;
    }

    erroresRecuperacion++;

    generacionUltimoError =
        generacion;

    console.warn(
        "TVLEGAL: recuperación por error programada",
        erroresRecuperacion,
        "URL:",
        url
    );

    errorRecuperacionTimer =
        setTimeout(async () => {

            errorRecuperacionTimer =
                null;

            /*
             * El usuario pudo cambiar de canal
             * durante la espera.
             */
            if (
                generacion !== generacionReproduccion
            ) {

                console.log(
                    "TVLEGAL: recuperación de error cancelada por cambio de canal"
                );

                return;
            }

            if (
                ultimaURLReproduciendo !== url
            ) {

                console.log(
                    "TVLEGAL: recuperación cancelada, URL diferente"
                );

                return;
            }

            if (!shakaPlayer) return;

            try {

                recuperacionEnCurso = true;

                console.log(
                    "TVLEGAL: RECUPERACIÓN POR ERROR",
                    erroresRecuperacion
                );

                videoPlayer.pause();

                await shakaPlayer.unload();

                /*
                 * Volvemos a comprobar la generación
                 * después de descargar el stream.
                 */
                if (
                    generacion !== generacionReproduccion ||
                    ultimaURLReproduciendo !== url
                ) {

                    console.log(
                        "TVLEGAL: recuperación descartada"
                    );

                    return;
                }

                await shakaPlayer.load(
                    url
                );

                await videoPlayer.play();

                console.log(
                    "TVLEGAL: recuperación por error completada"
                );

                erroresRecuperacion = 0;
                congelamientoDetectado = false;
                inicioCongelamiento = 0;
                ultimoCambioVideo = Date.now();

            } catch (e) {

                console.error(
                    "TVLEGAL: recuperación por error falló",
                    e
                );

            } finally {

                recuperacionEnCurso = false;

            }

        }, 2000);
}

function limpiarRecuperacion() {

    if (recuperacionTimer) {
        clearTimeout(recuperacionTimer);
        recuperacionTimer = null;
    }

    if (recuperacionFuerteTimer) {
        clearTimeout(recuperacionFuerteTimer);
        recuperacionFuerteTimer = null;
    }
}

function iniciarVigilanciaStream() {

    if (!videoPlayer) return;

    if (videoPlayer.dataset.vigilanciaProfesional === "1") return;

    videoPlayer.dataset.vigilanciaProfesional = "1";

    videoPlayer.addEventListener("timeupdate", () => {

        const tiempoActual = videoPlayer.currentTime;

        if (!Number.isFinite(tiempoActual)) return;

        if (Math.abs(tiempoActual - ultimoTiempoVideo) > 0.05) {

            ultimoTiempoVideo = tiempoActual;
            ultimoCambioVideo = Date.now();

            if (congelamientoDetectado) {

                console.log(
                    "TVLEGAL: transmisión recuperada"
                );

                congelamientoDetectado = false;
                inicioCongelamiento = 0;
                recuperacionEnCurso = false;

                limpiarRecuperacion();
            }
        }
    });

    videoPlayer.addEventListener("playing", () => {

        console.log(
            "TVLEGAL: reproducción activa"
        );

        congelamientoDetectado = false;
        recuperacionEnCurso = false;
        inicioCongelamiento = 0;

        ultimoTiempoVideo =
            Number.isFinite(videoPlayer.currentTime)
                ? videoPlayer.currentTime
                : 0;

        ultimoCambioVideo = Date.now();

        limpiarRecuperacion();
    });

    videoPlayer.addEventListener("waiting", () => {

        if (videoPlayer.paused) return;

        if (!inicioCongelamiento) {

            inicioCongelamiento = Date.now();
            congelamientoDetectado = true;

            console.log(
                "TVLEGAL: posible congelamiento detectado"
            );
        }

        programarRecuperacionProfesional();
    });

    videoPlayer.addEventListener("stalled", () => {

        if (videoPlayer.paused) return;

        if (!inicioCongelamiento) {

            inicioCongelamiento = Date.now();
            congelamientoDetectado = true;

            console.log(
                "TVLEGAL: stalled detectado"
            );
        }

        programarRecuperacionProfesional();
    });

    vigilanciaCongelamientoTimer = setInterval(() => {

        if (videoPlayer.paused) return;
        if (!ultimaURLReproduciendo) return;

        const ahora = Date.now();
        const sinAvance = ahora - ultimoCambioVideo;

        /*
         * Congelamiento silencioso:
         * el video no avanza aunque no exista waiting/stalled.
         */
        if (
            sinAvance >= 6000 &&
            videoPlayer.readyState < 3
        ) {

            if (!inicioCongelamiento) {

                inicioCongelamiento = ahora;
                congelamientoDetectado = true;

                console.log(
                    "TVLEGAL: congelamiento silencioso detectado"
                );
            }

            programarRecuperacionProfesional();
        }

    }, 1000);
}

function programarRecuperacionProfesional() {

    if (recuperacionEnCurso) return;
    if (!inicioCongelamiento) return;

    limpiarRecuperacion();

    /*
     * NIVEL 1
     * Intentar continuar sin recargar el canal.
     */
    recuperacionTimer = setTimeout(async () => {

        if (videoPlayer.paused) return;
        if (recuperacionEnCurso) return;

        const duracion =
            Date.now() - inicioCongelamiento;

        if (duracion < 3000) return;

        recuperacionEnCurso = true;

        console.log(
            "TVLEGAL: RECUPERACIÓN NIVEL 1"
        );

        try {

            await videoPlayer.play();

        } catch (e) {

            console.log(
                "TVLEGAL: nivel 1 no pudo continuar"
            );
        }

        recuperacionEnCurso = false;

        /*
         * NIVEL 2
         * Solo recargar si realmente sigue detenido.
         */
        recuperacionFuerteTimer = setTimeout(async () => {

            if (videoPlayer.paused) return;
            if (!ultimaURLReproduciendo) return;
            if (recuperacionEnCurso) return;

            const tiempoSinAvance =
                Date.now() - ultimoCambioVideo;

            if (tiempoSinAvance < 7000) return;

            recuperacionEnCurso = true;

            console.log(
                "TVLEGAL: RECUPERACIÓN NIVEL 2"
            );

            try {

                if (shakaPlayer) {
                    await shakaPlayer.unload();
                }

                await shakaPlayer.load(
                    ultimaURLReproduciendo
                );

                await videoPlayer.play();

                console.log(
                    "TVLEGAL: transmisión recuperada"
                );

                congelamientoDetectado = false;
                inicioCongelamiento = 0;

            } catch (e) {

                console.error(
                    "TVLEGAL: recuperación nivel 2 falló",
                    e
                );

            } finally {

                recuperacionEnCurso = false;
            }

        }, 6500);

    }, 3000);
}

iniciarVigilanciaStream();

console.log(
    "TVLEGAL: MOTOR DE RECUPERACIÓN PROFESIONAL ACTIVO"
);

/* =========================================================
   PRECARGA AGRESIVA DEL CANAL SELECCIONADO
   ========================================================= */

let shakaPreloadPlayer = null;
let preloadVideo = null;
let canalPreloadActual = null;
let preloadTimer = null;
let preloadGeneracion = 0;



/* =========================================================
   PRECARGA AGRESIVA
   ========================================================= */

async function prepararCanal(canal) {

    if (!canal || !canal.url) {
        return;
    }

    const generacion = ++preloadGeneracion;

    clearTimeout(preloadTimer);

    preloadTimer = setTimeout(async () => {

        if (generacion !== preloadGeneracion) {
            return;
        }

        if (
            canalPreloadActual === canal.url &&
            shakaPreloadPlayer
        ) {
            return;
        }

        try {

            console.log(
                "PRECARGANDO:",
                canal.nombre
            );

            canalPreloadActual = canal.url;

            if (!preloadVideo) {

                preloadVideo =
                    document.createElement("video");

                preloadVideo.muted = true;
                preloadVideo.playsInline = true;
                preloadVideo.preload = "auto";

                preloadVideo.style.position = "fixed";
                preloadVideo.style.width = "1px";
                preloadVideo.style.height = "1px";
                preloadVideo.style.opacity = "0";
                preloadVideo.style.pointerEvents = "none";
                preloadVideo.style.left = "-10px";
                preloadVideo.style.top = "-10px";

                document.body.appendChild(
                    preloadVideo
                );
            }

            if (!shakaPreloadPlayer) {

                shakaPreloadPlayer =
                    new shaka.Player(
                        preloadVideo
                    );

                shakaPreloadPlayer.configure({
                    streaming: {

                        bufferingGoal: 3,
                        rebufferingGoal: 1.5,
                        bufferBehind: 5,

                        retryParameters: {
                            maxAttempts: 4,
                            baseDelay: 200,
                            backoffFactor: 1.3,
                            fuzzFactor: 0.1
                        },

                        lowLatencyMode: false
                    }
                });

                shakaPreloadPlayer.addEventListener(
                    "error",
                    event => {

                        console.warn(
                            "Error precarga:",
                            event.detail
                        );

                    }
                );
            }

            await shakaPreloadPlayer.load(
                canal.url
            );

            if (generacion !== preloadGeneracion) {
                return;
            }

            console.log(
                "PRECARGA LISTA:",
                canal.nombre
            );

        } catch (error) {

            console.warn(
                "No se pudo precargar:",
                canal.nombre,
                error
            );

        }

    }, 250);
}


/* =========================================================
   CAMBIAR PANTALLA
   ========================================================= */

function mostrarPantalla(pantalla) {

    [
        pantallaCarga,
        pantallaSuspendida,
        pantallaError,
        pantallaTV
    ].forEach(elemento => {

        if (elemento) {
            elemento.classList.add("oculto");
        }

    });


    if (pantalla) {
        pantalla.classList.remove("oculto");
    }
}


/* =========================================================
   DESCARGAR TEXTO
   ========================================================= */

async function descargarTexto(url) {

    const respuesta =
        await fetch(url, {
            method: "GET",
            cache: "no-store"
        });


    if (!respuesta.ok) {

        throw new Error(
            "HTTP " + respuesta.status
        );

    }


    return await respuesta.text();
}


/* =========================================================
   VERIFICAR CLIENTE
   ========================================================= */

async function verificarCliente() {

    const texto =
        await descargarTexto(
            URL_CLIENTES
        );


    const objeto =
        JSON.parse(texto);


    if (
        !objeto ||
        !Array.isArray(
            objeto.clientes
        )
    ) {

        throw new Error(
            "clientes.json inválido"
        );

    }


    if (
        !CLIENTE_ID ||
        !CLIENTE_CODIGO
    ) {

        return false;

    }


    const cliente =
        objeto.clientes.find(
            item =>
                item.id === CLIENTE_ID &&
                item.codigo === CLIENTE_CODIGO
        );


    if (!cliente) {
        return false;
    }


    return cliente.activo === true;
}


/* =========================================================
   CARGAR LISTA
   ========================================================= */

async function cargarLista() {

    try {

        estado.textContent =
            "Cargando canales...";


        const texto =
            await descargarTexto(
                URL_LISTA
            );


        canales =
            analizarM3U(texto);


        canalesVisibles =
            [...canales];


        mostrarCanales(
            canalesVisibles
        );


        estado.textContent =
            canales.length +
            " canales disponibles";


        if (canalesVisibles.length > 0) {

            seleccionarCanal(0);

            console.log(
                "Preparando primer canal:",
                canalesVisibles[0].nombre
            );

            reproducir(
                canalesVisibles[0]
            );

        }


    } catch (error) {

        console.error(error);


        estado.textContent =
            "No se pudo cargar la lista";

    }
}


/* =========================================================
   ANALIZAR M3U
   ========================================================= */

function analizarM3U(texto) {

    const resultado = [];

    const lineas =
        texto.split(/\r?\n/);

    let nombre = "";

    let logo = "";


    for (
        const lineaOriginal
        of lineas
    ) {

        const linea =
            lineaOriginal.trim();


        if (!linea) {
            continue;
        }


        if (
            linea
                .toUpperCase()
                .startsWith("#EXTINF")
        ) {

            const coma =
                linea.indexOf(",");


            if (coma >= 0) {

                nombre =
                    linea
                        .substring(
                            coma + 1
                        )
                        .trim();

            }


            const logoMatch =
                linea.match(
                    /tvg-logo="([^"]*)"/i
                );


            logo =
                logoMatch
                    ? logoMatch[1]
                    : "";


            continue;
        }


        if (
            linea.startsWith(
                "http://"
            ) ||
            linea.startsWith(
                "https://"
            )
        ) {

            resultado.push({

                nombre:
                    nombre ||
                    "Canal " +
                    (
                        resultado.length + 1
                    ),

                logo:
                    logo,

                url:
                    linea

            });


            nombre = "";

            logo = "";
        }
    }


    return resultado;
}


/* =========================================================
   MOSTRAR CANALES
   ========================================================= */

function mostrarCanales(lista) {

    canalesContainer.innerHTML = "";


    canalesVisibles = lista;


    if (lista.length === 0) {

        canalesContainer.innerHTML =
            '<div class="canal">' +
            'NO SE ENCONTRARON CANALES' +
            '</div>';

        return;
    }


    lista.forEach(
        (canal, indice) => {

            const elemento =
                document.createElement(
                    "div"
                );


            elemento.className =
                "canal";


            elemento.tabIndex = 0;


            elemento.dataset.indice =
                indice;


            if (canal.logo) {

                const imagen =
                    document.createElement(
                        "img"
                    );


                imagen.src =
                    canal.logo;


                imagen.alt = "";


                imagen.onerror =
                    function() {

                        this.style.display =
                            "none";

                    };


                elemento.appendChild(
                    imagen
                );
            }


            const nombre =
                document.createElement(
                    "div"
                );


            nombre.className =
                "canal-nombre";


            nombre.textContent =
                canal.nombre;


            elemento.appendChild(
                nombre
            );


            elemento.addEventListener(
                "click",
                function() {

                    indiceSeleccionado =
                        indice;

                    seleccionarCanal(
                        indice
                    );

                    reproducir(
                        canal
                    );

                }
            );


            elemento.addEventListener(
                "focus",
                function() {

                    indiceSeleccionado =
                        indice;

                    actualizarEnfoque();

                }
            );


            canalesContainer.appendChild(
                elemento
            );

        }
    );


    actualizarEnfoque();
}


/* =========================================================
   SELECCIONAR CANAL
   ========================================================= */

function seleccionarCanal(indice) {

    if (
        canalesVisibles.length === 0
    ) {
        return;
    }


    if (indice < 0) {
        indice = 0;
    }


    if (
        indice >=
        canalesVisibles.length
    ) {

        indice =
            canalesVisibles.length - 1;

    }


    indiceSeleccionado =
        indice;


    actualizarEnfoque();
}


/* =========================================================
   ENFOQUE VISUAL
   ========================================================= */

function actualizarEnfoque() {

    const tarjetas =
        canalesContainer.querySelectorAll(
            ".canal"
        );


    tarjetas.forEach(
        (tarjeta, indice) => {

            tarjeta.classList.toggle(
                "enfocado",
                indice ===
                indiceSeleccionado
            );

        }
    );


    const tarjetaActual =
        tarjetas[
            indiceSeleccionado
        ];


    if (tarjetaActual) {

        const zonaFija =
            document.getElementById("zonaFija");

        const alturaZonaFija =
            zonaFija
                ? zonaFija.getBoundingClientRect().height
                : 0;

        const rect =
            tarjetaActual.getBoundingClientRect();

        const limiteSuperior =
            alturaZonaFija + 50;

        const limiteInferior =
            window.innerHeight - 20;

        if (rect.top < limiteSuperior) {

            window.scrollBy({
                top: rect.top - limiteSuperior,
                behavior: "smooth"
            });

        } else if (rect.bottom > limiteInferior) {

            window.scrollBy({
                top: rect.bottom - limiteInferior,
                behavior: "smooth"
            });

        }

    }
}


/* =========================================================
   REPRODUCIR
   ========================================================= */

async function reproducir(canal) {

    /*
     * Cada reproducción recibe una generación.
     * Si el usuario cambia rápidamente de canal,
     * las cargas anteriores quedan invalidadas.
     */
    const miGeneracion = ++generacionReproduccion;

    /*
     * Si existe una carga anterior, la cancelamos antes
     * de comenzar el nuevo canal.
     */
    await cancelarCargaAnterior();

    console.log(
        "Reproduciendo:",
        canal.nombre,
        "| generación:",
        miGeneracion
    );

    indiceReproduciendo =
        canalesVisibles.indexOf(
            canal
        );

    canalActual.textContent =
        canal.nombre;

    const tarjetas =
        canalesContainer.querySelectorAll(
            ".canal"
        );

    tarjetas.forEach(
        tarjeta =>
            tarjeta.classList.remove(
                "reproduciendo"
            )
    );

    if (
        tarjetas[indiceReproduciendo]
    ) {

        tarjetas[
            indiceReproduciendo
        ].classList.add(
            "reproduciendo"
        );

    }

    try {

        ultimaURLReproduciendo = canal.url;

        if (!window.shaka) {
            throw new Error(
                "Shaka Player no está cargado"
            );
        }

        shaka.polyfill.installAll();

        if (!shakaPlayer) {

            shakaPlayer =
                new shaka.Player(
                    videoPlayer
                );

            shakaPlayer.configure({
                streaming: {

                    /* ARRANQUE MÁS RÁPIDO */
                    bufferingGoal: 3,
                    rebufferingGoal: 1.5,

                    /* MENOS DATOS ATRASADOS */
                    bufferBehind: 5,

                    /* INTENTOS RÁPIDOS */
                    retryParameters: {
                        maxAttempts: 6,
                        baseDelay: 200,
                        backoffFactor: 1.3,
                        fuzzFactor: 0.1
                    },

                    /* MODO PARA STREAM EN VIVO */
                    lowLatencyMode: false
                }
            });

            shakaPlayer.addEventListener(
                "error",
                event => {

                    const error = event.detail;

                    console.error(
                        "TVLEGAL: Error Shaka:",
                        error
                    );

                    /*
                     * El motor profesional de recuperación
                     * se encarga de los fallos del stream.
                     * No intentamos recuperar si el usuario
                     * ya cambió de canal.
                     */
                    if (
                        miGeneracion !== generacionReproduccion ||
                        !ultimaURLReproduciendo
                    ) {
                        console.log(
                            "TVLEGAL: error descartado por cambio de canal"
                        );
                        return;
                    }

                    /*
                     * Guardamos información del último error
                     * para diagnóstico y recuperación.
                     */
                    window.tvlegalUltimoError = {
                        timestamp: Date.now(),
                        code: error?.code || null,
                        category: error?.category || null,
                        severity: error?.severity || null
                    };

                    console.warn(
                        "TVLEGAL: stream con error",
                        window.tvlegalUltimoError
                    );

                    /*
                     * Conectamos el error de Shaka
                     * al motor profesional de recuperación.
                     */
                    programarRecuperacionError(
                        miGeneracion,
                        canal.url
                    );

                }
            );

        }

        console.log(
            "Cargando URL:",
            canal.url
        );

        /*
         * Cargamos el nuevo canal directamente.
         * No destruimos el reproductor Shaka,
         * para evitar perder tiempo creando otro.
         */
        /*
         * La carga pertenece a esta generación.
         * Si el usuario cambió de canal mientras
         * Shaka estaba cargando, cancelamos el resultado.
         */
        cargaAnteriorEnCurso = true;

        await shakaPlayer.load(
            canal.url
        );

        cargaAnteriorEnCurso = false;

        if (miGeneracion !== generacionReproduccion) {

            console.log(
                "TVLEGAL: carga anterior descartada",
                miGeneracion,
                "!=",
                generacionReproduccion
            );

            return;
        }

        /*
         * El canal sigue siendo el seleccionado.
         * Intentar reproducir inmediatamente.
         */
        try {

            await videoPlayer.play();

        } catch (playError) {

            console.warn(
                "Autoplay/reproducción:",
                playError
            );

        }

        btnPlay.textContent =
            "❚❚ PAUSAR";

    } catch (error) {

        console.error(
            "Error reproduciendo canal:",
            error
        );

    }
}


/* =========================================================
   CANAL ANTERIOR
   ========================================================= */

function canalAnterior() {

    if (
        canalesVisibles.length === 0
    ) {
        return;
    }


    let indice =
        indiceReproduciendo;


    if (indice < 0) {

        indice =
            indiceSeleccionado;

    }


    indice--;


    if (indice < 0) {

        indice =
            canalesVisibles.length - 1;

    }


    seleccionarCanal(indice);


    reproducir(
        canalesVisibles[indice]
    );
}


/* =========================================================
   CANAL SIGUIENTE
   ========================================================= */

function canalSiguiente() {

    if (
        canalesVisibles.length === 0
    ) {
        return;
    }


    let indice =
        indiceReproduciendo;


    if (indice < 0) {

        indice =
            indiceSeleccionado;

    }


    indice++;


    if (
        indice >=
        canalesVisibles.length
    ) {

        indice = 0;

    }


    seleccionarCanal(indice);


    reproducir(
        canalesVisibles[indice]
    );
}


/* =========================================================
   BUSCADOR
   ========================================================= */

buscador.addEventListener(
    "input",
    function() {

        const texto =
            this.value
                .toLowerCase()
                .trim();


        const filtrados =
            canales.filter(
                canal =>
                    canal.nombre
                        .toLowerCase()
                        .includes(texto)
            );


        mostrarCanales(
            filtrados
        );


        indiceSeleccionado = 0;


        actualizarEnfoque();
    }
);


/* =========================================================
   BOTÓN PLAY / PAUSA
   ========================================================= */

btnPlay.addEventListener(
    "click",
    function() {

        if (
            videoPlayer.paused
        ) {

            videoPlayer.play();

            this.textContent =
                "❚❚ PAUSAR";

        } else {

            videoPlayer.pause();

            this.textContent =
                "▶ REPRODUCIR";

        }

    }
);


/* =========================================================
   BOTONES ANTERIOR / SIGUIENTE
   ========================================================= */

btnAnterior.addEventListener(
    "click",
    canalAnterior
);


btnSiguiente.addEventListener(
    "click",
    canalSiguiente
);


/* =========================================================
   PANTALLA COMPLETA
   ========================================================= */

async function pantallaCompleta() {

    try {

        if (
            !document.fullscreenElement
        ) {

            await document.documentElement
                .requestFullscreen();

        } else {

            await document.exitFullscreen();

        }

    } catch (error) {

        console.log(
            "Pantalla completa:",
            error
        );

    }
}


btnPantallaCompleta.addEventListener(
    "click",
    pantallaCompleta
);


/* =========================================================
   TECLADO / CONTROL REMOTO SMART TV
   ========================================================= */

document.addEventListener(
    "keydown",
    function(event) {

        const tecla =
            event.key;


        /* ENTER / OK */

        if (
            tecla === "Enter" ||
            tecla === "NumpadEnter"
        ) {

            const elemento =
                document.activeElement;


            if (
                elemento === buscador
            ) {

                return;

            }


            if (
                canalesVisibles.length > 0
            ) {

                reproducir(
                    canalesVisibles[
                        indiceSeleccionado
                    ]
                );

            }


            event.preventDefault();

            return;
        }


        /* FLECHA DERECHA */

        if (
            tecla === "ArrowRight"
        ) {

            moverDerecha();

            event.preventDefault();

            return;
        }


        /* FLECHA IZQUIERDA */

        if (
            tecla === "ArrowLeft"
        ) {

            moverIzquierda();

            event.preventDefault();

            return;
        }


        /* FLECHA ABAJO */

        if (
            tecla === "ArrowDown"
        ) {

            moverAbajo();

            event.preventDefault();

            return;
        }


        /* FLECHA ARRIBA */

        if (
            tecla === "ArrowUp"
        ) {

            moverArriba();

            event.preventDefault();

            return;
        }


        /* ESC */

        if (
            tecla === "Escape"
        ) {

            if (
                document.fullscreenElement
            ) {

                document.exitFullscreen();

            }

            return;
        }


        /* ESPACIO */

        if (
            tecla === " "
        ) {

            if (
                videoPlayer.paused
            ) {

                videoPlayer.play();

                btnPlay.textContent =
                    "❚❚ PAUSAR";

            } else {

                videoPlayer.pause();

                btnPlay.textContent =
                    "▶ REPRODUCIR";

            }


            event.preventDefault();

        }

    }
);


/* =========================================================
   NAVEGACIÓN DERECHA
   ========================================================= */

function moverDerecha() {

    if (
        canalesVisibles.length === 0
    ) {
        return;
    }


    if (
        indiceSeleccionado <
        canalesVisibles.length - 1
    ) {

        indiceSeleccionado++;

    } else {

        indiceSeleccionado = 0;

    }


    actualizarEnfoque();
}


/* =========================================================
   NAVEGACIÓN IZQUIERDA
   ========================================================= */

function moverIzquierda() {

    if (
        canalesVisibles.length === 0
    ) {
        return;
    }


    if (
        indiceSeleccionado > 0
    ) {

        indiceSeleccionado--;

    } else {

        indiceSeleccionado =
            canalesVisibles.length - 1;

    }


    actualizarEnfoque();
}


/* =========================================================
   NAVEGACIÓN ARRIBA
   ========================================================= */

function moverArriba() {

    if (
        canalesVisibles.length === 0
    ) {
        return;
    }


    const tarjetas =
        canalesContainer.querySelectorAll(
            ".canal"
        );


    if (tarjetas.length === 0) {
        return;
    }


    const tarjetaActual =
        tarjetas[indiceSeleccionado];


    if (!tarjetaActual) {
        return;
    }


    const columnas =
        calcularColumnas();


    let nuevoIndice =
        indiceSeleccionado -
        columnas;


    if (nuevoIndice < 0) {

        nuevoIndice =
            indiceSeleccionado;

    }


    indiceSeleccionado =
        nuevoIndice;


    actualizarEnfoque();
}


/* =========================================================
   NAVEGACIÓN ABAJO
   ========================================================= */

function moverAbajo() {

    if (
        canalesVisibles.length === 0
    ) {
        return;
    }


    const columnas =
        calcularColumnas();


    let nuevoIndice =
        indiceSeleccionado +
        columnas;


    if (
        nuevoIndice >=
        canalesVisibles.length
    ) {

        nuevoIndice =
            indiceSeleccionado;

    }


    indiceSeleccionado =
        nuevoIndice;


    actualizarEnfoque();
}


/* =========================================================
   CALCULAR COLUMNAS
   ========================================================= */

function calcularColumnas() {

    const tarjetas =
        canalesContainer.querySelectorAll(
            ".canal"
        );


    if (
        tarjetas.length < 2
    ) {
        return 1;
    }


    const primera =
        tarjetas[0];

    const segunda =
        tarjetas[1];


    const primeraTop =
        primera.getBoundingClientRect().top;


    let columnas = 1;


    for (
        let i = 1;
        i < tarjetas.length;
        i++
    ) {

        const top =
            tarjetas[i]
                .getBoundingClientRect()
                .top;


        if (
            Math.abs(
                top - primeraTop
            ) < 10
        ) {

            columnas++;

        } else {

            break;

        }

    }


    return Math.max(
        1,
        columnas
    );
}


/* =========================================================
   INICIAR TVLEGAL
   ========================================================= */

async function iniciarTVLEGAL() {

    mostrarPantalla(
        pantallaCarga
    );


    try {

        const activo =
            await verificarCliente();


        if (!activo) {

            mostrarPantalla(
                pantallaSuspendida
            );

            return;
        }


        mostrarPantalla(
            pantallaTV
        );


        await cargarLista();


    } catch (error) {

        console.error(
            "Error verificando cliente:",
            error
        );


        mostrarPantalla(
            pantallaError
        );

    }
}


/* =========================================================
   REINTENTAR
   ========================================================= */

btnReintentar.addEventListener(
    "click",
    iniciarTVLEGAL
);


/* =========================================================
   ARRANCAR
   ========================================================= */

iniciarTVLEGAL();
