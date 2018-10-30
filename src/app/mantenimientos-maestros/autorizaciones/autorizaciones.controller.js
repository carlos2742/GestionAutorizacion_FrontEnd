import isNil from 'lodash/isNil';
import find from 'lodash/find';
import findIndex from 'lodash/findIndex';
import clone from 'lodash/clone';
import cloneDeep from 'lodash/cloneDeep';
import concat from 'lodash/concat';
import isMatch from 'lodash/isMatch';
import filter from 'lodash/filter';
import includes from 'lodash/includes';
import get from 'lodash/get';

import './autorizaciones.scss';
import templateModal from './modal-edicion-autorizaciones.html';
import {ELEMENTO_NO_ENCONTRADO, ENTIDAD_NO_ELIMINABLE} from "../../common/constantes";

/* @ngInject */
/**
 * Esta clase representa un controlador de Angular usado en la vista de la lista de autorizaciones.
 */
export default class AutorizacionesController {
    /**
     * @param $scope
     * @param $location
     * @param $q
     * @param $uibModal
     * @param toastr
     * @param {AutorizacionesService} AutorizacionesService
     * @param {FlujosService} FlujosService
     * @param {RolesService} RolesService
     * @param AppConfig
     **/
    constructor($scope, $location, $q, $uibModal, toastr, AutorizacionesService, FlujosService, RolesService, AppConfig) {
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
        this.autorizacionesService = AutorizacionesService;
        /** @private */
        this.flujosService = FlujosService;

        /** @private */
        this.totalFlujos = 0;
        /** @type {Flujo[]} */
        this.flujos = [];

        this.presentacion = {
            entidad: 'Autorización',
            atributoPrincipal: 'id',
            ordenInicial: ['id', 'asc'],
            columnas: [
                {nombre: 'id', display: 'Código', ordenable: true},
                {nombre: 'flujo.display', display: 'Flujo', ordenable: true},
                {nombre: 'orden', display: 'Orden', ordenable: true},
                {nombre: 'nombre', display: 'Nombre', ordenable: true},
                {nombre: 'rol.display', display: 'Rol', ordenable: true},
                {nombre: 'fechaLimite.display', display: 'Fecha Límite', ordenable: false},
            ]
        };
        this.columnasExcel = {
            titulos: ['Codigo', 'Flujo', 'Orden', 'Nombre', 'Rol', 'Fecha Límite'],
            campos: ['codigo', 'flujo.display', 'orden', 'nombre', 'rol.display', 'fechaLimite.display']
        };

        RolesService.obtenerTodos(false)
            .then(roles => {
                /** @type {Rol[]} */
                this.roles = roles;
            });
        FlujosService.obtenerTodos(false)
            .then(flujos => {
                /** @type {Flujo[]} */
                this.flujos = [].concat(...flujos);
                this.flujos.unshift({codigo: undefined, evento: ''});

                if ($location.search().flujo) {
                    this.paramsBusqueda.flujo = find(flujos, ['id', parseInt($location.search().flujo)]);
                }
            });

        /** @type {number} */
        this.paginaActual = 1;
        if ($location.search().flujo) {
            this.paramsBusqueda = {
                flujo: { id: $location.search().flujo }
            };
            this.buscar();
        } else {
            this.actualizarPagina(['id', 'asc']);
        }
    }

    /**
     * Esta propiedad devuelve el total de autorizaciones existentes.
     * @return {Number}
     */
    get totalItems() {
        return this.autorizacionesService.autorizaciones.length;
    }

    /**
     * Propiedad que devuelve true si no se está mostrando la lista completa de flujos en un momento determinado.
     * @return {boolean}
     */
    get mostrandoResultadosParcialesFlujos() {
        return this.totalFlujos > this.ITEMS_SELECT + 1;
    }

    /**
     * Filtra la lista de flujos según el string que haya escrito el usuario. Es case insensitive.
     * @param {string} busqueda
     * @return {Flujo[]}
     */
    filtrarFlujos(busqueda) {
        const busquedaLower = busqueda.toLowerCase();
        const resultado = filter(this.flujos, (elemento) => {
            return (busqueda && elemento.evento) ? includes(elemento.evento.toLowerCase(), busquedaLower) : true;
        });
        this.totalFlujos = resultado.length;

        if (resultado.length > this.ITEMS_SELECT + 1) {
            return resultado.slice(0, this.ITEMS_SELECT + 1);
        } else {
            return resultado;
        }
    }

