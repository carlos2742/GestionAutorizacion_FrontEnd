import findIndex from 'lodash/findIndex';
import find from 'lodash/find';
import filter from 'lodash/filter';
import includes from 'lodash/includes';
import isNil from 'lodash/isNil';
import isMatch from 'lodash/isMatch';
import assign from 'lodash/assign';
import lowerCase from 'lodash/lowerCase';
import capitalize from 'lodash/capitalize';
import join from 'lodash/join';
import fill from 'lodash/fill';
import map from 'lodash/map';
import forEach from 'lodash/forEach';
import reduce from 'lodash/reduce';
import remove from 'lodash/remove';
import orderBy from 'lodash/orderBy';
import get from 'lodash/get';
import format from 'date-fns/format';
import {
    ACTUALIZACION_EN_BULTO_CON_ERRORES,
    AUTORIZACION_APROBADA, AUTORIZACION_PENDIENTE, AUTORIZACION_RECHAZADA, ENTIDAD_NO_ELIMINABLE, ERROR_DE_RED,
    ERROR_GENERAL,
    ETIQUETA_NOK_DESC,
    ETIQUETA_OK_DESC, PROPIEDAD_NO_EDITABLE
} from "../../common/constantes";
import {procesarFechaAEnviar} from "../../common/utiles";


/* @ngInject */
/**
 * Esta clase es un servicio de Angular donde se almacena la lista de todos las peticiones asociadas a un usuario.
 */
export default class PeticionesService {

    /**
     * @typedef {Object} Peticion
     * @property {number} id                        -  De sólo lectura. Se genera automáticamente en la Base de Datos para peticiones nuevas.
     * @property {number} codigo                    -  Lo mismo que id, se añade para mantener consistencia con otras entidades.
     * @property {Object} flujo                     -  Flujo al que pertenece la petición
     * @property {Flujo} flujo.valor                -  Su valor actual.
     * @property {string} flujo.display             -  Cómo debe ser representado.
     * @property {Object} solicitante               -  Persona que realiza la petición.
     * @property {Flujo} solicitante.valor          -  Su valor actual.
     * @property {string} solicitante.display       -  Cómo debe ser representado.
     * @property {string} observaciones             -  Observaciones.
     * @property {Object} informacionExtra          -  Información adicional relacionada con la petición.
     * @property {string} estadoInterno             -  Estado final de la petición.
     * @property {Object} estado                    -  Estado actual de la petición.
     * @property {Object} estado.valor              -  Su valor actual.
     * @property {string} estado.display            -  Cómo debe representarse.
     * @property {Object} fechaNecesaria            -  Fecha necesaria de la petición.
     * @property {Date} fechaNecesaria.valor        -  Su valor actual.
     * @property {string} fechaNecesaria.display    -  Cómo debe representarse esta fecha.
     *
     * @property {Object[]} autorizaciones                       -  Lista de autorizadores que ya aprobaron o rechazaron esta solicitud.
     * @property {Object} autorizaciones[0].autorizador          -  Datos del autorizador
     * @property {Object} autorizaciones[0].autorizador.valor    -  Su valor actual
     * @property {string} autorizaciones[0].autorizador.display  -  Cómo debe ser representado.
     * @property {Object} autorizaciones[0].estado               -  Estado de esta autorización.
     * @property {string} autorizaciones[0].estado.valor         -  Su valor actual.
     * @property {string} autorizaciones[0].estado.display       -  Cómo debe ser representado.
     * @property {Object} autorizaciones[0].fecha                -  Fecha en que realizó la autorización.
     * @property {Date} autorizaciones[0].fecha.valor            -  Su valor actual.
     * @property {string} autorizaciones[0].fecha.display        -  Cómo debe representarse esta fecha.
     *
     * @property {Adjunto[]} adjuntos                            -  Lista de adjuntos de la petición.
     *
     * @property {number} cantidadAutorizacionesCompletadas      -  Número de autorizaciones realizadas para la petición.
     * @property {number} cantidadAutorizacionesTotales          -  Número total de autorizaciones requeridas por la petición.
     *
     */

