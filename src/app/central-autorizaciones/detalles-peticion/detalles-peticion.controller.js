import clone from 'lodash/clone';
import get from 'lodash/get';
import map from 'lodash/map';

import {ELEMENTO_NO_ENCONTRADO, ERROR_GENERAL} from '../../common/constantes';

import './detalles-peticion.scss';

const PATH_401 = '/acceso-denegado';
const PATH_404 = '/no-encontrado';


/* @ngInject */
/**
 * Esta clase representa un controlador de Angular correspondiente a la vista de detalles de una petición.
 */
export default class DetallesPeticionController {
    /**
     * @param $routeParams
     * @param $location
     * @param toastr
     * @param FileUploader
     * @param {PeticionesService} PeticionesService
     * @param {MensajesService} MensajesService
     * @param {AdjuntosService} AdjuntosService
     * @param {SesionService} SesionService
     * @param AppConfig
     */
    constructor($routeParams, $location, toastr, FileUploader, PeticionesService, MensajesService, AdjuntosService, SesionService, AppConfig) {
        /** @private */
        this.$location = $location;
        /** @private */
        this.toastr = toastr;
        /** @private */
        this.peticionesService = PeticionesService;
        /** @private */
        this.mensajesService = MensajesService;
        /** @private */
        this.adjuntosService = AdjuntosService;

        this.presentacionAdjuntos = {
            entidad: 'Adjunto',
            atributoPrincipal: 'nombre',
            columnas: [
                {nombre: 'nombre', display: 'Nombre', ordenable: true},
                {nombre: 'accionDescargar', html: true, ancho: '40px'},
            ]
        };

        this.peticionesService.obtener($routeParams.id)
            .then(peticion => {
                this.peticion = peticion;
                this.mensajes = [];
                this.mensajesService.obtenerTodos(this.peticion)
                    .then(mensajes => {
                        this.mensajes = mensajes;
                    });

                this.adjuntosService.obtenerTodos(this.peticion)
                    .then(adjuntos => {
                        this.adjuntos = map(adjuntos, adjunto => {
                            return this._procesarAdjunto(adjunto);
                        });
                    });
            })
            .catch(response => {
                if (response.status === 404) {
                    this.$location.path(PATH_404);
                }
            });

        this.uploader = new FileUploader({
            url: AppConfig.url ? `${AppConfig.url}${this.adjuntosService.ENDPOINT}` : this.adjuntosService.ENDPOINT,
            alias: 'contenido',
            formData: [{
                idPeticion: $routeParams.id
            }],
            autoUpload: true,
            removeAfterUpload: true,
            queueLimit: 1,
            withCredentials: !DEBUG_MODE,
            onSuccessItem: (item, response) => {
                this.peticion.adjuntos.push(response.data);
                let adjunto = this._procesarAdjunto(response.data);
                this.adjuntos = this.adjuntos.concat(adjunto);
                this.toastr.success(adjunto.nombre, 'Adjunto añadido');
            },
            onWhenAddingFileFailed: (item, filter) => {
                if(filter.name === 'queueLimit') {
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
                } else if (status === 401) {
                    eliminarPeticion = true;
                    this.$location.path(PATH_401);
                } else if (get(response, 'errorCode') === ELEMENTO_NO_ENCONTRADO) {
                    eliminarPeticion = true;
                    this.$location.path(PATH_404);
                }

                if (eliminarPeticion) {
                    this.peticionesService.eliminarEntidad(this.peticion);
                    this.adjuntos = null;
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
                    };
                });
        }
    }

    enviar() {
        if (this.mensaje) {
            return this.mensajesService.enviarMensaje(this.mensaje, this.peticion)
                .then(() => {
                    this.mensajes = clone(this.peticion.mensajes);
                })
                .catch(response => {
                    let eliminarPeticion = false;
                    if (response.status === 401) {
                        eliminarPeticion = true;
                        this.$location.path(PATH_401);
                    } else if (get(response, 'error.errorCode') === ELEMENTO_NO_ENCONTRADO) {
                        eliminarPeticion = true;
                        this.$location.path(PATH_404);
                    }

                    if (eliminarPeticion) {
                        this.peticionesService.eliminarEntidad(this.peticion);
                        this.mensajes = null;
                    }
                })
                .finally(() => {
                    this.mensaje = '';
                });
        }
    }

    descargarAdjunto(entidad) {
        return this.adjuntosService.descargar(entidad, this.peticion);
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
        clon.accionDescargar = `<a href ng-click="$ctrl.fnAccion({entidad: elemento})"
                                   class="icon-download3" uib-tooltip="Descargar">
                                </a>`;

        return clon;
    }
}