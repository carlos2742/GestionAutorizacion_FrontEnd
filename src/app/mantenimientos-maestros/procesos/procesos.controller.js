import angular from 'angular';
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

import './procesos.scss';
import template from './modal-edicion-procesos.html';
import {ENTIDAD_NO_ELIMINABLE} from '../../common/constantes';


/* @ngInject */
/**
 * Esta clase es un controlador de Angular para la vista de lista de procesos.
 */
export default class ProcesosController {

    /**
     * @param $uibModal
     * @param toastr
     * @param {ProcesosService} ProcesosService
     * @param {AplicacionesService} AplicacionesService
     * @param AppConfig
     *
     **/
    constructor($uibModal, toastr, ProcesosService, AplicacionesService, AppConfig) {
        /** @type {number} */
        this.ITEMS_POR_PAGINA = AppConfig.elementosPorPagina;
        /** @private */
        this.$uibModal = $uibModal;
        /** @private */
        this.toastr = toastr;
        /** @private */
        this.procesosService = ProcesosService;

        /** @type {boolean} */
        this.busquedaVisible = true;
        /** @type {Proceso[]} */
        this.resultadoBusqueda = [];
        this.paramsBusqueda = {};
        /** @type {Proceso[]} */
        this.procesos = [];
        /** @type {number} */
        this.paginaActual = 1;
        this.procesosService.obtenerTodos(false)
            .then(procesos => {
                let procesosOrdenadosPorCodigo = sortBy(procesos, ['codigo']);
                this.procesos = map(procesosOrdenadosPorCodigo, entidad => { return this._procesarEntidadVisualizacion(entidad); });
                this.actualizarPagina();
            });
        AplicacionesService.obtenerTodos(false)
            .then(aplicaciones => {
                /** @type {Aplicacion[]} */
                this.aplicaciones = aplicaciones;
            });

        this.ordenActivo = ['codigo', 'asc'];
        this.presentacion = {
            entidad: 'Proceso',
            atributoPrincipal: 'evento',
            ordenInicial: ['codigo', 'asc'],
            columnas: [
                {nombre: 'codigo', display: 'ID', ordenable: true},
                {nombre: 'evento', display: 'Evento', ordenable: true},
                {nombre: 'aplicacion.display', display: 'Aplicación', ordenable: true},
                {nombre: 'totalActividadesConFormato', display: 'Total Actividades', html: true, ordenable:'cantidadActividades'},
                {nombre: 'observacionesInput', display: 'Observaciones', ancho: '250px', html: true},
                {nombre: 'estadoToggle', display: 'Activo', ordenable: false, html: true, ancho:'100px'},
                {nombre: 'enlaceActividades', display: '', ordenable: false, html: true, ancho: '40px'}
            ]
        };

        this.columnasExcel = {
            titulos: ['ID', 'Evento', 'Aplicación', 'Total Actividades', 'Observaciones', 'Activo'],
            campos: ['codigo', 'evento', 'aplicacion.display', 'cantidadActividades', 'observaciones', 'estado.activo']
        };
    }

    /**
     * Añade una propiedad a cada proceso que permite cambiar su estado y otra para mostrar las observaciones.
     *
     * @param {Proceso} entidad
     * @return {Proceso}  El mismo proceso, con las propiedades mencionadas
     * @private
     */
    _procesarEntidadVisualizacion(entidad) {
        let clon = clone(entidad);

        if (entidad.cantidadActividades > 0) {
            clon.totalActividadesConFormato = entidad.cantidadActividades;
        } else {
            clon.totalActividadesConFormato = `<span class="text-danger">${entidad.cantidadActividades || 0}</span>`;
        }

        clon.estado = clone(entidad.estado);
        clon.estadoToggle = `<toggle ng-model="elemento.estado.activo" 
                                            ng-change="$ctrl.fnAccion({entidad: elemento})" on="Si" off="No" 
                                            onstyle="btn-success" offstyle="btn-secondary"></toggle>`;
        clon.observacionesInput = `<textarea rows="3" 
                                            disabled
                                            style="width: 100%;">${!isNil(entidad.observaciones) ? entidad.observaciones : ''}</textarea>`;

        clon.enlaceActividades = `<a href class="icon-user-check d-print-none" ng-href="#/actividades?proceso=${entidad.id}" uib-tooltip="Ver Actividades"></a>`;

        return clon;
    }

