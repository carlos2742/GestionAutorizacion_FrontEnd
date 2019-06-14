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
import {elementoRequeridoEsNulo} from '../../common/validadores';
import {EVENTO_ACTUALIZACION_PROCESO} from "../procesos/procesos.service";
import {EVENTO_ACTUALIZACION_ROL} from "../roles/roles.service";


export const EVENTO_ACTUALIZACION_ACTIVIDAD = 'actividad:edicion';


/* @ngInject */
/**
 * Esta clase es un servicio de Angular donde se almacena la lista de todos las actividades existentes.
 */
export default class ActividadesService {
    /**
     * Una actividad está asociada a un proceso
     * @typedef {Object} Actividad
     * @property {number} id                        -  De sólo lectura. Se genera automáticamente en la Base de Datos para actividades nuevas.
     * @property {number} codigo                    -  Lo mismo que id, se añade para mantener consistencia con otras entidades.
     * @property {string} nombre                    -  Nombre de la actividad.
     * @property {int} orden                        -  Orden dentro del proceso al que pertenece.
     * @property {Object} fechaLimite               -  Fecha límite de la actividad.
     * @property {Date} fechaLimite.valor           -  Su valor actual.
     * @property {string} fechaLimite.display       -  Cómo debe representarse esta fecha.
     * @property {Object} proceso                   -  Proceso al que pertenece la actividad
     * @property {Proceso} proceso.valor            -  Su valor actual.
     * @property {string} proceso.display           -  Cómo debe ser representado.
     * @property {Object} rol                       -  Rol que debe tener la persona para que pueda autorizar.
     * @property {Rol} rol.valor                    -  Su valor actual.
     * @property {string} rol.display               -  Cómo debe ser representado.
     * @property {boolean} tienePeticiones          -  Verdadero si la actividad ha sido usada en alguna petición
     *
     **/

    /**
     * @param $q                        -  Servicio de Angular para utilizar Promesas
     * @param $http                     -  Servicio de Angular para hacer llamadas HTTP
     * @param $timeout
     * @param EtiquetasService
     * @param ErroresValidacionMaestros
     * @param Mediator
     * @param AppConfig                 -  Contiene la configuración del app.
     *
     **/
    constructor($q, $http, $timeout, EtiquetasService, ErroresValidacionMaestros, Mediator, AppConfig) {
        // Constantes del servicio
        /** @private */
        this.ENDPOINT = '/actividades';

        /** @private */
        this.$q = $q;
        /** @private */
        this.$http = $http;
        /** @private */
        this.$timeout = $timeout;
        /** @private */
        this.etiquetasService = EtiquetasService;
        /** @private */
        this.ErroresValidacionMaestros = ErroresValidacionMaestros;
        /** @private */
        this.Mediator = Mediator;
        /** @private */
        this.AppConfig = AppConfig;

        this.Mediator.subscribe(EVENTO_ACTUALIZACION_PROCESO, (data) => {
            forEach(this.actividades, actividad => {
                if (actividad.proceso.valor && actividad.proceso.valor.id === data.id) {
                    actividad.proceso = {
                        valor: data,
                        display: data.evento
                    }
                }
            });
        });
        this.Mediator.subscribe(EVENTO_ACTUALIZACION_ROL, (data) => {
            forEach(this.actividades, actividad => {
                if (actividad.rol.valor && actividad.rol.valor.id === data.id) {
                    actividad.rol = {
                        valor: data,
                        display: data.nombre
                    }
                }
            });
        });

        /** @type {Actividad[]} */
        this.actividades = [];

        /** @private */
        this.ordenActivo = null;
        /** @private */
        this.filtrosBusqueda = null;
    }

    /**
     * Le aplica algunas transformaciones a una actividad recibida del API. Añade los permisos de edición y también le
     * agrega una propiedad para facilitar la visualización de varias de sus propiedaddes.
     *
     * @param {Object} entidad      -  Representa una actividad recibida del API
     * @returns {Actividad}             -  La misma entidad, con las transformaciones mencionadas.
     */
    procesarEntidadRecibida(entidad) {
        let actividadProcesada = {
            codigo: entidad.id
        };

        for (let prop in entidad) {
            if (prop === 'fechaLimite') {
                const fechaObj = entidad[prop] ? new Date(Date.parse(entidad[prop])) : null;
                actividadProcesada[prop] = {
                    valor: fechaObj,
                    display: fechaObj ? format(fechaObj, this.AppConfig.formatoFechas) : ''
                };
            } else if (prop === 'proceso') {
                actividadProcesada[prop] = {
                    valor: entidad[prop],
                    display: entidad[prop] ? entidad[prop].evento : ''
                };
            } else if (prop === 'rol') {
                actividadProcesada[prop] = {
                    valor: entidad[prop],
                    display: entidad[prop] ? entidad[prop].nombre : ''
                };
            } else {
                actividadProcesada[prop] = entidad[prop];
            }
        }

        actividadProcesada.editable = true;
        actividadProcesada.eliminable = true;

        return actividadProcesada;
    }

