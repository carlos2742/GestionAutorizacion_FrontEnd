import findIndex from 'lodash/findIndex';
import find from 'lodash/find';
import isNil from 'lodash/isNil';
import isMatch from 'lodash/isMatch';
import isMatchWith from 'lodash/isMatchWith';
import fill from 'lodash/fill';
import map from 'lodash/map';
import forEach from 'lodash/forEach';
import assign from 'lodash/assign';
import reduce from 'lodash/reduce';
import orderBy from 'lodash/orderBy';
import get from 'lodash/get';
import format from 'date-fns/format';
import {
    AUTORIZACION_APROBADA, AUTORIZACION_PENDIENTE, AUTORIZACION_RECHAZADA, ETIQUETA_NOK_DESC,
    ETIQUETA_OK_DESC
} from "../../common/constantes";


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
     */

    /**
     * @param $q                        -  Servicio de Angular para utilizar Promesas
     * @param $http                     -  Servicio de Angular para hacer llamadas HTTP
     * @param EtiquetasService
     * @param PersonalService
     * @param AppConfig                 -  Contiene la configuración del app.
     *
     **/
    constructor($q, $http, EtiquetasService, PersonalService, AppConfig) {
        // Constantes del servicio
        /** @private */
        this.ENDPOINT = '/peticiones';

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
                peticionProcesada[prop] = map(entidad[prop], autorizacion => {
                    return this._procesarAutorizacion(autorizacion);
                })
            } else {
                peticionProcesada[prop] = entidad[prop];
            }
        }

        peticionProcesada.editable = false;
        peticionProcesada.eliminable = false;

        return peticionProcesada;
    }

    _procesarAutorizacion(autorizacion) {
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