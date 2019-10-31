import angular from 'angular';
import isNil from 'lodash/isNil';
import find from 'lodash/find';
import findIndex from 'lodash/findIndex';
import clone from 'lodash/clone';
import cloneDeep from 'lodash/cloneDeep';
import isMatch from 'lodash/isMatch';
import filter from 'lodash/filter';
import includes from 'lodash/includes';
import get from 'lodash/get';
import reduce from 'lodash/reduce';

import './actividades.scss';
import templateModal from './modal-edicion-actividades.html';
import {ENTIDAD_NO_ELIMINABLE} from '../../common/constantes';

/* @ngInject */
/**
 * Esta clase representa un controlador de Angular usado en la vista de la lista de actividades.
 */
export default class ActividadesController {
    /**
     * @param $scope
     * @param $location
     * @param $q
     * @param $uibModal
     * @param toastr
     * @param {ActividadesService} ActividadesService
     * @param {ProcesosService} ProcesosService
     * @param {RolesService} RolesService
     * @param AppConfig
     **/
    constructor($scope, $location, $q, $uibModal, toastr, ActividadesService, ProcesosService, RolesService, AppConfig) {
        /** @type {number} */
        this.ITEMS_POR_PAGINA = AppConfig.elementosPorPagina;
        /** @private */
        this.ITEMS_POR_PAGINA_EXCEL = AppConfig.elementosPorPaginaParaExcel;
        /** @private */
        this.ITEMS_SELECT = AppConfig.elementosBusquedaSelect;
        /** @type {boolean} */
        this.busquedaVisible = true;
        /** @private */
        this.busquedaActiva = false;
        /** @type {Object} */
        this.paramsBusqueda = {};
        /** @private */
        this.paramsAnteriores = {};

        /** @private */
        this.$q = $q;
        /** @private */
        this.$uibModal = $uibModal;
        /** @private */
        this.toastr = toastr;
        /** @private */
        this.actividadesService = ActividadesService;
        /** @private */
        this.procesosService = ProcesosService;

        /** @private */
        this.totalProcesos = 0;
        /** @type {Proceso[]} */
        this.procesos = [];

        this.presentacion = {
            entidad: 'Actividad',
            atributoPrincipal: 'nombre',
            ordenInicial: ['id', 'asc'],
            columnas: [
                {nombre: 'id', display: 'Código', ordenable: true},
                {nombre: 'proceso.display', display: 'Proceso', ordenable: true},
                {nombre: 'orden', display: 'Orden', ordenable: true},
                {nombre: 'nombre', display: 'Nombre', ordenable: true},
                {nombre: 'rol.display', display: 'Rol', ordenable: true}
            ]
        };
        this.columnasExcel = {
            titulos: ['Codigo', 'Proceso', 'Orden', 'Nombre', 'Rol'],
            campos: ['codigo', 'proceso.display', 'orden', 'nombre', 'rol.display']
        };

        RolesService.obtenerTodos(false)
            .then(roles => {
                /** @type {Rol[]} */
                this.roles = roles;
            });
        ProcesosService.obtenerTodos(false)
            .then(procesos => {
                /** @type {Proceso[]} */
                this.procesos = [].concat(...procesos);
                this.procesos.unshift({codigo: undefined, evento: ''});

                if ($location.search().proceso) {
                    this.paramsBusqueda.proceso = find(procesos, ['id', parseInt($location.search().proceso)]);
                }
            });

        /** @type {number} */
        this.paginaActual = 1;
        if ($location.search().proceso) {
            this.paramsBusqueda = {
                proceso: { id: $location.search().proceso }
            };
            this.buscar();
        } else {
            this.actualizarPagina(['id', 'asc']);
        }
    }

    /**
     * Esta propiedad devuelve el total de actividades existentes.
     * @return {Number}
     */
    get totalItems() {
        return this.actividadesService.actividades.length;
    }

