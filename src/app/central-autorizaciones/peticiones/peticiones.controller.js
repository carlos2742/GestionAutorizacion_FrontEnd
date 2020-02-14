import isNil from 'lodash/isNil';
import find from 'lodash/find';
import findIndex from 'lodash/findIndex';
import forEach from 'lodash/forEach';
import clone from 'lodash/clone';
import cloneDeep from 'lodash/cloneDeep';
import map from 'lodash/map';
import isMatch from 'lodash/isMatch';
import filter from 'lodash/filter';
import includes from 'lodash/includes';
import get from 'lodash/get';
import reduce from 'lodash/reduce';
import format from 'date-fns/format';
import differenceBy from 'lodash/differenceBy';

import './peticiones.scss';
import {
    AUTORIZACION_ANULADA,
    AUTORIZACION_APROBADA,
    AUTORIZACION_PENDIENTE, AUTORIZACION_RECHAZADA,
    ETIQUETA_ANULADO,
    ETIQUETA_NOK, ETIQUETA_NOK_DESC, ETIQUETA_OK_DESC,
    ETIQUETA_PENDIENTE,
    PROPIEDAD_NO_EDITABLE,
    TEXTO_CAMBIOS_GUARDADOS
} from "../../common/constantes";
import {procesarFechaAEnviar} from "../../common/utiles";

/* @ngInject */
/**
 * Esta clase representa un controlador de Angular usado en la vista de la lista de peticiones activas asociadas a un autorizador.
 */
export default class PeticionesController {

