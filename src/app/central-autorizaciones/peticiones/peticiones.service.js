import findIndex from 'lodash/findIndex';
import find from 'lodash/find';
import filter from 'lodash/filter';
import includes from 'lodash/includes';
import isNil from 'lodash/isNil';
import isUndefined from 'lodash/isUndefined';
import assign from 'lodash/assign';
import lowerCase from 'lodash/lowerCase';
import capitalize from 'lodash/capitalize';
import join from 'lodash/join';
import fill from 'lodash/fill';
import map from 'lodash/map';
import forEach from 'lodash/forEach';
import remove from 'lodash/remove';
import omit from 'lodash/omit';
import get from 'lodash/get';
import format from 'date-fns/format';
import toDate from 'date-fns/toDate';
import {
    ACTUALIZACION_EN_BULTO_CON_ERRORES, AUTORIZACION_ANULADA,
    AUTORIZACION_APROBADA, AUTORIZACION_PENDIENTE, AUTORIZACION_RECHAZADA,
    ETIQUETA_NOK_DESC,
    ETIQUETA_OK_DESC, PROPIEDAD_NO_EDITABLE
} from '../../common/constantes';
import {procesarFechaAEnviar} from '../../common/utiles';


/* @ngInject */
/**
 * Esta clase es un servicio de Angular donde se almacena la lista de todos las peticiones asociadas a un usuario.
 */
export default class PeticionesService {

