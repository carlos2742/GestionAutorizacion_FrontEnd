import angular from 'angular';
import clone from 'lodash/clone';
import cloneDeep from 'lodash/cloneDeep';
import map from 'lodash/map';
import sortBy from 'lodash/sortBy';
import isNil from 'lodash/isNil';
import get from 'lodash/get';

import './roles.scss';
import template from './modal-edicion-roles.html';
import {FUNCION_ROL_NO_IMPLEMENTADA} from "../../common/constantes";

/* @ngInject */
/**
 * Esta clase es un controlador de Angular para la vista de lista de roles.
 */
export default class RolesController {

    /**
     * @param $uibModal
     * @param toastr
     * @param {RolesService} RolesService
     *
     **/
    constructor($uibModal, toastr, RolesService) {
        /** @private */
        this.$uibModal = $uibModal;
        /** @private */
        this.toastr = toastr;
        /** @private */
        this.rolesService = RolesService;

        this.rolesService.obtenerTodos(false)
            .then(roles => {
                let rolesOrdenadosPorCodigo = sortBy(roles, ['codigo']);
                /** @type {Rol[]} */
                this.datos = map(rolesOrdenadosPorCodigo, entidad => { return this._procesarEntidadVisualizacion(entidad) });
            });
        this.presentacion = {
            entidad: 'Rol',
            atributoPrincipal: 'nombre',
            ordenInicial: ['codigo', 'asc'],
            columnas: [
                {nombre: 'codigo', display: 'ID', ordenable: true},
                {nombre: 'nombre', display: 'Nombre', ordenable: true},
                {nombre: 'nombreProcedimiento', display: 'Procedimiento', ordenable: true},
                {nombre: 'observacionesInput', display: 'Observaciones', ancho: '250px', html: true},
                {nombre: 'estadoToggle', display: 'Activo', ordenable: false, html: true, ancho:'100px'}
            ]
        };

        this.columnasExcel = {
            titulos: ['ID', 'Nombre', 'Procedimiento', 'Observaciones', 'Activo'],
            campos: ['codigo', 'nombre', 'nombreProcedimiento', 'observaciones', 'estado.activo']
        }
    }

    /**
     * Añade una propiedad a cada rol que permite cambiar su estado.
     *
     * @param {Rol} entidad
     * @return {Rol}             -  El mismo rol, con un componente añadido para cambiar su estado en la tabla.
     * @private
     */
    _procesarEntidadVisualizacion(entidad) {
        let clon = clone(entidad);
        clon.estado = clone(entidad.estado);
        clon.estadoToggle = `<toggle ng-model="elemento.estado.activo" 
                                            ng-change="$ctrl.fnAccion({entidad: elemento})" on="Si" off="No" 
                                            onstyle="btn-success" offstyle="btn-secondary"></toggle>`;
        clon.observacionesInput = `<textarea rows="3" 
                                            disabled
                                            style="width: 100%;">${!isNil(entidad.observaciones) ? entidad.observaciones : ''}</textarea>`;

        return clon;
    }

    /**
     * Cambia el estado de un rol de activo a inactivo y viceversa.
     *
     * @param {Rol} entidad
     */
    cambiarEstado(entidad) {
        let promesa;
        if (!entidad.estado.activo) {
            promesa = this.rolesService.eliminar(entidad);
        } else {
            promesa = this.rolesService.editar(entidad);
        }

        promesa.then(resultado => {
            entidad.estado = clone(resultado.estado);
        }).catch(response => {
            if (response && response.status === 404) {
                this.datos = map(this.rolesService.roles, entidad => { return this._procesarEntidadVisualizacion(entidad) });
            } else {
                if (get(response, 'error.errorCode') === FUNCION_ROL_NO_IMPLEMENTADA) {
                    this.toastr.warning('Lo sentimos, este rol no se puede activar.');
                }
                entidad.estado.activo =  !entidad.estado.activo;
            }
        });
    }

    /**
     * Abre el modal que se utiliza para crear/editar un rol. Cuando se termina de trabajar con el rol,
     * actualiza o crea una fila correspondiente en la tabla.
     *
     * @param {Rol} [rol]   Si no se pasa un rol, el modal se abre en modo de creación.
     */
    mostrarModalRol(rol) {
        const contenedor = angular.element(document.getElementById("modalEdicionRol"));
        const modal = this.$uibModal.open({
            template,
            appendTo: contenedor,
            size: 'dialog-centered',    // hack para que el modal salga centrado verticalmente
            controller: 'ModalEdicionRolesController',
            controllerAs: '$modal',
            resolve: {
                // Los elementos que se inyectan al controlador del modal se deben pasar de esta forma:
                entidad: () => { return rol },
                entidadesExistentes: () => { return this.datos }
            }
        });

        modal.result.then((resultado) => {
            this.datos = map(this.rolesService.roles, entidad => { return this._procesarEntidadVisualizacion(entidad) });
        });
        modal.result.catch(() => { });
    }

    /**
     * Edita los datos de un rol.
     * @param {Rol} rol
     */
    editarRol(rol) {
        let clon = cloneDeep(rol);
        this.mostrarModalRol(clon);
    }
}