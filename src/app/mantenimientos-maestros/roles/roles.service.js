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
     * @property {string} nombreProcedimiento   -  Nombre del procedimiento SQL que se ejecuta para determinar si un usuario está
     *                                              autorizado a ver una petición.
     * @property {string} observaciones         -  Observaciones.
     * @property {boolean} dependePeticion      -  Verdadero si este rol se debe determinar por cada una de las peticiones.
     * @property {Object} estado                -  Determina si un rol está activo o inactivo
     * @property {boolean} estado.activo
     * @property {string} estado.valor          -  Puede tener los valores 'A' (para activo), o 'I' (para inactivo).
     */

    /**
     * @param $q                        -  Servicio de Angular para utilizar Promesas
     * @param $http                     -  Servicio de Angular para hacer llamadas HTTP
     *
     **/
    constructor($q, $http, ErroresValidacionMaestros) {
        // Constantes del servicio
        /** @private */
        this.ENDPOINT = '/roles';

        /** @private */
        this.$q = $q;
        /** @private */
        this.$http = $http;
        /** @private */
        this.ErroresValidacionMaestros = ErroresValidacionMaestros;

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

        entidad.editable = true;
        entidad.eliminable = false;

        return entidad;
    }

    /**
     * Determina si un rol es válido. Se debe llamar a este método antes de crear o editar un rol.
     * Realiza varias comprobaciones:
     *  1 - Que el nombre no esté vacío, ya que es un campo requerido.
     *  2 - Que el nombre del procedimiento no esté vacío, ya que es un campo requerido.
     *
     * @param {number} codigo
     * @param {string} nombre
     * @param {string} nombreProcedimiento
     * @return {Promise<void>}                  - Se resuelve si la entidad es válida. En caso contrario, rechaza la promesa con
     *                                            el error específico.
     * @private
     */
    _validarEntidad(codigo, nombre, nombreProcedimiento) {
        if (elementoRequeridoEsNulo(nombre)) {
            return this.$q.reject(this.ErroresValidacionMaestros.FALTA_REQUERIDO);
        }
        if (elementoRequeridoEsNulo(nombreProcedimiento)) {
            return this.$q.reject(this.ErroresValidacionMaestros.FALTA_REQUERIDO);
        }

        return this.$q.resolve();
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
     * Crea un nuevo rol.
     *
     * @param {Rol} rol
     * @return {Promise<Rol>}     - Se resuelve con el rol creado
     */
    crear(rol) {
        return this._validarEntidad(null, rol.nombre, rol.nombreProcedimiento)
            .then(() => {
                return this.$http.post(this.ENDPOINT, {
                    nombre: rol.nombre,
                    nombreProcedimiento: rol.nombreProcedimiento,
                    observaciones: rol.observaciones,
                    dependePeticion: rol.dependePeticion
                })
            }).then(response => {
                let nuevoObj = this.procesarEntidadRecibida(response.data);
                this.roles.push(nuevoObj);
                return nuevoObj;
            });
    }

    /**
     * Actualiza un rol existente. Sólo se puede cambiar su estado.
     *
     * @param {Rol} rol
     * @return {Promise<Rol>}    -  Se resuelve con el rol actualizado.
     */
    editar(rol) {
        // Se seleccionan los campos que interesan para la edición
        let objEditado = pick(rol, ['codigo', 'id', 'nombre', 'nombreProcedimiento', 'observaciones', 'dependePeticion', 'estado', 'editable', 'eliminable']);

        // Si lo que se editó fue el estado de la entidad, hay que actualizar el valor del estado, ya que con el UI
        // lo que se actualiza es la propiedad "activo"
        let cambioEstado = false;
        if ((objEditado.estado.activo && objEditado.estado.valor === MANTENIMIENTO_MAESTRO_INACTIVO)
            || (!objEditado.estado.activo && objEditado.observacionesestado.valor === MANTENIMIENTO_MAESTRO_ACTIVO)) {
            cambioEstado = true;
            objEditado.estado = {
                activo: rol.estado.activo,
                valor: rol.estado.activo ? MANTENIMIENTO_MAESTRO_ACTIVO : MANTENIMIENTO_MAESTRO_INACTIVO
            }
        }

        const fnValidacion = () => {
            if (cambioEstado) { return this.$q.resolve(); }
            return this._validarEntidad(rol.codigo, rol.nombre, rol.nombreProcedimiento);
        };

        return fnValidacion().then(() => {
            let indiceExistente = this._indiceEntidadCambiada(objEditado);
            if (indiceExistente >= 0) {
                let datosAEnviar = clone(objEditado);
                datosAEnviar.estado = objEditado.estado.valor;
                return this.$http.put(`${this.ENDPOINT}/${rol.codigo}`, datosAEnviar)
                    .then(response => {
                        this.roles[indiceExistente] = this.procesarEntidadRecibida(response.data);
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

        let objAEliminar = pick(rol, ['codigo', 'id', 'nombre', 'nombreProcedimiento', 'observaciones', 'dependePeticion', 'estado', 'editable', 'eliminable']);
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