    /**
     * @typedef {Object} Peticion
     * @property {number} id                        -  De sólo lectura. Se genera automáticamente en la Base de Datos para peticiones nuevas.
     * @property {number} codigo                    -  Lo mismo que id, se añade para mantener consistencia con otras entidades.
     * @property {Object} proceso                   -  Proceso al que pertenece la petición
     * @property {Proceso} proceso.valor            -  Su valor actual.
     * @property {string} proceso.display           -  Cómo debe ser representado.
     * @property {Object} solicitante               -  Persona que realiza la petición.
     * @property {Persona} solicitante.valor        -  Su valor actual.
     * @property {string} solicitante.display       -  Cómo debe ser representado.
     * @property {string} tipoSolicitud1            -  Primer tipo de solicitud.
     * @property {string} tipoSolicitud2            -  Segundo tipo de solicitud.
     * @property {string} observaciones             -  Observaciones.
     * @property {Object} informacionExtra          -  Información adicional relacionada con la petición.
     * @property {string} estadoInterno             -  Estado final de la petición.
     * @property {Object} estado                    -  Estado actual de la petición.
     * @property {Object} estado.valor              -  Su valor actual.
     * @property {string} estado.display            -  Cómo debe representarse.
     * @property {Object} fechaCreacion             -  Fecha de creación de la petición.
     * @property {Date} fechaCreacion.valor         -  Su valor actual.
     * @property {string} fechaCreacion.display     -  Cómo debe representarse esta fecha.
     * @property {Object} fechaNecesaria            -  Fecha necesaria de la petición.
     * @property {Date} fechaNecesaria.valor        -  Su valor actual.
     * @property {string} fechaNecesaria.display    -  Cómo debe representarse esta fecha.
     *
     * @property {Object[]} actividades                       -  Lista de autorizadores que ya aprobaron o rechazaron esta solicitud.
     * @property {Object} actividades[0].autorizador          -  Datos del autorizador
     * @property {Object} actividades[0].autorizador.valor    -  Su valor actual
     * @property {string} actividades[0].autorizador.display  -  Cómo debe ser representado.
     * @property {Object} actividades[0].estado               -  Estado de esta actividad.
     * @property {string} actividades[0].estado.valor         -  Su valor actual.
     * @property {string} actividades[0].estado.display       -  Cómo debe ser representado.
     * @property {Object} actividades[0].fecha                -  Fecha en que realizó la autorización.
     * @property {Date} actividades[0].fecha.valor            -  Su valor actual.
     * @property {string} actividades[0].fecha.display        -  Cómo debe representarse esta fecha.
     *
     * @property {Adjunto[]} adjuntos                            -  Lista de adjuntos de la petición.
     *
     * @property {number} cantidadActividadesCompletadas         -  Número de actividades realizadas para la petición.
     * @property {number} cantidadActividadesTotales             -  Número total de actividades requeridas por la petición.
     * @property {number} cantidadAdjuntos                       -  Número total de adjuntos de la petición.
     * @property {number} cantidadMensajes                       -  Número total de mensajes de la petición.
     *
     * @property {string} enlaceOrigen                        - Enlace a la aplicación desde donde se generó la petición.
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
        this.ENDPOINT_TIPOS_SOLICITUD = '/tipos_solicitud';
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
            if (prop === 'proceso') {
                peticionProcesada[prop] = {
                    valor: entidad[prop],
                    display: entidad[prop] ? entidad[prop].evento : ''
                };
            } else if (prop === 'solicitante') {
                const personaProcesada = entidad[prop] ? this.personalService.procesarPersonaRecibida(entidad[prop]) : null;
                peticionProcesada[prop] = {
                    valor: personaProcesada,
                    display: personaProcesada ? personaProcesada.nombreApellidos : ''
                };
            } else if (prop === 'fechaCreacion' || prop === 'fechaNecesaria') {
                const fechaNecesariaObj = entidad[prop] ? new Date(Date.parse(entidad[prop])) : null;
                peticionProcesada[prop] = {
                    valor: fechaNecesariaObj,
                    display: fechaNecesariaObj ? format(fechaNecesariaObj, this.AppConfig.formatoFechas) : ''
                };
            } else if (prop === 'fechaUltimoMensaje') {
                const fechaObj = entidad[prop] ? new Date(Date.parse(entidad[prop])) : null;
                peticionProcesada[prop] = {
                    valor: fechaObj,
                    display: fechaObj ? format(fechaObj, `${this.AppConfig.formatoFechas} HH:mm:ss`) : ''
                };
            } else if (prop === 'informacionExtra') {
                const info = entidad.informacionExtra;
                peticionProcesada[prop] = this._procesarInformacionExtra(info);
            } else if (prop === 'estado') {
                const etiqueta = find(etiquetas, etiqueta => {
                    return etiqueta.estado === entidad[prop] && etiqueta.proceso.valor.id === entidad.proceso.id;
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
                        case AUTORIZACION_ANULADA:
                            descripcion = this.AppConfig.etiquetaPorDefectoAnulada;
                            break;
                    }
                }

                peticionProcesada[prop] = {
                    valor: entidad[prop],
                    display: descripcion
                };
            } else if (prop === 'actividades') {
                peticionProcesada[prop] = map(entidad[prop], (actividad, indice) => {
                    return this._procesarActividad(actividad, indice, entidad.cantidadActividadesTotales);
                });
            } else if (prop === 'peticionQueAnula' || prop === 'peticionAnulacion') {
                peticionProcesada[prop] = entidad[prop];
                if (!isNil(peticionProcesada[prop])) {
                    peticionProcesada[prop].informacionExtra = this._procesarInformacionExtra(peticionProcesada[prop].informacionExtra);
                }
            } else {
                peticionProcesada[prop] = entidad[prop];
            }
        }

        peticionProcesada.displayOrden = `${entidad.cantidadActividadesCompletadas}/${entidad.cantidadActividadesTotales}`;

        peticionProcesada.displayTipoSolicitud = entidad.tipoSolicitud1;
        if (!isNil(entidad.tipoSolicitud2)) {
            peticionProcesada.displayTipoSolicitud = `${peticionProcesada.displayTipoSolicitud}-${entidad.tipoSolicitud2}`;
        }

        if (entidad.proceso.aplicacion.id === this.AppConfig.idCalendarios && !isNil(peticionProcesada.fechaNecesaria.valor)) {
            const usuario = entidad.solicitante.nInterno;
            const anno = peticionProcesada.fechaNecesaria.valor.getFullYear();
            peticionProcesada.enlaceOrigen = this.AppConfig.urlEnlaceCalendarios.replace('<usuario>', usuario).replace('<anno>', anno);
        }

        peticionProcesada.editable = false;
        peticionProcesada.eliminable = false;

        return peticionProcesada;
    }

    _procesarInformacionExtra(info) {
        let resultado = Object.keys(info).length > 0 ? {} : null;
        for (let key in info) {
            const arregloPalabras = lowerCase(key).split(' ');
            forEach(arregloPalabras, (palabra, indice) => {
                arregloPalabras[indice] = capitalize(palabra);
            });

            let valorProcesado = info[key];
            const fecha = toDate(info[key]);
            if (!isNaN(fecha)) {
                let formato = this.AppConfig.formatoFechas;
                if ( !(fecha.getHours() === 0 && fecha.getMinutes() === 0) && !(fecha.getHours() === 23 && fecha.getMinutes() === 59) ) {
                    formato = `${formato} HH:mm`;
                }
                valorProcesado = format(info[key], formato);
            }

            resultado[key] = {
                valor: valorProcesado,
                label: join(arregloPalabras, ' ')
            };
        }

        return resultado;
    }

    _procesarActividad(actividad, indice, totalActividades) {
        let actividadProcesada = {
            codigo: actividad.actividad
        };
        for (let prop in actividad) {
            if (prop === 'autorizador') {
                const personaProcesada = actividad[prop] ? this.personalService.procesarPersonaRecibida(actividad[prop]) : null;
                actividadProcesada[prop] = {
                    valor: personaProcesada,
                    display: personaProcesada ? personaProcesada.nombreApellidos : ''
                };
            } else if (prop === 'fecha') {
                const fechaNecesariaObj = actividad[prop] ? new Date(Date.parse(actividad[prop])) : null;
                actividadProcesada[prop] = {
                    valor: fechaNecesariaObj,
                    display: fechaNecesariaObj ? format(fechaNecesariaObj, `${this.AppConfig.formatoFechas} HH:mm`) : ''
                };
            } else if (prop === 'estado') {
                actividadProcesada[prop] = {
                    valor: actividad[prop],
                    display: actividad[prop] === AUTORIZACION_APROBADA ? ETIQUETA_OK_DESC : ETIQUETA_NOK_DESC
                };
            } else {
                actividadProcesada[prop] = actividad[prop];
            }

            actividadProcesada.displayOrden = `${indice+1}/${totalActividades}`;
        }
        return actividadProcesada;
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
     * @param {boolean} peticionesPropias    -  Verdadero si lo que se desean son las peticiones propias.
     * @param {number} pagina               -  Página que se desea.
     * @param {[string, string]} orden      -  Cómo deben estar ordenados los resultados.
     * @param filtro                        -  Se puede usar para filtrar los resultados por varios campos.
     * @param {number} elementosPorPagina   -  Cantidad de peticiones que se desea recibir en una página.
     * @param {boolean} persistirResultado
     * @param {boolean} batch
     * @return {Promise.<Peticion[]>}       -  Se resuelve con el arreglo de peticiones que corresponden a una página determinada.
     */
    obtenerTodos(peticionesPropias, pagina, orden, filtro, elementosPorPagina, persistirResultado, batch) {
        let cambioOrden = false;
        const guardarCambios = isNil(persistirResultado) || persistirResultado;

        if (guardarCambios) {
            if (!isNil(orden) && (isNil(this.ordenActivo) || orden[0] !== this.ordenActivo[0] || orden[1] !== this.ordenActivo[1])) {
                this.ordenActivo = orden;
                cambioOrden = true;
            }

            if (!isUndefined(filtro)) {
                this.filtrosBusqueda = filtro;
            }
        }

        return this._obtenerServidor(peticionesPropias, pagina, cambioOrden, this.filtrosBusqueda, elementosPorPagina, persistirResultado, batch);
    }

