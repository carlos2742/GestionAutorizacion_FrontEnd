import findIndex from 'lodash/findIndex';
import isNil from 'lodash/isNil';
import isMatchWith from 'lodash/isMatchWith';
import sortBy from 'lodash/sortBy';
import filter from 'lodash/filter';
import map from 'lodash/map';
import pick from 'lodash/pick';
import clone from 'lodash/clone';
import get from 'lodash/get';

import {
    MANTENIMIENTO_MAESTRO_ACTIVO,
    MANTENIMIENTO_MAESTRO_INACTIVO
} from '../../common/constantes';
import {elementoRequeridoEsNulo} from '../../common/validadores';


/* @ngInject */
/**
 * Esta clase es un servicio de Angular donde se almacena la lista de todos los procesos disponibles.
 */
export default class ProcesosService {
    /**
     * Un proceso es un mantenimiento maestro.
     * @typedef {Object} Proceso
     * @property {number} id                    -  De sólo lectura. Se genera automáticamente en la Base de Datos para procesos nuevos.
     * @property {number} codigo                -  Lo mismo que id, se añade para mantener consistencia con otras entidades.
     * @property {string} evento                -  Evento.
     * @property {string} observaciones         -  Observaciones.
     * @property {Object} aplicacion            -  Aplicación asociada.
     * @property {Aplicacion} aplicacion.valor  -  Su valor actual.
     * @property {string} aplicacion.display    -  Cómo debe ser representado.
     * @property {Object} estado                -  Determina si un proceso está activo o inactivo
     * @property {boolean} estado.activo
     * @property {string} estado.valor          -  Puede tener los valores 'A' (para activo), o 'I' (para inactivo).
     * @property {number} cantidadActividades   - Total de actividades asociadas a este proceso.
     */

    /**
     * @param $q                        -  Servicio de Angular para utilizar Promesas
     * @param $http                     -  Servicio de Angular para hacer llamadas HTTP
     * @param EtiquetasService
     * @param ErroresValidacionMaestros -  Contiene los errores que pueden devolver las validaciones. Ver {@link ErroresValidacionMaestros}
     *
     **/
    constructor($q, $http, EtiquetasService, ErroresValidacionMaestros) {
        // Constantes del servicio
        /** @private */
        this.ENDPOINT = '/procesos';

        /** @private */
        this.$q = $q;
        /** @private */
        this.$http = $http;
        /** @private */
        this.etiquetasService = EtiquetasService;
        /** @private */
        this.ErroresValidacionMaestros = ErroresValidacionMaestros;

        /** @type {Proceso[]} */
        this.procesos = [];
    }

    /**
     * Le aplica algunas transformaciones a un proceso recibido del API. Añade los permisos de edición y también le
     * agrega una propiedad para facilitar la visualización del estado.
     *
     * @param {Object} entidad                  -  Representa un proceso recibido del API
     * @param {Aplicacion} [aplicacion]         -  Aplicación a la que pertenece el proceso.
     * @returns {Proceso}                       -  La misma entidad, con las transformaciones mencionadas.
     */
    procesarEntidadRecibida(entidad, aplicacion) {
        entidad.codigo = entidad.id;

        // Si el valor del atributo aplicacion es un número, esto significa que contiene el código del tipo,
        // en vez del objeto completo, por lo que hay que reemplazarlo
        let aplicacionRecibida = entidad.aplicacion;
        if (typeof entidad.aplicacion === 'number' && !isNil(aplicacion)) {
            aplicacionRecibida = aplicacion;
        }
        entidad.aplicacion = {
            valor: aplicacionRecibida,
            display: aplicacionRecibida ? aplicacionRecibida.nombre : ''
        };

        entidad.estado = {
            valor: entidad.estado,
            activo: entidad.estado === MANTENIMIENTO_MAESTRO_ACTIVO
        };

        entidad.editable = true;
        entidad.eliminable = true;
        return entidad;
    }

