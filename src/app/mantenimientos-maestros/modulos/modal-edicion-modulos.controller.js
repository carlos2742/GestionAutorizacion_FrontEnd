import isNil from 'lodash/isNil';
import get from 'lodash/get';

import {elementoYaExiste} from '../../common/validadores';
import {TITULO_CAMBIOS_GUARDADOS} from "../../common/constantes";

/* @ngInject */
/**
 * Esta clase representa un controlador de Angular que se utiliza en la vista del modal de creación/edición de un módulo.
 */
export default class ModalEdicionModulosController {

    /**
     * @param $uibModalInstance
     * @param toastr
     * @param ModulosService
     * @param entidad
     * @param entidadesExistentes
     */
    constructor($uibModalInstance, toastr, ModulosService, entidad, entidadesExistentes) {

        /** @private */
        this.$uibModalInstance = $uibModalInstance;
        /** @private */
        this.toastr = toastr;
        /** @private */
        this.modulosService = ModulosService;

        /** @type {Modulo} */
        this.entidad = entidad;
        /** @private */
        this.entidadesExistentes = entidadesExistentes;

        if (isNil(entidad)) {
            // Nueva entidad
            this.titulo = 'Nuevo Módulo';
            this.textoBoton = 'Crear';
        } else {
            // Entidad existente
            this.titulo = 'Actualizar Módulo';
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
    validarNombreDuplicado(modelValue, viewValue) {
        let entidad = {
            codigo: get(this.$modal.entidad, 'codigo'),
            nombre: modelValue
        };
        return (!isNil(this.$modal.nombreInicial) && modelValue === this.$modal.nombreInicial) || !elementoYaExiste(entidad, 'nombre', this.$modal.entidadesExistentes);
    }

    /**
     * Crea o edita una entidad, usando los datos que el usuario insertó en el formulario.
     *
     * @param edicionModuloForm        - Formulario que contiene los datos de la entidad
     */
    editar(edicionModuloForm) {
        if (edicionModuloForm.$invalid) {
            return;
        }

        let promesa;
        if (!this.modoEdicion) {
            promesa = this.modulosService.crear(this.entidad.nombre);
        } else {
            promesa = this.modulosService.editar(this.entidad);
        }
        promesa
            .then(resultado => {
                this.$uibModalInstance.close(resultado);
                this.toastr.success(`Módulo "${resultado.nombre}"`, TITULO_CAMBIOS_GUARDADOS);
            })
            .catch(error => {
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