    /**
     * @param $q                        -  Servicio de Angular para utilizar Promesas
     * @param $http                     -  Servicio de Angular para hacer llamadas HTTP
     * @param EtiquetasService
     * @param PersonalService
     * @param SesionService
     * @param AppConfig                 -  Contiene la configuración del app.
     *
     **/
    constructor($q, $http, EtiquetasService, PersonalService, SesionService, AppConfig) {
        // Constantes del servicio
        /** @private */
        this.ENDPOINT = '/peticiones';
        this.ENDPOINT_APROBAR = `${this.ENDPOINT}/autorizar`;
        this.ENDPOINT_RECHAZAR = `${this.ENDPOINT}/rechazar`;

        /** @private */
        this.$q = $q;
        /** @private */
        this.$http = $http;
        /** @private */
        this.etiquetasService = EtiquetasService;
        /** @private */
        this.personalService = PersonalService;
        /** @private */
        this.AppConfig = AppConfig;

        /** @type {Peticion[]} */
        this.peticiones = [];
        /** @type {Peticion[]} */
        this.resultadosBusqueda = [];

        /** @private */
        this.ordenActivo = null;
        /** @private */
        this.filtrosBusqueda = null;

        SesionService.obtenerUsuarioAutenticado()
            .then(usuario => {
                /** @private */
                this.usuario = usuario;
            });
    }

    reiniciarEstado() {
        this.peticiones = [];
        this.resultadosBusqueda = [];
        this.ordenActivo = null;
        this.filtrosBusqueda = null;
    }

    /**
     * Le aplica algunas transformaciones a una petición recibida del API. Añade los permisos de edición y también le
     * agrega una propiedad para facilitar la visualización de varias de sus propiedaddes.
     *
     * @param {Object} entidad          -  Representa una petición recibida del API
     * @param {Etiqueta[]} etiquetas    -  Listado de etiquetas existentes. Se usan para mostrar el estado.
     * @returns {Peticion}              -  La misma entidad, con las transformaciones mencionadas.
     */
    procesarEntidadRecibida(entidad, etiquetas) {
        let peticionProcesada = {
            codigo: entidad.id
        };

        for (let prop in entidad) {
            if (prop === 'flujo') {
                peticionProcesada[prop] = {
                    valor: entidad[prop],
                    display: entidad[prop] ? entidad[prop].evento : ''
                }
            } else if (prop === 'solicitante') {
                const personaProcesada = entidad[prop] ? this.personalService.procesarPersonaRecibida(entidad[prop]) : null;
                peticionProcesada[prop] = {
                    valor: personaProcesada,
                    display: personaProcesada ? personaProcesada.nombreApellidos : ''
                };
            } else if (prop === 'fechaNecesaria') {
                const fechaNecesariaObj = entidad[prop] ? new Date(Date.parse(entidad[prop])) : null;
                peticionProcesada[prop] = {
                    valor: fechaNecesariaObj,
                    display: fechaNecesariaObj ? format(fechaNecesariaObj, this.AppConfig.formatoFechas) : ''
                };
            } else if (prop === 'informacionExtra') {
                const info = entidad.informacionExtra;
                peticionProcesada[prop] = Object.keys(info).length > 0 ? {} : null;
                for (let key in info) {
                    const arregloPalabras = lowerCase(key).split(' ');
                    forEach(arregloPalabras, (palabra, indice) => {
                        arregloPalabras[indice] = capitalize(palabra);
                    });
                    peticionProcesada[prop][key] = {
                        valor: info[key],
                        label: join(arregloPalabras, ' ')
                    };
                }
            } else if (prop === 'estado') {
                const etiqueta = find(etiquetas, etiqueta => {
                    return etiqueta.estado === entidad[prop] && etiqueta.modulo.valor.id === entidad.flujo.modulo.id;
                });
                let descripcion = etiqueta ? etiqueta.descripcion : '';
                if (isNil(etiqueta)) {
                    switch (entidad.estadoInterno) {
                        case AUTORIZACION_APROBADA:
                            descripcion = this.AppConfig.etiquetaPorDefectoAutorizada;
                            break;
                        case AUTORIZACION_RECHAZADA:
                            descripcion = this.AppConfig.etiquetaPorDefectoRechazada;
                            break;
                        case AUTORIZACION_PENDIENTE:
                            if (entidad.estado === '0') {
                                descripcion = this.AppConfig.etiquetaPorDefectoPendiente;
                            } else {
                                descripcion = this.AppConfig.etiquetaPorDefectoEnRevision;
                            }
                            break;
                    }
                }

                peticionProcesada[prop] = {
                    valor: entidad[prop],
                    display: descripcion
                };
            } else if (prop === 'autorizaciones') {
                peticionProcesada[prop] = map(entidad[prop], (autorizacion, indice) => {
                    return this._procesarAutorizacion(autorizacion, indice, entidad.cantidadAutorizacionesTotales);
                })
            } else {
                peticionProcesada[prop] = entidad[prop];
            }
        }

        peticionProcesada.displayOrden = `Aut. ${entidad.cantidadAutorizacionesCompletadas+1}/${entidad.cantidadAutorizacionesTotales}`;

        peticionProcesada.editable = false;
        peticionProcesada.eliminable = false;

        return peticionProcesada;
    }

