import findIndex from 'lodash/findIndex';
import isNil from 'lodash/isNil';
import isMatchWith from 'lodash/isMatchWith';
import sortBy from 'lodash/sortBy';
import filter from 'lodash/filter';
import map from 'lodash/map';
import pick from 'lodash/pick';
import clone from 'lodash/clone';
import forEach from 'lodash/forEach';
import get from 'lodash/get';

import {
    ELEMENTO_YA_ESTA_INACTIVO, MANTENIMIENTO_MAESTRO_ACTIVO,
    MANTENIMIENTO_MAESTRO_INACTIVO
} from "../../common/constantes";
import {elementoRequeridoEsNulo, elementoYaExiste} from "../../common/validadores";


/* @ngInject */
/**
 * Esta clase es un servicio de Angular donde se almacena la lista de todos los flujos disponibles.
 */
export default class FlujosService {
    /**
     * Un flujo es un mantenimiento maestro.
     * @typedef {Object} Flujo
     * @property {number} id                    -  De sólo lectura. Se genera automáticamente en la Base de Datos para flujos nuevos.
     * @property {number} codigo                -  Lo mismo que id, se añade para mantener consistencia con otras entidades.
     * @property {string} evento                -  Evento.
     * @property {string} observaciones         -  Observaciones.
     * @property {Object} modulo                -  Módulo asociado.
     * @property {Modulo} modulo.valor          -  Su valor actual.
     * @property {Modulo} modulo.display        -  Cómo debe ser representado.
     * @property {Object} estado                -  Determina si un flujo está activo o inactivo
     * @property {boolean} estado.activo
     * @property {string} estado.valor          -  Puede tener los valores 'A' (para activo), o 'I' (para inactivo).
     */

    /**
     * @param $q                        -  Servicio de Angular para utilizar Promesas
     * @param $http                     -  Servicio de Angular para hacer llamadas HTTP
     * @param $timeout                  -  Servicio de Angular para diferir ejecución de funciones.
     * @param ErroresValidacionMaestros -  Contiene los errores que pueden devolver las validaciones. Ver {@link ErroresValidacionMaestros}
     * @param Mediator
     *
     **/
    constructor($q, $http, $timeout, ErroresValidacionMaestros, Mediator) {
        // Constantes del servicio
        /** @private */
        this.ENDPOINT = '/flujos';

        /** @private */
        this.$q = $q;
        /** @private */
        this.$http = $http;
        /** @private */
        this.$timeout = $timeout;
        /** @private */
        this.ErroresValidacionMaestros = ErroresValidacionMaestros;
        /** @private */
        this.Mediator = Mediator;

        /** @type {Flujo[]} */
        this.flujos = [];

        this.Mediator.subscribe('modulo:edicion', (data) => {
            forEach(this.flujos, flujo => {
               if (flujo.modulo.valor && flujo.modulo.valor.id === data.id) {
                   flujo.modulo = {
                       valor: data,
                       display: data.nombre
                   }
               }
            });
        });
    }

