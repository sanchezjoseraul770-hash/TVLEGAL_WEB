"use strict";


/* =========================================================
   CONFIGURACIÓN
   ========================================================= */

const parametros = new URLSearchParams(window.location.search);

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


let canales = [];


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
        await descargarTexto(URL_CLIENTES);

    const objeto =
        JSON.parse(texto);

    if (
        !objeto ||
        !Array.isArray(objeto.clientes)
    ) {
        throw new Error(
            "clientes.json inválido"
        );
    }

    if (!CLIENTE_ID || !CLIENTE_CODIGO) {
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
            await descargarTexto(URL_LISTA);

        canales =
            analizarM3U(texto);

        mostrarCanales(canales);

        estado.textContent =
            canales.length +
            " canales disponibles";

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

    for (const lineaOriginal of lineas) {

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
                        .substring(coma + 1)
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
            linea.startsWith("http://") ||
            linea.startsWith("https://")
        ) {

            resultado.push({

                nombre:
                    nombre ||
                    "Canal " +
                    (resultado.length + 1),

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

    lista.forEach(canal => {

        const elemento =
            document.createElement("div");

        elemento.className =
            "canal";


        if (canal.logo) {

            const imagen =
                document.createElement("img");

            imagen.src =
                canal.logo;

            imagen.alt =
                "";

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
            document.createElement("div");

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
                reproducir(canal);
            }
        );


        canalesContainer.appendChild(
            elemento
        );

    });

}


/* =========================================================
   REPRODUCIR
   ========================================================= */

function reproducir(canal) {

    console.log(
        "Reproduciendo:",
        canal.nombre
    );

    videoPlayer.src =
        canal.url;

    videoPlayer.play()
        .catch(error => {

            console.log(
                "Reproducción:",
                error
            );

        });

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
            canales.filter(canal =>
                canal.nombre
                    .toLowerCase()
                    .includes(texto)
            );

        mostrarCanales(
            filtrados
        );

    }
);


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
