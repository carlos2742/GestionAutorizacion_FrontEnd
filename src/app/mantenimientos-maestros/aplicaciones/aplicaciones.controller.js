import angular from 'angular';
import clone from 'lodash/clone';
import cloneDeep from 'lodash/cloneDeep';
import map from 'lodash/map';
import sortBy from 'lodash/sortBy';

import './aplicaciones.scss';
import template from './modal-edicion-aplicaciones.html';

/* @ngInject */
/**
 * Esta clase es un controlador de Angular para la vista de lista de aplicaciones.
 */
export default class AplicacionesController {

    /**
     * @param $uibModal
     * @param toastr
     * @param {AplicacionesService} AplicacionesService
     *
     **/
    constructor($uibModal, toastr, AplicacionesService) {
        /** @private */
        this.$uibModal = $uibModal;
        /** @private */
        this.toastr = toastr;
        /** @private */
        this.aplicacionesService = AplicacionesService;

        this.aplicacionesService.obtenerTodos(false)
            .then(aplicaciones => {
                let appsOrdenadosPorCodigo = sortBy(aplicaciones, ['codigo']);
                /** @type {Aplicacion[]} */
                this.datos = map(appsOrdenadosPorCodigo, entidad => { return this._procesarEntidadVisualizacion(entidad); });
            });
        this.presentacion = {
            entidad: 'Aplicación',
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
        };
    }

    /**
     * Añade una propiedad a cada aplicación que permite cambiar su estado.
     *
     * @param {Aplicacion} entidad
     * @return {Aplicacion}             -  La misma aplicación, con un componente añadido para cambiar su estado en la tabla.
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
     * Abre el modal que se utiliza para crear/editar una aplicación. Cuando se termina de trabajar con la aplicación,
     * actualiza o crea una fila correspondiente en la tabla.
     *
     * @param {Aplicacion} [aplicacion]   Si no se pasa una aplicación, el modal se abre en modo de creación.
     */
    mostrarModalAplicacion(aplicacion) {
        const contenedor = angular.element(document.getElementById('modalEdicionAplicacion'));
        const modal = this.$uibModal.open({
            template,
            appendTo: contenedor,
            size: 'dialog-centered',    // hack para que el modal salga centrado verticalmente
            controller: 'ModalEdicionAplicacionesController',
            controllerAs: '$modal',
            resolve: {
                // Los elementos que se inyectan al controlador del modal se deben pasar de esta forma:
                entidad: () => { return aplicacion; },
                entidadesExistentes: () => { return this.datos; }
            }
        });

        modal.result.then(() => {
            this.datos = map(this.aplicacionesService.aplicaciones, entidad => { return this._procesarEntidadVisualizacion(entidad); });
        });
        modal.result.catch(() => { });
    }

    /**
     * Edita los datos de una aplicación.
     * @param {Aplicacion} aplicacion
     */
    editarAplicacion(aplicacion) {
        let clon = cloneDeep(aplicacion);
        this.mostrarModalAplicacion(clon);
    }

    /**
     * Cambia el estado de una aplicación de activo a inactivo y viceversa.
     *
     * @param {Aplicacion} entidad
     */
    cambiarEstado(entidad) {
        let promesa;
        if (!entidad.estado.activo) {
            promesa = this.aplicacionesService.eliminar(entidad);
        } else {
            promesa = this.aplicacionesService.editar(entidad);
        }

        promesa.then(resultado => {
            entidad.estado = clone(resultado.estado);
        }).catch(response => {
            if (response && response.status === 404) {
                this.datos = map(this.aplicacionesService.aplicaciones, entidad => { return this._procesarEntidadVisualizacion(entidad); });
            } else {
                entidad.estado.activo =  !entidad.estado.activo;
            }
        });
    }
}