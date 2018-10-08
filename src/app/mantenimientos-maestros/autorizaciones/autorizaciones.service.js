import findIndex from 'lodash/findIndex';
import isNil from 'lodash/isNil';
import isMatchWith from 'lodash/isMatchWith';
import isMatch from 'lodash/isMatch';
import fill from 'lodash/fill';
import map from 'lodash/map';
import get from 'lodash/get';
import forEach from 'lodash/forEach';
import format from 'date-fns/format';
import assign from 'lodash/assign';
import {elementoRequeridoEsNulo} from "../../common/validadores";


/* @ngInject */
/**
 * Esta clase es un servicio de Angular donde se almacena la lista de todos las autorizaciones existentes.
 */
export default class AutorizacionesService {
    /**
     * Una autorización está asociada a un flujo
     * @typedef {Object} Autorizacion
     * @property {number} id                        -  De sólo lectura. Se genera automáticamente en la Base de Datos para autorizaciones nuevas.
     * @property {number} codigo                    -  Lo mismo que id, se añade para mantener consistencia con otras entidades.
     * @property {string} nombre                    -  Nombre de la autorización.
     * @property {int} orden                        -  Orden dentro del flujo al que pertenece.
     * @property {Object} fechaLimite               -  Fecha límite de la autorización.
     * @property {Date} fechaLimite.valor           -  Su valor actual.
     * @property {string} fechaLimite.display       -  Cómo debe representarse esta fecha.
     * @property {Object} flujo                     -  Flujo al que pertenece la autorización
     * @property {Flujo} flujo.valor                -  Su valor actual.
     * @property {string} flujo.display             -  Cómo debe ser representado.
     * @property {Object} rol                       -  Rol que debe tener la persona para que pueda autorizar.
     * @property {Rol} rol.valor                    -  Su valor actual.
     * @property {string} rol.display               -  Cómo debe ser representado.
     * @property {boolean} tienePeticiones          -  Verdadero si la autorización ha sido usada en alguna petición
     *
     **/

    /**
     * @param $q                        -  Servicio de Angular para utilizar Promesas
     * @param $http                     -  Servicio de Angular para hacer llamadas HTTP
     * @param $timeout                  -  Servicio de Angular para diferir ejecución de funciones.
     * @param ErroresValidacionMaestros
     * @param AppConfig                 -  Contiene la configuración del app.
     * @param Mediator
     *
     **/
    constructor($q, $http, $timeout, ErroresValidacionMaestros, AppConfig, Mediator) {
        // Constantes del servicio
        /** @private */
        this.ENDPOINT = '/autorizaciones';

        /** @private */
        this.$q = $q;
        /** @private */
        this.$http = $http;
        /** @private */
        this.$timeout = $timeout;
        /** @private */
        this.ErroresValidacionMaestros = ErroresValidacionMaestros;
        /** @private */
        this.AppConfig = AppConfig;
        /** @private */
        this.Mediator = Mediator;

        /** @type {Autorizacion[]} */
        this.autorizaciones = [];

        /** @private */
        this.ordenActivo = null;
        /** @private */
        this.filtrosBusqueda = null;
    }

    /**
     * Le aplica algunas transformaciones a una autorización recibida del API. Añade los permisos de edición y también le
     * agrega una propiedad para facilitar la visualización de varias de sus propiedaddes.
     *
     * @param {Object} entidad      -  Representa una autorización recibida del API
     * @returns {Autorizacion}             -  La misma entidad, con las transformaciones mencionadas.
     */
    procesarEntidadRecibida(entidad) {
        let autorizacionProcesada = {
            codigo: entidad.id
        };

        for (let prop in entidad) {
            if (prop === 'fechaLimite') {
                const fechaObj = entidad[prop] ? new Date(Date.parse(entidad[prop])) : null;
                autorizacionProcesada[prop] = {
                    valor: fechaObj,
                    display: fechaObj ? format(fechaObj, this.AppConfig.formatoFechas) : ''
                };
            } else if (prop === 'flujo') {
                autorizacionProcesada[prop] = {
                    valor: entidad[prop],
                    display: entidad[prop] ? entidad[prop].evento : ''
                }
            } else if (prop === 'rol') {
                autorizacionProcesada[prop] = {
                    valor: entidad[prop],
                    display: entidad[prop] ? entidad[prop].nombre : ''
                }
            } else {
                autorizacionProcesada[prop] = entidad[prop];
            }
        }

        autorizacionProcesada.editable = true;
        autorizacionProcesada.eliminable = true;

        return autorizacionProcesada;
    }