    /**
     * @param $rootScope
     * @param $scope
     * @param $q
     * @param $timeout
     * @param $location
     * @param $uibModal
     * @param toastr
     * @param {PeticionesService} PeticionesService
     * @param {AdjuntosService} AdjuntosService
     * @param {MensajesService} MensajesService
     * @param {AplicacionesService} AplicacionesService
     * @param {RolesService} RolesService
     * @param EtiquetasService
     * @param {PersonalService} PersonalService
     * @param SesionService
     * @param AppConfig
     * @param autorizador
     **/
    constructor($rootScope, $scope, $q, $timeout, $location, $uibModal, toastr, PeticionesService, AdjuntosService, MensajesService,
                AplicacionesService, RolesService, EtiquetasService, PersonalService, SesionService, AppConfig, autorizador) {
        /** @type {number} */
        this.ITEMS_POR_PAGINA = AppConfig.elementosPorPagina;
        /** @private */
        this.ITEMS_POR_PAGINA_EXCEL = AppConfig.elementosPorPaginaParaExcel;
        /** @private */
        this.ITEMS_SELECT = AppConfig.elementosBusquedaSelect;

        /** @type {string} */
        this.ETIQUETA_PENDIENTE = ETIQUETA_PENDIENTE;
        /** @type {string} */
        this.ETIQUETA_OK_DESC = ETIQUETA_OK_DESC;
        /** @type {string} */
        this.ETIQUETA_NOK_DESC = ETIQUETA_NOK_DESC;
        /** @type {string} */
        this.ETIQUETA_ANULADO = ETIQUETA_ANULADO;

        /** @type {string} */
        this.AUTORIZACION_PENDIENTE = AUTORIZACION_PENDIENTE;
        /** @type {string} */
        this.AUTORIZACION_APROBADA = AUTORIZACION_APROBADA;
        /** @type {string} */
        this.AUTORIZACION_RECHAZADA = AUTORIZACION_RECHAZADA;
        /** @type {string} */
        this.AUTORIZACION_ANULADA = AUTORIZACION_ANULADA;

        this.popupFechaInicialAbierto = false;
        this.popupFechaFinalAbierto = false;

        /** @type {boolean} */
        this.busquedaVisible = true;
        /** @private */
        this.busquedaActiva = false;
        /** @type {Object} */
        this.paramsBusqueda = {
            pendiente: true
        };
        /** @private */
        this.paramsAnteriores = {};
        /** @private */
        this.ultimaBusquedaPersonas = null;

        /** @type {boolean} */
        this.procesando = false;

        /** @type {boolean} */
        this.mostrarSoloLectura = true;

        /** @type {boolean} */
        this.autorizador = autorizador;

        /** @private */
        this.$rootScope = $rootScope;
        /** @private */
        this.$scope = $scope;
        /** @private */
        this.AppConfig = AppConfig;
        /** @private */
        this.$q = $q;
        /** @private */
        this.$timeout = $timeout;
        /** @private */
        this.$uibModal = $uibModal;
        /** @private */
        this.toastr = toastr;
        /** @private */
        this.peticionesService = PeticionesService;
        /** @private */
        this.adjuntosService = AdjuntosService;
        /** @private */
        this.mensajesService = MensajesService;
        /** @private */
        this.personalService = PersonalService;

        /** @private */
        this.totalRoles = 0;
        /** @private */
        this.totalPersonas = 0;
        /** @type {Persona[]} */
        this.personas = [];
        /** @type {boolean} */
        this.obteniendoPersonas = false;
        /** @private */
        this.actualizacionEnProgreso = false;

        this.aprobarPeticiones = () => {
            this._cambiarEstado(this.peticionesSeleccionadas, 'aprobar');
        };
        this.rechazarPeticiones = () => {
            this._cambiarEstado(this.peticionesSeleccionadas, 'rechazar');
        };

        /** @type {number} */
        this.paginaActual = 1;
        if ($location.search().solicitante) {
            this.paramsBusqueda.solicitante = { codigo: $location.search().solicitante };
            this.personalService.obtener($location.search().solicitante)
                .then(persona => {
                    this.paramsBusqueda.solicitante = persona;
                });
        }
        this.buscar(['fecha.valor', 'asc'], true);

        this.presentacion = {
            entidad: 'Petición',
            atributoPrincipal: 'nombre',
            ordenInicial: ['fecha.valor', 'asc'],
            columnas: [
                {nombre: 'id', display: 'Código', ordenable: true},
                {nombre: 'fechaNecesaria.display', display: 'Fecha Necesaria', ordenable: 'fecha.valor'},
                {nombre: 'solicitante.display', display: 'Solicitante', ordenable: 'solicitante'},
                {nombre: 'tipoSolicitud1', display: 'Tipo Solicitud 1', ordenable: true, ancho: '135px'},
                {nombre: 'tipoSolicitud2', display: 'Tipo Solicitud 2', ordenable: true, ancho: '135px'},
                {nombre: 'proceso.display', display: 'Proceso', ordenable: 'proceso'},
                {nombre: 'displayOrden', display: 'Autorizaciones Completadas', ordenable: false},
                {nombre: 'estado.display', display: 'Etiqueta', ordenable: false},
                {nombre: 'accionMensajes', display: 'Chat', html: true, ancho: '40px', ordenable: 'fechaUltimoMensaje.valor'},
                {nombre: 'accionAdjuntos', display: '', html: true, ancho: '40px'},
                {nombre: 'enlaceDetalles', display: '', html: true, ancho: '40px'}
            ]
        };
        if (this.autorizador) {
            this.presentacion.columnas.unshift(
                {nombre: 'checkbox', display: '', html: true, ancho: '40px'}
            );
            this.presentacion.columnas.splice(9, 0,
                {nombre: 'observacionesInput', display: 'Comentarios Internos', ancho: '300px', html: true},
                {nombre: 'accionAprobar', display: '', html: true, ancho: '40px'},
                {nombre: 'accionRechazar', display: '', html: true, ancho: '40px'},
            );
        }

        this.presentacionHistorialAutorizaciones = {
            entidad: 'Autorización',
            atributoPrincipal: 'autorizador.display',
            ordenInicial: ['fecha.valor', 'asc'],
            columnas: [
                {nombre: 'fecha.display', display: 'Fecha', ordenable: false},
                {nombre: 'displayOrden', display: 'Autorización', ordenable: false},
                {nombre: 'autorizador.display', display: 'Autorizador', ordenable: false},
                {nombre: 'estado.display', display: 'Etiqueta', ordenable: false}
            ]
        };
        this.columnasExcel = {
            titulos: ['Código', 'Fecha Necesaria', 'Solicitante', 'Tipo Solicitud 1', 'Tipo Solicitud 2', 'Proceso', 'Autorizaciones Completadas', 'Etiqueta'],
            campos: ['id', 'fechaNecesaria.display', 'solicitante.display', 'tipoSolicitud1', 'tipoSolicitud2', 'proceso.display', 'displayOrden', 'estado.display']
        };
        if (this.autorizador) {
            this.columnasExcel.titulos.push('Comentarios Internos');
            this.columnasExcel.campos.push('observaciones');
        }

        /** @type {Peticion} */
        this.peticionSeleccionada = null;
        this.solicitantePeticionSeleccionada = null;

        AplicacionesService.obtenerTodos(false)
            .then(aplicaciones => {
                /** @type {Aplicacion[]} */
                this.aplicaciones = aplicaciones;
            });

        RolesService.obtenerTodos(false)
            .then(roles => {
                /** @type {Rol[]} */
                this.roles = [].concat(roles);
                this.roles.push({id:undefined, nombre: undefined});
            });

        PeticionesService.obtenerTiposSolicitud()
            .then(tiposSolicitud => {
                this.tiposSolicitud = [].concat(tiposSolicitud);
                this.tiposSolicitud.push({nombre: undefined});
            });

        SesionService.obtenerUsuarioAutenticado()
            .then(usuario => {
               this.usuarioEsGestor = usuario.esGestor;
            });

        const deregisterFn = $scope.$on('$destroy', () => {
            this.peticionesService.reiniciarEstado();
            deregisterFn();
        });

    }