    /**
     * Determina si un proceso es válido. Se debe llamar a este método antes de crear o editar un proceso.
     * Realiza varias comprobaciones:
     *  1 - Que el evento no esté vacío, ya que es un campo requerido.
     *  2 - Que la aplicación no esté vacía, ya que es un campo requerido.
     *
     * @param {number} codigo
     * @param {string} evento
     * @param {Aplicacion} aplicacion
     * @return {Promise<void>}                  - Se resuelve si la entidad es válida. En caso contrario, rechaza la promesa con
     *                                            el error específico.
     * @private
     */
    _validarEntidad(codigo, evento, aplicacion) {
        if (elementoRequeridoEsNulo(evento)) {
            return this.$q.reject(this.ErroresValidacionMaestros.FALTA_REQUERIDO);
        } else if (elementoRequeridoEsNulo(aplicacion)) {
            return this.$q.reject(this.ErroresValidacionMaestros.FALTA_REQUERIDO);
        }

        return this.$q.resolve();
    }

    /**
     * Devuelve el índice de un proceso en la lista que los contiene a todos si sus datos son diferentes a los que
     * están almacenados en dicha lista. Este método es útil a la hora de editar un proceso, para no hacer una llamada
     * al API a menos que los datos del mismo hayan cambiado.
     *
     * @param {Proceso} proceso
     * @returns {number}               -  La posición de ese proceso en la lista según su código o -1 si sus datos son idénticos.
     * @private
     */
    _indiceEntidadCambiada(proceso) {
        if (isNil(proceso)) { return -1; }
        let indiceExistente = findIndex(this.procesos, ['id', proceso.id]);
        if (indiceExistente < 0) { return -1; }

        let iguales = isMatchWith(this.procesos[indiceExistente], proceso, (objValue, srcValue, key) => {
            if (key === 'estado') {
                return objValue.valor === srcValue.valor;
            } else if (key === 'aplicacion') {
                return get(objValue, 'valor.id') === srcValue.id;
            }
            return undefined; // Cuando se devuelve undefined la comparación la hace internamente isMatch()
        });
        return iguales ? -1 : indiceExistente;
    }

    /**
     * Elimina un proceso de la lista
     *
     * @param {Proceso} proceso
     * @private
     */
    _eliminarEntidad(proceso) {
        let indiceExistente = findIndex(this.procesos, ['id', proceso.id]);
        if (indiceExistente > -1) {
            this.procesos.splice(indiceExistente, 1);

            // Eliminar un proceso puede implicar que cambiaron las etiquetas del mismo, por lo que es mejor
            // resetear las etiquetas para que se vuelvan a pedir del servidor la próxima vez que hagan falta
            this.etiquetasService.etiquetas = [];
        }
    }

    /**
     * Devuelve una lista de todos los procesos existentes. La primera vez que se ejecuta este método, se piden los
     * procesos al API, y en las siguientes llamadas se devuelve la lista almacenada en este servicio.
     * Devuelve los procesos ordenados ascendentemente por su campo "evento".
     *
     * @param {boolean} soloActivos     -  Se debe pasar en true si se desea nada más la lista de procesos activos.
     * @return {Promise<Proceso[]>}     -  Se resuelve con el arreglo de procesos.
     */
    obtenerTodos(soloActivos) {
        const fnRetorno = () => {
            // Por defecto se devuelven los procesos ordenados ascendentemente por el campo "evento"
            let resultado = sortBy(this.procesos, 'evento');

            if (isNil(soloActivos) || soloActivos) {
                return filter(resultado, (entidad) => {
                    return entidad.estado.activo;
                });
            } else {
                return resultado;
            }
        };

        if (this.procesos.length === 0) {
            return this.$http.get(this.ENDPOINT)
                .then(response => {
                    this.procesos = map(response.data, proceso => {
                        return this.procesarEntidadRecibida(proceso);
                    });

                    return fnRetorno();
                });
        } else {
            return this.$q.resolve(fnRetorno());
        }
    }