    /**
     * Le aplica algunas transformaciones a una autorización necesarias para poder enviarla correctamente al API.
     *
     * @param {Autorizacion} autorizacion
     * @return {Object}
     * @private
     */
    _procesarEntidadAEnviar(autorizacion) {
        let datos = {};

        for (let prop in autorizacion) {
            if (prop === 'flujo' || prop === 'rol') {
                datos[prop] = autorizacion[prop].id;
            } else {
                datos[prop] = autorizacion[prop];
            }
        }

        return datos;
    }

    /**
     * Determina si una autorización es válida. Se debe llamar a este método antes de crear o editar una autorización.
     * Realiza varias comprobaciones:
     *  1 - Que el nombre esté definido, ya que es un campo requerido.
     *  2 - Que el orden esté definido, ya que es un campo requerido.
     *  3 - Que no exista otra autorización con la misma combinación de flujo + orden.
     *
     * @param {Autorizacion} autorizacion
     * @return {Promise<void>}                  - Se resuelve si la entidad es válida. En caso contrario, rechaza la promesa con
     *                                            el error específico.
     * @private
     */
    _validarEntidad(autorizacion) {
        if (elementoRequeridoEsNulo(autorizacion.nombre)) {
            return this.$q.reject(this.ErroresValidacionMaestros.FALTA_REQUERIDO);
        } else if (elementoRequeridoEsNulo(autorizacion.orden)) {
            return this.$q.reject(this.ErroresValidacionMaestros.FALTA_REQUERIDO);
        } else {
            const indiceRepetido = findIndex(this.autorizaciones, (item) => {
               return !isNil(item) && item.flujo.valor.id === autorizacion.flujo.id && item.orden === autorizacion.orden && item.id !== autorizacion.id;
            });
            if (indiceRepetido > -1) {
                return this.$q.reject(this.ErroresValidacionMaestros.YA_EXISTE_ORDEN);
            }
        }

        return this.$q.resolve();
    }

    /**
     * Devuelve el índice de una autorización en la lista que las contiene a todas si sus datos son diferentes a los que
     * están almacenados en dicha lista. Este método es útil a la hora de editar una autorización, para no hacer una llamada
     * al API a menos que los datos del mismo hayan cambiado.
     *
     * @param {Autorizacion} autorizacion
     * @returns {number}               -  La posición de esa autorización en la lista según su código o -1 si sus datos son idénticos.
     * @private
     */
    _indiceEntidadCambiada(autorizacion) {
        if (isNil(autorizacion)) { return -1 }
        let indiceExistente = findIndex(this.autorizaciones, ['id', autorizacion.id]);
        if (indiceExistente < 0) { return -1 }

        let iguales = isMatchWith(this.autorizaciones[indiceExistente], autorizacion, (objValue, srcValue, key) => {
            if (key === 'flujo' || key === 'rol') {
                return get(objValue.valor, 'id') === get(srcValue.valor, 'id');
            } else if (key === 'fechaLimite') {
                return objValue.display === srcValue.display;
            } else if (key === 'tienePeticiones') {
                return true;
            }

            return undefined; // Cuando se devuelve undefined la comparación la hace internamente isMatch()
        });

        return iguales ? -1 : indiceExistente;
    }

    /**
     * Elimina una autorización de la lista
     *
     * @param {Autorizacion} autorizacion
     * @private
     */
    _eliminarEntidad(autorizacion) {
        let indiceExistente = findIndex(this.autorizaciones, ['id', autorizacion.id]);
        if (indiceExistente > -1) {
            this.autorizaciones.splice(indiceExistente, 1);
        }
    }

