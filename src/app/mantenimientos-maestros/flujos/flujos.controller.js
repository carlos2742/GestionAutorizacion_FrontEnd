import sortBy from 'lodash/sortBy';
import orderBy from 'lodash/orderBy';
import map from 'lodash/map';
import clone from 'lodash/clone';
import cloneDeep from 'lodash/cloneDeep';
import find from 'lodash/find';
import reduce from 'lodash/reduce';
import isMatchWith from 'lodash/isMatchWith';
import includes from 'lodash/includes';
import isNil from 'lodash/isNil';
import get from 'lodash/get';

import './flujos.scss';
import template from './modal-edicion-flujos.html';
import {ENTIDAD_NO_ELIMINABLE} from "../../common/constantes";


/* @ngInject */
/**
 * Esta clase es un controlador de Angular para la vista de lista de flujos.
 */
export default class FlujosController {

    /**
     * @param $uibModal
     * @param toastr
     * @param {FlujosService} FlujosService
     * @param {ModulosService} ModulosService
     * @param AppConfig
     *
     **/
    constructor($uibModal, toastr, FlujosService, ModulosService, AppConfig) {
        /** @type {number} */
        this.ITEMS_POR_PAGINA = AppConfig.elementosPorPagina;
        /** @private */
        this.$uibModal = $uibModal;
        /** @private */
        this.toastr = toastr;
        /** @private */
        this.flujosService = FlujosService;

        /** @type {boolean} */
        this.busquedaVisible = true;
        /** @type {Flujo[]} */
        this.resultadoBusqueda = [];
        this.paramsBusqueda = {};
        /** @type {Flujo[]} */
        this.flujos = [];
        /** @type {number} */
        this.paginaActual = 1;
        this.flujosService.obtenerTodos(false)
            .then(flujos => {
                let flujosOrdenadosPorCodigo = sortBy(flujos, ['codigo']);
                this.flujos = map(flujosOrdenadosPorCodigo, entidad => { return this._procesarEntidadVisualizacion(entidad) });
                this.actualizarPagina();
            });
        ModulosService.obtenerTodos(false)
            .then(modulos => {
                /** @type {Modulo[]} */
                this.modulos = modulos;
            });

        this.ordenActivo = ['codigo', 'asc'];
        this.presentacion = {
            entidad: 'Flujo',
            atributoPrincipal: 'evento',
            ordenInicial: ['codigo', 'asc'],
            columnas: [
                {nombre: 'codigo', display: 'ID', ordenable: true},
                {nombre: 'evento', display: 'Evento', ordenable: true},
                {nombre: 'modulo.display', display: 'Módulo', ordenable: true},
                {nombre: 'totalAutorizacionesConFormato', display: 'Total Autorizaciones', html: true, ordenable:'cantidadAutorizaciones'},
                {nombre: 'observacionesInput', display: 'Observaciones', ancho: '250px', html: true},
                {nombre: 'estadoToggle', display: 'Activo', ordenable: false, html: true, ancho:'100px'},
                {nombre: 'enlaceAutorizaciones', display: '', ordenable: false, html: true, ancho: '40px'}
            ]
        };

        this.columnasExcel = {
            titulos: ['ID', 'Evento', 'Módulo', 'Total Autorizaciones', 'Observaciones', 'Activo'],
            campos: ['codigo', 'evento', 'modulo.display', 'cantidadAutorizaciones', 'observaciones', 'estado.activo']
        }
    }

