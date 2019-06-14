import map from 'lodash/map';
import clone from 'lodash/clone';
import get from 'lodash/get';
import isNil from 'lodash/isNil';

import './modal-adjuntos.scss';
import {ADJUNTO_MUY_GRANDE, ELEMENTO_NO_ENCONTRADO, ERROR_GENERAL} from "../../common/constantes";


/* @ngInject */
/**
 * Esta clase representa un controlador de Angular correspondiente a la vista de la lista de adjuntos de una petición.
 */
export default class ModalAdjuntosController {
    /**
     * @param $uibModalInstance
     * @param $scope
     * @param toastr
     * @param FileUploader
     * @param {AdjuntosService} AdjuntosService
     * @param {PeticionesService} PeticionesService
     * @param {SesionService} SesionService
     * @param AppConfig
     * @param {Peticion} peticion
     * @param {boolean} modoEdicion
     * @param {boolean} modoAutorizador
     * @param {function} fnAccion
     * @param {function} fnResolucion
     */
    constructor($uibModalInstance, $scope, toastr, FileUploader, AdjuntosService, PeticionesService, SesionService, AppConfig,
                peticion, modoEdicion, modoAutorizador, fnAccion, fnResolucion) {
        /** @private */
        this.$uibModalInstance = $uibModalInstance;
        /** @private */
        this.toastr = toastr;
        /** @private */
        this.adjuntosService = AdjuntosService;
        /** @private */
        this.peticionesService = PeticionesService;
        /** @private */
        this.peticion = peticion;
        /** @type {boolean} */
        this.modoEdicion = modoEdicion;
        /** @type {boolean} */
        this.modoAutorizador = modoAutorizador;
        this.ejecutarAccion = (entidad, accion) => {
            fnAccion(entidad, accion)
                .catch(response => {
                    if (response && response.status === 401) {
                        this.peticionesService.eliminarEntidad(this.peticion);
                        this.adjuntos = null;
                        this.$uibModalInstance.close();

                        this.toastr.warning('Lo sentimos, ya no tiene permiso para acceder a esta petición.');
                    }
                })
                .finally(() => {
                    this._listaAdjuntos();
                });
        };
        /** @private */
        this.fnResolucion = fnResolucion;

        this.presentacion = this._presentacionTabla();
        /** @type {Adjunto[]} */
        this.adjuntos = null;
        this._listaAdjuntos();

        this.uploader = new FileUploader({
            url: AppConfig.url ? `${AppConfig.url}${this.adjuntosService.ENDPOINT}` : this.adjuntosService.ENDPOINT,
            alias: 'contenido',
            formData: [{
                idPeticion: this.peticion.id
            }],
            autoUpload: true,
            removeAfterUpload: true,
            queueLimit: 1,
            withCredentials: !DEBUG_MODE,
            onSuccessItem: (item, response) => {
                if (isNil(this.peticion.adjuntos)) {
                    this.peticion.adjuntos = [];
                }

                this.peticion.adjuntos.push(response.data);
                this.peticion.cantidadAdjuntos = this.peticion.adjuntos.length;
                let adjunto = this._procesarAdjunto(response.data);
                this.adjuntos = this.adjuntos.concat(adjunto);
                this.toastr.success(adjunto.nombre, 'Adjunto añadido');
            },
            onWhenAddingFileFailed: (item, filter) => {
                if(filter.name === "queueLimit") {
                    this.uploader.clearQueue();
                    this.uploader.addToQueue(item);
                } else {
                    this.toastr.warning('Lo sentimos, no se pudo añadir este adjunto');
                }
            },
            onErrorItem: (item, response, status) => {
                let eliminarPeticion = false;
                if (status === 0) {
                    toastr.error('No se pudo establecer una conexión con el servidor', null, {
                        closeButton: true,
                        timeOut: 0,
                        extendedTimeOut: 0
                    });
                } else if (status === 500 && get(response, 'errorCode') === ERROR_GENERAL) {
                    toastr.warning(response.message, null, {
                        closeButton: true,
                        timeOut: 0,
                        extendedTimeOut: 0
                    });
                } else if (status === 500 && get(response, 'errorCode') === ADJUNTO_MUY_GRANDE) {
                    toastr.warning('No se pudo añadir este archivo porque es demasiado grande.');
                } else if (status === 401) {
                    this.toastr.warning('Lo sentimos, ya no tiene permiso para acceder a esta petición.');
                    eliminarPeticion = true;
                } else if (get(response, 'errorCode') === ELEMENTO_NO_ENCONTRADO) {
                    this.toastr.warning('Lo sentimos, no se encontró la petición asociada a este adjunto');
                    eliminarPeticion = true;
                }

                if (eliminarPeticion) {
                    this.peticionesService.eliminarEntidad(this.peticion);
                    this.adjuntos = null;
                    this.$uibModalInstance.close();
                }
            }
        });

        // Esta variable está definida estáticamente en webpack.config. En producción toma el valor false, por lo que
        // esta sección del código no se añade al bundle.
        if (DEBUG_MODE) {
            // En modo DEBUG, se envía el header X-User en el upload de un archivo.
            SesionService.obtenerUsuarioAutenticado()
                .then(usuario => {
                    this.uploader.headers = {
                        'X-User': usuario.nInterno
                    }
                });
        }

        // Cuando se cierra el modal, por el motivo que sea, resuelve la promesa con la lista de adjuntos.
        let deregister = $scope.$on('modal.closing', () => {
            fnResolucion(this.adjuntos);
            deregister();
        });
    }