    toggleSelectorFecha(nombre) {
        this[`popupFecha${nombre}Abierto`] = !this[`popupFecha${nombre}Abierto`];
    }

    /**
     * Añade una propiedad a cada petición que permite seleccionar la fila.
     *
     * @param {Peticion} entidad
     * @return {Peticion}  La misma petición, con las propiedades mencionadas
     * @private
     */
    _procesarEntidadVisualizacion(entidad, idsSeleccionados) {
        let clon = clone(entidad);

        clon.seleccionada = includes(idsSeleccionados, clon.id) && entidad.estadoInterno === AUTORIZACION_PENDIENTE;
        clon.accionAdjuntos =  `<a href ng-click="$ctrl.fnAccion({entidad: elemento, accion: 'adjuntos'})"
                                   class="icon-attachment" uib-tooltip="Adjuntos">
                                </a><small class="ml-1 ${entidad.cantidadAdjuntos > 0 ? 'font-weight-bold' : 'text-muted'}">(${entidad.cantidadAdjuntos})</small>`;
        clon.accionMensajes =  `<div class="d-flex flex-column">
                                    <div>
                                        <a href ng-click="$ctrl.fnAccion({entidad: elemento, accion: 'mensajes'})"
                                            class="icon-bubbles4" uib-tooltip="Conversación">
                                        </a>
                                        <small class="ml-1 ${entidad.cantidadMensajes > 0 ? 'font-weight-bold' : 'text-muted'}">(${entidad.cantidadMensajes})</small>
                                    </div>
                                    <small class="text-muted">${entidad.cantidadMensajes > 0 ? entidad.fechaUltimoMensaje.display : ''}</small>
                                </div>`;

        clon.enlaceDetalles = `<a href target="_blank" class="icon-view-show d-print-none" ng-href="#/peticion/${entidad.id}" uib-tooltip="Ver Detalles"></a>`;

        if (this.autorizador && entidad.estadoInterno === AUTORIZACION_PENDIENTE) {
            clon.checkbox = `<input type="checkbox" class="checkbox-visible" ng-model="elemento.seleccionada" uib-tooltip="Seleccionar">`;
            clon.accionAprobar = `<a href="" ng-click="$ctrl.fnAccion({entidad: elemento, accion: 'aprobar'})" uib-tooltip="Aprobar">
                                <span class="icon-checkmark text-success"></span>
                              </a>`;
            clon.accionRechazar = `<a href="" ng-click="$ctrl.fnAccion({entidad: elemento, accion: 'rechazar'})" uib-tooltip="Rechazar">
                                <span class="icon-cross text-danger"></span>
                               </a>`;

            clon.observacionesInput = `<textarea
                                          name="observaciones"
                                          class="form-control"
                                          rows="3"
                                          ng-model="elemento.observaciones"
                                          ng-model-options="{ updateOn: 'blur' }"
                                          ng-change="$ctrl.fnAccion({entidad: elemento, accion: 'actualizar'})"></textarea>`;
        } else {
            clon.checkbox = '';
            clon.accionAprobar = '';
            clon.accionRechazar = '';
            clon.observacionesInput = `<textarea 
                                            rows="3" 
                                            class="form-control"
                                            disabled
                                            style="width: 100%;">${!isNil(entidad.observaciones) ? entidad.observaciones : ''}</textarea>`;

        }

        return clon;
    }

    get datosAExportar() {
        return this.peticionesService.peticiones;
    }