    obtenerTiposSolicitud() {
        return this.$http.get(this.ENDPOINT_TIPOS_SOLICITUD)
            .then(response => {
                return response.data;
            });
    }

    aprobar(peticiones, paginaActual) {
        return this._cambiarEstadoPeticiones(peticiones, {}, paginaActual, this.ENDPOINT_APROBAR, AUTORIZACION_APROBADA);
    }

    rechazar(peticiones, paginaActual) {
        return this._cambiarEstadoPeticiones(peticiones, {}, paginaActual, this.ENDPOINT_RECHAZAR, AUTORIZACION_RECHAZADA);
    }

    _actualizarPeticiones(peticiones, respuestaServidor, paginaActual, accion) {
        return this.etiquetasService.obtenerTodos()
            .then(etiquetas => {
                let pagina = paginaActual;
                const fin = paginaActual * this.AppConfig.elementosPorPagina;
                const inicio = fin - this.AppConfig.elementosPorPagina;
                const totalPaginas = Math.ceil(this.peticiones.length / this.AppConfig.elementosPorPagina);

                let actualizarPagina = false;
                if (peticiones.length !== respuestaServidor.length) {
                    actualizarPagina = true;
                } else {
                    forEach(respuestaServidor, resultado => {
                        const indicePeticion = findIndex(this.peticiones, ['id', resultado.id]);

                        if (this._sigueSiendoVisible(resultado)) {
                            const peticionCorrespondiente = this.peticiones[indicePeticion];

                            peticionCorrespondiente.actividades.push(
                                this._procesarActividad({
                                    actividad: peticionCorrespondiente.cantidadActividadesCompletadas + 1,
                                    autorizador: this.usuario,
                                    estado: accion,
                                    fecha: new Date().toISOString().replace('Z', '')
                                }, peticionCorrespondiente.cantidadActividadesCompletadas, peticionCorrespondiente.cantidadActividadesTotales)
                            );

                            const objHidratado = assign({},
                                omit(resultado, ['solicitante', 'proceso', 'peticionQueAnula', 'peticionAnulacion']),
                                {proceso: peticionCorrespondiente.proceso.valor, solicitante: peticionCorrespondiente.solicitante.valor}
                            );
                            assign(peticionCorrespondiente, this.procesarEntidadRecibida( objHidratado, etiquetas) );
                        } else {
                            this.peticiones.splice(indicePeticion, 1);
                            if (pagina < totalPaginas) {
                                actualizarPagina = true;
                            }
                        }
                    });

                    if (inicio >= this.peticiones.length) {
                        if (paginaActual > 1) {
                            pagina -= 1;
                            actualizarPagina = true;
                        } else {
                            return {
                                peticiones: [],
                                pagina
                            }
                        }
                    }
                }

                if (actualizarPagina) {
                    return this.obtenerTodos(false, pagina, undefined, undefined)
                        .then(peticionesPagina => {
                            return {
                                peticiones: peticionesPagina,
                                pagina
                            }
                        });
                } else {
                    return {
                        peticiones: this.peticiones.slice(inicio, fin),
                        pagina
                    }
                }
            });
    }

