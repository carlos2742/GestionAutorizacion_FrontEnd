import findIndex from 'lodash/findIndex';
import isNil from 'lodash/isNil';
import isMatchWith from 'lodash/isMatchWith';
import sortBy from 'lodash/sortBy';
import filter from 'lodash/filter';
import map from 'lodash/map';
import pick from 'lodash/pick';
import clone from 'lodash/clone';

import {
    ELEMENTO_YA_ESTA_INACTIVO, MANTENIMIENTO_MAESTRO_ACTIVO,
    MANTENIMIENTO_MAESTRO_INACTIVO
} from '../../common/constantes';
import {elementoRequeridoEsNulo} from '../../common/validadores';


/* @ngInject */
/**
 * Esta clase es un servicio de Angular donde se almacena la lista de todas las aplicaciones disponibles.
 */
export default class AplicacionesService {
    /**
     * Una aplicacion es un mantenimiento maestro.
     * @typedef {Object} Aplicacion
     * @property {number} id                    -  De sólo lectura. Se genera automáticamente en la Base de Datos para aplicaciones nuevas.
     * @property {number} codigo                -  Lo mismo que id, se añade para mantener consistencia con otras entidades.
     * @property {string} nombre                -  Nombre de la aplicación.
     * @property {Object} estado                -  Determina si una aplicación está activa o inactiva
     * @property {boolean} estado.activo
     * @property {string} estado.valor          -  Puede tener los valores 'A' (para activo), o 'I' (para inactivo).
     */

    /**
     * @param $q                        -  Servicio de Angular para utilizar Promesas
     * @param $http                     -  Servicio de Angular para hacer llamadas HTTP
     * @param ErroresValidacionMaestros -  Contiene los errores que pueden devolver las validaciones. Ver {@link ErroresValidacionMaestros}
     *
     **/
    constructor($q, $http, ErroresValidacionMaestros) {
        // Constantes del servicio
        /** @private */
        this.ENDPOINT = '/aplicaciones';

        /** @private */
        this.$q = $q;
        /** @private */
        this.$http = $http;
        /** @private */
        this.ErroresValidacionMaestros = ErroresValidacionMaestros;

        /** @type {Aplicacion[]} */
        this.aplicaciones = [];
    }

    /**
     * Le aplica algunas transformaciones a una aplicación recibido del API. Añade los permisos de edición y también le
     * agrega una propiedad para facilitar la visualización del estado.
     *
     * @param {Object} entidad      -  Representa una aplicación recibida del API
     * @returns {Aplicacion}        -  La misma entidad, con las transformaciones mencionadas.
     */
    procesarEntidadRecibida(entidad) {
        entidad.codigo = entidad.id;

        entidad.estado = {
            valor: entidad.estado,
            activo: entidad.estado === MANTENIMIENTO_MAESTRO_ACTIVO
        };

        entidad.editable = true;
        entidad.eliminable = false;

        return entidad;
    }

    /**
     * Determina si una aplicación es válida. Se debe llamar a este método antes de crear o editar una aplicación.
     * Realiza varias comprobaciones:
     *  1 - Que el nombre no esté vacío, ya que es un campo requerido.
     *
     * @param {number} codigo
     * @param {string} nombre
     * @return {Promise<void>}                  - Se resuelve si la entidad es válida. En caso contrario, rechaza la promesa con
     *                                            el error específico.
     * @private
     */
    _validarEntidad(codigo, nombre) {
        if (elementoRequeridoEsNulo(nombre)) {
            return this.$q.reject(this.ErroresValidacionMaestros.FALTA_REQUERIDO);
        }

        return this.$q.resolve();
    }

    /**
     * Devuelve el índice de una aplicación en la lista que las contiene a todas si sus datos son diferentes a los que
     * están almacenados en dicha lista. Este método es útil a la hora de editar una aplicación, para no hacer una llamada
     * al API a menos que los datos del mismo hayan cambiado.
     *
     * @param {Aplicacion} aplicacion
     * @returns {number}               -  La posición de esa aplicación en la lista según su código o -1 si sus datos son idénticos.
     * @private
     */
    _indiceEntidadCambiada(aplicacion) {
        if (isNil(aplicacion)) { return -1; }
        let indiceExistente = findIndex(this.aplicaciones, ['id', aplicacion.id]);
        if (indiceExistente < 0) { return -1; }

        let iguales = isMatchWith(this.aplicaciones[indiceExistente], aplicacion, (objValue, srcValue, key) => {
            if (key === 'estado') {
                return objValue.valor === srcValue.valor;
            }
            return undefined; // Cuando se devuelve undefined la comparación la hace internamente isMatch()
        });
        return iguales ? -1 : indiceExistente;
    }

    /**
     * Elimina una aplicación de la lista
     *
     * @param {Aplicacion} aplicacion
     * @private
     */
    _eliminarEntidad(aplicacion) {
        let indiceExistente = findIndex(this.aplicaciones, ['id', aplicacion.id]);
        if (indiceExistente > -1) {
            this.aplicaciones.splice(indiceExistente, 1);
        }
    }

