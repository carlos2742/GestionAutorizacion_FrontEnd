import reduce from 'lodash/reduce';
import isNil from "lodash/isNil";

import { TITULO_CAMBIOS_GUARDADOS } from '../../common/constantes';
/* @ngInject */
/**
 * Esta clase representa un controlador de Angular correspondiente a la vista de detalles de un anticipo.
 */
export default class ModalAprobarAnticipoController {
    constructor($uibModalInstance, $q, toastr, entidad, paginaActual, PeticionesService) {
        this.$uibModalInstance = $uibModalInstance;
        this.$q = $q;
        this.toastr = toastr;

        this.titulo = 'Solicitud de Anticipo';
        this.entidad = entidad;
        this.paginaActual = paginaActual;
        this.peticionesService = PeticionesService;
    }

    cancelar() { this.$uibModalInstance.close(); }

    cambiarEstadoPeticion(accion) {
        let promesa;
        if (accion === 'aprobar') {
            promesa = this.peticionesService.aprobar([this.entidad], this.paginaActual);
        } else if (accion === 'rechazar') {
            promesa = this.peticionesService.rechazar([this.entidad], this.paginaActual);
        }

        return promesa
            .then(resultado => {
                let mensaje = '';
                if (accion === 'aprobar') {
                    mensaje = 'aprobada';
                } else if (accion === 'rechazar') {
                    mensaje = 'rechazada';
                }
                this.toastr.success(`Petición ${mensaje}`, TITULO_CAMBIOS_GUARDADOS);
                this.$uibModalInstance.close({datos: resultado.peticiones, error: []});
        })
            .catch(error => {
                if (!isNil(error.peticionesConError) && error.peticionesConError.length > 0) {
                    let listaError = reduce(error.peticionesConError, (resultado, peticion) => {
                        resultado += `<li>
                                        <strong>${peticion.id}:</strong> ${peticion.message}
                                      </li>`;
                        return resultado;
                    }, '');
                    const mensaje = `La petición no se pudo ${accion}:
                                     <ul>${listaError}</ul>`;
                    this.toastr.warning(mensaje, null, {
                        allowHtml: true,
                        closeButton: true,
                        tapToDismiss: false,
                        timeOut: 0,
                        extendedTimeOut: 0,
                        iconClass: 'toast-warning alerta-peticiones'
                    });
                }
                this.$uibModalInstance.close({datos: error.peticiones, error: error.peticionesConError });
            })

    }
}