    /**
     * Le aplica algunas transformaciones a una actividad necesarias para poder enviarla correctamente al API.
     *
     * @param {Actividad} actividad
     * @return {Object}
     * @private
     */
    _procesarEntidadAEnviar(actividad) {
        let datos = {};

        for (let prop in actividad) {
            if (prop === 'proceso' || prop === 'rol') {
                datos[prop] = actividad[prop].id;
            } else {
                datos[prop] = actividad[prop];
            }
        }

        return datos;
    }

    /**
     * Determina si una actividad es válida. Se debe llamar a este método antes de crear o editar una actividad.
     * Realiza varias comprobaciones:
     *  1 - Que el nombre esté definido, ya que es un campo requerido.
     *  2 - Que el orden esté definido, ya que es un campo requerido.
     *  3 - Que no exista otra actividad con la misma combinación de proceso + orden.
     *
     * @param {Actividad} actividad
     * @return {Promise<void>}                  - Se resuelve si la entidad es válida. En caso contrario, rechaza la promesa con
     *                                            el error específico.
     * @private
     */
    _validarEntidad(actividad) {
        if (elementoRequeridoEsNulo(actividad.nombre)) {
            return this.$q.reject(this.ErroresValidacionMaestros.FALTA_REQUERIDO);
        } else if (elementoRequeridoEsNulo(actividad.orden)) {
            return this.$q.reject(this.ErroresValidacionMaestros.FALTA_REQUERIDO);
        } else {
            const indiceRepetido = findIndex(this.actividades, (item) => {
                return !isNil(item) && item.proceso.valor.id === actividad.proceso.id && item.orden === actividad.orden && item.id !== actividad.id;
            });
            if (indiceRepetido > -1) {
                return this.$q.reject(this.ErroresValidacionMaestros.YA_EXISTE_ORDEN);
            }
        }

        return this.$q.resolve();
    }