    /**
     * Devuelve una lista de todas las aplicaciones existentes. La primera vez que se ejecuta este método, se piden las
     * aplicaciones al API, y en las siguientes llamadas se devuelve la lista almacenada en este servicio.
     * Devuelve las aplicaciones ordenados ascendentemente por su nombre.
     *
     * @param {boolean} soloActivos         -  Se debe pasar en true si se desea nada más la lista de aplicaciones activas.
     * @return {Promise<Aplicacion[]>}      -  Se resuelve con el arreglo de aplicaciones.
     */
    obtenerTodos(soloActivos) {
        const fnRetorno = () => {
            // Por defecto se devuelven las aplicaciones ordenadas ascendentemente por el campo "nombre"
            let resultado = sortBy(this.aplicaciones, ['nombre']);

            if (isNil(soloActivos) || soloActivos) {
                return filter(resultado, (entidad) => {
                    return entidad.estado.activo;
                });
            } else {
                return resultado;
            }
        };

        if (this.aplicaciones.length === 0) {
            return this.$http.get(this.ENDPOINT)
                .then(response => {
                    this.aplicaciones = map(response.data, obj => {
                        return this.procesarEntidadRecibida(obj);
                    });

                    return fnRetorno();
                });
        } else {
            return this.$q.resolve(fnRetorno());
        }
    }

    /**
     * Crea una nueva aplicación.
     *
     * @param {string} nombre
     * @return {Promise<Aplicacion>}     - Se resuelve con la aplicación creada
     */
    crear(nombre) {
        return this._validarEntidad(null, nombre)
            .then(() => {
                return this.$http.post(this.ENDPOINT, { nombre });
            }).then(response => {
                let nuevoObj = this.procesarEntidadRecibida(response.data);
                this.aplicaciones.push(nuevoObj);
                return nuevoObj;
            });
    }

    /**
     * Actualiza una aplicación existente. Sólo se llama al API si los datos de la aplicación cambiaron.
     *
     * @param {Aplicacion} aplicacion
     * @return {Promise<Aplicacion>}    -  Se resuelve con la aplicación actualizada.
     */
    editar(aplicacion) {
        // Se seleccionan los campos que interesan para la edición
        let objEditado = pick(aplicacion, ['codigo', 'id', 'nombre', 'estado', 'editable', 'eliminable']);

        // Si lo que se editó fue el estado de la entidad, hay que actualizar el valor del estado, ya que con el UI
        // lo que se actualiza es la propiedad "activo"
        let cambioEstado = false;
        if ((objEditado.estado.activo && objEditado.estado.valor === MANTENIMIENTO_MAESTRO_INACTIVO)
            || (!objEditado.estado.activo && objEditado.estado.valor === MANTENIMIENTO_MAESTRO_ACTIVO)) {
            cambioEstado = true;
            objEditado.estado = {
                activo: aplicacion.estado.activo,
                valor: aplicacion.estado.activo ? MANTENIMIENTO_MAESTRO_ACTIVO : MANTENIMIENTO_MAESTRO_INACTIVO
            };
        }

        const fnValidacion = () => {
            if (cambioEstado) { return this.$q.resolve(); }
            return this._validarEntidad(aplicacion.codigo, aplicacion.nombre);
        };

        return fnValidacion().then(() => {
            let indiceExistente = this._indiceEntidadCambiada(objEditado);
            if (indiceExistente >= 0) {
                let datosAEnviar = clone(objEditado);
                datosAEnviar.estado = objEditado.estado.valor;
                return this.$http.put(`${this.ENDPOINT}/${aplicacion.codigo}`, datosAEnviar)
                    .then(response => {
                        this.aplicaciones[indiceExistente] = this.procesarEntidadRecibida(response.data);
                        return this.aplicaciones[indiceExistente];
                    })
                    .catch(response => {
                        // Si en el servidor no se encontró una entidad con este código, se quita de la lista local
                        if (response.status === 404) {
                            this._eliminarEntidad(aplicacion);
                        }
                        throw response;
                    });
            } else {
                return this.$q.reject();
            }
        });
    }

    /**
     * Elimina una aplicación. Dado que los mantenimientos maestros no se pueden eliminar de la Base de Datos, esto lo
     * que hace es cambiar el estado de una aplicación a Inactivo.
     * @param {Aplicacion} aplicacion
     * @return {Promise<Aplicacion>}   -  Se resuelve con la aplicación eliminada.
     */
    eliminar(aplicacion) {
        if (isNil(aplicacion)){ return this.$q.reject(); }
        let indiceExistente = findIndex(this.aplicaciones, ['id', aplicacion.id]);
        if (indiceExistente < 0 ){ return this.$q.reject(); }

        let objAEliminar = pick(aplicacion, ['codigo', 'id', 'nombre', 'estado', 'editable', 'eliminable']);
        objAEliminar.estado.valor = aplicacion.estado.activo ? MANTENIMIENTO_MAESTRO_ACTIVO : MANTENIMIENTO_MAESTRO_INACTIVO;

        return this.$http.delete(`${this.ENDPOINT}/${aplicacion.id}`)
            .then(() => {
                this.aplicaciones[indiceExistente] = objAEliminar;
                return this.aplicaciones[indiceExistente];
            })
            .catch(response => {
                // Si en el servidor no se encontró una entidad con este código, se quita de la lista local
                if (response.status === 404) {
                    this._eliminarEntidad(aplicacion);
                    throw response;
                } else if (response.error && response.error.errorCode === ELEMENTO_YA_ESTA_INACTIVO) {
                    // Igual se cambia el estado de la entidad, ya que el error se produjo porque ya tenía el estado
                    // que se le quería asignar
                    this.aplicaciones[indiceExistente] = objAEliminar;
                    return this.aplicaciones[indiceExistente];
                } else {
                    throw response;
                }
            });
    }
}