    /**
     * Devuelve una autorización dado su código
     * @param {number} codigo
     * @return {Promise.<Autorizacion>}       -  Se resuelve con la autorización correspondiente a ese id.
     */
    obtener(codigo) {
        return this.$http.get(`${this.ENDPOINT}/${codigo}`)
            .then(response => {
                return this.procesarEntidadRecibida(response.data);
            })
            .then(autorizacion => {
                let indiceExistente = findIndex(this.autorizaciones, ['id', codigo]);
                if (indiceExistente > -1) {
                    this.autorizaciones[indiceExistente] = autorizacion;
                }
                return autorizacion;
            });
    }

    /**
     * Devuelve una lista de autorizaciones. Utiliza paginación porque la cantidad total de autorizaciones puede llegar a ser
     * considerable.
     *
     * @param {number} pagina               -  Página que se desea.
     * @param {[string, string]} orden      -  Cómo deben estar ordenados los resultados.
     * @param filtro                        -  Se puede usar para filtrar los resultados por varios campos.
     * @param {number} elementosPorPagina   -  Cantidad de autorizaciones que se desea recibir en una página.
     * @return {Promise.<Autorizacion[]>}   -  Se resuelve con el arreglo de autorizaciones que corresponden a una página determinada.
     */
    obtenerTodos(pagina, orden, filtro, elementosPorPagina) {
        let totalAutorizaciones = 0;
        const paginaActual = !isNil(pagina) ? pagina : 1;
        const fin = paginaActual * this.AppConfig.elementosPorPagina;
        const inicio = fin - this.AppConfig.elementosPorPagina;

        let ordenarPor;
        if (!isNil(orden) && (isNil(this.ordenActivo) || orden[0] !== this.ordenActivo[0] || orden[1] !== this.ordenActivo[1])) {
            this.autorizaciones = [];
            this.ordenActivo = orden;
        }
        if (!isNil(this.ordenActivo)) {
            let campoAOrdenar = this.ordenActivo[0];
            campoAOrdenar = campoAOrdenar.split('.')[0]; // Se hace esto por si el campo por el que se ordena es 'fecha.valor', por ejemplo
            // El API interpreta como orden descendente si se pasa el parámetros con un - delante, ejemplo: -fecha
            ordenarPor = `${this.ordenActivo[1] === 'desc' ? '-' : ''}${campoAOrdenar}`;
        }

        if (filtro === null || !isMatch(this.filtrosBusqueda, filtro)) {
            this.filtrosBusqueda = filtro;
        }

        const params = assign({
            paginaActual,
            elementosPorPagina: !isNil(elementosPorPagina) ? elementosPorPagina : this.AppConfig.elementosPorPagina,
            ordenarPor
        }, this.filtrosBusqueda);
        return this.$http.get(this.ENDPOINT, {
            params
        }).then(response => {
            totalAutorizaciones = response.metadata.cantidadTotal;
            const autorizaciones = map(response.data, autorizacion => {
                return this.procesarEntidadRecibida(autorizacion);
            });
            this._procesarResultadosPaginados(autorizaciones, totalAutorizaciones, inicio);
            return autorizaciones;
        });
    }

    /**
     * Añade una página de autorizaciones obtenidas del API al arreglo total de autorizaciones, en la posición que le corresponde.
     * @param {Autorizacion[]} resultados       -  Representa una página de autorizaciones.
     * @param {number} total                    -  Total de autorizaciones existentes.
     * @param {number} inicio                   -  Posición inicial del arreglo donde se debe insertar la página.
     * @private
     */
    _procesarResultadosPaginados(resultados, total, inicio) {
        this.autorizaciones = [];
        this.autorizaciones.push(... fill(Array(total), undefined));
        forEach(resultados, (autorizacion, index) => {
            this.autorizaciones[index+inicio] = autorizacion;
        });
    }