    /**
     * Devuelve el índice de una actividad en la lista que las contiene a todas si sus datos son diferentes a los que
     * están almacenados en dicha lista. Este método es útil a la hora de editar una actividad, para no hacer una llamada
     * al API a menos que los datos del mismo hayan cambiado.
     *
     * @param {Actividad} actividad
     * @returns {number}               -  La posición de esa actividad en la lista según su código o -1 si sus datos son idénticos.
     * @private
     */
    _indiceEntidadCambiada(actividad) {
        if (isNil(actividad)) { return -1; }
        let indiceExistente = findIndex(this.actividades, ['id', actividad.id]);
        if (indiceExistente < 0) { return -1; }

        let iguales = isMatchWith(this.actividades[indiceExistente], actividad, (objValue, srcValue, key) => {
            if (key === 'proceso' || key === 'rol') {
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
     * Elimina una actividad de la lista
     *
     * @param {Actividad} actividad
     * @private
     */
    _eliminarEntidad(actividad) {
        let indiceExistente = findIndex(this.actividades, ['id', actividad.id]);
        if (indiceExistente > -1) {
            this.actividades.splice(indiceExistente, 1);

            // Eliminar una actividad puede implicar que cambiaron las etiquetas del proceso, por lo que es mejor
            // resetear las etiquetas para que se vuelvan a pedir del servidor la próxima vez que hagan falta
            this.etiquetasService.etiquetas = [];
        }
    }

    /**
     * Devuelve una actividad dado su código
     * @param {number} codigo
     * @return {Promise.<Actividad>}       -  Se resuelve con la actividad correspondiente a ese id.
     */
    obtener(codigo) {
        return this.$http.get(`${this.ENDPOINT}/${codigo}`)
            .then(response => {
                return this.procesarEntidadRecibida(response.data);
            })
            .then(actividad => {
                let indiceExistente = findIndex(this.actividades, ['id', codigo]);
                if (indiceExistente > -1) {
                    this.actividades[indiceExistente] = actividad;
                }
                return actividad;
            });
    }

    /**
     * Devuelve una lista de actividades. Utiliza paginación porque la cantidad total de actividades puede llegar a ser
     * considerable.
     *
     * @param {number} pagina               -  Página que se desea.
     * @param {[string, string]} orden      -  Cómo deben estar ordenados los resultados.
     * @param filtro                        -  Se puede usar para filtrar los resultados por varios campos.
     * @param {number} elementosPorPagina   -  Cantidad de actividades que se desea recibir en una página.
     * @return {Promise.<Actividad[]>}   -  Se resuelve con el arreglo de actividades que corresponden a una página determinada.
     */
    obtenerTodos(pagina, orden, filtro, elementosPorPagina) {
        let totalActividades = 0;
        const paginaActual = !isNil(pagina) ? pagina : 1;
        const fin = paginaActual * this.AppConfig.elementosPorPagina;
        const inicio = fin - this.AppConfig.elementosPorPagina;

        let ordenarPor;
        if (!isNil(orden) && (isNil(this.ordenActivo) || orden[0] !== this.ordenActivo[0] || orden[1] !== this.ordenActivo[1])) {
            this.actividades = [];
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
            totalActividades = response.metadata.cantidadTotal;
            const actividades = map(response.data, actividad => {
                return this.procesarEntidadRecibida(actividad);
            });
            this._procesarResultadosPaginados(actividades, totalActividades, inicio);
            return actividades;
        });
    }

    /**
     * Añade una página de actividades obtenidas del API al arreglo total de actividades, en la posición que le corresponde.
     * @param {Actividad[]} resultados       -  Representa una página de actividades.
     * @param {number} total                    -  Total de actividades existentes.
     * @param {number} inicio                   -  Posición inicial del arreglo donde se debe insertar la página.
     * @private
     */
    _procesarResultadosPaginados(resultados, total, inicio) {
        this.actividades = [];
        this.actividades.push(... fill(Array(total), undefined));
        forEach(resultados, (actividad, index) => {
            this.actividades[index+inicio] = actividad;
        });
    }

    /**
     * Vuelve a pedir la página en la que se estaba al API para comprobar si la actividad creada/editada está
     * presente en esa página. Devuelve el campo pagina: -1 si no la encuentra, y además siempre devuelve la lista de
     * actividades presentes en la página.
     *
     * @param {Actividad} actividadCambiada
     * @param {number} paginaActual
     * @return {Promise.<{pagina: number, actividadesPagina: Actividad[]}>}
     * @private
     */
    _posicionarActividadCambiada(actividadCambiada, paginaActual) {
        return this.obtenerTodos(paginaActual)
            .then(actividades => {
                let indexEval = findIndex(actividades, ['id', actividadCambiada.id]);
                let pagina = indexEval < 0 ? -1 : paginaActual;
                return { pagina, actividadesPagina: actividades };
            });
    }

    /**
     * Crea una nueva actividad.
     * @param {Actividad} datosActividad      -  Datos de la actividad que se desea crear.
     * @param {number} paginaActual           -  Página de actividades que se está visualizando en ese momento.
     * @return {Promise.<{actividad:Actividad, pagina:number, actividadesPagina: Actividad[]}>}
     */
    crear(datosActividad, paginaActual) {
        let nuevaActividad;
        return this._validarEntidad(datosActividad)
            .then(() => {
                let datos = this._procesarEntidadAEnviar(datosActividad);
                return this.$http.post(this.ENDPOINT, datos);
            })
            .then(response => {
                const actividadRecibida = response.data;
                datosActividad.id = actividadRecibida.id;
                nuevaActividad = this.procesarEntidadRecibida(datosActividad);
                return this._posicionarActividadCambiada(nuevaActividad, paginaActual);
            })
            .then(resultado => {
                return {actividad: nuevaActividad, pagina: resultado.pagina, actividadesPagina: resultado.actividadesPagina};
            });
    }

    /**
     * Edita una actividad existente
     * @param {Actividad} actividad      -  Datos de la actividad que se desea editar.
     * @param {number} paginaActual      -  Página de actividades que se está visualizando en ese momento.
     * @return {Promise.<{actividad:Actividad, pagina:number, actividadesPagina: Actividad[]}>}
     */
    editar(actividad, paginaActual) {
        let actividadEditada;
        return this._validarEntidad(actividad)
            .then(() => {
                const actividadProcesada = this.procesarEntidadRecibida(actividad);
                let indiceExistente = this._indiceEntidadCambiada(actividadProcesada);
                // Si los datos de la actividad no han cambiado, se rechaza la edición
                if (indiceExistente >= 0) {
                    let datos = this._procesarEntidadAEnviar(actividad);
                    return this.$http.put(`${this.ENDPOINT}/${actividad.codigo}`, datos)
                        .then(() => {
                            actividadEditada = actividadProcesada;

                            // Si cambió el orden de la actividad, cambiaron las etiquetas del proceso, por lo que es mejor
                            // resetear las etiquetas para que se vuelvan a pedir del servidor la próxima vez que hagan falta
                            if (this.actividades[indiceExistente].orden !== actividadEditada.orden) {
                                this.etiquetasService.etiquetas = [];
                            }

                            return this._posicionarActividadCambiada(actividadEditada, paginaActual);
                        })
                        .then(resultado => {
                            // Notifica a las entidades que contengan una referencia a este módulo que fue actualizado.
                            this.$timeout(() => {
                                this.Mediator.publish(EVENTO_ACTUALIZACION_ACTIVIDAD, actividadEditada);
                            }, 1000, false);

                            return {actividad: actividadEditada, pagina: resultado.pagina, actividadesPagina: resultado.actividadesPagina};
                        })
                        .catch(response => {
                            // Si el API devuelve que no encontró esa entidad, se elimina de la lista local
                            if (response && response.status === 404) {
                                this._eliminarEntidad(actividad);
                            }
                            throw response;
                        });
                } else {
                    return this.$q.reject();
                }
            });
    }

    /**
     * Elimina una actividad.
     * @param {Actividad} actividad
     * @return {Promise<Actividad>}   -  Se resuelve con la actividad eliminada.
     */
    eliminar(actividad) {
        return this.$http.delete(`${this.ENDPOINT}/${actividad.codigo}`)
            .then(response => {
                this._eliminarEntidad(actividad);
                return response.data;
            })
            .catch(response => {
                if (response && response.status === 404) {
                    this._eliminarEntidad(actividad);
                }
                throw response;
            });
    }
}