    _procesarAutorizacion(autorizacion, indice, totalAutorizaciones) {
        let autorizacionProcesada = {
            codigo: autorizacion.autorizacion
        };
        for (let prop in autorizacion) {
            if (prop === 'autorizador') {
                const personaProcesada = autorizacion[prop] ? this.personalService.procesarPersonaRecibida(autorizacion[prop]) : null;
                autorizacionProcesada[prop] = {
                    valor: personaProcesada,
                    display: personaProcesada ? personaProcesada.nombreApellidos : ''
                };
            } else if (prop === 'fecha') {
                const fechaNecesariaObj = autorizacion[prop] ? new Date(Date.parse(autorizacion[prop])) : null;
                autorizacionProcesada[prop] = {
                    valor: fechaNecesariaObj,
                    display: fechaNecesariaObj ? format(fechaNecesariaObj, this.AppConfig.formatoFechas) : ''
                };
            } else if (prop === 'estado') {
                autorizacionProcesada[prop] = {
                    valor: autorizacion[prop],
                    display: autorizacion[prop] === AUTORIZACION_APROBADA ? ETIQUETA_OK_DESC : ETIQUETA_NOK_DESC
                };
            } else {
                autorizacionProcesada[prop] = autorizacion[prop];
            }

            autorizacionProcesada.displayOrden = `Aut. ${indice+1}/${totalAutorizaciones}`;
        }
        return autorizacionProcesada;
    }

    /**
     * Devuelve una petición dado su código
     * @param {number} codigo
     * @return {Promise.<Peticion>}       -  Se resuelve con la petición correspondiente a ese id.
     */
    obtener(codigo) {
        return this.$q.all([
            this.$http.get(`${this.ENDPOINT}/${codigo}`),
            this.etiquetasService.obtenerTodos()
        ]).then(resultado => {
                const peticion = this.procesarEntidadRecibida(resultado[0].data, resultado[1]);
                let indiceExistente = findIndex(this.peticiones, ['codigo', codigo]);
                if (indiceExistente > -1) {
                    this.peticiones[indiceExistente] = peticion;
                }
                return peticion;
            });
    }