    /**
     * Vuelve a pedir la página en la que se estaba al API para comprobar si la autorización creada/editada está
     * presente en esa página. Devuelve el campo pagina: -1 si no la encuentra, y además siempre devuelve la lista de
     * autorizaciones presentes en la página.
     *
     * @param {Autorizacion} autorizacionCambiada
     * @param {number} paginaActual
     * @return {Promise.<{pagina: number, autorizacionesPagina: Autorizacion[]}>}
     * @private
     */
    _posicionarAutorizacionCambiada(autorizacionCambiada, paginaActual) {
        return this.obtenerTodos(paginaActual)
            .then(autorizaciones => {
                let indexEval = findIndex(autorizaciones, ['id', autorizacionCambiada.id]);
                let pagina = indexEval < 0 ? -1 : paginaActual;
                return { pagina, autorizacionesPagina: autorizaciones }
            });
    }

    /**
     * Crea una nueva autorización.
     * @param {Autorizacion} datosAutorizacion      -  Datos de la autorización que se desea crear.
     * @param {number} paginaActual                 -  Página de autorizaciones que se está visualizando en ese momento.
     * @return {Promise.<{autorizacion:Autorizacion, pagina:number, autorizacionesPagina: Autorizacion[]}>}
     */
    crear(datosAutorizacion, paginaActual) {
        let nuevaAutorizacion;
        return this._validarEntidad(datosAutorizacion)
            .then(() => {
                let datos = this._procesarEntidadAEnviar(datosAutorizacion);
                return this.$http.post(this.ENDPOINT, datos);
            })
            .then(response => {
                const autorizacionRecibida = response.data;
                datosAutorizacion.id = autorizacionRecibida.id;
                nuevaAutorizacion = this.procesarEntidadRecibida(datosAutorizacion);
                return this._posicionarAutorizacionCambiada(nuevaAutorizacion, paginaActual);
            })
            .then(resultado => {
                return {autorizacion: nuevaAutorizacion, pagina: resultado.pagina, autorizacionesPagina: resultado.autorizacionesPagina};
            });
    }

    /**
     * Edita una autorización existente
     * @param {Autorizacion} autorizacion   -  Datos de la autorización que se desea editar.
     * @param {number} paginaActual         -  Página de autorizaciones que se está visualizando en ese momento.
     * @return {Promise.<{autorizacion:Autorizacion, pagina:number, autorizacionesPagina: Autorizacion[]}>}
     */
    editar(autorizacion, paginaActual) {
        let autorizacionEditada;
        return this._validarEntidad(autorizacion)
            .then(() => {
                const autorizacionProcesada = this.procesarEntidadRecibida(autorizacion);
                let indiceExistente = this._indiceEntidadCambiada(autorizacionProcesada);
                // Si los datos de la autorización no han cambiado, se rechaza la edición
                if (indiceExistente >= 0) {
                    let datos = this._procesarEntidadAEnviar(autorizacion);
                    return this.$http.put(`${this.ENDPOINT}/${autorizacion.codigo}`, datos)
                        .then(response => {
                            autorizacionEditada = autorizacionProcesada;
                            return this._posicionarAutorizacionCambiada(autorizacionEditada, paginaActual);
                        })
                        .then(resultado => {
                            // Notifica a las entidades que contengan una referencia a esta autorización que fue actualizada.
                            this.$timeout(() => {
                                this.Mediator.publish('autorizacion:edicion', autorizacionEditada);
                            }, 1000, false);

                            return {autorizacion: autorizacionEditada, pagina: resultado.pagina, autorizacionesPagina: resultado.autorizacionesPagina};
                        })
                        .catch(response => {
                            // Si el API devuelve que no encontró esa entidad, se elimina de la lista local
                            if (response && response.status === 404) {
                                this._eliminarEntidad(autorizacion);
                            }
                            throw response;
                        })
                } else {
                    return this.$q.reject();
                }
            });
    }

    /**
     * Elimina una autorización.
     * @param {Autorizacion} autorizacion
     * @return {Promise<Autorizacion>}   -  Se resuelve con la autorización eliminada.
     */
    eliminar(autorizacion) {
        return this.$http.delete(`${this.ENDPOINT}/${autorizacion.codigo}`)
            .then(response => {
                this._eliminarEntidad(autorizacion);
                return response.data;
            })
            .catch(response => {
                if (response && response.status === 404) {
                    this._eliminarEntidad(autorizacion);
                }
                throw response;
            });
    }
}