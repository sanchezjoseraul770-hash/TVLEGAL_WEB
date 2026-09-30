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

function reproducir(canal) {

    console.log(
        "Reproduciendo:",
        canal.nombre
    );


    indiceReproduciendo =
        canalesVisibles.indexOf(
            canal
        );


    videoPlayer.src =
        canal.url;


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


    videoPlayer.play()
        .then(() => {

            btnPlay.textContent =
                "❚❚ PAUSAR";

        })
        .catch(error => {

            console.log(
                "Reproducción:",
                error
            );

        });
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