    _sigueSiendoVisible(peticion) {
        if (peticion.estadoInterno === AUTORIZACION_PENDIENTE) {
            return this.usuario.esGestor && !get(this.filtrosBusqueda, 'idRol');
        } else {
            return isNil(this.filtrosBusqueda) || !this.filtrosBusqueda.estadosInternos || includes(this.filtrosBusqueda.estadosInternos, peticion.estadoInterno);
        }
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
                'proceso': peticion.proceso.valor.id,
                'estado': peticion.estado.valor,
                'fechaCreacion': procesarFechaAEnviar(peticion.fechaCreacion.valor),
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

    _cambiarEstadoPeticiones(peticiones, dataExtra, paginaActual, endpoint, accion) {
        const ids = map(peticiones, peticion => {
            return peticion.id
        });

        if (ids.length > 0) {
            let error = false;
            let peticionesConError, peticionesExitosas = [];

            return this.$http.post(endpoint, assign({}, {ids}, dataExtra))
                .then(response => {
                    return this._actualizarPeticiones(peticiones, response.data, paginaActual, accion);
                })
                .catch(response => {
                    error = true;

                    if (get(response, 'error.errorCode') === ACTUALIZACION_EN_BULTO_CON_ERRORES) {
                        peticionesConError = response.error.fallos;
                        peticionesExitosas = response.error.exitos;
                        return this._actualizarPeticiones(peticiones, response.error.exitos, paginaActual, accion);
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
     * @param {boolean} peticionesPropias    -  Verdadero si lo que se desean son las peticiones propias.
     * @param {number} pagina               -  Página que se desea.
     * @param {boolean} cambioOrden         -  Verdadero si el orden de las peticiones fue cambiado.
     * @param filtro                        -  Se puede usar para filtrar los resultados por varios campos.
     * @param {number} elementosPorPagina   -  Cantidad de peticiones que se desea recibir en una página.
     * @param {boolean} persistirResultado
     * @param {boolean} batch
     * @return {Promise.<Peticion[]>}       -  Se resuelve con el arreglo de peticiones que corresponden a una página determinada.
     */
    _obtenerServidor(peticionesPropias, pagina, cambioOrden, filtro, elementosPorPagina, persistirResultado, batch) {
        let totalPeticiones = 0;
        const paginaActual = !isNil(pagina) ? pagina : 1;
        const fin = paginaActual * this.AppConfig.elementosPorPagina;
        const inicio = fin - this.AppConfig.elementosPorPagina;

        const guardarCambios = isNil(persistirResultado) || persistirResultado;

        let ordenarPor;
        if (guardarCambios && cambioOrden) {
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
            ordenarPor,
            peticionesPropias,
            batch
        };

        return this.$q.all([
            this.$http.get(this.ENDPOINT, { params: assign(params, filtro) }),
            this.etiquetasService.obtenerTodos()
        ]).then(resultado => {
            const peticiones = map(resultado[0].data, peticion => {
                return this.procesarEntidadRecibida(peticion, resultado[1]);
            });
            if (guardarCambios) {
                totalPeticiones = resultado[0].metadata.cantidadTotal;
                this._procesarResultadosPaginados(peticiones, totalPeticiones, inicio);
            }
            return peticiones;
        });
    }

    /**
     * Añade una página de peticiones obtenidas del API al arreglo total de peticiones, en la posición que le corresponde.
     * @param {Peticion[]} resultados           -  Representa una página de peticiones.
     * @param {number} total                    -  Total de peticiones existentes.
     * @param {number} inicio                   -  Posición inicial del arreglo donde se debe insertar la página.
     * @private
     */
    _procesarResultadosPaginados(resultados, total, inicio) {
        this.peticiones = [];
        this.peticiones.push(...fill(Array(total), undefined));
        forEach(resultados, (peticion, index) => {
            this.peticiones[index + inicio] = peticion;
        });
    }
}