    /**
     * Devuelve una lista de peticiones. Utiliza paginación porque la cantidad total de peticiones puede llegar a ser
     * considerable.
     *
     * @param {number} pagina               -  Página que se desea.
     * @param {[string, string]} orden      -  Cómo deben estar ordenados los resultados.
     * @param filtro                        -  Se puede usar para filtrar los resultados por varios campos.
     * @param {boolean} forzarActualizacion -  Verdadero si se desean pedir de nuevo las peticiones al servidor. En caso contrario,
     *                                          no se piden si el total de páginas = 1.
     * @param {number} elementosPorPagina   -  Cantidad de peticiones que se desea recibir en una página.
     * @return {Promise.<Peticion[]>}       -  Se resuelve con el arreglo de peticiones que corresponden a una página determinada.
     */
    obtenerTodos(pagina, orden, filtro, forzarActualizacion, elementosPorPagina) {
        let cambioOrden = false;
        if (!isNil(orden) && (isNil(this.ordenActivo) || orden[0] !== this.ordenActivo[0] || orden[1] !== this.ordenActivo[1])) {
            this.ordenActivo = orden;
            cambioOrden = true;
        }

        if (filtro === null || (!isNil(filtro) && !isMatch(this.filtrosBusqueda, filtro))) {
            this.filtrosBusqueda = filtro;
        }

        // Se verifica si hay una búsqueda activa o no
        const filtroDefinido = find(this.filtrosBusqueda, filtro => {
            return !isNil(filtro);
        });
        const busquedaActiva = !isNil(filtroDefinido);

        if (forzarActualizacion || this.peticiones.length === 0 || this.peticiones.length > this.AppConfig.elementosPorPagina) {
            return this._obtenerServidor(pagina, cambioOrden, busquedaActiva, this.filtrosBusqueda, elementosPorPagina);
        } else {
            if (cambioOrden) {
                let campo ='';
                switch (this.ordenActivo[0]) {
                    case 'id':
                        campo = 'id';
                        break;
                    case 'fecha.valor':
                        campo = 'fechaNecesaria.valor';
                        break;
                    case 'solicitante':
                        campo = 'solicitante.display';
                        break;
                    case 'flujo':
                        campo = 'flujo.display';
                        break;
                }

                this.peticiones = orderBy(this.peticiones,
                    [entidad => {
                        const valor = get(entidad, campo);
                        return typeof valor === 'string' ? valor.toLowerCase() : valor }],
                    [this.ordenActivo[1]]);
            }
            if (busquedaActiva) {
                this.resultadosBusqueda = reduce(this.peticiones, (resultado, peticion) => {
                    if ((isNil(this.filtrosBusqueda.idModulo) || get(peticion, 'flujo.valor.modulo.id') === this.filtrosBusqueda.idModulo )
                        && (isNil(this.filtrosBusqueda.idFlujo) || get(peticion, 'flujo.valor.id') === this.filtrosBusqueda.idFlujo )
                        && (isNil(this.filtrosBusqueda.nInternoSolicitante) || get(peticion, 'solicitante.valor.nInterno') === this.filtrosBusqueda.nInternoSolicitante )
                        && (isNil(this.filtrosBusqueda.etiqueta) || peticion.estado.display === this.filtrosBusqueda.etiqueta) ) {

                        resultado.push(peticion);
                    }

                    return resultado;
                }, []);
                return this.$q.resolve(this.resultadosBusqueda);
            } else {
                return this.$q.resolve(this.peticiones);
            }
        }
    }