    /**
     * Abre el modal que se utiliza para crear/editar un proceso. Cuando se termina de trabajar con el proceso,
     * actualiza o crea una fila correspondiente en la tabla.
     *
     * @param {Proceso} [proceso]   Si no se pasa un proceso, el modal se abre en modo de creación.
     */
    mostrarModalProceso(proceso) {
        const contenedor = angular.element(document.getElementById('modalEdicionProceso'));

        const modal = this.$uibModal.open({
            template,
            appendTo: contenedor,
            size: 'dialog-centered',    // hack para que el modal salga centrado verticalmente
            controller: 'ModalEdicionProcesosController',
            controllerAs: '$modal',
            resolve: {
                proceso: () => { return proceso; }
            }
        });

        const actualizarFn = (resultado) => {
            this.procesos = map(this.procesosService.procesos, entidad => { return this._procesarEntidadVisualizacion(entidad); });
            this.actualizarOrden(this.ordenActivo, false);
            if (this.busquedaActiva) {
                this.buscar(false);
            }

            if (!isNil(resultado) && !this.filaEsVisible(resultado)) {
                this.toastr.warning(`Aunque se guardaron los cambios del proceso "${resultado.evento}", no están visibles en la tabla en este momento.`, null, {
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
     * Edita los datos de un proceso.
     * @param {Proceso} proceso
     */
    editarProceso(proceso) {
        const clon = cloneDeep(proceso);
        clon.aplicacion = clon.aplicacion.valor;
        this.mostrarModalProceso(clon);
    }

    /**
     * Elimina un proceso
     * @param {Proceso} proceso
     */
    eliminarProceso(proceso) {
        const fnActualizarProcesos = () => {
            this.procesos = map(this.procesosService.procesos, entidad => { return this._procesarEntidadVisualizacion(entidad); });
            this.actualizarOrden(this.ordenActivo, false);
            if (this.busquedaActiva) {
                this.buscar(false);
            }
        };

        return this.procesosService.eliminar(proceso)
            .then(() => {
                fnActualizarProcesos();
            })
            .catch(response => {
                if (response && response.status === 404) {
                    fnActualizarProcesos();
                } else if (get(response, 'error.errorCode') === ENTIDAD_NO_ELIMINABLE) {
                    this.toastr.error(`El proceso "${proceso.evento}" no se puede eliminar porque existe información que depende de él.`, null, {
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
     * Cambia el estado de un proceso de activo a inactivo y viceversa.
     *
     * @param {Proceso} entidad
     */
    cambiarEstado(entidad) {
        this.procesosService.editar(entidad)
            .then(resultado => {
                entidad.estado = clone(resultado.estado);
            })
            .catch(response => {
                if (response.status === 404) {
                    this.procesos = map(this.procesosService.procesos, entidad => { return this._procesarEntidadVisualizacion(entidad); });
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
     * Devuelve verdadero si el proceso está visible en la tabla en ese momento.
     * @param {Proceso} proceso
     * @return {boolean}
     */
    filaEsVisible(proceso) {
        if (isNil(proceso)) {
            return false;
        }
        return !!find(this.datos, (item) => {
            return item.codigo === proceso.codigo;
        });
    }

    buscar(cambiarPagina) {
        if (Object.getOwnPropertyNames(this.paramsBusqueda).length === 0) {
            this.mostrarTodos();
        } else {
            this.busquedaActiva = true;
            this.resultadoBusqueda = reduce(this.procesos, (resultado, item) => {
                let coincidencia = isMatchWith(item, this.paramsBusqueda, (objValue, srcValue, key) => {
                    if (key === 'aplicacion') {
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
        return this.busquedaActiva ? this.resultadoBusqueda : this.procesos;
    }

    get totalProcesos() {
        return this.busquedaActiva ? this.resultadoBusqueda.length : this.procesos.length;
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
            if (inicio >= this.procesos.length) {
                if (this.paginaActual > 1) {
                    this.paginaActual--;
                    this.actualizarPagina();
                } else {
                    this.datos = [];
                }
            } else {
                this.datos = this.procesos.slice(inicio, fin);
            }
        }
    }

    actualizarOrden(orden, cambiarPagina) {
        if (isNil(cambiarPagina) || cambiarPagina) {
            this.paginaActual = 1;
        }
        this.ordenActivo = orden;

        this.procesos = orderBy(this.procesos,
            [entidad => {
                const valor = get(entidad, orden[0]);
                return typeof valor === 'string' ? valor.toLowerCase() : valor; }],
            [ orden[1] ]);

        if (this.busquedaActiva) {
            this.resultadoBusqueda = orderBy(this.resultadoBusqueda,
                [entidad => {
                    const valor = get(entidad, orden[0]);
                    return typeof valor === 'string' ? valor.toLowerCase() : valor; }],
                [ orden[1] ]);
        }

        this.actualizarPagina();
    }
}