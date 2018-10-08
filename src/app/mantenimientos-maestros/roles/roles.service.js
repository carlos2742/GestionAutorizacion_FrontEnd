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
} from "../../common/constantes";
import {elementoRequeridoEsNulo, elementoYaExiste} from "../../common/validadores";


export const EVENTO_ACTUALIZACION_ROL = 'rol:edicion';


/* @ngInject */
/**
 * Esta clase es un servicio de Angular donde se almacena la lista de todos los roles disponibles.
 */
export default class Roles {
    /**
     * Un rol es un mantenimiento maestro no editable.
     * @typedef {Object} Rol
     * @property {number} id                    -  De sólo lectura. Se genera automáticamente en la Base de Datos para roles nuevos.
     * @property {number} codigo                -  Lo mismo que id, se añade para mantener consistencia con otras entidades.
     * @property {string} nombre                -  Nombre del rol.
     * @property {Object} estado                -  Determina si un rol está activo o inactivo
     * @property {boolean} estado.activo
     * @property {string} estado.valor          -  Puede tener los valores 'A' (para activo), o 'I' (para inactivo).
     */

    /**
     * @param $q                        -  Servicio de Angular para utilizar Promesas
     * @param $http                     -  Servicio de Angular para hacer llamadas HTTP
     * @param $timeout                  -  Servicio de Angular para diferir ejecución de funciones.
     * @param Mediator
     *
     **/
    constructor($q, $http, $timeout, Mediator) {
        // Constantes del servicio
        /** @private */
        this.ENDPOINT = '/roles';

        /** @private */
        this.$q = $q;
        /** @private */
        this.$http = $http;
        /** @private */
        this.$timeout = $timeout;
        /** @private */
        this.Mediator = Mediator;

        /** @type {Rol[]} */
        this.roles = [];
    }

    /**
     * Le aplica algunas transformaciones a un rol recibido del API. Añade los permisos de edición y también le
     * agrega una propiedad para facilitar la visualización del estado.
     *
     * @param {Object} entidad      -  Representa un rol recibido del API
     * @returns {Rol}               -  La misma entidad, con las transformaciones mencionadas.
     */
    procesarEntidadRecibida(entidad) {
        entidad.codigo = entidad.id;

        entidad.estado = {
            valor: entidad.estado,
            activo: entidad.estado === MANTENIMIENTO_MAESTRO_ACTIVO
        };

        entidad.editable = false;
        entidad.eliminable = false;

        return entidad;
    }

    /**
     * Devuelve el índice de un rol en la lista que los contiene a todos si sus datos son diferentes a los que
     * están almacenados en dicha lista. Este método es útil a la hora de editar un rol, para no hacer una llamada
     * al API a menos que los datos del mismo hayan cambiado.
     *
     * @param {Rol} rol
     * @returns {number}               -  La posición de ese rol en la lista según su código o -1 si sus datos son idénticos.
     * @private
     */
    _indiceEntidadCambiada(rol) {
        if (isNil(rol)) { return -1 }
        let indiceExistente = findIndex(this.roles, ['id', rol.id]);
        if (indiceExistente < 0) { return -1 }

        let iguales = isMatchWith(this.roles[indiceExistente], rol, (objValue, srcValue, key) => {
            if (key === 'estado') {
                return objValue.valor === srcValue.valor;
            }
            return undefined; // Cuando se devuelve undefined la comparación la hace internamente isMatch()
        });
        return iguales ? -1 : indiceExistente;
    }

    /**
     * Elimina un rol de la lista
     *
     * @param {Rol} rol
     * @private
     */
    _eliminarEntidad(rol) {
        let indiceExistente = findIndex(this.roles, ['id', rol.id]);
        if (indiceExistente > -1) {
            this.roles.splice(indiceExistente, 1);
        }
    }

    /**es
     * Devuelve una lista de todos los roles existentes. La primera vez que se ejecuta este método, se piden los
     * rol al API, y en las siguientes llamadas se devuelve la lista almacenada en este servicio.
     * Devuelve los roles ordenados ascendentemente por su nombre.
     *
     * @param {boolean} soloActivos      -  Se debe pasar en true si se desea nada más la lista de roles activos.
     * @return {Promise<Rol[]>}          -  Se resuelve con el arreglo de roles.
     */
    obtenerTodos(soloActivos) {
        const fnRetorno = () => {
            // Por defecto se devuelven los roles ordenadas ascendentemente por el campo "nombre"
            let resultado = sortBy(this.roles, 'nombre');

            if (isNil(soloActivos) || soloActivos) {
                return filter(resultado, (entidad) => {
                    return entidad.estado.activo;
                });
            } else {
                return resultado;
            }
        };

        if (this.roles.length === 0) {
            return this.$http.get(this.ENDPOINT)
                .then(response => {
                    this.roles = map(response.data, obj => {
                        return this.procesarEntidadRecibida(obj)
                    });

                    return fnRetorno();
                });
        } else {
            return this.$q.resolve(fnRetorno());
        }
    }

