import isNil from 'lodash/isNil';
import get from 'lodash/get';

import { TITULO_CAMBIOS_GUARDADOS, ERROR_GENERAL } from '../../common/constantes';
import { procesarFechaAEnviar } from '../../common/utiles';

/* @ngInject */
/**
 * Esta clase representa un controlador de Angular que se utiliza en la vista del modal de creación/edición de una notificacion.
 */
export default class ModalEdicionNotificacionController {
    constructor($uibModalInstance, toastr, AppConfig, entidad, paginaActual, NotificacionesService,
                esCrear, PeticionesService, peticiones) {
        this.$uibModalInstance = $uibModalInstance;
        this.toastr = toastr;
        this.entidad = entidad;
        this.paginaActual = paginaActual;
        this.esCrear = esCrear;
        this.notificacionesService = NotificacionesService;
        this.peticionesService = PeticionesService;

        this.botonActivoModal = `<div class="form-row mr-3">
                <toggle onstyle="btn-success" offstyle="btn-secondary"
                        on="Si" off="No" size="btn-sm" id="activo" name="activo"
                        ng-model="$modal.entidad.activo">
                </toggle>
            </div>
            <div>
                <label class="form-check-label mt-1" for="activo">Activo</label>
            </div>`;

        if(isNil(this.entidad) || this.esCrear) {
            this.modoEdicion = false;
            this.titulo = 'Adicionar notificación';
            this.textoBoton = 'Crear';
        } else {
            this.modoEdicion = true;
            this.titulo = 'Actualizar notificación';
            this.textoBoton = 'Actualizar';
        }

        this.popupFechaInicialAbierto = false;
        this.popupFechaFinalAbierto = false;
        this.mensajeErrorHoraInicio = false;
        this.mensajeErrorHoraFin = false;
    }

    toggleSelectorFecha(nombre) {
        this[`popupFecha${nombre}Abierto`] = !this[`popupFecha${nombre}Abierto`];
    }

    get mostrarMensajeErrorHoraInicio() {
        if(!isNil(get(this.entidad, 'fechaFin.valor')) && !isNil(get(this.entidad, 'fechaInicio.valor'))) {
            if(this.entidad.fechaInicio.valor >= this.entidad.fechaFin.valor) {
                this.mensajeErrorHoraInicio = true;
                return  true;
            }
        } else {
            this.mensajeErrorHoraInicio = false;
            return false;
        }
    }

    get mostrarMensajeErrorHoraFin() {
        if(!isNil(get(this.entidad, 'fechaFin.valor')) && !isNil(get(this.entidad, 'fechaInicio.valor'))) {
            if(this.entidad.fechaFin.valor <= this.entidad.fechaInicio.valor) {
                this.mensajeErrorHoraFin = true;
                return  true;
            }
        } else {
            this.mensajeErrorHoraFin = false;
            return false;
        }
    }

    editar(edicionNotificacionForm) {
        if (edicionNotificacionForm.$invalid) {
            return;
        } else if(this.entidad.fechaInicio.valor >= this.entidad.fechaFin.valor) {
            return;
        } else if(this.entidad.fechaFin.valor <= this.entidad.fechaInicio.valor) {
            return;
        }

        if (!this.modoEdicion || this.esCrear) {
            //Crear notificacion
            const datosNotificacionCrear = {
                mensaje: this.entidad.mensaje,
                activo: get(this.entidad, 'activo') ? get(this.entidad, 'activo') : false,
                fechaInicio: procesarFechaAEnviar(this.entidad.fechaInicio.valor),
                fechaFin: procesarFechaAEnviar(this.entidad.fechaFin.valor),
                idPeticion: get(this.entidad, 'idPeticion') ? this.entidad.idPeticion : undefined
            };
            this.notificacionesService.crear(datosNotificacionCrear)
                .then((respuesta) => {
                    this.toastr.success(`Notificación "${this.entidad.mensaje}"`, TITULO_CAMBIOS_GUARDADOS);
                    this.$uibModalInstance.close(null);
                })
                .catch(respuesta => {
                    // Se verifica si cayó el servidor, en cuyo caso se muestra este mensaje
                    if(respuesta.status === ERROR_GENERAL) {
                        this.toastr.warning(`${respuesta.error.message}`);
                        this.$uibModalInstance.close(null);
                    } else if(get(respuesta, 'error.errorCode')) {
                        this.toastr.warning(`${respuesta.error.message}`);
                    }
                });
        } else {
            //Editar notificacion
            this.notificacionesService.editar(this.entidad, this.paginaActual)
                .then(resultado => {
                    this.$uibModalInstance.close(resultado);
                    this.toastr.success(`Notificación "${resultado['notificacion'].mensaje}"`, TITULO_CAMBIOS_GUARDADOS);
                })
                .catch(response => {
                    if (isNil(response)) {
                        this.$uibModalInstance.close();
                        return;
                    } else if (get(response, 'error.errorCode')) {
                        this.toastr.error(response.error.message);
                    }
                    this.$uibModalInstance.close(null);
                });
        }
    }

    cancelar() { this.$uibModalInstance.close(); }
}