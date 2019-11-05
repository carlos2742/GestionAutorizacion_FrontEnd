import map from 'lodash/map';
import clone from 'lodash/clone';
import isMatch from 'lodash/isMatch';
import isNil from 'lodash/isNil';
import reduce from 'lodash/reduce';

import {USUARIO_YA_ES_ADMIN, USUARIO_NO_ES_ADMIN} from "../common/constantes";

import './permisos-admin.scss';

/* @ngInject */
/**
 * Esta clase es un controlador de Angular para la vista de lista de administradores.
 */
export default class PermisosAdminController {

    /**
     * @param $q
     * @param $window
     * @param toastr
     * @param PermisosAdminService
     * @param PersonalService
     * @param SesionService
     * @param AppConfig
     **/
    constructor($q, $window, toastr, PermisosAdminService, PersonalService, SesionService, AppConfig) {
        /** @type {number} */
        this.ITEMS_POR_PAGINA = AppConfig.elementosPorPagina;
        /** @private */
        this.ITEMS_POR_PAGINA_EXCEL = AppConfig.elementosPorPaginaParaExcel;

        /** @private */
        this.$q = $q;
        /** @private */
        this.$window = $window;
        /** @private */
        this.toastr = toastr;
        /** @private */
        this.permisosAdminService = PermisosAdminService;
        /** @private */
        this.personalService = PersonalService;
        /** @private */
        this.sesionService = SesionService;
        /** @type {boolean} */
        this.busquedaVisible = true;
        /** @type {Object} */
        this.paramsBusqueda = {};
        /** @private */
        this.paramsAnteriores = {};
        /** @private */
        this.ordenActivo = ['nInterno', 'asc'];

        /** @type {number} */
        this.paginaActual = 1;
        this.actualizarPagina();

        this.presentacion = {
            entidad: 'Administrador',
            ordenInicial: ['nInterno', 'asc'],
            columnas: [
                {nombre: 'codigo', display: 'ID', ordenable: 'nInterno'},
                {nombre: 'usuarioRed', display: 'Usuario de Red', ordenable: true},
                {nombre: 'nombre', display: 'Nombre', ordenable: true, ancho:'150px'},
                {nombre: 'apellidos', display: 'Apellidos', ordenable: true, ancho:'250px'},
                {nombre: 'adminToggle', display: 'Administrador', html: true, ancho:'50px'},
            ]
        };
        this.columnasExcel = {
            titulos: ['ID', 'Usuario de Red', 'Nombre', 'Apellidos', 'Administrador'],
            campos: ['codigo', 'usuarioRed', 'nombre', 'apellidos', 'esGestor']
        }
    }

    /**
     * Añade una propiedad a cada persona que permite cambiar su condición de administrador.
     *
     * @param {Persona} persona
     * @return {Persona}            -  La misma persona, con un componente añadido para cambiar su rol de administrador.
     * @private
     */
    _procesarPersonaParaVisualizacion(persona) {
        let clon = clone(persona);
        clon.adminToggle = `<toggle ng-model="elemento.esGestor" 
                                        ng-change="$ctrl.fnAccion({entidad: elemento})" on="Si" off="No" 
                                        onstyle="btn-success" offstyle="btn-secondary"></toggle>`;
        return clon;
    }

    /**
     * Le añade o quita el rol de administrador a una persona.
     * @param {Persona} entidad
     */
    cambiarPermisoAdministracion(entidad) {
        this.permisosAdminService.cambiarPermisoAdministracion(entidad)
            .then(() => {
                return this.sesionService.obtenerUsuarioAutenticado();
            })
            .then(usuario => {
                if (!entidad.esGestor) {
                    if (entidad.nInterno === usuario.nInterno) {
                        // Si el usuario autenticado es un administrador y se acaba de quitar permisos de administración a sí
                        // mismo, se debe refrescar la aplicación completa para que ya no pueda acceder al área de administración.
                        this.$window.location.reload();
                    } else if (this.paramsBusqueda.esGestor) {
                        if (this.paginaActual > 1 && this.datos.length === 1) {
                            this.paginaActual--;
                        }
                        this.actualizarPagina();
                    }
                }
            })
            .catch(response => {
                if (response.error.errorCode === USUARIO_YA_ES_ADMIN) {
                    this.toastr.error('Esta persona ya era administrador');
                } else if (response.error.errorCode === USUARIO_NO_ES_ADMIN) {
                    this.toastr.error('Esta persona no era administrador');
                } else {
                    entidad.esGestor = !entidad.esGestor;
                }
            });
    }

    /**
     * Busca las personas que cumplan con los criterios seleccionados, haciendo una llamada al API en caso de que los
     * parámetros de búsqueda hayan cambiado desde la última búsqueda realizada.
     */
    buscar() {
        if (!isNil(this.paramsBusqueda.esGestor) && !this.paramsBusqueda.esGestor) {
            this.paramsBusqueda.esGestor = undefined;
        }

        // No hace nada si los parámetros de búsqueda no han cambiado, para no estar haciendo llamadas innecesarias al API.
        if (!isMatch(this.paramsAnteriores, this.paramsBusqueda)) {
            this.paramsAnteriores = clone(this.paramsBusqueda);
            this.paginaActual = 1;
            this.actualizarPagina();
        }
    }

    /**
     * Quita todos los filtros de búsqueda activos.
     */
    mostrarTodos() {
        this.paramsBusqueda = {};

        // No hace nada si no había ningún filtro de búsqueda activos, para no estar haciendo llamadas innecesarias al API.
        if (Object.getOwnPropertyNames(this.paramsAnteriores).length > 0) {
            this.paramsAnteriores = {};
            this.paginaActual = 1;
            this.actualizarPagina();
        }
    }

    /**
     * Propiedad que devuelva la cantidad total de personas existentes. Se usa para calcular el total de páginas disponibles.
     * @return {Number}
     */
    get totalItems() {
        return this.personalService.personas.length;
    }

    /**
     * Pide al API una página del listado de personas.
     */
    actualizarPagina() {
        this.datos = null;
        this.personalService.obtenerTodos(this.paginaActual, this.ordenActivo, this.paramsBusqueda, this.ITEMS_POR_PAGINA, true)
            .then(personas => {
                this.datos = map(personas, persona => {
                    return this._procesarPersonaParaVisualizacion(persona);
                });
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
        if (orden[0] !== this.ordenActivo[0] || orden[1] !== this.ordenActivo[1]) {
            this.ordenActivo = orden;
            this.paginaActual = 1;
            this.actualizarPagina();
        }
    }

    /**
     * Pide al API todas las páginas necesarias para tener el total de personas que se van a exportar a un documento
     * Excel. Esta exportación respeta el ordenamiento activo y cualquier filtro seleccionado.
     */
    obtenerDatosAExportar() {
        let totalPaginas = Math.ceil(this.personalService.personas.length / this.ITEMS_POR_PAGINA_EXCEL);
        let promesasObtencion = [];

        if (!isNil(this.paramsBusqueda.esGestor) && !this.paramsBusqueda.esGestor) {
            this.paramsBusqueda.esGestor = undefined;
        }

        for (let i=1; i <= totalPaginas; i++) {
            promesasObtencion.push(this.personalService.obtenerTodos(i, this.ordenActivo, this.paramsBusqueda, this.ITEMS_POR_PAGINA_EXCEL, true)
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