    aprobar(peticiones, paginaActual) {
        const fnActualizacion = (peticionesActualizadas) => {
            let pagina = paginaActual;

            // Se verifica si hay una búsqueda activa o no
            const filtroDefinido = find(this.filtrosBusqueda, filtro => {
                return !isNil(filtro);
            });
            const busquedaActiva = !isNil(filtroDefinido);
            const cantidadPeticiones = busquedaActiva ? this.resultadosBusqueda.length : this.peticiones.length;

            if (!this.usuario.esGestor || cantidadPeticiones > this.AppConfig.elementosPorPagina) {
                const fin = paginaActual * this.AppConfig.elementosPorPagina;
                const inicio = fin - this.AppConfig.elementosPorPagina;
                // Si es la última página y se aprobaron/rechazaron todos los elementos, hay que cambiar de página
                if (inicio + peticionesActualizadas.length >= cantidadPeticiones && paginaActual > 1) {
                    //Se comprueba si todas las peticiones ya están en su aprobación final
                    const peticionesFinales = filter(peticionesActualizadas, peticion => {
                        return peticion.cantidadAutorizacionesTotales === peticion.cantidadAutorizacionesCompletadas + 1
                                || !isNil(peticion.errorCode);
                    });

                    if (peticionesFinales.length === peticionesActualizadas.length) {
                        pagina = paginaActual - 1;
                    }
                }

                return this.obtenerTodos(pagina, undefined, undefined, true)
                    .then(peticionesPagina => {
                        return {
                            peticiones: peticionesPagina,
                            pagina
                        }
                    });
            } else {
                // Se eliminan de la lista de peticiones las que ya no tienen más autorizaciones pendientes
                remove(this.peticiones, peticion => {
                    const indiceCoincidencia = findIndex(peticionesActualizadas, ['id', peticion.id]);
                    if (indiceCoincidencia > -1) {
                        return !isNil(peticionesActualizadas[indiceCoincidencia].errorCode) || peticion.cantidadAutorizacionesTotales === peticion.cantidadAutorizacionesCompletadas + 1;
                    }
                    return false;
                });
                // Se eliminan también de los resultados de búsqueda
                remove(this.resultadosBusqueda, peticion => {
                    const indiceCoincidencia = findIndex(peticionesActualizadas, ['id', peticion.id]);
                    if (indiceCoincidencia > -1) {
                        return !isNil(peticionesActualizadas[indiceCoincidencia].errorCode) || peticion.cantidadAutorizacionesTotales === peticion.cantidadAutorizacionesCompletadas + 1;
                    }
                    return false;
                });

                // Se actualizan las peticiones que quedan
                const idsActualizados = map(peticionesActualizadas, peticion => {
                    return peticion.id
                });
                const peticionesCambiadas = filter(busquedaActiva ? this.resultadosBusqueda : this.peticiones, peticion => {
                    return includes(idsActualizados, peticion.id);
                });
                forEach(peticionesCambiadas, peticion => {
                    peticion.autorizaciones.push(this._procesarAutorizacion({
                        autorizacion: peticion.cantidadAutorizacionesCompletadas + 1,
                        autorizador: this.usuario,
                        estado: AUTORIZACION_APROBADA,
                        fecha: new Date().toISOString().replace('Z', '')
                    }, peticion.cantidadAutorizacionesCompletadas, peticion.cantidadAutorizacionesTotales));

                    peticion.cantidadAutorizacionesCompletadas++;
                    peticion.displayOrden = `Aut. ${peticion.cantidadAutorizacionesCompletadas+1}/${peticion.cantidadAutorizacionesTotales}`;
                });

                const peticionesPagina = busquedaActiva ? this.resultadosBusqueda : this.peticiones;
                return {
                    peticiones: peticionesPagina,
                    pagina
                }
            }
        };

        return this._cambiarEstadoPeticiones(peticiones, {}, paginaActual, this.ENDPOINT_APROBAR, fnActualizacion);
    }

    rechazar(peticiones, paginaActual) {
        const fnActualizacion = (peticionesActualizadas) => {
            let pagina = paginaActual;

            const idsActualizados = map(peticionesActualizadas, peticion => {
                return peticion.id
            });

            // Se verifica si hay una búsqueda activa o no
            const filtroDefinido = find(this.filtrosBusqueda, filtro => {
                return !isNil(filtro);
            });
            const busquedaActiva = !isNil(filtroDefinido);
            const cantidadPeticiones = busquedaActiva ? this.resultadosBusqueda.length : this.peticiones.length;

            // Si la lista de peticiones está paginada, se vuelve a pedir la página en la que estaba el usuario
            if (cantidadPeticiones > this.AppConfig.elementosPorPagina) {
                const fin = paginaActual * this.AppConfig.elementosPorPagina;
                const inicio = fin - this.AppConfig.elementosPorPagina;
                // Si es la última página y se aprobaron/rechazaron todos los elementos, hay que cambiar de página
                if (inicio + peticionesActualizadas.length >= cantidadPeticiones && paginaActual > 1) {
                    pagina = paginaActual - 1;
                }
                return this.obtenerTodos(pagina, undefined, undefined, true)
                    .then(peticionesPagina => {
                        return {
                            peticiones: peticionesPagina,
                            pagina
                        }
                    });
            } else {
                // Se eliminan de la lista de peticiones pendientes, porque ya este usuario no tiene que autorizarlas.
                remove(this.peticiones, peticion => {
                    return includes(idsActualizados, peticion.id);
                });
                // Se eliminan también de los resultados de búsqueda
                remove(this.resultadosBusqueda, peticion => {
                    return includes(idsActualizados, peticion.id);
                });

                const peticionesPagina = busquedaActiva ? this.resultadosBusqueda : this.peticiones;
                return {
                    peticiones: peticionesPagina,
                    pagina
                }
            }
        };

        return this._cambiarEstadoPeticiones(peticiones, {}, paginaActual, this.ENDPOINT_RECHAZAR, fnActualizacion);
    }

