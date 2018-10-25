import map from 'lodash/map';
import clone from 'lodash/clone';
import get from 'lodash/get';
import isNil from 'lodash/isNil';
import isSameDay from 'date-fns/isSameDay';

import './modal-mensajes.scss';
import {ELEMENTO_NO_ENCONTRADO, ERROR_GENERAL} from "../../common/constantes";


/* @ngInject */
/**
 * Esta clase representa un controlador de Angular correspondiente a la vista de la lista de mensajes de una petición.
 */
export default class ModalMensajesController {
    /**
     * @param $uibModalInstance
     * @param $scope
     * @param toastr
     * @param {MensajesService} MensajesService
     * @param {PeticionesService} PeticionesService
     * @param {Peticion} peticion
     * @param {function} fnEnvioMensaje
     * @param {function} fnResolucion
     */
    constructor($uibModalInstance, $scope, toastr, MensajesService, PeticionesService, peticion, fnEnvioMensaje, fnResolucion) {
        /** @private */
        this.$uibModalInstance = $uibModalInstance;
        /** @private */
        this.toastr = toastr;
        /** @private */
        this.mensajesService = MensajesService;
        /** @private */
        this.peticionesService = PeticionesService;
        /** @private */
        this.peticion = peticion;
        /** @private */
        this.fnEnvioMensaje = fnEnvioMensaje;
        /** @private */
        this.fnResolucion = fnResolucion;

        this.mensajes = [];
        this.mensajesService.obtenerTodos(this.peticion)
            .then(mensajes => {
                this.mensajes = mensajes;
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
                    this.mensajes = null;
                    this.$uibModalInstance.close();
                }
            });

        // Cuando se cierra el modal, por el motivo que sea, resuelve la promesa con la lista de mensajes.
        let deregister = $scope.$on('modal.closing', () => {
            fnResolucion(this.mensajes);
            deregister();
        });
    }

    enviar() {
        if (this.mensaje) {
            return this.fnEnvioMensaje(this.mensaje)
                .catch(response => {
                    let eliminarPeticion = false;
                    if (response.status === 401) {
                        this.toastr.warning('Lo sentimos, ya no tiene permiso para acceder a esta petición.');
                        eliminarPeticion = true;
                    } else if (get(response, 'error.errorCode') === ELEMENTO_NO_ENCONTRADO) {
                        this.toastr.warning('Lo sentimos, no se encontró la petición asociada a esta conversación');
                        eliminarPeticion = true;
                    }

                    if (eliminarPeticion) {
                        this.peticionesService.eliminarEntidad(this.peticion);
                        this.mensajes = null;
                        this.$uibModalInstance.close();
                    }
                })
                .finally(() => {
                    this.mensaje = "";
                });
        }
    }

    /**
     * Cierra el modal de mensajes.
     */
    cancelar() {
        this.$uibModalInstance.close();
    }

    mostrarSeparadorFecha(indiceMensaje) {
        return indiceMensaje === 0 || !isSameDay(this.mensajes[indiceMensaje].fechaEnvio.valor, this.mensajes[indiceMensaje - 1].fechaEnvio.valor);
    }
}