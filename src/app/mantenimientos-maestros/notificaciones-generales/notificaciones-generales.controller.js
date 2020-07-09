import angular from 'angular';
import clone from 'lodash/clone';
import cloneDeep from 'lodash/cloneDeep';
import map from 'lodash/map';
import get from 'lodash/get';
import isNil from 'lodash/isNil';
import isMatch from 'lodash/isMatch';

import './notificaciones-generales.scss';
import { ENTIDAD_NO_ELIMINABLE } from '../../common/constantes';
import modalEdicionNotificacionGeneral from './modal-edicion-notificacion-general.html';
import { procesarFechaAEnviar } from "../../common/utiles";

/* @ngInject */
/**
 * Esta clase es un controlador de Angular para la vista de lista de notificaciones generales.
 */
export default class NotificacionesGeneralesController {
    constructor($rootScope, $scope, $q, $uibModal, toastr, AppConfig, NotificacionesGeneralesService) {
        this.$rootScope = $rootScope;
        this.$q = $q;
        this.$uibModal = $uibModal;
        this.toastr = toastr;
        this.ITEMS_POR_PAGINA = AppConfig.elementosPorPagina;
        this.ITEMS_POR_PAGINA_EXCEL = AppConfig.elementosPorPaginaParaExcel;
        this.ITEMS_SELECT = AppConfig.elementosBusquedaSelect;
        this.notificacionesGeneralesService = NotificacionesGeneralesService;

        this.busquedaVisible = true;
        this.paramsBusqueda = { activoBusqueda: true };
        this.paramsAnteriores = { activoBusqueda: true };

        this.paginaActual = 1;
        this.orden = ['id', 'desc'];

        this.botonActivo = `<div class="form-row mr-3">
                                <toggle onstyle="btn-success" offstyle="btn-secondary"
                                        on="Si" off="No" size="btn-sm" id="activoBusqueda" name="activoBusqueda"
                                        ng-model="vm.paramsBusqueda.activoBusqueda">
                                </toggle>
                            </div>
                            <div>
                                <label class="form-check-label cambiar-fuente mt-1" for="activoBusqueda">Activo</label>
                            </div>`;

        this.presentacion = {
            entidad: 'Notificación general',
            atributoPrincipal: 'mensaje',
            ordenInicial: this.orden,
            columnas: [
                {nombre: 'codigo', display: 'ID'},
                {nombre: 'mensaje', display: 'Descripción'},
                {nombre: 'estadoSpan', display: 'Activo', ancho: '40px', html: true},
                {nombre: 'fechaInicio.display', display: 'Fecha Inicio', ordenable: 'fechaInicio.valor'},
                {nombre: 'fechaFin.display', display: 'Fecha Fin', ordenable: 'fechaFin.valor'},
                {nombre: 'fechaInicio.displayHoraInicio', display: 'Hora Inicio'},
                {nombre: 'fechaFin.displayHoraFin', display: 'Hora Fin'},
            ]
        };

        this.notificacionesGeneralesService.obtenerTodos(this.paginaActual , this.orden, { notificacionGeneral: true, activo: true })
            .then(resultado => {
                this.datos = map(resultado, notificacion => {
                    return this._procesarNotificacionVisualizacion(notificacion);
                });
                this.totalItems = this.notificacionesGeneralesService.notificacionesGenerales.length;
            });

        this.popupFechaInicialAbierto = false;
        this.popupFechaFinalAbierto = false;

        const deregister = $rootScope.$on('$routeChangeStart', () => {
            this.notificacionesGeneralesService.reset();
            deregister();
        });
    }

    _procesarNotificacionVisualizacion(notificacion) {
        let clon = clone(notificacion);
        clon.estadoSpan = `<span class="estado ${notificacion.activo ? 'activo' : 'inactivo'}"></span>`;
        return clon;
    }

    toggleSelectorFechaBusqueda(nombre) {
        this[`popupFecha${nombre}Abierto`] = !this[`popupFecha${nombre}Abierto`];
    }

    cambiarEstadoNotificacion(entidad) {}

    actualizarPagina(orden) {
        this.datos = null;
        let filtroBusqueda = {
            notificacionGeneral: true,
            mensaje: get(this.paramsBusqueda, 'mensajeBusqueda') ? this.paramsBusqueda.mensajeBusqueda : undefined,
            activo: get(this.paramsBusqueda, 'activoBusqueda')
        };
        this.notificacionesGeneralesService.obtenerTodos(this.paginaActual , orden, filtroBusqueda)
            .then(notificaciones => {
                this.totalItems = this.notificacionesGeneralesService.notificacionesGenerales.length;
                this.datos = map(notificaciones, notificacion => {
                    return this._procesarNotificacionVisualizacion(notificacion);
                });
            })
            .catch(response => {
                this.datos = [];
                throw response;
            });
    }