    /**
     * Actualiza un rol existente. Sólo se puede cambiar su estado.
     *
     * @param {Rol} rol
     * @return {Promise<Rol>}    -  Se resuelve con el rol actualizado.
     */
    editar(rol) {
        // Se seleccionan los campos que interesan para la edición
        let objEditado = pick(rol, ['codigo', 'id', 'nombre', 'estado', 'editable', 'eliminable']);

        // Si lo que se editó fue el estado de la entidad, hay que actualizar el valor del estado, ya que con el UI
        // lo que se actualiza es la propiedad "activo"
        let cambioEstado = false;
        if ((objEditado.estado.activo && objEditado.estado.valor === MANTENIMIENTO_MAESTRO_INACTIVO)
            || (!objEditado.estado.activo && objEditado.estado.valor === MANTENIMIENTO_MAESTRO_ACTIVO)) {
            cambioEstado = true;
            objEditado.estado = {
                activo: rol.estado.activo,
                valor: rol.estado.activo ? MANTENIMIENTO_MAESTRO_ACTIVO : MANTENIMIENTO_MAESTRO_INACTIVO
            }
        }

        const fnValidacion = () => {
            if (cambioEstado) { return this.$q.resolve(); }
            return this.$q.reject();
        };

        return fnValidacion().then(() => {
            let indiceExistente = this._indiceEntidadCambiada(objEditado);
            if (indiceExistente >= 0) {
                let datosAEnviar = clone(objEditado);
                datosAEnviar.estado = objEditado.estado.valor;
                return this.$http.put(`${this.ENDPOINT}/${rol.codigo}`, datosAEnviar)
                    .then(response => {
                        this.roles[indiceExistente] = this.procesarEntidadRecibida(response.data);

                        // Notifica a las entidades que contengan una referencia a este rol que fue actualizado.
                        this.$timeout(() => {
                            this.Mediator.publish(EVENTO_ACTUALIZACION_ROL, this.roles[indiceExistente]);
                        }, 1000, false);

                        return this.roles[indiceExistente];
                    })
                    .catch(response => {
                        // Si en el servidor no se encontró una entidad con este código, se quita de la lista local
                        if (response.status === 404) {
                            this._eliminarEntidad(rol);
                        }
                        throw response;
                    });
            } else {
                return this.$q.reject();
            }
        });
    }

    /**
     * Elimina un rol. Dado que los mantenimientos maestros no se pueden eliminar de la Base de Datos, esto lo
     * que hace es cambiar el estado de un rol a Inactivo.
     * @param {Rol} rol
     * @return {Promise<Rol>}   -  Se resuelve con el rol eliminado.
     */
    eliminar(rol) {
        if (isNil(rol)){ return this.$q.reject() }
        let indiceExistente = findIndex(this.roles, ['id', rol.id]);
        if (indiceExistente < 0 ){ return this.$q.reject() }

        let objAEliminar = pick(rol, ['codigo', 'id', 'nombre', 'estado', 'editable', 'eliminable']);
        objAEliminar.estado.valor = rol.estado.activo ? MANTENIMIENTO_MAESTRO_ACTIVO : MANTENIMIENTO_MAESTRO_INACTIVO;

        return this.$http.delete(`${this.ENDPOINT}/${rol.id}`)
            .then(response => {
                this.roles[indiceExistente] = objAEliminar;
                return this.roles[indiceExistente];
            })
            .catch(response => {
                // Si en el servidor no se encontró una entidad con este código, se quita de la lista local
                if (response.status === 404) {
                    this._eliminarEntidad(rol);
                    throw response;
                } else if (response.error && response.error.errorCode === ELEMENTO_YA_ESTA_INACTIVO) {
                    // Igual se cambia el estado de la entidad, ya que el error se produjo porque ya tenía el estado
                    // que se le quería asignar
                    this.roles[indiceExistente] = objAEliminar;
                    return this.roles[indiceExistente];
                } else {
                    throw response;
                }
            });
    }
}