    /**
     * Crea un nuevo proceso.
     *
     * @param {Proceso} datosProceso
     * @return {Promise<Proceso>}     - Se resuelve con el proceso creado
     */
    crear(datosProceso) {
        return this._validarEntidad(null, datosProceso.evento, datosProceso.aplicacion)
            .then(() => {
                const datosAEnviar = clone(datosProceso);
                datosAEnviar.aplicacion = datosProceso.aplicacion.id;

                return this.$http.post(this.ENDPOINT, datosAEnviar);
            }).then(response => {
                let nuevoProceso = this.procesarEntidadRecibida(response.data, datosProceso.aplicacion);
                nuevoProceso.cantidadActividades = 0;
                this.procesos.push(nuevoProceso);
                return nuevoProceso;
            });
    }

    /**
     * Actualiza un proceso existente. Sólo se llama al API si los datos del proceso cambiaron.
     *
     * @param {Proceso} proceso
     * @return {Promise<Proceso>}    -  Se resuelve con el proceso actualizado.
     */
    editar(proceso) {
        // Se seleccionan los campos que interesan para la edición
        let procesoEditado = pick(proceso, ['codigo', 'id', 'evento', 'observaciones', 'aplicacion', 'estado', 'editable', 'eliminable']);
        const aplicacion = get(procesoEditado, 'aplicacion.valor') || get(procesoEditado, 'aplicacion');

        // Si lo que se editó fue el estado de la entidad, hay que actualizar el valor del estado, ya que con el UI
        // lo que se actualiza es la propiedad "activo"
        let cambioEstado = false;
        if ((procesoEditado.estado.activo && procesoEditado.estado.valor === MANTENIMIENTO_MAESTRO_INACTIVO)
            || (!procesoEditado.estado.activo && procesoEditado.estado.valor === MANTENIMIENTO_MAESTRO_ACTIVO)) {
            cambioEstado = true;
            procesoEditado.estado = {
                activo: proceso.estado.activo,
                valor: proceso.estado.activo ? MANTENIMIENTO_MAESTRO_ACTIVO : MANTENIMIENTO_MAESTRO_INACTIVO
            };
        }

        const fnValidacion = () => {
            if (cambioEstado) { return this.$q.resolve(); }
            return this._validarEntidad(proceso.codigo, proceso.evento, proceso.aplicacion);
        };

        return fnValidacion().then(() => {
            let indiceExistente = this._indiceEntidadCambiada(procesoEditado);
            if (indiceExistente >= 0) {
                let datosAEnviar = clone(procesoEditado);
                datosAEnviar.aplicacion = aplicacion.id;
                datosAEnviar.estado = procesoEditado.estado.valor;
                return this.$http.put(`${this.ENDPOINT}/${proceso.codigo}`, datosAEnviar)
                    .then(response => {
                        const procesoRecibido = this.procesarEntidadRecibida(response.data, aplicacion);
                        procesoRecibido.cantidadActividades = proceso.cantidadActividades;

                        // Si cambió el nombre del proceso, es mejor volver a pedir las etiquetas al servidor la próxima
                        // vez que hagan falta
                        if (this.procesos[indiceExistente].evento !== procesoRecibido.evento) {
                            this.etiquetasService.etiquetas = [];
                        }

                        this.procesos[indiceExistente] = procesoRecibido;
                        return this.procesos[indiceExistente];
                    })
                    .catch(response => {
                        // Si en el servidor no se encontró una entidad con este código, se quita de la lista local
                        if (response.status === 404) {
                            this._eliminarEntidad(proceso);
                        }
                        throw response;
                    });
            } else {
                return this.$q.reject();
            }
        });
    }

    /**
     * Elimina un proceso.
     *
     * @param {Proceso} proceso
     * @return {Promise<Proceso>}   -  Se resuelve con el proceso eliminado.
     */
    eliminar(proceso) {
        return this.$http.delete(`${this.ENDPOINT}/${proceso.codigo}`)
            .then(response => {
                this._eliminarEntidad(proceso);
                return response.data;
            })
            .catch(response => {
                if (response && response.status === 404) {
                    this._eliminarEntidad(proceso);
                }
                throw response;
            });
    }
}