    /**
     * Esta propiedad devuelve el total de peticiones existentes.
     * @return {Number}
     */
    get totalItems() {
        return this.peticionesService.peticiones.length;
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
                    this.personas.push({codigo: undefined, nombreApellidos:''});
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
     * Propiedad que devuelve true si no se está mostrando la lista completa de roles en un momento determinado.
     * @return {boolean}
     */
    get mostrandoResultadosParcialesRoles() {
        return this.totalRoles > this.ITEMS_SELECT + 1;
    }

    /**
     * Filtra la lista de roles según el string que haya escrito el usuario. Es case insensitive.
     * @param {string} busqueda
     * @return {Rol[]}
     */
    filtrarRoles(busqueda) {
        const busquedaLower = busqueda.toLowerCase();
        const resultado = filter(this.roles, (elemento) => {
            return (busqueda && elemento.nombre) ? includes(elemento.nombre.toLowerCase(), busquedaLower) : true;
        });
        this.totalRoles = resultado.length;

        if (resultado.length > this.ITEMS_SELECT + 1) {
            return resultado.slice(0, this.ITEMS_SELECT + 1);
        } else {
            return resultado;
        }
    }

    /**
     * Propiedad que devuelve true si no se está mostrando la lista completa de tipos de solicitud en un momento determinado.
     * @return {boolean}
     */
    get mostrandoResultadosParcialesTiposSolicitud() {
        return this.totalTiposSolicitud > this.ITEMS_SELECT + 1;
    }

    /**
     * Filtra la lista de tipos de solicitud según el string que haya escrito el usuario. Es case insensitive.
     * @param {string} busqueda
     * @return {Proceso[]}
     */
    filtrarTiposSolicitud(busqueda) {
        const busquedaLower = busqueda.toLowerCase();
        const resultado = filter(this.tiposSolicitud, (elemento) => {
            return (busqueda && elemento.nombre) ? includes(elemento.nombre.toLowerCase(), busquedaLower) : true;
        });
        this.totalTiposSolicitud = resultado.length;

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
        this.paramsAnteriores = {};
        this.buscar();
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

    _generarStringEstados() {
        let resultado = '';

        forEach([['pendiente', AUTORIZACION_PENDIENTE], ['aprobada', AUTORIZACION_APROBADA], ['rechazada', AUTORIZACION_RECHAZADA], ['anulada', AUTORIZACION_ANULADA]], item => {
            if (this.paramsBusqueda[item[0]]) {
                resultado += `${resultado ? '_' : ''}${item[1]}`;
            }
        });

        if (!resultado) {
            return undefined;
        }

        return resultado;
    }

    /**
     * Pide al API todas las peticiones que cumplan con los parámetros de búsqueda seleccionados por el usuario.
     */
    buscar(orden) {
        // Si justo antes ya se había mandado a hacer una búsqueda exactamente igual, no se hace nada. Comprobando esto se
        // ahorran llamadas innecesarias al API.
        if (!isMatch(this.paramsAnteriores, this.paramsBusqueda)) {
            let filtroBusqueda = {
                idPeticion:  get(this.paramsBusqueda, 'idPeticion'),
                idAplicacion: get(this.paramsBusqueda, 'aplicacion.id'),
                idRol: get(this.paramsBusqueda, 'rol.id'),
                nInternoSolicitante: get(this.paramsBusqueda, 'solicitante.codigo'),
                estadosInternos: this._generarStringEstados(),
                tipoSolicitud: get(this.paramsBusqueda, 'tipoSolicitud.nombre'),
                fechaInicial: get(this.paramsBusqueda, 'fechaInicial') ? procesarFechaAEnviar(this.paramsBusqueda.fechaInicial) : undefined,
                fechaFinal: get(this.paramsBusqueda, 'fechaFinal') ? procesarFechaAEnviar(this.paramsBusqueda.fechaFinal) : undefined
            };

            this.paramsAnteriores = cloneDeep(this.paramsBusqueda);

            if (this.totalItems > this.ITEMS_POR_PAGINA) {
                this.seleccionarTodos = false;
                this.cambiarSeleccion();
            }

            this.busquedaActiva = true;
            this.actualizacionEnProgreso = true;
            const idsSeleccionados = map(this.peticionesSeleccionadas, peticion => { return peticion.id });
            this.datos = null;
            this.peticionesService.obtenerTodos(!this.autorizador, 1, orden, filtroBusqueda)
                .then(resultados => {
                    this.paginaActual = 1;
                    this.datos = map(resultados, peticion => {
                        return this._procesarEntidadVisualizacion(peticion, idsSeleccionados);
                    });
                    Object.defineProperty(this.datos, 'yaOrdenados', {
                        enumerable: false,
                        get: () => { return true; }
                    });

                    if (!this.filaEsVisible(this.peticionSeleccionada)) {
                        this.peticionSeleccionada = null;
                    }
                    this.mostrarSoloLectura = !this.autorizador || filtroBusqueda.estadoInterno !== AUTORIZACION_PENDIENTE;
                })
                .finally(() => {
                    this.$timeout(() => {
                       this.actualizacionEnProgreso = false;
                    }, 500);
                });
        }
    }

    /**
     * Reinicia todos los parámetros de búsqueda y obtiene todas las peticiones.
     *
     * @param busquedaForm      -  Formulario de los parámetros de búsqueda
     */
    mostrarTodos(busquedaForm) {
        this.paramsBusqueda = {
            pendiente: true
        };
        busquedaForm.$setPristine();
        busquedaForm.$setUntouched();

        // Si justo antes ya se había mandado a mostrar todos los resultados, no se hace nada. Comprobando esto se
        // ahorran llamadas innecesarias al API.
        if (Object.getOwnPropertyNames(this.paramsAnteriores).length > 1 || !this.paramsAnteriores.pendiente) {
            this.paramsAnteriores = {
                pendiente: true
            };

            if (this.totalItems > this.ITEMS_POR_PAGINA) {
                this.seleccionarTodos = false;
                this.cambiarSeleccion();
            }

            this.actualizacionEnProgreso = true;
            const idsSeleccionados = map(this.peticionesSeleccionadas, peticion => { return peticion.id });
            this.datos = null;
            this.peticionesService.obtenerTodos(!this.autorizador, 1, null, { estadosInternos: AUTORIZACION_PENDIENTE })
                .then(resultados => {
                    this.paginaActual = 1;
                    this.datos = map(resultados, peticion => {
                        return this._procesarEntidadVisualizacion(peticion, idsSeleccionados);
                    });
                    Object.defineProperty(this.datos, 'yaOrdenados', {
                        enumerable: false,
                        get: () => { return true; }
                    });

                    if (!this.filaEsVisible(this.peticionSeleccionada)) {
                        this.peticionSeleccionada = null;
                    }

                    this.mostrarSoloLectura = !this.autorizador;
                })
                .finally(() => {
                    this.$timeout(() => {
                        this.actualizacionEnProgreso = false;
                    }, 500);
                });
        }
    }

    /**
     * Pide al API las peticiones correspondientes a una página determinada.
     * @param orden
     */
    actualizarPagina(orden, forzarActualizacion) {
        if (this.actualizacionEnProgreso) {
            return;
        }

        if (this.totalItems > this.ITEMS_POR_PAGINA || forzarActualizacion) {
            this.seleccionarTodos = false;
            this.cambiarSeleccion();
        }

        const idsSeleccionados = map(this.peticionesSeleccionadas, peticion => { return peticion.id });
        this.datos = null;
        this.procesando = true;
        return this.peticionesService.obtenerTodos(!this.autorizador, this.paginaActual, orden)
            .then(peticiones => {
                this.datos = map(peticiones, peticion => {
                    return this._procesarEntidadVisualizacion(peticion, idsSeleccionados);
                });
                Object.defineProperty(this.datos, 'yaOrdenados', {
                    enumerable: false,
                    get: () => { return true; }
                });

                if (!this.filaEsVisible(this.peticionSeleccionada)) {
                    this.peticionSeleccionada = null;
                }

                this.mostrarSoloLectura = !this.autorizador || this.paramsBusqueda.estadoInterno !== AUTORIZACION_PENDIENTE;
            })
            .catch(() => {
                this.datos = [];
            })
            .finally(() => {
                this.procesando = false;
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
        let promesasObtencion = [];
        let pagina = this.datosObtenidos.activarRango ? this.datosObtenidos.rangoPagina : 1;
        let elementosPorPagina = this.ITEMS_POR_PAGINA_EXCEL * 200;
        promesasObtencion.push(this.peticionesService.obtenerTodos(!this.autorizador, pagina, undefined, { elementosExportar: elementosPorPagina }, this.ITEMS_POR_PAGINA_EXCEL, false, undefined)
            .then(resultado => {
                this.datosObtenidos.total = resultado.length;
                    return resultado;
            })
        );
        return this.$q.all(promesasObtencion)
            .then(resultado => {
                this.$rootScope.$emit('GestionAutorizacionAPI:response');
                return reduce(resultado, (arregloResultados, item) => {
                    arregloResultados = arregloResultados.concat(item);
                    return arregloResultados;
                }, []);
            })
            .catch(error => {
                this.$rootScope.$emit('GestionAutorizacionAPI:responseError');
                throw error;
            });
    }

    get historialAutorizaciones() {
        if (!isNil(this.peticionSeleccionada)) {
            return this.peticionSeleccionada.actividades;
        }
        return [];
    }

    cambiarSeleccion() {
        if (this.seleccionarTodos) {
            this.datos = map(this.datos, peticion => {
                peticion.seleccionada = peticion.estadoInterno === AUTORIZACION_PENDIENTE;
                return peticion;
            });
        } else {
            this.datos = map(this.datos, peticion => {
                peticion.seleccionada = false;
                return peticion;
            })
        }
        Object.defineProperty(this.datos, 'yaOrdenados', {
            enumerable: false,
            get: () => { return true; }
        });
    }

    manejarAccion(entidad, accion) {
        if (accion === 'aprobar' || accion === 'rechazar') {
            return this._cambiarEstado([entidad], accion);
        } else if (accion === 'adjuntos') {
            return this.mostrarPopupAdjuntos(entidad);
        } else if (accion === 'mensajes') {
            return this.mostrarPopupMensajes(entidad);
        } else if (accion === 'actualizar') {
            return this.guardarCambiosObservaciones(entidad);
        }
    }

     _cambiarEstado(peticiones, accion) {
        return this.$q((resolve, reject) => {
            const contenedor = angular.element(document.getElementById("modalConfirmacionAutorizacion"));
            const modal = this.$uibModal.open({
                templateUrl: 'modalConfirmacionAutorizacion.html',
                appendTo: contenedor,
                size: 'dialog-centered',    // hack para que el modal salga centrado verticalmente
                controller: ($scope) => {
                    'ngInject';

                    $scope.peticiones = peticiones;
                    $scope.accion = accion;
                    $scope.usuarioEsGestor = this.usuarioEsGestor;
                    $scope.estado = {};

                    $scope.actualizarPeticion = () => {
                        this.seleccionarTodos = false;
                        this.cambiarSeleccion();

                        const fnActualizarTabla = (datos, peticionesConError) => {
                            const idsSeleccionados = map(this.peticionesSeleccionadas, peticion => { return peticion.id });
                            this.datos = map(datos, peticion => {
                                return this._procesarEntidadVisualizacion(peticion, idsSeleccionados);
                            });
                            Object.defineProperty(this.datos, 'yaOrdenados', {
                                enumerable: false,
                                get: () => { return true; }
                            });

                            if (!this.filaEsVisible(this.peticionSeleccionada)) {
                                this.peticionSeleccionada = null;
                            } else {
                                this.peticionSeleccionada = find(this.datos, ['id', this.peticionSeleccionada.id]);
                            }

                            const listaPeticionesTodaviaVisibles = reduce(peticiones, (resultado, peticion) => {
                                const indiceCorrespondiente = findIndex(this.datos, ['id', peticion.id]);
                                if (indiceCorrespondiente > -1) {
                                    const indiceError = findIndex(peticionesConError, ['id', peticion.id]);
                                    if (this.datos[indiceCorrespondiente].estadoInterno === AUTORIZACION_PENDIENTE && indiceError < 0) {
                                        resultado += `<li>
                                                        <strong>${peticion.id}</strong>
                                                      </li>`;
                                    }
                                }
                                return resultado;
                            }, '');
                            if (listaPeticionesTodaviaVisibles !== '') {
                                const mensaje = `Las siguientes peticiones requieren de otras aprobaciones:
                                         <ul>${listaPeticionesTodaviaVisibles}</ul>`;
                                this.toastr.info(mensaje, null, {
                                    allowHtml: true,
                                    closeButton: true,
                                    tapToDismiss: false,
                                    timeOut: 0,
                                    extendedTimeOut: 0,
                                    iconClass: 'toast-info alerta-peticiones'
                                });
                            }

                            this.$timeout(() => {
                                this.actualizacionEnProgreso = false;
                            }, 500);
                        };

                        let promesa;
                        if (accion === 'aprobar') {
                            promesa = this.peticionesService.aprobar(peticiones, this.paginaActual);
                        } else if (accion === 'rechazar') {
                            promesa = this.peticionesService.rechazar(peticiones, this.paginaActual);
                        }

                        this.actualizacionEnProgreso = true;
                        return promesa.then(resultado => {
                            let message = '';
                            if (peticiones.length === 1) {
                                message = accion === 'aprobar' ? 'Se aprobó la petición' : 'Se rechazó la petición';
                            } else {
                                message = accion === 'aprobar' ? 'Se aprobaron las peticiones' : 'Se rechazaron las peticiones';
                            }
                            this.toastr.success(message);

                            this.paginaActual = resultado.pagina;
                            fnActualizarTabla(resultado.peticiones, []);
                            resolve();
                        }).catch(error => {
                            resolve();

                            if (!isNil(error.peticionesConError) && error.peticionesConError.length > 0) {
                                // Se quitan de la tabla las que se pudieron actualizar bien
                                this.datos = differenceBy(this.datos, error.peticionesExitosas, 'id');
                                Object.defineProperty(this.datos, 'yaOrdenados', {
                                    enumerable: false,
                                    get: () => { return true; }
                                });

                                let listaErrores = reduce(error.peticionesConError, (resultado, peticion) => {
                                    resultado += `<li>
                                            <strong>${peticion.id}:</strong> ${peticion.message}
                                          </li>`;
                                    return resultado;
                                }, '');
                                const mensaje = `Las peticiones con los siguientes códigos no se pudieron ${accion}:
                                         <ul>${listaErrores}</ul>`;
                                this.toastr.warning(mensaje, null, {
                                    allowHtml: true,
                                    closeButton: true,
                                    tapToDismiss: false,
                                    timeOut: 0,
                                    extendedTimeOut: 0,
                                    iconClass: 'toast-warning alerta-peticiones',
                                    onHidden: () => {
                                        this.paginaActual = error.pagina;
                                        fnActualizarTabla(error.peticiones, error.peticionesConError);
                                    }
                                });
                            } else {
                                this.actualizacionEnProgreso = false;
                            }
                        }).finally(() => {
                            $scope.$close();
                        });
                    };
                }
            });

            modal.result.catch(() => {
                reject();
            });
        });
    }

    get peticionesSeleccionadas() {
        return filter(this.datos, 'seleccionada');
    }

    guardarCambiosObservaciones(entidad) {
        this.actualizacionEnProgreso = true;
        return this.peticionesService.editar(entidad)
            .then(() => {
                this.toastr.info(TEXTO_CAMBIOS_GUARDADOS, {
                    allowHtml: true,
                    iconClass: 'toast-info alerta-guardar'
                });
                this.actualizacionEnProgreso = false;
            })
            .catch(response => {
                if (response) {
                    let actualizar = false;

                    if (response.status === 401) {
                        actualizar = true;
                        this.peticionSeleccionada = null;
                        this.toastr.error('Lo sentimos, ya no tiene permiso para modificar esta petición.');
                    } else if (response.status === 404) {
                        actualizar = true;
                        this.peticionSeleccionada = null;
                    } else if (get(response, 'error.errorCode') === PROPIEDAD_NO_EDITABLE) {
                        actualizar = true;
                        this.toastr.error('Lo sentimos, no se pudieron guardar los cambios porque la petición estaba desactualizada. Por favor, inténtelo de nuevo.');
                    }

                    if (actualizar) {
                        const fin = this.paginaActual * this.ITEMS_POR_PAGINA;
                        const inicio = fin - this.ITEMS_POR_PAGINA;
                        let forzarActualizacion = false;

                        // Si es la última página y ya no tiene elementos, hay que cambiar de página
                        if (this.paginaActual > 1 && inicio >= this.peticionesService.peticiones.length) {
                            this.paginaActual -= 1;
                            forzarActualizacion = true;
                        }

                        this.actualizacionEnProgreso = false;
                        this.actualizarPagina(undefined, forzarActualizacion)
                            .then(() => {
                                if (get(response, 'error.errorCode') === PROPIEDAD_NO_EDITABLE) {
                                    this.peticionSeleccionada = find(this.datos, ['id', this.peticionSeleccionada.id]);
                                }
                            });
                    } else {
                        this.actualizacionEnProgreso = false;
                    }
                }
            });
    }

    /**
     * Muestra el modal que contiene la lista de adjuntos vinculados a una petición determinada.
     * @param {Peticion} entidad
     */
    mostrarPopupAdjuntos(entidad) {
        const contenedor = angular.element(document.getElementById("modalAdjuntosPeticion"));
        this.adjuntosService.mostrar(entidad, { contenedor, modoEdicion: true, modoAutorizador: this.autorizador })
            .then(resultado => {
                if (!isNil(resultado.adjuntos)) {
                    entidad.adjuntos = resultado.adjuntos;
                    entidad.cantidadAdjuntos = resultado.adjuntos.length;

                    if (resultado.mensajes.length > 0) {
                        entidad.fechaUltimoMensaje = {
                            valor: resultado.mensajes[0].fechaEnvio.valor,
                            display: format(resultado.mensajes[0].fechaEnvio.valor, `${this.AppConfig.formatoFechas} HH:mm:ss`)
                        };
                    }

                    const indiceEntidadCambiada = findIndex(this.datos, ['codigo', entidad.codigo]);
                    if (indiceEntidadCambiada > -1) {
                        const idsSeleccionados = map(this.peticionesSeleccionadas, peticion => { return peticion.id; });
                        this.datos[indiceEntidadCambiada] = this._procesarEntidadVisualizacion(entidad, idsSeleccionados);
                        this.datos = clone(this.datos);
                        Object.defineProperty(this.datos, 'yaOrdenados', {
                            enumerable: false,
                            get: () => { return true; }
                        });
                    }
                } else {
                    this.actualizarPagina();
                }
            });
    }

    /**
     * Muestra el modal que contiene la lista de mensajes vinculados a una petición determinada.
     * @param {Peticion} entidad
     */
    mostrarPopupMensajes(entidad) {
        const contenedor = angular.element(document.getElementById("modalMensajesPeticion"));
        this.mensajesService.mostrar(entidad, { contenedor })
            .then(mensajes => {
                // Si no se devuelve la lista de mensajes cuando se cierra el modal, es porque se produjo algún error
                // y es necesario actualizar la lista de peticiones.
                if (isNil(mensajes)) {
                    this.actualizarPagina();
                } else {
                    entidad.cantidadMensajes = mensajes.length;
                    if (mensajes.length > 0) {
                        const ultimoMensaje = mensajes[mensajes.length - 1];
                        entidad.fechaUltimoMensaje = {
                            valor: ultimoMensaje.fechaEnvio.valor,
                            display: format(ultimoMensaje.fechaEnvio.valor, `${this.AppConfig.formatoFechas} HH:mm:ss`)
                        };
                    }
                    const indiceEntidadCambiada = findIndex(this.datos, ['codigo', entidad.codigo]);
                    if (indiceEntidadCambiada > -1) {
                        const idsSeleccionados = map(this.peticionesSeleccionadas, peticion => { return peticion.id; });
                        this.datos[indiceEntidadCambiada] = this._procesarEntidadVisualizacion(entidad, idsSeleccionados);
                        this.datos = clone(this.datos);
                        Object.defineProperty(this.datos, 'yaOrdenados', {
                            enumerable: false,
                            get: () => { return true; }
                        });
                    }
                }
            });
    }

    obtenerSolicitantePeticionRelacionada(peticionAnulacion) {
        const path = peticionAnulacion ? 'peticionAnulacion' : 'peticionQueAnula';

        const idSolicitante = get(this.peticionSeleccionada, `${path}.solicitante`);
        if (!isNil(idSolicitante)) {
            if (idSolicitante === this.peticionSeleccionada.solicitante.valor.nInterno) {
                return this.peticionSeleccionada.solicitante.display;
            } else if (idSolicitante === get(this.solicitantePeticionSeleccionada, 'nInterno')) {
                return this.solicitantePeticionSeleccionada.nombreApellidos;
            } else if (!this.obteniendoSolicitante) {
                this.obteniendoSolicitante = true;
                this.personalService.obtener( get(this.peticionSeleccionada, `${path}.solicitante`) )
                    .then(persona => {
                        this.solicitantePeticionSeleccionada = persona;
                        return persona.nombreApellidos;
                    })
                    .finally(() => {
                        this.obteniendoSolicitante = false;
                    });
            }
        }

    }
}