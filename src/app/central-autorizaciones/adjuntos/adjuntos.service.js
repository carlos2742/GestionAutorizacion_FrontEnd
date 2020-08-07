import remove from 'lodash/remove';
import isNil from 'lodash/isNil';
import FileSaver from 'file-saver';

import template from './modal-adjuntos.html';
import templateEliminar from '../../common/ge-tabla/modal-eliminar-entidad.html';


/* @ngInject */
/**
 * Esta clase representa el servicio de Angular que gestiona los adjuntos de una petición.
 */
export default class AdjuntosService {
    /**
     * Representa un archivo adjunto a una petición
     * @typedef {Object} Adjunto
     * @property {number} id        -  Identificador del adjunto. Autogenerado en la Base de Datos para adjuntos nuevos.
     * @property {number} codigo    -  Lo mismo que 'id', se añade para mantener consistencia con otras entidades.
     * @property {string} nombre    -  Nombre del adjunto.
     */

    /**
     * @param $q
     * @param $http
     * @param $uibModal
     * @param {PeticionesService} PeticionesService
     **/
    constructor($q, $http, $uibModal, PeticionesService) {
        // Constantes del servicio
        /** @type {string} */
        this.ENDPOINT = '/peticiones_adjuntos';

        /** @private */
        this.$q = $q;
        /** @private */
        this.$http = $http;
        /** @private */
        this.$uibModal = $uibModal;
        /** @private */
        this.peticionesService = PeticionesService;
    }

    obtenerTodos(peticion) {
        const fnObtencion = (idPeticion) => {
            return this.$http.get(this.ENDPOINT, { params: { idPeticion } })
                .then(response => {
                    return response.data;
                });
        };

        if (typeof peticion === 'number') {
            return fnObtencion(peticion);
        } else if (isNil(peticion.adjuntos) || peticion.adjuntos.length === 0) {
            return fnObtencion(peticion.id)
                .then(adjuntos => {
                    peticion.adjuntos = adjuntos;
                    return peticion.adjuntos;
                });
        } else {
            return this.$q.resolve(peticion.adjuntos);
        }
    }

    /**
     * Descarga el adjunto seleccionado a la PC del usuario.
     * @param {Adjunto} adjunto
     * @param {Peticion} peticion
     */
    descargar(adjunto, peticion) {
        return this.$http.get(`${this.ENDPOINT}/${adjunto.id}`, {responseType: 'arraybuffer'})
            .then(response => {
                let archivo = new Blob([response.data], {type: 'blob'});
                FileSaver.saveAs(archivo, adjunto.nombre);
            })
            .catch(response => {
                // Si el API devuelve que no encontró el adjunto, lo elimina de la lista local
                if (response && response.status === 404) {
                    remove(peticion.adjuntos, ['id', adjunto.id]);
                }
                throw response;
            });
    }

    /**
     * Muestra el modal que contiene la lista de adjuntos de una petición determinada.
     * @param {Peticion} entidad
     * @param {Object} conf                 -  Objeto que contiene la configuración del modal.
     * @param {Object} conf.contenedor      -  Elemento del DOM que va a contener el modal.
     * @param {boolean} conf.modoEdicion    -  Se debe pasar en verdadero si se debe añadir la opción de eliminar los
     *                                          adjuntos en la tabla.
     * @return {Promise}                    -  Se resuelve cuando el usuario cierra el modal de adjuntos.
     */
    mostrar(entidad, conf) {
        return this.$q((resolve, reject) => {
            this.$uibModal.open({
                template,
                appendTo: conf.contenedor,
                size: 'dialog-centered',    // hack para que el modal salga centrado verticalmente
                controller: 'ModalAdjuntosController',
                controllerAs: '$modal',
                resolve: {
                    peticion: () => { return entidad },
                    modoEdicion: () => { return conf.modoEdicion },
                    modoAutorizador: () => { return conf.modoAutorizador },
                    fnAccion: () => {
                        return (adjunto, accion) => {
                            if (accion === 'descargar') {
                                return this.descargar(adjunto, entidad);
                            } else if (accion === 'eliminar') {
                                return this.accionEliminar(adjunto, entidad);
                            }
                        };
                    },
                    fnResolucion: () => {
                        return (resultado) => { resolve(resultado) }
                    }
                }
            }).result.catch(() => {
                // Es necesario añadir este catch para que la biblioteca 'ui-bootstrap4' no muestre la siguiente excepción en consola:
                // Possibly unhandled rejection: backdrop click
                // cuando se cierra el modal haciendo click fuera del mismo
            });
        });
    }

    /**
     * Elimina un adjunto de una petición.
     * @param {Adjunto} adjunto
     * @param {Peticion} peticion
     * @return {Promise}            -  Se resuelve cuando el adjunto fue eliminado
     */
    eliminar(adjunto, peticion) {
        return this.$http.delete(`${this.ENDPOINT}/${adjunto.codigo}`)
            .then(() => {
                remove(peticion.adjuntos, ['id', adjunto.id]);
                peticion.cantidadAdjuntos = peticion.adjuntos.length;
            })
            .catch(response => {
                if (response && response.status === 404) {
                    remove(peticion.adjuntos, ['id', adjunto.id]);
                    peticion.cantidadAdjuntos = peticion.adjuntos.length;
                }

                throw response;
            });
    }

    /**
     * Muestra un modal de confirmación antes de eliminar un adjunto. No se pudo usar el modal de confirmación del componente
     * ge-tabla por problemas de solapación de los modals (ya que la lista de adjuntos ya se muestra también en un modal).
     * @param {Adjunto} adjunto
     * @param {Peticion} peticion
     * @return {Promise}        -  Se resuelve cuando el adjunto fue eliminado.
     */
    accionEliminar(adjunto, peticion) {
        return this.$q((resolve, reject) => {
            const contenedor = angular.element(document.getElementById(`customModalEliminarAdjunto`));
            let modal = this.$uibModal.open({
                template: templateEliminar,
                appendTo: contenedor,
                controller: 'ModalEliminarEntidadController',
                controllerAs: '$modal',
                resolve: {
                    nombre: () => {
                        return `"${adjunto.nombre}"`
                    },
                    elemento: () => {
                        return adjunto
                    },
                    entidad: () => {
                        return 'Adjunto'
                    },
                    incluirMotivo: () => {
                        return false;
                    },
                    fnEliminacion: () => {
                        return () => {
                            return this.eliminar(adjunto, peticion)
                                .catch(response => {
                                   reject(response);
                                   throw response;
                                });
                        };
                    }
                }
            });

            modal.result.then((eliminado) => {
                if (eliminado) { resolve(); }
                else { reject(); }
            });
            modal.result.catch(() => {
                reject();
            });
        });
    }
}