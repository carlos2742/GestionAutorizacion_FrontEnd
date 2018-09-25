import angular from 'angular';
import clone from 'lodash/clone';
import cloneDeep from 'lodash/cloneDeep';
import map from 'lodash/map';
import sortBy from 'lodash/sortBy';

import './modulos.scss';
import template from './modal-edicion-modulos.html';

/* @ngInject */
/**
 * Esta clase es un controlador de Angular para la vista de lista de módulos.
 */
export default class ModulosController {

    /**
     * @param $uibModal
     * @param toastr
     * @param {ModulosService} ModulosService
     *
     **/
    constructor($uibModal, toastr, ModulosService) {
        /** @private */
        this.$uibModal = $uibModal;
        /** @private */
        this.toastr = toastr;
        /** @private */
        this.modulosService = ModulosService;

        this.modulosService.obtenerTodos(false)
            .then(modulos => {
                let modulosOrdenadosPorCodigo = sortBy(modulos, ['codigo']);
                /** @type {Modulo[]} */
                this.datos = map(modulosOrdenadosPorCodigo, entidad => { return this._procesarEntidadVisualizacion(entidad) });
            });
        this.presentacion = {
            entidad: 'Módulo',
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
     * Añade una propiedad a cada módulo que permite cambiar su estado.
     *
     * @param {Modulo} entidad
     * @return {Modulo}             -  El mismo módulo, con un componente añadido para cambiar su estado en la tabla.
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
     * Abre el modal que se utiliza para crear/editar un módulo. Cuando se termina de trabajar con el módulo,
     * actualiza o crea una fila correspondiente en la tabla.
     *
     * @param {Modulo} [modulo]   Si no se pasa un módulo, el modal se abre en modo de creación.
     */
    mostrarModalModulo(modulo) {
        const contenedor = angular.element(document.getElementById("modalEdicionModulo"));
        const modal = this.$uibModal.open({
            template,
            appendTo: contenedor,
            size: 'dialog-centered',    // hack para que el modal salga centrado verticalmente
            controller: 'ModalEdicionModulosController',
            controllerAs: '$modal',
            resolve: {
                // Los elementos que se inyectan al controlador del modal se deben pasar de esta forma:
                entidad: () => { return modulo },
                entidadesExistentes: () => { return this.datos }
            }
        });

        modal.result.then((resultado) => {
            this.datos = map(this.modulosService.modulos, entidad => { return this._procesarEntidadVisualizacion(entidad) });
        });
        modal.result.catch(() => { });
    }

    /**
     * Edita los datos de un módulo.
     * @param {Modulo} modulo
     */
    editarModulo(modulo) {
        let clon = cloneDeep(modulo);
        this.mostrarModalModulo(clon);
    }

    /**
     * Cambia el estado de un módulo de activo a inactivo y viceversa.
     *
     * @param {Modulo} entidad
     */
    cambiarEstado(entidad) {
        let promesa;
        if (!entidad.estado.activo) {
            promesa = this.modulosService.eliminar(entidad);
        } else {
            promesa = this.modulosService.editar(entidad);
        }

        promesa.then(resultado => {
            entidad.estado = clone(resultado.estado);
        }).catch(response => {
            if (response && response.status === 404) {
                this.datos = map(this.modulosService.modulos, entidad => { return this._procesarEntidadVisualizacion(entidad) });
            } else {
                entidad.estado.activo =  !entidad.estado.activo;
            }
        });
    }
}