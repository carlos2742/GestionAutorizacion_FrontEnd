import isNil from 'lodash/isNil';
import find from 'lodash/find';
import findIndex from 'lodash/findIndex';
import clone from 'lodash/clone';
import cloneDeep from 'lodash/cloneDeep';
import map from 'lodash/map';
import concat from 'lodash/concat';
import isMatch from 'lodash/isMatch';
import filter from 'lodash/filter';
import includes from 'lodash/includes';
import get from 'lodash/get';
import uniqBy from 'lodash/uniqBy';

import './peticiones.scss';
import {ETIQUETA_NOK} from "../../common/constantes";

/* @ngInject */
/**
 * Esta clase representa un controlador de Angular usado en la vista de la lista de peticiones activas asociadas a un autorizador.
 */
export default class PeticionesController {

    /**
     * @param $scope
     * @param $q
     * @param $uibModal
     * @param toastr
     * @param {PeticionesService} PeticionesService
     * @param {ModulosService} ModulosService
     * @param {FlujosService} FlujosService
     * @param {PersonalService} PersonalService
     * @param AppConfig
     **/
    constructor($scope, $q, $uibModal, toastr, PeticionesService, ModulosService, FlujosService, EtiquetasService,
                PersonalService, AppConfig) {
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
        this.ultimaBusquedaPersonas = null;


        /** @private */
        this.$q = $q;
        /** @private */
        this.$uibModal = $uibModal;
        /** @private */
        this.toastr = toastr;
        /** @private */
        this.peticionesService = PeticionesService;
        /** @private */
        this.personalService = PersonalService;
        /** @private */
        this.flujosService = FlujosService;
        /** @private */
        this.etiquetasService = EtiquetasService;

        /** @private */
        this.totalFlujos = 0;
        /** @private */
        this.totalPersonas = 0;
        /** @type {Persona[]} */
        this.personas = [];
        /** @type {boolean} */
        this.obteniendoPersonas = false;

        /** @type {number} */
        this.paginaActual = 1;
        this.actualizarPagina(['fecha.valor', 'asc'], true);

        this.presentacion = {
            entidad: 'Petición',
            atributoPrincipal: 'nombre',
            ordenInicial: ['fecha.valor', 'asc'],
            columnas: [
                {nombre: 'id', display: 'Código', ordenable: true},
                {nombre: 'fechaNecesaria.display', display: 'Fecha Necesaria', ordenable: 'fecha.valor'},
                {nombre: 'solicitante.display', display: 'Solicitante', ordenable: 'solicitante'},
                {nombre: 'flujo.display', display: 'Flujo', ordenable: 'flujo'},
                {nombre: 'estado.display', display: 'Estado', ordenable: false}
            ]
        };
        this.presentacionHistorialAutorizaciones = {
            entidad: 'Autorización',
            atributoPrincipal: 'autorizador.display',
            ordenInicial: ['fecha.valor', 'asc'],
            columnas: [
                {nombre: 'fecha.display', display: 'Fecha', ordenable: false},
                {nombre: 'autorizador.display', display: 'Autorizador', ordenable: false},
                {nombre: 'estado.display', display: 'Estado', ordenable: false},
            ]
        };
        this.columnasExcel = {
            titulos: ['Código', 'Fecha Necesaria', 'Solicitante', 'Flujo', 'Estado', 'Observaciones'],
            campos: ['id', 'fechaNecesaria.display', 'solicitante.display', 'flujo.display', 'estado.display', 'observaciones']
        };

        /** @type {Peticion} */
        this.peticionSeleccionada = null;

        ModulosService.obtenerTodos(false)
            .then(modulos => {
                /** @type {Modulo[]} */
                this.modulos = modulos;
            });

        const quitarWatcherFn = $scope.$watch('vm.paramsBusqueda.modulo', (newValue, oldValue) => {
            if (newValue !== oldValue || isNil(this.flujos)) {
                this.flujosService.obtenerTodos(false)
                    .then(flujos => {
                        if (isNil(newValue)) {
                            /** @type {Flujo[]} */
                            this.flujos = [].concat(...flujos);
                        } else {
                            this.flujos = filter(flujos, flujo => {
                                return flujo.modulo.valor.id === newValue.id;
                            });
                        }

                        this.flujos.unshift({id: undefined, nombre: ''});
                    });
                this.etiquetasService.obtenerTodos()
                    .then(etiquetas => {
                        const etiquetasAprobadas = filter(etiquetas, etiqueta => {
                            return !includes(etiqueta.estado, ETIQUETA_NOK)
                        });

                        if (isNil(newValue)) {
                            /** @type {Etiqueta[]} */
                            this.etiquetas = [];
                            this.paramsBusqueda.estado = undefined;
                        } else {
                            this.etiquetas = filter(etiquetasAprobadas, etiqueta => {
                                return etiqueta.modulo.valor.id === newValue.id;
                            })
                        }
                    });
            }
        });

        const deregisterFn = $scope.$on('$destroy', () => {
            this.peticionesService.reiniciarEstado();
            quitarWatcherFn();
            deregisterFn();
        });

    }

    get datosAExportar() {
        return this.busquedaActiva ? this.peticionesService.resultadosBusqueda : this.peticionesService.peticiones;
    }

    /**
     * Esta propiedad devuelve el total de peticiones existentes.
     * @return {Number}
     */
    get totalItems() {
        return this.busquedaActiva ? this.peticionesService.resultadosBusqueda.length : this.peticionesService.peticiones.length;
    }

