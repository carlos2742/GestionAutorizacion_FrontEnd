import isNil from 'lodash/isNil';
import get from 'lodash/get';
import find from 'lodash/find';

import {
    ELEMENTO_NO_ENCONTRADO,
    TITULO_CAMBIOS_GUARDADOS
} from '../../common/constantes';


/* @ngInject */
/**
 * Esta clase representa un controlador de Angular usado en el modal de creación/edición de un proceso.
 */
export default class ModalEdicionProcesosController {
    /**
     * @param $uibModalInstance
     * @param toastr
     * @param {ProcesosService} ProcesosService
     * @param {AplicacionesService} AplicacionesService
     * @param {Proceso} proceso
     */
    constructor($uibModalInstance, toastr, ProcesosService, AplicacionesService, proceso) {
        /** @private */
        this.$uibModalInstance = $uibModalInstance;
        /** @private */
        this.toastr = toastr;
        /** @private */
        this.procesosService = ProcesosService;
        /** @type {Proceso} */
        this.proceso = proceso;

        if (isNil(this.proceso)) {
            /** @type {boolean} */
            this.modoEdicion = false;
            /** @type {string} */
            this.titulo = 'Nuevo Proceso';
            /** @type {string} */
            this.textoBoton = 'Crear';
        } else {
            this.modoEdicion = true;
            this.titulo = 'Actualizar Proceso';
            this.textoBoton = 'Actualizar';
        }

        AplicacionesService.obtenerTodos(true)
            .then(aplicaciones => {
                /** @type {Aplicacion[]} */
                this.aplicaciones = aplicaciones;

                if (this.modoEdicion) {
                    let aplicacionAsociada = find(this.aplicaciones, ['id', this.proceso.aplicacion.id]);
                    if (isNil(aplicacionAsociada)) {
                        this.aplicaciones.push(this.proceso.aplicacion);
                    }
                }
            });
    }

    /**
     * Crea o edita un proceso, usando los datos que el usuario insertó en el formulario.
     *
     * @param edicionProcesoForm        - Formulario que contiene los datos de la entidad
     */
    editar(edicionProcesoForm) {
        if (edicionProcesoForm.$invalid) { return; }

        let promesa;
        if (!this.modoEdicion) {
            promesa = this.procesosService.crear(this.proceso);
        } else {
            promesa = this.procesosService.editar(this.proceso);
        }
        promesa
            .then(resultado => {
                this.$uibModalInstance.close(resultado);
                this.toastr.success(`Proceso "${resultado.evento}"`, TITULO_CAMBIOS_GUARDADOS);
            })
            .catch(error => {
                if (get(error, 'error.errorCode') === ELEMENTO_NO_ENCONTRADO) {
                    this.toastr.warning('No se pudo encontrar la aplicación relacionada con el proceso, por lo que no se guardaron los cambios.');
                }
                this.$uibModalInstance.close();
            });
    }

    /**
     * Cierra el modal de edición de tarifa.
     */
    cancelar() {
        this.$uibModalInstance.close();
    }
}