    /**
     * Propiedad que devuelve true si no se está mostrando la lista completa de procesos en un momento determinado.
     * @return {boolean}
     */
    get mostrandoResultadosParcialesProcesos() {
        return this.totalProcesos > this.ITEMS_SELECT + 1;
    }

    /**
     * Filtra la lista de procesos según el string que haya escrito el usuario. Es case insensitive.
     * @param {string} busqueda
     * @return {Proceso[]}
     */
    filtrarProcesos(busqueda) {
        const busquedaLower = busqueda.toLowerCase();
        const resultado = filter(this.procesos, (elemento) => {
            return (busqueda && elemento.evento) ? includes(elemento.evento.toLowerCase(), busquedaLower) : true;
        });
        this.totalProcesos = resultado.length;

        if (resultado.length > this.ITEMS_SELECT + 1) {
            return resultado.slice(0, this.ITEMS_SELECT + 1);
        } else {
            return resultado;
        }
    }

    /**
     * Muestra el modal de creación/edición de una actividad. Una vez cerrado el modal, se actualizan los valores en la
     * tabla.
     * @param {Actividad} [actividad]
     */
    mostrarModalActividad(actividad) {
        const modoEdicion = !isNil(actividad);
        const tienePeticiones = modoEdicion ? actividad.tienePeticiones : false;
        const contenedor = angular.element(document.getElementById('modalEdicionActividad'));
        this.$uibModal.open({
            template: templateModal,
            appendTo: contenedor,
            size: 'lg',
            controller: 'ModalEdicionActividadesController',
            controllerAs: '$modal',
            resolve: {
                actividad: () => { return actividad; },
                paginaActual: () => { return this.paginaActual; },
                fnDespuesEdicion: () => {
                    return (resultado) => {
                        if (!isNil(resultado)) {
                            this.datos = resultado.actividadesPagina;
                        } else {
                            if (this.datos.length === 1 && this.paginaActual > 1) {
                                this.paginaActual = this.paginaActual-1;
                            }
                            this.actualizarPagina();
                        }
                    };
                }
            }
        }).result.catch(() => {
            // Se actualiza el valor en la tabla en el caso de que la actividad no tuviera peticiones porque cuando
            // se abrió el modal se verificó si tiene peticiones o no
            if (modoEdicion && !tienePeticiones) {
                const index = findIndex(this.datos, ['id', actividad.id]);
                if (index > -1) {
                    this.datos[index].tienePeticiones = actividad.tienePeticiones;
                    this.datos = clone(this.datos);
                }
            }
        });
    }

    /**
     * Devuelve verdadero si la actividad está visible en la tabla en ese momento.
     * @param {Actividad} actividad
     * @return {boolean}
     */
    filaEsVisible(actividad) {
        if (isNil(actividad)) {
            return false;
        }

        return !!find(this.datos, (item) => {
            return item.codigo === actividad.codigo;
        });
    }

    /**
     * Pide al API todos las actividades que cumplan con los parámetros de búsqueda seleccionados por el usuario.
     */
    buscar() {
        // Si justo antes ya se había mandado a hacer una búsqueda exactamente igual, no se hace nada. Comprobando esto se
        // ahorran llamadas innecesarias al API.
        if (!isMatch(this.paramsAnteriores, this.paramsBusqueda)) {
            let filtroBusqueda = {
                idProceso: this.paramsBusqueda.proceso ? this.paramsBusqueda.proceso.id : undefined,
                idRol: this.paramsBusqueda.rol ? this.paramsBusqueda.rol.id : undefined,
                nombre: this.paramsBusqueda.nombre
            };

            this.paramsAnteriores = cloneDeep(this.paramsBusqueda);

            this.datos = null;
            this.actividadesService.obtenerTodos(1, null, filtroBusqueda)
                .then(resultados => {
                    this.paginaActual = 1;
                    this.datos = resultados;
                });
        }
    }

