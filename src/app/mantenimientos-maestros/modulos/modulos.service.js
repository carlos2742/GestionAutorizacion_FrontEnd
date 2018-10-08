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


export const EVENTO_ACTUALIZACION_MODULO = 'modulo:edicion';


/* @ngInject */
/**
 * Esta clase es un servicio de Angular donde se almacena la lista de todos los módulos disponibles.
 */
export default class ModulosService {
    /**
     * Un módulo es un mantenimiento maestro.
     * @typedef {Object} Modulo
     * @property {number} id                    -  De sólo lectura. Se genera automáticamente en la Base de Datos para módulos nuevos.
     * @property {number} codigo                -  Lo mismo que id, se añade para mantener consistencia con otras entidades.
     * @property {string} nombre                -  Nombre del módulo.
     * @property {Object} estado                -  Determina si un módulo está activo o inactivo
     * @property {boolean} estado.activo
     * @property {string} estado.valor          -  Puede tener los valores 'A' (para activo), o 'I' (para inactivo).
     */

    /**
     * @param $q                        -  Servicio de Angular para utilizar Promesas
     * @param $http                     -  Servicio de Angular para hacer llamadas HTTP
     * @param $timeout                  -  Servicio de Angular para ejecutar código asíncrono
     * @param ErroresValidacionMaestros -  Contiene los errores que pueden devolver las validaciones. Ver {@link ErroresValidacionMaestros}
     * @param Mediator
     *
     **/
    constructor($q, $http, $timeout, ErroresValidacionMaestros, Mediator) {
        // Constantes del servicio
        /** @private */
        this.ENDPOINT = '/modulos';

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

        /** @type {Modulo[]} */
        this.modulos = [];
    }

    /**
     * Le aplica algunas transformaciones a un módulo recibido del API. Añade los permisos de edición y también le
     * agrega una propiedad para facilitar la visualización del estado.
     *
     * @param {Object} entidad      -  Representa un módulo recibido del API
     * @returns {Modulo}            -  La misma entidad, con las transformaciones mencionadas.
     */
    procesarEntidadRecibida(entidad) {
        entidad.codigo = entidad.id;

        entidad.estado = {
            valor: entidad.estado,
            activo: entidad.estado === MANTENIMIENTO_MAESTRO_ACTIVO
        };

        entidad.editable = true;
        // TODO Revisar si los módulos se pueden eliminar
        entidad.eliminable = false;

        return entidad;
    }

    /**
     * Determina si un módulo es válido. Se debe llamar a este método antes de crear o editar un módulo.
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
     * Devuelve el índice de un módulo en la lista que los contiene a todos si sus datos son diferentes a los que
     * están almacenados en dicha lista. Este método es útil a la hora de editar un módulo, para no hacer una llamada
     * al API a menos que los datos del mismo hayan cambiado.
     *
     * @param {Modulo} modulo
     * @returns {number}               -  La posición de ese módulo en la lista según su código o -1 si sus datos son idénticos.
     * @private
     */
    _indiceEntidadCambiada(modulo) {
        if (isNil(modulo)) { return -1 }
        let indiceExistente = findIndex(this.modulos, ['id', modulo.id]);
        if (indiceExistente < 0) { return -1 }

        let iguales = isMatchWith(this.modulos[indiceExistente], modulo, (objValue, srcValue, key) => {
            if (key === 'estado') {
                return objValue.valor === srcValue.valor;
            }
            return undefined; // Cuando se devuelve undefined la comparación la hace internamente isMatch()
        });
        return iguales ? -1 : indiceExistente;
    }

    /**
     * Elimina un módulo de la lista
     *
     * @param {Modulo} modulo
     * @private
     */
    _eliminarEntidad(modulo) {
        let indiceExistente = findIndex(this.modulos, ['id', modulo.id]);
        if (indiceExistente > -1) {
            this.modulos.splice(indiceExistente, 1);
        }
    }

    /**
     * Devuelve una lista de todos los módulos existentes. La primera vez que se ejecuta este método, se piden los
     * módulos al API, y en las siguientes llamadas se devuelve la lista almacenada en este servicio.
     * Devuelve los módulos ordenados ascendentemente por su nombre.
     *
     * @param {boolean} soloActivos         -  Se debe pasar en true si se desea nada más la lista de módulos activos.
     * @return {Promise<Modulo[]>}          -  Se resuelve con el arreglo de módulos.
     */
    obtenerTodos(soloActivos) {
        const fnRetorno = () => {
            // Por defecto se devuelven los módulos ordenadas ascendentemente por el campo "nombre"
            let resultado = sortBy(this.modulos, 'nombre');

            if (isNil(soloActivos) || soloActivos) {
                return filter(resultado, (entidad) => {
                    return entidad.estado.activo;
                });
            } else {
                return resultado;
            }
        };

        if (this.modulos.length === 0) {
            return this.$http.get(this.ENDPOINT)
                .then(response => {
                    this.modulos = map(response.data, obj => {
                        return this.procesarEntidadRecibida(obj)
                    });

                    return fnRetorno();
                });
        } else {
            return this.$q.resolve(fnRetorno());
        }
    }