    /**
     * Devuelve las propiedades de presentación del componente <ge-tabla> para la lista de adjuntos.
     * @return {Object}
     * @private
     */
    _presentacionTabla() {
        return {
            entidad: 'Adjunto',
            atributoPrincipal: 'nombre',
            columnas: [
                {nombre: 'nombre', display: 'Nombre', ordenable: true},
                {nombre: 'accionDescargar', html: true, ancho: '40px'},
                {nombre: 'accionEliminar', html: true, ancho: '40px'}
            ]
        };
    }

    /**
     * Devuelve la lista de adjuntos, procesada para su correcta visualización.
     * @return {Adjunto[]}
     * @private
     */
    _listaAdjuntos() {
        return this.adjuntosService.obtenerTodos(this.peticion)
            .then(adjuntos => {
                this.adjuntos = map(adjuntos, adjunto => {
                    return this._procesarAdjunto(adjunto);
                });
            })
            .catch(response => {
                let eliminarPeticion = false;

                if (response.status === -1 || (response.status === 500 && get(response, 'error.errorCode') === ERROR_GENERAL)) {
                    this.$uibModalInstance.close();
                } else if (response.status === 401) {
                    this.toastr.warning('Lo sentimos, ya no tiene permiso para acceder a esta petición.');
                    eliminarPeticion = true;
                } else if (response.status === 404) {
                    eliminarPeticion = true;
                }

                if (eliminarPeticion) {
                    this.peticionesService.eliminarEntidad(this.peticion);
                    this.adjuntos = null;
                    this.$uibModalInstance.close();
                }
            });
    }

    /**
     * Le aplica algunas transformaciones a un adjunto antes de ser visualizado. En todos los casos le añade una acción para
     * poder descargar el adjunto, y en modo edición le añade una opción para poder eliminarlo también.
     *
     * @param {Adjunto} adjunto
     * @return {Adjunto}        - La misma entidad, con las transformaciones mencionadas
     * @private
     */
    _procesarAdjunto(adjunto) {
        let clon = clone(adjunto);

        clon.codigo = clon.id;
        clon.editable = false;
        clon.eliminable = false;
        clon.accionDescargar = `<a href ng-click="$ctrl.fnAccion({entidad: elemento, accion: 'descargar'})"
                                   class="icon-download3" uib-tooltip="Descargar">
                                </a>`;
        clon.accionEliminar = `<a href ng-click="$ctrl.fnAccion({entidad: elemento, accion: 'eliminar'})"
                                       class="icon-bin" uib-tooltip="Eliminar">
                                   </a>`;

        return clon;
    }

    /**
     * Cierra el modal de adjuntos.
     */
    cancelar() {
        this.$uibModalInstance.close();
    }
}