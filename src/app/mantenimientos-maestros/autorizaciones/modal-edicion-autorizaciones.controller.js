import isNil from 'lodash/isNil';
import includes from 'lodash/includes';
import assign from 'lodash/assign';
import get from 'lodash/get';
import find from 'lodash/find';
import filter from 'lodash/filter';
import {
    ELEMENTO_NO_ENCONTRADO, ELEMENTO_YA_EXISTE, PROPIEDAD_NO_EDITABLE, TITULO_CAMBIOS_GUARDADOS
} from "../../common/constantes";
import {procesarFechaAEnviar} from "../../common/utiles";

/* @ngInject */
/**
 * Esta clase representa un controlador de Angular que se utiliza en la vista del modal de creación/edición que se usa para
 * las autorizaciones.
 */
export default class ModalEdicionAutorizacionesController {

    /**
     * @param $uibModalInstance
     * @param $scope
     * @param toastr
     * @param AutorizacionesService
     * @param FlujosService
     * @param RolesService
     * @param AppConfig
     * @param ErroresValidacionMaestros
     * @param autorizacion
     * @param paginaActual
     * @param fnDespuesEdicion
     */
    constructor($uibModalInstance, $scope, toastr, AutorizacionesService, FlujosService, RolesService, ErroresValidacionMaestros, AppConfig, autorizacion, paginaActual, fnDespuesEdicion) {

        /** @private */
        this.$uibModalInstance = $uibModalInstance;
        /** @private */
        this.$scope = $scope;
        /** @private */
        this.toastr = toastr;
        /** @private */
        this.autorizacionesService = AutorizacionesService;
        /** @private */
        this.ErroresValidacionMaestros = ErroresValidacionMaestros;

        /** @private */
        this.paginaActual = paginaActual;
        /** @private */
        this.fnDespuesEdicion = fnDespuesEdicion;
        /** @private */
        this.ITEMS_SELECT = AppConfig.elementosBusquedaSelect;

        /** @private */
        this.totalFlujos = 0;
        /** @type {Flujo[]} */
        this.flujos = [];

        /** @type {boolean} */
        this.mostrarErrorDuplicado = false;

        this.autorizacion = autorizacion;
        if (isNil(this.autorizacion)) {
            /** @type {boolean} */
            this.modoEdicion = false;
            /** @type {string} */
            this.titulo = 'Nueva Autorización';
            /** @type {string} */
            this.textoBoton = 'Crear';
        } else {
            this.modoEdicion = true;
            this.titulo = 'Actualizar Autorización';
            this.textoBoton = 'Actualizar';

            // Si no se sabe si la autorización ya ha sido usada en alguna petición, o ya se pidió esa información antes
            // y devolvió que todavía no ha sido usada, se verifica de nuevo
            if (!this.autorizacion.hasOwnProperty('tienePeticiones') || !this.autorizacion.tienePeticiones) {
                this.autorizacionesService.obtener(this.autorizacion.id)
                    .then(resultado => {
                        this.autorizacion.tienePeticiones = resultado.tienePeticiones;
                        /** @type {boolean} */
                        this.edicionRestringida = resultado.tienePeticiones;
                    })
                    .catch(response => {
                        if (response && response.status === 404) {
                            this.fnDespuesEdicion(null);
                            this.$uibModalInstance.close();
                        }
                    });
            } else {
                this.edicionRestringida = true;
            }
        }

        RolesService.obtenerTodos(true)
            .then(roles => {
                /** @type {Rol[]} */
                this.roles = roles;

                if (this.modoEdicion) {
                    const rolCorrespondiente = find(this.roles, ['id', this.autorizacion.rol.id]);
                    if (isNil(rolCorrespondiente)) {
                        this.roles.push(this.autorizacion.rol);
                    }
                }
            });
        FlujosService.obtenerTodos(true)
            .then(flujos => {
                /** @type {Flujo[]} */
                this.flujos = flujos;

                if (this.modoEdicion) {
                    const flujoCorrespondiente = find(this.flujos, ['id', this.autorizacion.flujo.id]);
                    if (isNil(flujoCorrespondiente)) {
                        this.flujos.push(this.autorizacion.flujo);
                    }
                }
            });
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
     * Crea o edita una autorización, usando los datos que el usuario insertó en el formulario.
     *
     * @param edicionAutorizacionForm        - Formulario que contiene los datos de la autorización
     */
    editar(edicionAutorizacionForm) {
        if (edicionAutorizacionForm.$invalid) {
            return;
        }

        const fechas = {
            fechaLimite: this.autorizacion.fechaLimite ? procesarFechaAEnviar(this.autorizacion.fechaLimite) : null
        };

        let promesa;
        if (!this.modoEdicion) {
            promesa = this.autorizacionesService.crear(assign({}, this.autorizacion, fechas), this.paginaActual);
        } else {
            promesa = this.autorizacionesService.editar(assign({}, this.autorizacion, fechas), this.paginaActual);
        }

        promesa
            .then(resultado => {
                this.fnDespuesEdicion(resultado);
                this.$uibModalInstance.close();

                if (resultado.pagina > -1) {
                    this.toastr.success(`Autorización "${resultado.autorizacion.nombre}"`, TITULO_CAMBIOS_GUARDADOS);
                } else {
                    this.toastr.warning(`Se guardaron los cambios de la autorización "${resultado.autorizacion.nombre}", pero no están visibles en esta página`, null, {
                        closeButton: true,
                        timeOut: 0,
                        extendedTimeOut: 0
                    });
                }
            })
            .catch(response => {
                let cerrarModal = true;

                if (response && response.status === 404) {
                    this.fnDespuesEdicion(null);
                } else if (get(response, 'error.errorCode') === ELEMENTO_NO_ENCONTRADO) {
                    this.toastr.warning('No se pudo encontrar alguna de las entidades relacionadas con la autorización, por lo que no se guardaron los cambios.');
                } else if (response === this.ErroresValidacionMaestros.YA_EXISTE_ORDEN) {
                    this.mostrarErrorDuplicado = true;
                    cerrarModal = false;
                } else if (get(response, 'error.errorCode') === PROPIEDAD_NO_EDITABLE) {
                    this.toastr.warning('Se realizaron cambios en propiedades de esta autorización que ya no son editables, por lo que no se guardaron los cambios.');
                }

                if (cerrarModal) {
                    this.$uibModalInstance.close();
                }
            });
    }

    /**
     * Elimina todas las alertas visibles relacionadas con errores de validación
     */
    cerrarAlert() {
        this.mostrarErrorDuplicado = false;
    }

    /**
     * Cierra el modal de edición.
     */
    cancelar() {
        this.$uibModalInstance.close();
    }
}