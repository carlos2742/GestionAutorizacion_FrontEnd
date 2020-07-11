import angular from 'angular';
import clone from 'lodash/clone';
import cloneDeep from 'lodash/cloneDeep';
import map from 'lodash/map';
import filter from 'lodash/filter';
import get from 'lodash/get';
import isNil from 'lodash/isNil';
import isMatch from 'lodash/isMatch';

import './notificaciones.scss';
import { ENTIDAD_NO_ELIMINABLE } from '../../common/constantes';
import modalEdicionNotificacion from './modal-edicion-notificacion.html';

/* @ngInject */
/**
 * Esta clase es un controlador de Angular para la vista de lista de notificaciones.
 */
export default class NotificacionesController {
    constructor($rootScope, $scope, $location, $q, $uibModal, toastr, AppConfig, NotificacionesService,
                esGeneral, titulo, PersonalService) {
        this.$rootScope = $rootScope;
        this.$q = $q;
        this.$uibModal = $uibModal;
        this.toastr = toastr;
        this.ITEMS_POR_PAGINA = AppConfig.elementosPorPagina;
        this.ITEMS_POR_PAGINA_EXCEL = AppConfig.elementosPorPaginaParaExcel;
        this.ITEMS_SELECT = AppConfig.elementosBusquedaSelect;
        this.notificacionesService = NotificacionesService;

        this.esGeneral = esGeneral;
        this.titulo = titulo;
        this.urlRedireccionar = sessionStorage.getItem('urlOrigen');

        this.estados = this.notificacionesService.obtenerEstados();
        this.totalEstados = 0;

        this.personalService = PersonalService;
        this.ultimaBusquedaPersonas = null;
        this.personas = [];
        this.totalPersonas = 0;
        this.obteniendoPersonas = false;

        this.busquedaVisible = true;
        this.paramsBusqueda = {};
        this.paramsAnteriores = {};

        this.paginaActual = 1;
        this.orden = ['id', 'desc'];

        this.presentacion = {
            entidad: 'Notificación',
            atributoPrincipal: 'mensaje',
            ordenInicial: this.orden,
            columnas: [
                {nombre: 'codigo', display: 'ID'},
                {nombre: 'mensajeInput', display: 'Descripción', ancho: '250px', html: true },
                {nombre: 'estadoSpan', display: 'Activo', ancho: '40px', html: true},
                {nombre: 'fechaInicio.display', display: 'Fecha Inicio', ordenable: 'fechaInicio.valor'},
                {nombre: 'fechaFin.display', display: 'Fecha Fin', ordenable: 'fechaFin.valor'},
                {nombre: 'fechaInicio.displayHoraInicio', display: 'Hora Inicio'},
                {nombre: 'fechaFin.displayHoraFin', display: 'Hora Fin'},
            ]
        };

        let filtro = { activo: undefined };
        if(this.esGeneral) {
            filtro['notificacionGeneral'] = true;
        } else {
            filtro['notificacionEspecifica'] = true;
            this.presentacion.columnas.splice(2, 0, { nombre: 'idPeticion', display: 'Código'});
            this.presentacion.columnas.splice(3, 0, { nombre: 'solicitante.display', display: 'Solicitante'});
        }
        if ($location.search().idPeticion) {
            this.idPeticion = Number($location.search().idPeticion);
            this.paramsBusqueda['codigoPeticionBusqueda'] = this.idPeticion;
            this.paramsAnteriores['codigoPeticionBusqueda'] = this.idPeticion;
            filtro['idPeticion'] = this.idPeticion;
        }

        this.notificacionesService.obtenerTodos(this.paginaActual , this.orden, filtro)
            .then(resultado => {
                this.datos = map(resultado, notificacion => {
                    return this._procesarNotificacionVisualizacion(notificacion);
                });
                this.totalItems = this.notificacionesService.notificaciones.length;
            });

        this.popupFechaInicialAbierto = false;
        this.popupFechaFinalAbierto = false;

        const deregister = $rootScope.$on('$routeChangeStart', () => {
            this.notificacionesService.reset();
            deregister();
        });
    }

    _procesarNotificacionVisualizacion(notificacion) {
        let clon = clone(notificacion);
        clon.mensajeInput = `<textarea rows="3" disabled style="width: 100%;">${!isNil(notificacion.mensaje) ? notificacion.mensaje : ''}</textarea>`;
        clon.estadoSpan = `<span class="estado ${notificacion.activo ? 'activo' : 'inactivo'}"></span>`;
        return clon;
    }

    get mostrandoResultadosParcialesEstados() {
        return this.totalEstados > this.ITEMS_SELECT;
    }

    filtrarEstado(busqueda) {
        const busquedaLower = busqueda.toLowerCase();
        const resultado = filter(this.estados, (elemento) => {
            return (busqueda && elemento.nombre) ? includes(elemento.nombre.toLowerCase(), busquedaLower) : true;
        });
        this.totalEstados = resultado.length;
        if (resultado.length > this.ITEMS_SELECT + 1) {
            return resultado.slice(0, this.ITEMS_SELECT + 1);
        } else {
            return resultado;
        }
    }

