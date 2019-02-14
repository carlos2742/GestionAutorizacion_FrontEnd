import isNil from 'lodash/isNil';
import get from 'lodash/get';

import {elementoYaExiste} from '../../common/validadores';
import {TITULO_CAMBIOS_GUARDADOS} from '../../common/constantes';

/* @ngInject */
/**
 * Esta clase representa un controlador de Angular que se utiliza en la vista del modal de creación/edición de una aplicación.
 */
export default class ModalEdicionAplicacionesController {

    /**
     * @param $uibModalInstance
     * @param toastr
     * @param AplicacionesService
     * @param entidad
     * @param entidadesExistentes
     */
    constructor($uibModalInstance, toastr, AplicacionesService, entidad, entidadesExistentes) {

        /** @private */
        this.$uibModalInstance = $uibModalInstance;
        /** @private */
        this.toastr = toastr;
        /** @private */
        this.aplicacionesService = AplicacionesService;

        /** @type {Aplicacion} */
        this.entidad = entidad;
        /** @private */
        this.entidadesExistentes = entidadesExistentes;

        if (isNil(entidad)) {
            // Nueva entidad
            this.titulo = 'Nueva Aplicación';
            this.textoBoton = 'Crear';
        } else {
            // Entidad existente
            this.titulo = 'Actualizar Aplicación';
            this.textoBoton = 'Actualizar';
            this.modoEdicion = true;
            /** @private */
            this.nombreInicial = entidad.nombre;
        }
    }

    /**
     * Función que se usa para validar el input del nombre, que no debe existir ya en otras entidades del mismo tipo.
     *
     * @param modelValue
     * @param viewValue
     * @return {boolean}        - Devuelve true la entidad es válida (es decir, si el nombre no existe ya).
     */
    validarNombreDuplicado(modelValue) {
        let entidad = {
            codigo: get(this.$modal.entidad, 'codigo'),
            nombre: modelValue
        };
        return (!isNil(this.$modal.nombreInicial) && modelValue === this.$modal.nombreInicial) || !elementoYaExiste(entidad, 'nombre', this.$modal.entidadesExistentes);
    }

    /**
     * Crea o edita una entidad, usando los datos que el usuario insertó en el formulario.
     *
     * @param edicionAplicacionForm        - Formulario que contiene los datos de la entidad
     */
    editar(edicionAplicacionForm) {
        if (edicionAplicacionForm.$invalid) {
            return;
        }

        let promesa;
        if (!this.modoEdicion) {
            promesa = this.aplicacionesService.crear(this.entidad.nombre);
        } else {
            promesa = this.aplicacionesService.editar(this.entidad);
        }
        promesa
            .then(resultado => {
                this.$uibModalInstance.close(resultado);
                this.toastr.success(`Aplicación "${resultado.nombre}"`, TITULO_CAMBIOS_GUARDADOS);
            })
            .catch(() => {
                this.$uibModalInstance.close();
            });
    }

    /**
     * Cierra el modal de edición.
     */
    cancelar() {
        this.$uibModalInstance.close();
    }
}