    /**
     * Añade una propiedad a cada flujo que permite cambiar su estado y otra para mostrar las observaciones.
     *
     * @param {Flujo} entidad
     * @return {Flujo}  El mismo flujo, con las propiedades mencionadas
     * @private
     */
    _procesarEntidadVisualizacion(entidad) {
        let clon = clone(entidad);

        if (entidad.cantidadAutorizaciones > 0) {
            clon.totalAutorizacionesConFormato = entidad.cantidadAutorizaciones;
        } else {
            clon.totalAutorizacionesConFormato = `<span class="text-danger">${entidad.cantidadAutorizaciones || 0}</span>`;
        }

        clon.estado = clone(entidad.estado);
        clon.estadoToggle = `<toggle ng-model="elemento.estado.activo" 
                                            ng-change="$ctrl.fnAccion({entidad: elemento})" on="Si" off="No" 
                                            onstyle="btn-success" offstyle="btn-secondary"></toggle>`;
        clon.observacionesInput = `<textarea rows="3" 
                                            disabled
                                            style="width: 100%;">${!isNil(entidad.observaciones) ? entidad.observaciones : ''}</textarea>`;

        clon.enlaceAutorizaciones = `<a href class="icon-user-check d-print-none" ng-href="#/autorizaciones?flujo=${entidad.id}" uib-tooltip="Ver Autorizaciones"></a>`;

        return clon;
    }

    /**
     * Abre el modal que se utiliza para crear/editar un flujo. Cuando se termina de trabajar con el flujo,
     * actualiza o crea una fila correspondiente en la tabla.
     *
     * @param {Flujo} [flujo]   Si no se pasa un flujo, el modal se abre en modo de creación.
     */
    mostrarModalFlujo(flujo) {
        const contenedor = angular.element(document.getElementById("modalEdicionFlujo"));

        const modal = this.$uibModal.open({
            template,
            appendTo: contenedor,
            size: 'dialog-centered',    // hack para que el modal salga centrado verticalmente
            controller: 'ModalEdicionFlujosController',
            controllerAs: '$modal',
            resolve: {
                flujo: () => { return flujo }
            }
        });

        const actualizarFn = (resultado) => {
            this.flujos = map(this.flujosService.flujos, entidad => { return this._procesarEntidadVisualizacion(entidad) });
            this.actualizarOrden(this.ordenActivo, false);
            if (this.busquedaActiva) {
                this.buscar(false);
            }

            if (!isNil(resultado) && !this.filaEsVisible(resultado)) {
                this.toastr.warning(`Aunque se guardaron los cambios del flujo "${resultado.evento}", no están visibles en la tabla en este momento.`, null, {
                    allowHtml: true,
                    closeButton: true,
                    timeOut: 0,
                    extendedTimeOut: 0
                });
            }
        };

        modal.result.then((resultado) => {
            actualizarFn(resultado);
        });
        modal.result.catch(() => {
            actualizarFn(null);
        });
    }

    /**
     * Edita los datos de un flujo.
     * @param {Flujo} flujo
     */
    editarFlujo(flujo) {
        const clon = cloneDeep(flujo);
        clon.modulo = clon.modulo.valor;
        this.mostrarModalFlujo(clon);
    }

    /**
     * Elimina un flujo
     * @param {Flujo} flujo
     */
    eliminarFlujo(flujo) {
        const fnActualizarFlujos = () => {
            this.flujos = map(this.flujosService.flujos, entidad => { return this._procesarEntidadVisualizacion(entidad) });
            this.actualizarOrden(this.ordenActivo, false);
            if (this.busquedaActiva) {
                this.buscar(false);
            }
        };

        return this.flujosService.eliminar(flujo)
            .then(() => {
                fnActualizarFlujos();
            })
            .catch(response => {
                if (response && response.status === 404) {
                    fnActualizarFlujos();
                } else if (get(response, 'error.errorCode') === ENTIDAD_NO_ELIMINABLE) {
                    this.toastr.warning(`El flujo "${flujo.evento}" no se puede eliminar porque existe información que depende de él.`, null, {
                        allowHtml: true,
                        closeButton: true,
                        timeOut: 0,
                        extendedTimeOut: 0
                    });
                }
                throw response;
            });
    }

