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
    ELEMENTO_YA_ESTA_INACTIVO, ETIQUETA_NOK, ETIQUETA_NOK_DESC, ETIQUETA_OK, ETIQUETA_OK_DESC, ETIQUETA_PENDIENTE,
    MANTENIMIENTO_MAESTRO_ACTIVO,
    MANTENIMIENTO_MAESTRO_INACTIVO
} from "../../common/constantes";
import {elementoRequeridoEsNulo, elementoYaExiste} from "../../common/validadores";


/* @ngInject */
/**
 * Esta clase es un servicio de Angular donde se almacena la lista de todos las etiquetas disponibles.
 */
export default class EtiquetasService {
    /**
     * Una etiqueta es un mantenimiento maestro.
     * @typedef {Object} Etiqueta
     * @property {number} id                                -  De sólo lectura. Se genera automáticamente en la Base de Datos
     *                                                          para etiquetas nuevas.
     * @property {number} codigo                            -  Lo mismo que id, se añade para mantener consistencia con otras entidades.
     * @property {string} descripcion                       -  Descripción de la etiqueta.
     * @property {string} estado                            -  Estado que representa esta etiqueta.
     * @property {Object} modulo                            -  Módulo asociado.
     * @property {Modulo} modulo.valor                      -  Su valor actual.
     * @property {Modulo} modulo.display                    -  Cómo debe ser representado.
     * @property {Object} descripcionEstado                 -  Cómo debe ser representado el estado de la etiqueta.
     * @property {string} descripcionEstado.nombre          -  El nombre del estado.
     * @property {number} descripcionEstado.autorizacion    -  A qué número de autorización corresponde.
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
        this.ENDPOINT = '/etiquetas';

        /** @private */
        this.$q = $q;
        /** @private */
        this.$http = $http;
        /** @private */
        this.ErroresValidacionMaestros = ErroresValidacionMaestros;

