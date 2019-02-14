import isNil from 'lodash/isNil';
import includes from 'lodash/includes';
import assign from 'lodash/assign';
import get from 'lodash/get';
import find from 'lodash/find';
import filter from 'lodash/filter';
import {
    ELEMENTO_NO_ENCONTRADO, PROPIEDAD_NO_EDITABLE, TITULO_CAMBIOS_GUARDADOS
} from '../../common/constantes';
import {procesarFechaAEnviar} from '../../common/utiles';

/* @ngInject */
/**
 * Esta clase representa un controlador de Angular que se utiliza en la vista del modal de creación/edición que se usa para
 * las actividades.
 */
export default class ModalEdicionActividadesController {

    /**
     * @param $uibModalInstance
     * @param $scope
     * @param toastr
     * @param ActividadesService
     * @param ProcesosService
     * @param RolesService
     * @param AppConfig
     * @param ErroresValidacionMaestros
     * @param actividad
     * @param paginaActual
     * @param fnDespuesEdicion
     */
    constructor($uibModalInstance, $scope, toastr, ActividadesService, ProcesosService, RolesService, ErroresValidacionMaestros, AppConfig, actividad, paginaActual, fnDespuesEdicion) {

        /** @private */
        this.$uibModalInstance = $uibModalInstance;
        /** @private */
        this.$scope = $scope;
        /** @private */
        this.toastr = toastr;
        /** @private */
        this.actividadesService = ActividadesService;
        /** @private */
        this.ErroresValidacionMaestros = ErroresValidacionMaestros;

        /** @private */
        this.paginaActual = paginaActual;
        /** @private */
        this.fnDespuesEdicion = fnDespuesEdicion;
        /** @private */
        this.ITEMS_SELECT = AppConfig.elementosBusquedaSelect;

        /** @private */
        this.totalProcesos = 0;
        /** @type {Proceso[]} */
        this.procesos = [];

        /** @type {boolean} */
        this.mostrarErrorDuplicado = false;

        this.actividad = actividad;
        if (isNil(this.actividad)) {
            /** @type {boolean} */
            this.modoEdicion = false;
            /** @type {string} */
            this.titulo = 'Nueva Actividad';
            /** @type {string} */
            this.textoBoton = 'Crear';
        } else {
            this.modoEdicion = true;
            this.titulo = 'Actualizar Actividad';
            this.textoBoton = 'Actualizar';

            // Si no se sabe si la actividad ya ha sido usada en alguna petición, o ya se pidió esa información antes
            // y devolvió que todavía no ha sido usada, se verifica de nuevo
            if (!this.actividad.hasOwnProperty('tienePeticiones') || !this.actividad.tienePeticiones) {
                this.actividadesService.obtener(this.actividad.id)
                    .then(resultado => {
                        this.actividad.tienePeticiones = resultado.tienePeticiones;
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
                    const rolCorrespondiente = find(this.roles, ['id', this.actividad.rol.id]);
                    if (isNil(rolCorrespondiente)) {
                        this.roles.push(this.actividad.rol);
                    }
                }
            });
        ProcesosService.obtenerTodos(true)
            .then(procesos => {
                /** @type {Proceso[]} */
                this.procesos = procesos;

                if (this.modoEdicion) {
                    const procesoCorrespondiente = find(this.procesos, ['id', this.actividad.proceso.id]);
                    if (isNil(procesoCorrespondiente)) {
                        this.procesos.push(this.actividad.proceso);
                    }
                }
            });
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
     * Crea o edita una actividad, usando los datos que el usuario insertó en el formulario.
     *
     * @param edicionActividadForm        - Formulario que contiene los datos de la actividad
     */
    editar(edicionActividadForm) {
        if (edicionActividadForm.$invalid) {
            return;
        }

        const fechas = {
            fechaLimite: this.actividad.fechaLimite ? procesarFechaAEnviar(this.actividad.fechaLimite) : null
        };

        let promesa;
        if (!this.modoEdicion) {
            promesa = this.actividadesService.crear(assign({}, this.actividad, fechas), this.paginaActual);
        } else {
            promesa = this.actividadesService.editar(assign({}, this.actividad, fechas), this.paginaActual);
        }

        promesa
            .then(resultado => {
                this.fnDespuesEdicion(resultado);
                this.$uibModalInstance.close();

                if (resultado.pagina > -1) {
                    this.toastr.success(`Actividad "${resultado.actividad.nombre}"`, TITULO_CAMBIOS_GUARDADOS);
                } else {
                    this.toastr.warning(`Se guardaron los cambios de la actividad "${resultado.actividad.nombre}", pero no están visibles en esta página`, null, {
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
                    this.toastr.warning('No se pudo encontrar alguna de las entidades relacionadas con la actividad, por lo que no se guardaron los cambios.');
                } else if (response === this.ErroresValidacionMaestros.YA_EXISTE_ORDEN) {
                    this.mostrarErrorDuplicado = true;
                    cerrarModal = false;
                } else if (get(response, 'error.errorCode') === PROPIEDAD_NO_EDITABLE) {
                    this.toastr.warning('Se realizaron cambios en propiedades de esta actividad que ya no son editables, por lo que no se guardaron los cambios.');
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