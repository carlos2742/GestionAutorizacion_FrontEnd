import clone from 'lodash/clone';
import get from 'lodash/get';
import map from 'lodash/map';
import isNil from 'lodash/isNil';

import {ADJUNTO_MUY_GRANDE, ELEMENTO_NO_ENCONTRADO, ERROR_GENERAL} from '../../common/constantes';

import './detalles-peticion.scss';

const PATH_401 = '/acceso-denegado';
const PATH_404 = '/no-encontrado';


/* @ngInject */
/**
 * Esta clase representa un controlador de Angular correspondiente a la vista de detalles de una petición.
 */
export default class DetallesPeticionController {
    /**
     * @param $q
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
    constructor($q, $routeParams, $location, toastr, FileUploader, PeticionesService, MensajesService, AdjuntosService, SesionService, AppConfig) {
        /** @private */
        this.$q = $q;
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
                {nombre: 'accionEliminar', html: true, ancho: '40px'}
            ]
        };

        this.presentacionHistorialAutorizaciones = {
            entidad: 'Autorización',
            atributoPrincipal: 'autorizador.display',
            ordenInicial: ['fecha.valor', 'asc'],
            columnas: [
                {nombre: 'fecha.display', display: 'Fecha', ordenable: false},
                {nombre: 'displayOrden', display: 'Autorización', ordenable: false},
                {nombre: 'autorizador.display', display: 'Autorizador', ordenable: false},
                {nombre: 'estado.display', display: 'Etiqueta', ordenable: false}
            ]
        };

        const idPeticion = parseInt($routeParams.id);
        this.$q.all([
            this.peticionesService.obtener(idPeticion),
            this._obtenerAdjuntos(idPeticion),
            this.mensajesService.obtenerTodos(idPeticion)
        ]).then(resultado => {
            this.peticion = resultado[0];
            this.peticion.adjuntos = resultado[1];

            this.peticion.mensajes = map(resultado[2], mensaje => {
                if (mensaje.enviadoPor.valor.nInterno === this.peticion.solicitante.valor.nInterno) {
                    mensaje.enviadoPor.display = `${mensaje.enviadoPor.display} (solicitante)`;
                }
                return mensaje;
            });
            this.mensajes = this.peticion.mensajes;

            this.historialAutorizaciones = this.peticion.actividades;
        }).catch(response => {
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
                if(filter.name === 'queueLimit') {
                    this.uploader.clearQueue();
                    this.uploader.addToQueue(item);
                } else {
                    this.toastr.error('Lo sentimos, no se pudo añadir este adjunto');
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
                    toastr.error(response.message, null, {
                        closeButton: true,
                        timeOut: 0,
                        extendedTimeOut: 0
                    });
                } else if (status === 500 && get(response, 'errorCode') === ADJUNTO_MUY_GRANDE) {
                    toastr.error('No se pudo añadir este archivo porque es demasiado grande.');
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

    _obtenerAdjuntos(idPeticion) {
        this.adjuntosService.obtenerTodos(idPeticion || this.peticion)
            .then(adjuntos => {
                this.adjuntos = map(adjuntos, adjunto => {
                    return this._procesarAdjunto(adjunto);
                });
                return adjuntos;
            });
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

    ejecutarAccion(entidad, accion) {
        let promesa;
        if (accion === 'descargar') {
            promesa = this.adjuntosService.descargar(entidad, this.peticion);
        } else if (accion === 'eliminar') {
            promesa = this.adjuntosService.accionEliminar(entidad, this.peticion);
        }

        promesa
            .catch(response => {
                if (response && response.status === 401) {
                    this.peticionesService.eliminarEntidad(this.peticion);
                    this.adjuntos = null;
                    this.$location.path(PATH_401);
                }
            })
            .finally(() => {
                this._obtenerAdjuntos();
            });
    };

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
}