    /**
     * Filtra la lista de personal según el string que haya escrito el usuario. Es case insensitive.
     *
     * @param busqueda
     * @return {Persona[]}
     */
    filtrarPersonas(busqueda) {
        // Si justo antes ya se había mandado a hacer una búsqueda exactamente igual, no se hace nada. Comprobando esto se
        // ahorran llamadas innecesarias al API.
        if (busqueda !== this.ultimaBusquedaPersonas) {
            this.ultimaBusquedaPersonas = busqueda;
            const busquedaGeneral = busqueda ? busqueda : undefined;
            this.personas = [];
            this.totalPersonas = 0;
            this.obteniendoPersonas = true;
            return this.personalService.obtenerTodos(1, ['apellidos', 'asc'], { busquedaGeneral }, this.ITEMS_SELECT)
                .then(personas => {
                    this.personas = [].concat(...personas);
                    this.personas.unshift({codigo: undefined, nombreApellidos:''});
                    this.totalPersonas = this.personalService.personas.length;
                })
                .finally(() => {
                    this.obteniendoPersonas = false;
                });
        }
    }

    /**
     * Propiedad que devuelve true si no se está mostrando la lista completa de personas en un momento determinado.
     * @return {boolean}
     */
    get mostrandoResultadosParcialesPersonas() {
        return this.totalPersonas > this.ITEMS_SELECT;
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
     * Muestra los detalles de una petición determinada en un panel lateral.
     * @param {Peticion} entidad
     */
    mostrarInfoPeticion(entidad) {
        this.peticionSeleccionada = entidad;
    }

    actualizarPeticiones() {
        this.paginaActual = 1;
        this.actualizarPagina(null, true);
    }

    /**
     * Devuelve verdadero si la petición está visible en la tabla en ese momento.
     * @param {Peticion} peticion
     * @return {boolean}
     */
    filaEsVisible(peticion) {
        if (isNil(peticion)) {
            return false;
        }

        return !!find(this.datos, (item) => {
            return item.codigo === peticion.codigo;
        });
    }

    /**
     * Pide al API todas las peticiones que cumplan con los parámetros de búsqueda seleccionados por el usuario.
     */
    buscar(forzarActualizacion) {
        // Si justo antes ya se había mandado a hacer una búsqueda exactamente igual, no se hace nada. Comprobando esto se
        // ahorran llamadas innecesarias al API.
        if (!isMatch(this.paramsAnteriores, this.paramsBusqueda)) {
            let filtroBusqueda = {
                idModulo: get(this.paramsBusqueda, 'modulo.id'),
                idFlujo: get(this.paramsBusqueda, 'flujo.id'),
                nInternoSolicitante: get(this.paramsBusqueda, 'solicitante.codigo'),
                estado: this.paramsBusqueda.estado ? this.paramsBusqueda.estado.estado : undefined,
                etiqueta: get(this.paramsBusqueda, 'estado.descripcion')
            };

            this.paramsAnteriores = cloneDeep(this.paramsBusqueda);

            this.busquedaActiva = true;
            this.datos = null;
            this.peticionesService.obtenerTodos(1, null, filtroBusqueda, forzarActualizacion)
                .then(resultados => {
                    this.paginaActual = 1;
                    this.datos = resultados;
                    if (!this.filaEsVisible(this.peticionSeleccionada)) {
                        this.peticionSeleccionada = null;
                    }
                });
        }
    }

    /**
     * Reinicia todos los parámetros de búsqueda y obtiene todas las peticiones.
     *
     * @param busquedaForm      -  Formulario de los parámetros de búsqueda
     */
    mostrarTodos(busquedaForm) {
        this.paramsBusqueda = {};
        this.busquedaActiva = false;
        busquedaForm.$setPristine();
        busquedaForm.$setUntouched();

        // Si justo antes ya se había mandado a mostrar todos los resultados, no se hace nada. Comprobando esto se
        // ahorran llamadas innecesarias al API.
        if (Object.getOwnPropertyNames(this.paramsAnteriores).length > 0) {
            this.paramsAnteriores = {};

            this.datos = null;
            this.peticionesService.obtenerTodos(1, null, null)
                .then(resultados => {
                    this.paginaActual = 1;
                    this.datos = resultados
                    if (!this.filaEsVisible(this.peticionSeleccionada)) {
                        this.peticionSeleccionada = null;
                    }
                });
        }
    }

    /**
     * Pide al API las peticiones correspondientes a una página determinada.
     * @param orden
     */
    actualizarPagina(orden, forzarActualizacion) {
        this.datos = null;
        return this.peticionesService.obtenerTodos(this.paginaActual, orden, undefined, forzarActualizacion)
            .then(peticiones => {
                this.datos = peticiones;

                if (!this.filaEsVisible(this.peticionSeleccionada)) {
                    this.peticionSeleccionada = null;
                }
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
     * Pide al API todas las páginas necesarias para tener el total de peticiones que se van a exportar a un documento
     * Excel. Esta exportación respeta el ordenamiento activo y cualquier filtro seleccionado.
     */
    obtenerDatosAExportar() {
        let totalPaginas = Math.ceil(this.peticionesService.peticiones.length / this.ITEMS_POR_PAGINA_EXCEL);
        let promesasObtencion = [];
        for (let i=1; i <= totalPaginas; i++) {
            promesasObtencion.push(this.peticionesService.obtenerTodos(i, undefined, undefined, this.ITEMS_POR_PAGINA_EXCEL));
        }
        return this.$q.all(promesasObtencion)
            .then(resultado => {
                return concat([], ...resultado);
            });
    }

    get historialAutorizaciones() {
        if (!isNil(this.peticionSeleccionada)) {
            return this.peticionSeleccionada.autorizaciones;
        }
        return [];
    }
}