    /**
     * Muestra el modal de creación/edición de una autorización. Una vez cerrado el modal, se actualizan los valores en la
     * tabla.
     * @param {Autorizacion} [autorizacion]
     */
    mostrarModalAutorizacion(autorizacion) {
        const modoEdicion = !isNil(autorizacion);
        const tienePeticiones = modoEdicion ? autorizacion.tienePeticiones : false;
        const contenedor = angular.element(document.getElementById("modalEdicionAutorizacion"));
        this.$uibModal.open({
            template: templateModal,
            appendTo: contenedor,
            size: 'lg',
            controller: 'ModalEdicionAutorizacionesController',
            controllerAs: '$modal',
            resolve: {
                autorizacion: () => { return autorizacion },
                paginaActual: () => { return this.paginaActual },
                fnDespuesEdicion: () => {
                    return (resultado) => {
                        if (!isNil(resultado)) {
                            this.datos = resultado.autorizacionesPagina;
                        } else {
                            if (this.datos.length === 1 && this.paginaActual > 1) {
                                this.paginaActual = this.paginaActual-1;
                            }
                            this.actualizarPagina();
                        }
                    }
                }
            }
        }).result.catch(() => {
            // Se actualiza el valor en la tabla en el caso de que la autorización no tuviera peticiones porque cuando
            // se abrió el modal se verificó si tiene peticiones o no
            if (modoEdicion && !tienePeticiones) {
                const index = findIndex(this.datos, ['id', autorizacion.id]);
                if (index > -1) {
                    this.datos[index].tienePeticiones = autorizacion.tienePeticiones;
                    this.datos = clone(this.datos);
                }
            }
        });
    }

    /**
     * Devuelve verdadero si la autorización está visible en la tabla en ese momento.
     * @param {Autorizacion} autorizacion
     * @return {boolean}
     */
    filaEsVisible(autorizacion) {
        if (isNil(autorizacion)) {
            return false;
        }

        return !!find(this.datos, (item) => {
            return item.codigo === autorizacion.codigo;
        });
    }

    /**
     * Pide al API todos las autorizaciones que cumplan con los parámetros de búsqueda seleccionados por el usuario.
     */
    buscar() {
        // Si justo antes ya se había mandado a hacer una búsqueda exactamente igual, no se hace nada. Comprobando esto se
        // ahorran llamadas innecesarias al API.
        if (!isMatch(this.paramsAnteriores, this.paramsBusqueda)) {
            let filtroBusqueda = {
                idFlujo: this.paramsBusqueda.flujo ? this.paramsBusqueda.flujo.id : undefined,
                idRol: this.paramsBusqueda.rol ? this.paramsBusqueda.rol.id : undefined,
                nombre: this.paramsBusqueda.nombre
            };

            this.paramsAnteriores = cloneDeep(this.paramsBusqueda);

            this.datos = null;
            this.autorizacionesService.obtenerTodos(1, null, filtroBusqueda)
                .then(resultados => {
                    this.paginaActual = 1;
                    this.datos = resultados;
                });
        }
    }

    /**
     * Reinicia todos los parámetros de búsqueda y obtiene todas las autorizaciones.
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
            this.autorizacionesService.obtenerTodos(1, null, null)
                .then(resultados => {
                    this.paginaActual = 1;
                    this.datos = resultados;
                });
        }
    }

    /**
     * Edita una autorización.
     * @param {Autorizacion} entidad
     */
    editarAutorizacion(entidad) {
        const autorizacionAEditar = cloneDeep(entidad);
        autorizacionAEditar.flujo = entidad.flujo.valor;
        autorizacionAEditar.rol = entidad.rol.valor;
        autorizacionAEditar.fechaLimite = entidad.fechaLimite.valor;
        this.mostrarModalAutorizacion(autorizacionAEditar);
    }

    /**
     * Elimina una autorización determinada.
     * @param entidad
     * @return {Promise.<Autorizacion[]>}     -  Se resuelve con la lista de autorizaciones visibles en la página.
     */
    eliminarAutorizacion(entidad) {
        return this.autorizacionesService.eliminar(entidad)
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
                    this.toastr.warning(`Esta autorización no se puede eliminar porque ya ha sido usada en una petición. Si ya no es necesaria, debe <a href="#/flujos">crear un flujo nuevo</a>.`, null, {
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
     * Pide al API las autorizaciones correspondientes a una página determinada.
     * @param orden
     */
    actualizarPagina(orden) {
        this.datos = null;
        return this.autorizacionesService.obtenerTodos(this.paginaActual, orden)
            .then(autorizaciones => {
                this.datos = autorizaciones;
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
     * Pide al API todas las páginas necesarias para tener el total de autorizaciones que se van a exportar a un documento
     * Excel. Esta exportación respeta el ordenamiento activo y cualquier filtro seleccionado.
     */
    obtenerDatosAExportar() {
        let totalPaginas = Math.ceil(this.autorizacionesService.autorizaciones.length / this.ITEMS_POR_PAGINA_EXCEL);
        let promesasObtencion = [];
        for (let i=1; i <= totalPaginas; i++) {
            promesasObtencion.push(this.autorizacionesService.obtenerTodos(i, undefined, undefined, this.ITEMS_POR_PAGINA_EXCEL));
        }
        return this.$q.all(promesasObtencion)
            .then(resultado => {
                return concat([], ...resultado);
            });
    }
}