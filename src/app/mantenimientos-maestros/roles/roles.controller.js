import angular from 'angular';
import clone from 'lodash/clone';
import map from 'lodash/map';
import sortBy from 'lodash/sortBy';
import get from 'lodash/get';

import './roles.scss';
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
                {nombre: 'estadoToggle', display: 'Activo', ordenable: false, html: true, ancho:'100px'}
            ]
        };

        this.columnasExcel = {
            titulos: ['ID', 'Nombre', 'Activo'],
            campos: ['codigo', 'nombre', 'estado.activo']
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
}