    /**
     * Elimina una petición de la lista
     *
     * @param {Peticion} peticion
     */
    eliminarEntidad(peticion) {
        let indiceExistente = findIndex(this.peticiones, ['id', peticion.id]);
        if (indiceExistente > -1) {
            this.peticiones.splice(indiceExistente, 1);
        }
    }

    /**
     * Actualiza una petición existente. Sólo se llama al API si los datos de la petición cambiaron.
     *
     * @param {Peticion} peticion
     * @return {Promise<Peticion>}    -  Se resuelve con la petición actualizada.
     */
    editar(peticion) {
        let error;
        const indicePeticionCambiada = findIndex(this.peticiones, ['id', peticion.id]);
        if (indicePeticionCambiada < 0) {
            return this.$q.reject();
        }

        const peticionCorrespondiente = this.peticiones[indicePeticionCambiada];
        if (peticion.observaciones !== peticionCorrespondiente.observaciones) {
            const datosAEnviar = {
                'id': peticion.id,
                'flujo': peticion.flujo.valor.id,
                'estado': peticion.estado.valor,
                'fechaNecesaria': procesarFechaAEnviar(peticion.fechaNecesaria.valor),
                'observaciones': peticion.observaciones,
                'solicitante': peticion.solicitante.valor.nInterno
            };
            return this.$http.put(`${this.ENDPOINT}/${peticion.id}`, datosAEnviar)
                .then(response => {
                    peticionCorrespondiente.observaciones = peticion.observaciones;
                    return peticionCorrespondiente;
                })
                .catch(response => {
                    error = response;

                    // Si en el servidor no se encontró una entidad con este código, o ya no tiene permiso para editarla,
                    // se quita de la lista local
                    if (response && (response.status === 404 || response.status === 401) ) {
                        this.eliminarEntidad(peticion);
                    } else if (get(response, 'error.errorCode') === PROPIEDAD_NO_EDITABLE) {
                        // Este error se da por problemas de sincronización, es necesario volver a pedir la petición
                        return this.obtener(peticion.id);
                    }
                })
                .then(peticion => {
                    if (!error) {
                        return peticion;
                    } else {
                        throw error;
                    }
                });
        } else {
            return this.$q.reject();
        }
    }

    _cambiarEstadoPeticiones(peticiones, dataExtra, paginaActual, endpoint, fnActualizacion) {
        const ids = map(peticiones, peticion => {
            return peticion.id
        });

        if (ids.length > 0) {
            let error = false;
            let peticionesConError, peticionesExitosas = [];

            return this.$http.post(endpoint, assign({}, {ids}, dataExtra))
                .then(response => {
                    return fnActualizacion(peticiones);
                })
                .catch(response => {
                    error = true;

                    if (get(response, 'error.errorCode') === ACTUALIZACION_EN_BULTO_CON_ERRORES) {
                        peticionesConError = response.error.fallos;
                        peticionesExitosas = response.error.exitos;
                        const peticionesErrorNoRecuperable = filter(peticionesConError, fallo => {
                            return ( (fallo.httpStatusCode === 500 && (fallo.errorCode !== ERROR_GENERAL && fallo.errorCode !== ERROR_DE_RED))
                                || fallo.httpStatusCode === 401 || fallo.httpStatusCode === 404);
                        });

                        return fnActualizacion(peticionesExitosas.concat(peticionesErrorNoRecuperable));
                    } else {
                        throw response;
                    }
                })
                .then(resultado => {
                    if (!error) {
                        return resultado;
                    } else {
                        throw {
                            peticiones: resultado.peticiones,
                            pagina: resultado.pagina,
                            peticionesExitosas,
                            peticionesConError
                        }
                    }
                });
        } else {
            return this.$q.reject();
        }
    }