        /** @type {Etiqueta[]} */
        this.etiquetas = [];
    }

    /**
     * Le aplica algunas transformaciones a una etiqueta recibida del API. Añade los permisos de edición y también le
     * agrega una propiedad para facilitar la visualización del estado.
     *
     * @param {Object} entidad                  -  Representa una etiqueta recibida del API
     * @param {Modulo} [modulo]                 -  Módulo al que pertenece la etiqueta.
     * @returns {Etiqueta}                      -  La misma entidad, con las transformaciones mencionadas.
     */
    procesarEntidadRecibida(entidad, modulo) {
        entidad.codigo = entidad.id;

        // Si el valor del atributo modulo es un número, esto significa que contiene el código del módulo,
        // en vez del objeto completo, por lo que hay que reemplazarlo
        let moduloRecibido = entidad.modulo;
        if (typeof entidad.modulo === 'number' && !isNil(modulo)) {
            moduloRecibido = modulo;
        }
        entidad.modulo = {
            valor: moduloRecibido,
            display: moduloRecibido ? moduloRecibido.nombre : ''
        };

        const arregloEstado = entidad.estado.split('_');
        let nombre = '';
        let autorizacion = null;
        if (arregloEstado.length === 1 && arregloEstado[0] === "0") {
            nombre = ETIQUETA_PENDIENTE;
        } else if (arregloEstado.length === 2) {
            autorizacion = parseInt(arregloEstado[0]);
            if (arregloEstado[1] === ETIQUETA_OK) {
                nombre = ETIQUETA_OK_DESC;
            } else if (arregloEstado[1] === ETIQUETA_NOK) {
                nombre = ETIQUETA_NOK_DESC;
            }
        }
        entidad.descripcionEstado = {
            nombre,
            autorizacion
        };

        entidad.editable = true;
        entidad.eliminable = true;
        return entidad;
    }

    /**
     * Determina si una etiqueta es válida. Se debe llamar a este método antes de crear o editar una etiqueta.
     * Realiza varias comprobaciones:
     *  1 - Que la descripción no esté vacía, ya que es un campo requerido.
     *  2 - Que no exista ya una etiqueta para la combinación módulo + estado + # autorización
     *
     * @param {Etiqueta} etiqueta
     * @return {Promise<void>}                  - Se resuelve si la entidad es válida. En caso contrario, rechaza la promesa con
     *                                            el error específico.
     * @private
     */
    _validarEntidad(etiqueta) {
        if (elementoRequeridoEsNulo(etiqueta.descripcion)) {
            return this.$q.reject(this.ErroresValidacionMaestros.FALTA_REQUERIDO);
        } else {
            const indiceExistente = findIndex(this.etiquetas, (item) => {
                return item.id !== etiqueta.id && item.estado === etiqueta.estado && item.modulo.valor.id === etiqueta.modulo.id;
            });
            if (indiceExistente > -1) {
                return this.$q.reject(this.ErroresValidacionMaestros.ELEMENTO_DUPLICADO);
            }
        }

        return this.$q.resolve();
    }

    /**
     * Devuelve el índice de una etiqueta en la lista que las contiene a todas si sus datos son diferentes a los que
     * están almacenados en dicha lista. Este método es útil a la hora de editar una etiqueta, para no hacer una llamada
     * al API a menos que los datos de la misma hayan cambiado.
     *
     * @param {Etiqueta} etiqueta
     * @returns {number}               -  La posición de esa etiqueta en la lista según su código o -1 si sus datos son idénticos.
     * @private
     */
    _indiceEntidadCambiada(etiqueta) {
        if (isNil(etiqueta)) { return -1 }
        let indiceExistente = findIndex(this.etiquetas, ['id', etiqueta.id]);
        if (indiceExistente < 0) { return -1 }

        let iguales = isMatchWith(this.etiquetas[indiceExistente], etiqueta, (objValue, srcValue, key) => {
            if (key === 'modulo') {
                return get(objValue, 'valor.id') === srcValue.id;
            } else if (key === 'descripcionEstado') {
                return true;
            }
            return undefined; // Cuando se devuelve undefined la comparación la hace internamente isMatch()
        });
        return iguales ? -1 : indiceExistente;
    }

    /**
     * Elimina una etiqueta de la lista
     *
     * @param {Etiqueta} etiqueta
     * @private
     */
    _eliminarEntidad(etiqueta) {
        let indiceExistente = findIndex(this.etiquetas, ['id', etiqueta.id]);
        if (indiceExistente > -1) {
            this.etiquetas.splice(indiceExistente, 1);
        }
    }

    /**
     * Devuelve una lista de todos las etiquetas existentes. La primera vez que se ejecuta este método, se piden las
     * etiquetas al API, y en las siguientes llamadas se devuelve la lista almacenada en este servicio.
     * Devuelve las etiquetas ordenadas ascendentemente por su campo "descripción".
     *
     * @return {Promise<Etiqueta[]>}       -  Se resuelve con el arreglo de etiquetas.
     */
    obtenerTodos() {
        const fnRetorno = () => {
            // Por defecto se devuelven las etiquetas ordenadas ascendentemente por el campo "descripcion"
            return sortBy(this.etiquetas, 'descripcion');
        };

        if (this.etiquetas.length === 0) {
            return this.$http.get(this.ENDPOINT)
                .then(response => {
                    this.etiquetas = map(response.data, etiqueta => {
                        return this.procesarEntidadRecibida(etiqueta)
                    });

                    return fnRetorno();
                });
        } else {
            return this.$q.resolve(fnRetorno());
        }
    }

    /**
     * Genera el string que representa el estado de la etiqueta a partir de los valores de estado y # de autorización.
     *
     * @param {Etiqueta} etiqueta
     * @return {string}     - Devuelve el estado al que corresponde la etiqueta.
     */
    _generarEstado(etiqueta) {
        let resultado = !isNil(etiqueta.descripcionEstado.autorizacion) ? etiqueta.descripcionEstado.autorizacion : "0";
        if (etiqueta.descripcionEstado.nombre === ETIQUETA_OK_DESC) {
            resultado += `_${ETIQUETA_OK}`;
        } else if (etiqueta.descripcionEstado.nombre === ETIQUETA_NOK_DESC) {
            resultado += `_${ETIQUETA_NOK}`;
        }
        return resultado;
    }

    /**
     * Crea una nueva etiqueta.
     *
     * @param {Etiqueta} datosEtiqueta
     * @return {Promise<Etiqueta>}     - Se resuelve con la etiqueta creada.
     */
    crear(datosEtiqueta) {
        datosEtiqueta.estado = this._generarEstado(datosEtiqueta);

        return this._validarEntidad(datosEtiqueta)
            .then(() => {
                return this.$http.post(this.ENDPOINT, {
                    descripcion: datosEtiqueta.descripcion,
                    modulo: datosEtiqueta.modulo.id,
                    estado: datosEtiqueta.estado
                })
            }).then(response => {
                let nuevaEtiqueta = this.procesarEntidadRecibida(response.data, datosEtiqueta.modulo);
                this.etiquetas.push(nuevaEtiqueta);
                return nuevaEtiqueta;
            });
    }

    /**
     * Actualiza una etiqueta existente. Sólo se llama al API si los datos de la etiqueta cambiaron.
     *
     * @param {Etiqueta} etiqueta
     * @return {Promise<Etiqueta>}    -  Se resuelve con la etiqueta actualizada.
     */
    editar(etiqueta) {
        // Se seleccionan los campos que interesan para la edición
        let etiquetaEditada = pick(etiqueta, ['codigo', 'id', 'descripcion', 'estado', 'modulo', 'descripcionEstado',
                                              'editable', 'eliminable']);
        etiquetaEditada.estado = this._generarEstado(etiqueta);

        return this._validarEntidad(etiquetaEditada)
            .then(() => {
                let indiceExistente = this._indiceEntidadCambiada(etiquetaEditada);
                if (indiceExistente >= 0) {
                    return this.$http.put(`${this.ENDPOINT}/${etiqueta.codigo}`, {
                        id: etiquetaEditada.id,
                        descripcion: etiquetaEditada.descripcion,
                        modulo: etiquetaEditada.modulo.id,
                        estado: etiquetaEditada.estado
                    })
                        .then(response => {
                            this.etiquetas[indiceExistente] = this.procesarEntidadRecibida(response.data, etiqueta.modulo);
                            return this.etiquetas[indiceExistente];
                        })
                        .catch(response => {
                            // Si en el servidor no se encontró una entidad con este código, se quita de la lista local
                            if (response.status === 404) {
                                this._eliminarEntidad(etiqueta);
                            }
                            throw response;
                        });
                } else {
                    return this.$q.reject();
                }
            });
    }

    /**
     * Elimina una etiqueta.
     *
     * @param {Etiqueta} etiqueta
     * @return {Promise<Etiqueta>}   -  Se resuelve con la etiqueta eliminada.
     */
    eliminar(etiqueta) {
        return this.$http.delete(`${this.ENDPOINT}/${etiqueta.codigo}`)
            .then(response => {
                this._eliminarEntidad(etiqueta);
                return response.data;
            })
            .catch(response => {
                if (response && response.status === 404) {
                    this._eliminarEntidad(etiqueta);
                }
                throw response;
            });
    }
}