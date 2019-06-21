import isNil from 'lodash/isNil';
import get from 'lodash/get';
import find from 'lodash/find';

import {
    ELEMENTO_NO_ENCONTRADO, ELEMENTO_YA_EXISTE, FUNCION_ROL_NO_IMPLEMENTADA,
    TITULO_CAMBIOS_GUARDADOS
} from "../../common/constantes";
import {elementoYaExiste} from '../../common/validadores';


/* @ngInject */
/**
 * Esta clase representa un controlador de Angular usado en el modal de creación/edición de un rol.
 */
export default class ModalEdicionRolesController {
    /**
     * @param $uibModalInstance
     * @param toastr
     * @param {RolesService} RolesService
     * @param {Rol} entidad
     * @param {Rol[]} entidadesExistentes
     */
    constructor($uibModalInstance, toastr, RolesService, entidad, entidadesExistentes) {
        /** @private */
        this.$uibModalInstance = $uibModalInstance;
        /** @private */
        this.toastr = toastr;
        /** @private */
        this.rolesService = RolesService;
        /** @type {Rol} */
        this.rol = entidad;
        /** @private */
        this.entidadesExistentes = entidadesExistentes;

        if (isNil(this.rol)) {
            /** @type {boolean} */
            this.modoEdicion = false;
            /** @type {string} */
            this.titulo = 'Nuevo Rol';
            /** @type {string} */
            this.textoBoton = 'Crear';

            this.rol = {
                dependePeticion: false
            }
        } else {
            this.modoEdicion = true;
            this.titulo = 'Actualizar Rol';
            this.textoBoton = 'Actualizar';

            /** @private */
            this.nombreInicial = this.rol.nombre;
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
     * Crea o edita un rol, usando los datos que el usuario insertó en el formulario.
     *
     * @param edicionRolForm        - Formulario que contiene los datos de la entidad
     */
    editar(edicionRolForm) {
        if (edicionRolForm.$invalid) { return }

        let promesa;
        if (!this.modoEdicion) {
            promesa = this.rolesService.crear(this.rol);
        } else {
            promesa = this.rolesService.editar(this.rol);
        }
        promesa
            .then(resultado => {
                this.$uibModalInstance.close(resultado);
                this.toastr.success(`Rol "${resultado.nombre}"`, TITULO_CAMBIOS_GUARDADOS);
            })
            .catch(error => {
                if (get(error, 'error.errorCode') === FUNCION_ROL_NO_IMPLEMENTADA) {
                    this.toastr.error('Lo sentimos, no se pudo encontrar este procedimiento SQL en la Base de Datos.');
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