    /**
     * Reinicia todos los parámetros de búsqueda y obtiene todas las actividades.
     *
     * @param busquedaForm      -  Formulario de los parámetros de búsqueda
     */
    mostrarTodos(busquedaForm) {
        this.paramsBusqueda = {};
        busquedaForm.$setPristine();
        busquedaForm.$setUntouched();

        // Si justo antes ya se había mandado a mostrar todos los resultados, no se hace nada. Comprobando esto se
        // ahorran llamadas innecesarias al API.
        if (Object.getOwnPropertyNames(this.paramsAnteriores).length > 0) {
            this.paramsAnteriores = {};

            this.datos = null;
            this.actividadesService.obtenerTodos(1, null, null)
                .then(resultados => {
                    this.paginaActual = 1;
                    this.datos = resultados;
                });
        }
    }

    /**
     * Edita una actividad.
     * @param {Actividad} entidad
     */
    editarActividad(entidad) {
        const actividadAEditar = cloneDeep(entidad);
        actividadAEditar.proceso = entidad.proceso.valor;
        actividadAEditar.rol = entidad.rol.valor;
        actividadAEditar.fechaLimite = entidad.fechaLimite.valor;
        this.mostrarModalActividad(actividadAEditar);
    }

    /**
     * Elimina una actividad determinada.
     * @param entidad
     * @return {Promise.<Actividad[]>}     -  Se resuelve con la lista de actividades visibles en la página.
     */
    eliminarActividad(entidad) {
        return this.actividadesService.eliminar(entidad)
            .then(() => {
                if (this.datos.length === 1 && this.paginaActual > 1) {
                    this.paginaActual = this.paginaActual-1;
                }
                return this.actualizarPagina();
            })
            .catch(response => {
                if (response && response.status === 404) {
                    if (this.datos.length === 1 && this.paginaActual > 1) {
                        this.paginaActual = this.paginaActual-1;
                    }
                    this.actualizarPagina();
                } else if (get(response, 'error.errorCode') === ENTIDAD_NO_ELIMINABLE) {
                    this.toastr.error(`Esta actividad no se puede eliminar porque ya ha sido usada en una petición. Si ya no es necesaria, debe <a href="#/procesos">crear un proceso nuevo</a>.`, null, {
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
     * Pide al API las actividades correspondientes a una página determinada.
     * @param orden
     */
    actualizarPagina(orden) {
        this.datos = null;
        return this.actividadesService.obtenerTodos(this.paginaActual, orden)
            .then(actividades => {
                this.datos = actividades;
            })
            .catch(() => {
                this.datos = [];
            });
    }

    /**
     * Este método se ejecuta cada vez que el usuario cambia el ordenamiento activo en la tabla, para pedir al API la
     * primera página que corresponda al orden seleccionado.
     *
     * @param {[string, string]} orden
     */
    actualizarOrden(orden) {
        this.paginaActual = 1;
        this.actualizarPagina(orden);
    }

    /**
     * Pide al API todas las páginas necesarias para tener el total de actividades que se van a exportar a un documento
     * Excel. Esta exportación respeta el ordenamiento activo y cualquier filtro seleccionado.
     */
    obtenerDatosAExportar() {
        let totalPaginas = Math.ceil(this.actividadesService.actividades.length / this.ITEMS_POR_PAGINA_EXCEL);
        let promesasObtencion = [];
        for (let i=1; i <= totalPaginas; i++) {
            promesasObtencion.push(this.actividadesService.obtenerTodos(i, undefined, undefined, this.ITEMS_POR_PAGINA_EXCEL)
                .then(resultado => {
                    this.datosObtenidos.total += resultado.length;
                    return resultado;
                })
            );
        }
        return this.$q.all(promesasObtencion)
            .then(resultado => {
                return reduce(resultado, (arregloResultados, item) => {
                    arregloResultados = arregloResultados.concat(item);
                    return arregloResultados;
                }, []);
            });
    }
}