    /**
     * Cambia el estado de un flujo de activo a inactivo y viceversa.
     *
     * @param {Flujo} entidad
     */
    cambiarEstado(entidad) {
        this.flujosService.editar(entidad)
            .then(resultado => {
                entidad.estado = clone(resultado.estado);
            })
            .catch(response => {
                if (response.status === 404) {
                    this.flujos = map(this.flujosService.flujos, entidad => { return this._procesarEntidadVisualizacion(entidad) });
                    this.actualizarOrden(this.ordenActivo, false);
                    if (this.busquedaActiva) {
                        this.buscar(false);
                    }
                } else {
                    entidad.estado.activo = !entidad.estado.activo;
                }
            });
    }

    /**
     * Devuelve verdadero si el flujo está visible en la tabla en ese momento.
     * @param {Flujo} flujo
     * @return {boolean}
     */
    filaEsVisible(flujo) {
        if (isNil(flujo)) {
            return false;
        }
        return !!find(this.datos, (item) => {
            return item.codigo === flujo.codigo;
        });
    }

    buscar(cambiarPagina) {
        if (Object.getOwnPropertyNames(this.paramsBusqueda).length === 0) {
            this.mostrarTodos();
        } else {
            this.busquedaActiva = true;
            this.resultadoBusqueda = reduce(this.flujos, (resultado, item) => {
                let coincidencia = isMatchWith(item, this.paramsBusqueda, (objValue, srcValue, key) => {
                    if (key === 'modulo') {
                        return isNil(srcValue) || objValue.valor.id === srcValue.id;
                    } else {
                        return objValue && includes(objValue.toLowerCase(), srcValue.toLowerCase());
                    }
                });
                if (coincidencia) {
                    resultado.push(item);
                }
                return resultado;
            }, []);

            if (isNil(cambiarPagina) || cambiarPagina) {
                this.paginaActual = 1;
            }

            this.actualizarPagina();
        }
    }

    mostrarTodos(cambiarPagina) {
        if (Object.getOwnPropertyNames(this.paramsBusqueda).length > 0) {
            this.paramsBusqueda = {};
            this.busquedaActiva = false;
            this.resultadoBusqueda = [];

            if (isNil(cambiarPagina) || cambiarPagina) {
                this.paginaActual = 1;
            }

            this.actualizarPagina();
        }
    }

    get datosAExportar() {
        return this.busquedaActiva ? this.resultadoBusqueda : this.flujos;
    }

    get totalFlujos() {
        return this.busquedaActiva ? this.resultadoBusqueda.length : this.flujos.length;
    }

    actualizarPagina() {
        const fin = this.paginaActual * this.ITEMS_POR_PAGINA;
        const inicio = fin - this.ITEMS_POR_PAGINA;

        if (this.busquedaActiva) {
            if (inicio >= this.resultadoBusqueda.length) {
                if (this.paginaActual > 1) {
                    this.paginaActual--;
                    this.actualizarPagina();
                } else {
                    this.datos = [];
                }
            } else {
                this.datos = this.resultadoBusqueda.slice(inicio, fin);
            }
        } else {
            if (inicio >= this.flujos.length) {
                if (this.paginaActual > 1) {
                    this.paginaActual--;
                    this.actualizarPagina();
                } else {
                    this.datos = [];
                }
            } else {
                this.datos = this.flujos.slice(inicio, fin);
            }
        }
    }

    actualizarOrden(orden, cambiarPagina) {
        if (isNil(cambiarPagina) || cambiarPagina) {
            this.paginaActual = 1;
        }
        this.ordenActivo = orden;

        this.flujos = orderBy(this.flujos,
            [entidad => {
                const valor = get(entidad, orden[0]);
                return typeof valor === 'string' ? valor.toLowerCase() : valor }],
            [ orden[1] ]);

        if (this.busquedaActiva) {
            this.resultadoBusqueda = orderBy(this.resultadoBusqueda,
                [entidad => {
                    const valor = get(entidad, orden[0]);
                    return typeof valor === 'string' ? valor.toLowerCase() : valor }],
                [ orden[1] ]);
        }

        this.actualizarPagina();
    }
}