    actualizarOrden(orden) {
        this.orden = orden;
        this.paginaActual = 1;
        this.actualizarPagina(orden);
    }

    buscar(orden) {
        if (!isMatch(this.paramsAnteriores, this.paramsBusqueda)) {
            this.paramsAnteriores = cloneDeep(this.paramsBusqueda);
            let filtroBusqueda = {
                notificacionGeneral: true,
                mensaje: get(this.paramsBusqueda, 'mensajeBusqueda') ? this.paramsBusqueda.mensajeBusqueda : undefined,
                activo: get(this.paramsBusqueda, 'activoBusqueda')
            };
            this.datos = null;
            this.notificacionesGeneralesService.obtenerTodos(1 , orden, filtroBusqueda, this.ITEMS_POR_PAGINA)
                .then(notificaciones => {
                    this.datos = map(notificaciones, notificacion => {
                        return this._procesarNotificacionVisualizacion(notificacion);
                    });
                    this.totalItems = this.notificacionesGeneralesService.notificacionesGenerales.length;
                    this.paginaActual = 1;
                })
                .catch(response => {
                    this.datos = [];
                    throw response;
                });
        }
    }

    mostrarTodos(busquedaNotificacionesGeneralesForm) {
        this.paramsBusqueda = { activoBusqueda: true };
        if (!isNil(busquedaNotificacionesGeneralesForm)) {
            busquedaNotificacionesGeneralesForm.$setPristine();
            busquedaNotificacionesGeneralesForm.$setUntouched();
        }
        //Ahorrando llamadas innecesarias al API
        if (Object.getOwnPropertyNames(this.paramsAnteriores).length > 1 || !this.paramsAnteriores.activoBusqueda) {
            this.paramsAnteriores = { activoBusqueda: true };
            this.datos = null;
            this.notificacionesGeneralesService.obtenerTodos(1, null, { notificacionGeneral: true, activo: true })
                .then(notificaciones => {
                    this.totalItems = this.notificacionesGeneralesService.notificacionesGenerales.length;
                    this.paginaActual = 1;
                    this.datos = map(notificaciones, notificacion => {
                        return this._procesarNotificacionVisualizacion(notificacion);
                    });
                })
                .catch(response => {
                    this.datos = [];
                    throw response;
                });
        }
    }

    eliminarNotificacionGeneral(entidad) {
        return this.notificacionesGeneralesService.eliminar(entidad)
            .then(() => {
                if (this.datos.length === 1 && this.paginaActual > 1) {
                    this.paginaActual = this.paginaActual - 1;
                }
                return this.actualizarPagina();
            })
            .catch(response => {
                if (response && response.status === 404) {
                    if (this.datos.length === 1 && this.paginaActual > 1) {
                        this.paginaActual = this.paginaActual - 1;
                    }
                    this.actualizarPagina();
                } else if (get(response, 'error.errorCode') === ENTIDAD_NO_ELIMINABLE) {
                    this.toastr.error('La notificación no se puede eliminar');
                }
                throw response;
            });
    }

    mostrarModalNotificacionGeneral(notificacion) {
        const contenedor = angular.element(document.getElementById('modalEdicionNotificacionGeneral'));
        const modal = this.$uibModal.open({
            template: modalEdicionNotificacionGeneral,
            appendTo: contenedor,
            size: 'lg dialog-centered',
            controller: 'ModalEdicionNotificacionGeneralController',
            controllerAs: '$modal',
            resolve: {
                entidad: () => { return notificacion; },
                paginaActual: () => { return this.paginaActual; }
            }
        });
        const actualizarFn = (resultado) => {
            if (!isNil(resultado)) {
                this.datos = map(resultado.notificacionesPagina, notificacion => {
                    return this._procesarNotificacionVisualizacion(notificacion);
                });
            } else if(resultado === null) {
                if (this.datos.length === 1 && this.paginaActual > 1) {
                    this.paginaActual = this.paginaActual - 1;
                }
                this.actualizarPagina();
            }
        };
        modal.result.then((resultado) => { actualizarFn(resultado); });
        modal.result.catch(response => { throw response; });
    }

    editarNotificacionGeneral(entidad) {
        const notificacionAEditar = cloneDeep(entidad);
        this.mostrarModalNotificacionGeneral(notificacionAEditar);
    }
}