    /**
     * Devuelve una lista de peticiones del servidor
     *
     * @param {number} pagina               -  Página que se desea.
     * @param {boolean} cambioOrden         -  Verdadero si el orden de las peticiones fue cambiado.
     * @param {boolean} busquedaActiva      -  Verdadero si hay algún filtro activado.
     * @param filtro                        -  Se puede usar para filtrar los resultados por varios campos.
     * @param {number} elementosPorPagina   -  Cantidad de peticiones que se desea recibir en una página.
     * @return {Promise.<Peticion[]>}       -  Se resuelve con el arreglo de peticiones que corresponden a una página determinada.
     */
    _obtenerServidor(pagina, cambioOrden, busquedaActiva, filtro, elementosPorPagina) {
        let totalPeticiones = 0;
        const paginaActual = !isNil(pagina) ? pagina : 1;
        const fin = paginaActual * this.AppConfig.elementosPorPagina;
        const inicio = fin - this.AppConfig.elementosPorPagina;

        let ordenarPor;
        if (cambioOrden) {
            this.peticiones = [];
        }
        if (!isNil(this.ordenActivo)) {
            let campoAOrdenar = this.ordenActivo[0];
            campoAOrdenar = campoAOrdenar.split('.')[0]; // Se hace esto por si el campo por el que se ordena es 'fecha.valor', por ejemplo
            // El API interpreta como orden descendente si se pasa el parámetros con un - delante, ejemplo: -fecha
            ordenarPor = `${this.ordenActivo[1] === 'desc' ? '-' : ''}${campoAOrdenar}`;
        }

        let params = {
            paginaActual,
            elementosPorPagina: !isNil(elementosPorPagina) ? elementosPorPagina : this.AppConfig.elementosPorPagina,
            ordenarPor
        };

        return this.$q.all([
            this.$http.get(this.ENDPOINT, { params: assign(params, filtro) }),
            this.etiquetasService.obtenerTodos()
        ]).then(resultado => {
            totalPeticiones = resultado[0].metadata.cantidadTotal;
            const peticiones = map(resultado[0].data, peticion => {
                return this.procesarEntidadRecibida(peticion, resultado[1]);
            });
            if (busquedaActiva) {
                this.peticiones = [];
            }
            this._procesarResultadosPaginados(peticiones, totalPeticiones, inicio, busquedaActiva);
            return peticiones;
        });
    }

    /**
     * Añade una página de peticiones obtenidas del API al arreglo total de peticiones, en la posición que le corresponde.
     * @param {Peticion[]} resultados           -  Representa una página de peticiones.
     * @param {number} total                    -  Total de peticiones existentes.
     * @param {number} inicio                   -  Posición inicial del arreglo donde se debe insertar la página.
     * @param {boolean} busquedaActiva          -  Verdadero si los resultados corresponden a filtros de búsqueda activos.
     * @private
     */
    _procesarResultadosPaginados(resultados, total, inicio, busquedaActiva) {
        if (busquedaActiva) {
            this.resultadosBusqueda = [];
            this.resultadosBusqueda.push(... fill(Array(total), undefined));
            forEach(resultados, (peticion, index) => {
                this.resultadosBusqueda[index+inicio] = peticion;
            });
        } else {
            this.peticiones = [];
            this.peticiones.push(... fill(Array(total), undefined));
            forEach(resultados, (peticion, index) => {
                this.peticiones[index+inicio] = peticion;
            });
        }


    }
}