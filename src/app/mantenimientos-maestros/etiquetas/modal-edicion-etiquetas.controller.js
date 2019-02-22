import isNil from 'lodash/isNil';
import find from 'lodash/find';
import filter from 'lodash/filter';
import includes from 'lodash/includes';
import get from 'lodash/get';
import {
    ELEMENTO_YA_EXISTE,
    ERROR_DE_VALIDACION,
    ETIQUETA_NOK_DESC, ETIQUETA_OK_DESC, ETIQUETA_PENDIENTE,
    TITULO_CAMBIOS_GUARDADOS
} from '../../common/constantes';

/* @ngInject */
/**
 * Esta clase representa un controlador de Angular que se utiliza en la vista del modal de creación/edición que se usa para las
 * etiquetas.
 */
export default class ModalEdicionEtiquetasController {
    /**
     * @param $uibModalInstance
     * @param $scope
     * @param toastr
     * @param {EtiquetasService} EtiquetasService
     * @param {ProcesosService} ProcesosService
     * @param {ActividadesService} ActividadesService
     * @param ErroresValidacionMaestros
     * @param AppConfig
     * @param entidad
     * @param actividades
     */
    constructor($uibModalInstance, $scope, toastr, EtiquetasService, ProcesosService, ActividadesService, ErroresValidacionMaestros,
        AppConfig, entidad, actividades) {

        /** @private */
        this.$uibModalInstance = $uibModalInstance;
        /** @private */
        this.toastr = toastr;
        /** @private */
        this.etiquetasService = EtiquetasService;
        /** @private */
        this.actividadesService = ActividadesService;
        /** @private */
        this.erroresValidacionMaestros = ErroresValidacionMaestros;

        /** @type {boolean} */
        this.mostrarErrorDuplicado = false;
        /** @type {string} */
        this.ETIQUETA_PENDIENTE = ETIQUETA_PENDIENTE;
        /** @type {string} */
        this.ETIQUETA_OK_DESC = ETIQUETA_OK_DESC;
        /** @type {string} */
        this.ETIQUETA_NOK_DESC = ETIQUETA_NOK_DESC;

        /** @private */
        this.ITEMS_SELECT = AppConfig.elementosBusquedaSelect;

        /** @private */
        this.totalProcesos = 0;
        /** @type {Proceso[]} */
        this.procesos = [];

        /** @type {Etiqueta} */
        this.entidad = entidad;

        if (isNil(entidad)) {
            // Nueva entidad
            this.titulo = 'Nueva Etiqueta';
            this.textoBoton = 'Crear';
            this.entidad = {
                descripcionEstado: {}
            };
        } else {
            // Entidad existente
            this.titulo = 'Actualizar Etiqueta';
            this.textoBoton = 'Actualizar';
            this.modoEdicion = true;
        }

        ProcesosService.obtenerTodos(false)
            .then(procesos => {
                /** @type {Proceso[]} */
                this.procesos = procesos;

                if (this.modoEdicion) {
                    const procesoCorrespondiente = find(this.procesos, ['id', this.entidad.proceso.id]);
                    if (isNil(procesoCorrespondiente)) {
                        this.procesos.push(this.entidad.proceso);
                    }
                }
            });

        this.actividadesFiltradas = [];
        this.actividades = actividades;
        if (this.modoEdicion) {
            this._filtrarActividades(this.entidad.proceso);
        }

        const deregisterFn = $scope.$watch('$modal.entidad.descripcionEstado.nombre', (newValue) => {
            if (newValue === ETIQUETA_PENDIENTE) {
                this.entidad.actividad = null;
                this.entidad.descripcionEstado.actividad = null;
            }
        });
        const deregisterProcesoFn = $scope.$watch('$modal.entidad.proceso', (newValue, oldValue) => {
            if (newValue !== oldValue) {
                this._filtrarActividades(newValue);
            }
        });
        $scope.$on('$destroy', () => {
            deregisterFn();
            deregisterProcesoFn();
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

    _filtrarActividades(proceso) {
        if (!isNil(proceso)) {
            this.actividadesFiltradas = filter(this.actividades, ['proceso.valor.id', proceso.id]);
        } else {
            this.actividadesFiltradas = [];
        }

        if (!isNil(this.entidad.actividad)) {
            this.entidad.actividad = find(this.actividadesFiltradas, ['id', this.entidad.actividad.id]);
        }
    }


    /**
     * Crea o edita una entidad, usando los datos que el usuario insertó en el formulario.
     *
     * @param edicionEntidadForm        - Formulario que contiene los datos de la entidad
     */
    editar(edicionEntidadForm) {
        if (edicionEntidadForm.$invalid) {
            return;
        }

        let promesa;
        if (!this.modoEdicion) {
            promesa = this.etiquetasService.crear(this.entidad);
        } else {
            promesa = this.etiquetasService.editar(this.entidad);
        }
        promesa
            .then(resultado => {
                this.$uibModalInstance.close(resultado);
                this.toastr.success(`Etiqueta "${resultado.descripcion}"`, TITULO_CAMBIOS_GUARDADOS);
            })
            .catch(error => {
                if (error && error.status === 404) {
                    this.$uibModalInstance.close({ codigo: null });
                } else if (error === this.erroresValidacionMaestros.ELEMENTO_DUPLICADO) {
                    this.mostrarErrorDuplicado = true;
                } else {
                    let msg;
                    if (get(error, 'error.errorCode') === ELEMENTO_YA_EXISTE) {
                        msg = 'No se pudo guardar este elemento en la base de datos porque ya existe otro igual';
                    } else if (get(error, 'error.errorCode') === ERROR_DE_VALIDACION) {
                        msg = error.error.message;

                        // Se resetean las actividades para que se vuelvan a pedir
                        this.actividadesService.actividades = [];
                    }

                    if (!isNil(msg)) {
                        // Se vuelven a pedir todas las etiquetas, porque hubo un problema de sincronización
                        this.etiquetasService.etiquetas = [];
                        this.etiquetasService.obtenerTodos()
                            .then(() => {
                                this.toastr.warning(msg);
                                this.$uibModalInstance.close();
                            });
                    } else {
                        this.$uibModalInstance.close();
                    }
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