    /**
     * Crea un nuevo módulo.
     *
     * @param {string} nombre
     * @return {Promise<Modulo>}     - Se resuelve con el módulo creado
     */
    crear(nombre) {
        return this._validarEntidad(null, nombre)
            .then(() => {
                return this.$http.post(this.ENDPOINT, { nombre })
            }).then(response => {
                let nuevoObj = this.procesarEntidadRecibida(response.data);
                this.modulos.push(nuevoObj);
                return nuevoObj;
            });
    }

    /**
     * Actualiza un módulo existente. Sólo se llama al API si los datos del módulo cambiaron.
     *
     * @param {Modulo} modulo
     * @return {Promise<Modulo>}    -  Se resuelve con el módulo actualizado.
     */
    editar(modulo) {
        // Se seleccionan los campos que interesan para la edición
        let objEditado = pick(modulo, ['codigo', 'id', 'nombre', 'estado', 'editable', 'eliminable']);

        // Si lo que se editó fue el estado de la entidad, hay que actualizar el valor del estado, ya que con el UI
        // lo que se actualiza es la propiedad "activo"
        let cambioEstado = false;
        if ((objEditado.estado.activo && objEditado.estado.valor === MANTENIMIENTO_MAESTRO_INACTIVO)
            || (!objEditado.estado.activo && objEditado.estado.valor === MANTENIMIENTO_MAESTRO_ACTIVO)) {
            cambioEstado = true;
            objEditado.estado = {
                activo: modulo.estado.activo,
                valor: modulo.estado.activo ? MANTENIMIENTO_MAESTRO_ACTIVO : MANTENIMIENTO_MAESTRO_INACTIVO
            }
        }

        const fnValidacion = () => {
            if (cambioEstado) { return this.$q.resolve(); }
            return this._validarEntidad(modulo.codigo, modulo.nombre);
        };

        return fnValidacion().then(() => {
            let indiceExistente = this._indiceEntidadCambiada(objEditado);
            if (indiceExistente >= 0) {
                let datosAEnviar = clone(objEditado);
                datosAEnviar.estado = objEditado.estado.valor;
                return this.$http.put(`${this.ENDPOINT}/${modulo.codigo}`, datosAEnviar)
                    .then(response => {
                        this.modulos[indiceExistente] = this.procesarEntidadRecibida(response.data);

                        // Notifica a las entidades que contengan una referencia a este módulo que fue actualizado.
                        this.$timeout(() => {
                            this.Mediator.publish(EVENTO_ACTUALIZACION_MODULO, this.modulos[indiceExistente]);
                        }, 1000, false);

                        return this.modulos[indiceExistente];
                    })
                    .catch(response => {
                        // Si en el servidor no se encontró una entidad con este código, se quita de la lista local
                        if (response.status === 404) {
                            this._eliminarEntidad(modulo);
                        }
                        throw response;
                    });
            } else {
                return this.$q.reject();
            }
        });
    }

    /**
     * Elimina un módulo. Dado que los mantenimientos maestros no se pueden eliminar de la Base de Datos, esto lo
     * que hace es cambiar el estado de un módulo a Inactivo.
     * @param {Modulo} modulo
     * @return {Promise<Modulo>}   -  Se resuelve con el módulo eliminado.
     */
    eliminar(modulo) {
        if (isNil(modulo)){ return this.$q.reject() }
        let indiceExistente = findIndex(this.modulos, ['id', modulo.id]);
        if (indiceExistente < 0 ){ return this.$q.reject() }

        let objAEliminar = pick(modulo, ['codigo', 'id', 'nombre', 'estado', 'editable', 'eliminable']);
        objAEliminar.estado.valor = modulo.estado.activo ? MANTENIMIENTO_MAESTRO_ACTIVO : MANTENIMIENTO_MAESTRO_INACTIVO;

        return this.$http.delete(`${this.ENDPOINT}/${modulo.id}`)
            .then(response => {
                this.modulos[indiceExistente] = objAEliminar;
                return this.modulos[indiceExistente];
            })
            .catch(response => {
                // Si en el servidor no se encontró una entidad con este código, se quita de la lista local
                if (response.status === 404) {
                    this._eliminarEntidad(modulo);
                    throw response;
                } else if (response.error && response.error.errorCode === ELEMENTO_YA_ESTA_INACTIVO) {
                    // Igual se cambia el estado de la entidad, ya que el error se produjo porque ya tenía el estado
                    // que se le quería asignar
                    this.modulos[indiceExistente] = objAEliminar;
                    return this.modulos[indiceExistente];
                } else {
                    throw response;
                }
            });
    }
}