    /**
     * Le aplica algunas transformaciones a un flujo recibido del API. Añade los permisos de edición y también le
     * agrega una propiedad para facilitar la visualización del estado.
     *
     * @param {Object} entidad                  -  Representa un flujo recibido del API
     * @param {Modulo} [modulo]                 -  Módulo al que pertenece el flujo.
     * @returns {Flujo}                         -  La misma entidad, con las transformaciones mencionadas.
     */
    procesarEntidadRecibida(entidad, modulo) {
        entidad.codigo = entidad.id;

        // Si el valor del atributo modulo es un número, esto significa que contiene el código del tipo,
        // en vez del objeto completo, por lo que hay que reemplazarlo
        let moduloRecibido = entidad.modulo;
        if (typeof entidad.modulo === 'number' && !isNil(modulo)) {
            moduloRecibido = modulo;
        }
        entidad.modulo = {
            valor: moduloRecibido,
            display: moduloRecibido ? moduloRecibido.nombre : ''
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
     * Determina si un flujo es válido. Se debe llamar a este método antes de crear o editar un flujo.
     * Realiza varias comprobaciones:
     *  1 - Que el evento no esté vacío, ya que es un campo requerido.
     *  2 - Que el módulo no esté vacío, ya que es un campo requerido.
     *
     * @param {number} codigo
     * @param {string} evento
     * @param {Modulo} modulo
     * @return {Promise<void>}                  - Se resuelve si la entidad es válida. En caso contrario, rechaza la promesa con
     *                                            el error específico.
     * @private
     */
    _validarEntidad(codigo, evento, modulo) {
        if (elementoRequeridoEsNulo(evento)) {
            return this.$q.reject(this.ErroresValidacionMaestros.FALTA_REQUERIDO);
        } else if (elementoRequeridoEsNulo(modulo)) {
            return this.$q.reject(this.ErroresValidacionMaestros.FALTA_REQUERIDO);
        }

        return this.$q.resolve();
    }

    /**
     * Devuelve el índice de un flujo en la lista que los contiene a todos si sus datos son diferentes a los que
     * están almacenados en dicha lista. Este método es útil a la hora de editar un flujo, para no hacer una llamada
     * al API a menos que los datos del mismo hayan cambiado.
     *
     * @param {Flujo} flujo
     * @returns {number}               -  La posición de ese flujo en la lista según su código o -1 si sus datos son idénticos.
     * @private
     */
    _indiceEntidadCambiada(flujo) {
        if (isNil(flujo)) { return -1 }
        let indiceExistente = findIndex(this.flujos, ['id', flujo.id]);
        if (indiceExistente < 0) { return -1 }

        let iguales = isMatchWith(this.flujos[indiceExistente], flujo, (objValue, srcValue, key) => {
            if (key === 'estado') {
                return objValue.valor === srcValue.valor;
            } else if (key === 'modulo') {
                return get(objValue, 'valor.id') === srcValue.id;
            }
            return undefined; // Cuando se devuelve undefined la comparación la hace internamente isMatch()
        });
        return iguales ? -1 : indiceExistente;
    }

    /**
     * Elimina un flujo de la lista
     *
     * @param {Flujo} flujo
     * @private
     */
    _eliminarEntidad(flujo) {
        let indiceExistente = findIndex(this.flujos, ['id', flujo.id]);
        if (indiceExistente > -1) {
            this.flujos.splice(indiceExistente, 1);
        }
    }

    /**
     * Devuelve una lista de todos los flujos existentes. La primera vez que se ejecuta este método, se piden los
     * flujos al API, y en las siguientes llamadas se devuelve la lista almacenada en este servicio.
     * Devuelve los flujos ordenados ascendentemente por su campo "evento".
     *
     * @param {boolean} soloActivos     -  Se debe pasar en true si se desea nada más la lista de flujos activos.
     * @return {Promise<Flujo[]>}       -  Se resuelve con el arreglo de flujos.
     */
    obtenerTodos(soloActivos) {
        const fnRetorno = () => {
            // Por defecto se devuelven los flujos ordenados ascendentemente por el campo "evento"
            let resultado = sortBy(this.flujos, 'evento');

            if (isNil(soloActivos) || soloActivos) {
                return filter(resultado, (entidad) => {
                    return entidad.estado.activo;
                });
            } else {
                return resultado;
            }
        };

        if (this.flujos.length === 0) {
            return this.$http.get(this.ENDPOINT)
                .then(response => {
                    this.flujos = map(response.data, flujo => {
                        return this.procesarEntidadRecibida(flujo)
                    });

                    return fnRetorno();
                });
        } else {
            return this.$q.resolve(fnRetorno());
        }
    }

    /**
     * Crea un nuevo flujo.
     *
     * @param {Flujo} datosFlujo
     * @return {Promise<Flujo>}     - Se resuelve con el flujo creado
     */
    crear(datosFlujo) {
        return this._validarEntidad(null, datosFlujo.evento, datosFlujo.modulo)
            .then(() => {
                const datosAEnviar = clone(datosFlujo);
                datosAEnviar.modulo = datosFlujo.modulo.id;

                return this.$http.post(this.ENDPOINT, datosAEnviar)
            }).then(response => {
                let nuevoFlujo = this.procesarEntidadRecibida(response.data, datosFlujo.modulo);
                this.flujos.push(nuevoFlujo);
                return nuevoFlujo;
            });
    }

    /**
     * Actualiza un flujo existente. Sólo se llama al API si los datos del flujo cambiaron.
     *
     * @param {Flujo} flujo
     * @return {Promise<Flujo>}    -  Se resuelve con el flujo actualizado.
     */
    editar(flujo) {
        // Se seleccionan los campos que interesan para la edición
        let flujoEditado = pick(flujo, ['codigo', 'id', 'evento', 'observaciones', 'modulo', 'estado', 'editable', 'eliminable']);
        const modulo = get(flujoEditado, 'modulo.valor') || get(flujoEditado, 'modulo');

        // Si lo que se editó fue el estado de la entidad, hay que actualizar el valor del estado, ya que con el UI
        // lo que se actualiza es la propiedad "activo"
        let cambioEstado = false;
        if ((flujoEditado.estado.activo && flujoEditado.estado.valor === MANTENIMIENTO_MAESTRO_INACTIVO)
            || (!flujoEditado.estado.activo && flujoEditado.estado.valor === MANTENIMIENTO_MAESTRO_ACTIVO)) {
            cambioEstado = true;
            flujoEditado.estado = {
                activo: flujo.estado.activo,
                valor: flujo.estado.activo ? MANTENIMIENTO_MAESTRO_ACTIVO : MANTENIMIENTO_MAESTRO_INACTIVO
            }
        }

        const fnValidacion = () => {
            if (cambioEstado) { return this.$q.resolve(); }
            return this._validarEntidad(flujo.codigo, flujo.evento, flujo.modulo);
        };

        return fnValidacion().then(() => {
            let indiceExistente = this._indiceEntidadCambiada(flujoEditado);
            if (indiceExistente >= 0) {
                let datosAEnviar = clone(flujoEditado);
                datosAEnviar.modulo = modulo.id;
                datosAEnviar.estado = flujoEditado.estado.valor;
                return this.$http.put(`${this.ENDPOINT}/${flujo.codigo}`, datosAEnviar)
                    .then(response => {
                        this.flujos[indiceExistente] = this.procesarEntidadRecibida(response.data, modulo);

                        // Notifica a las entidades que contengan una referencia a este flujo que fue actualizado.
                        this.$timeout(() => {
                            this.Mediator.publish('flujo:edicion', this.flujos[indiceExistente]);
                        }, 1000, false);

                        return this.flujos[indiceExistente];
                    })
                    .catch(response => {
                        // Si en el servidor no se encontró una entidad con este código, se quita de la lista local
                        if (response.status === 404) {
                            this._eliminarEntidad(flujo);
                        }
                        throw response;
                    });
            } else {
                return this.$q.reject();
            }
        });
    }

    /**
     * Elimina un flujo.
     *
     * @param {Flujo} flujo
     * @return {Promise<Flujo>}   -  Se resuelve con el flujo eliminado.
     */
    eliminar(flujo) {
        return this.$http.delete(`${this.ENDPOINT}/${flujo.codigo}`)
            .then(response => {
                this._eliminarEntidad(flujo);
                return response.data;
            })
            .catch(response => {
                if (response && response.status === 404) {
                    this._eliminarEntidad(flujo);
                }
                throw response;
            });
    }
}