    get mostrandoResultadosParcialesPersonas() {
        return this.totalPersonas > this.ITEMS_SELECT;
    }

    filtrarPersonas(busqueda) {
        if (busqueda !== this.ultimaBusquedaPersonas) {
            this.ultimaBusquedaPersonas = busqueda;
            const busquedaGeneral = busqueda ? busqueda : undefined;
            this.personas = [];
            this.totalPersonas = 0;
            this.obteniendoPersonas = true;
            return this.personalService.obtenerTodos(1, ['apellidos', 'asc'], { busquedaGeneral }, this.ITEMS_SELECT)
                .then(personas => {
                    this.personas = [].concat(...personas);
                    this.personas.push({ codigo: undefined, nombreApellidos: '' });
                    this.totalPersonas = this.personalService.personas.length;
                })
                .finally(() => {
                    this.obteniendoPersonas = false;
                });
        }
    }

    actualizarPagina(orden) {
        this.datos = null;
        let filtroBusqueda = {
            mensaje: get(this.paramsBusqueda, 'mensajeBusqueda') ? this.paramsBusqueda.mensajeBusqueda : undefined,
            activo: get(this.paramsBusqueda, 'estado.valor'),
            idPersona: get(this.paramsBusqueda, 'solicitante.codigo') ? this.paramsBusqueda.solicitante.codigo : undefined,
            idPeticion: get(this.paramsBusqueda, 'codigoPeticionBusqueda') ? this.paramsBusqueda.codigoPeticionBusqueda : undefined
        };
        if(this.esGeneral) {
            filtroBusqueda['notificacionGeneral'] = true;
        } else {
            filtroBusqueda['notificacionEspecifica'] = true;
        }
        this.notificacionesService.obtenerTodos(this.paginaActual , orden, filtroBusqueda)
            .then(notificaciones => {
                this.totalItems = this.notificacionesService.notificaciones.length;
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
                mensaje: get(this.paramsBusqueda, 'mensajeBusqueda') ? this.paramsBusqueda.mensajeBusqueda : undefined,
                activo: get(this.paramsBusqueda, 'estado.valor'),
                idPersona: get(this.paramsBusqueda, 'solicitante.codigo') ? this.paramsBusqueda.solicitante.codigo : undefined,
                idPeticion: get(this.paramsBusqueda, 'codigoPeticionBusqueda') ? this.paramsBusqueda.codigoPeticionBusqueda : undefined
            };
            if(this.esGeneral) {
                filtroBusqueda['notificacionGeneral'] = true;
            } else {
                filtroBusqueda['notificacionEspecifica'] = true;
            }
            this.datos = null;
            this.notificacionesService.obtenerTodos(1 , orden, filtroBusqueda, this.ITEMS_POR_PAGINA)
                .then(notificaciones => {
                    this.datos = map(notificaciones, notificacion => {
                        return this._procesarNotificacionVisualizacion(notificacion);
                    });
                    this.totalItems = this.notificacionesService.notificaciones.length;
                    this.paginaActual = 1;
                })
                .catch(response => {
                    this.datos = [];
                    throw response;
                });
        }
    }

    mostrarTodos(busquedaNotificacionesForm) {
        this.paramsBusqueda = {};
        if (!isNil(busquedaNotificacionesForm)) {
            busquedaNotificacionesForm.$setPristine();
            busquedaNotificacionesForm.$setUntouched();
        }
        //Ahorrando llamadas innecesarias al API
        if (Object.getOwnPropertyNames(this.paramsAnteriores).length > 0) {
            this.paramsAnteriores = {};
            this.datos = null;
            let filtro = { activo: undefined };
            if(this.esGeneral) {
                filtro['notificacionGeneral'] = true;
            } else {
                filtro['notificacionEspecifica'] = true;
            }
            this.notificacionesService.obtenerTodos(1, null, filtro)
                .then(notificaciones => {
                    this.totalItems = this.notificacionesService.notificaciones.length;
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

    eliminarNotificacion(entidad) {
        return this.notificacionesService.eliminar(entidad)
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

    mostrarModalNotificacion(notificacion) {
        const contenedor = angular.element(document.getElementById('modalEdicionNotificacion'));
        const modal = this.$uibModal.open({
            template: modalEdicionNotificacion,
            appendTo: contenedor,
            size: 'lg dialog-centered',
            controller: 'ModalEdicionNotificacionController',
            controllerAs: '$modal',
            resolve: {
                entidad: () => { return notificacion; },
                paginaActual: () => { return this.paginaActual; },
                esCrear: () => { return undefined; },
                peticiones: () => { return []; },
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

    editarNotificacion(entidad) {
        const notificacionAEditar = cloneDeep(entidad);
        this.mostrarModalNotificacion(notificacionAEditar);
    }
}