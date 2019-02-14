import isNil from 'lodash/isNil';
import find from 'lodash/find';
import {
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
     * @param {AplicacionesService} AplicacionesService
     * @param ErroresValidacionMaestros
     * @param entidad
     */
    constructor($uibModalInstance, $scope, toastr, EtiquetasService, AplicacionesService, ErroresValidacionMaestros, entidad) {

        /** @private */
        this.$uibModalInstance = $uibModalInstance;
        /** @private */
        this.toastr = toastr;
        /** @private */
        this.etiquetasService = EtiquetasService;
        /** @private */
        this.erroresValidacionMaestros = ErroresValidacionMaestros;

        /** @type {boolean} */
        this.mostrarErrorDuplicado = false;
        /** @type {boolean} */
        this.desactivarActividad = false;
        /** @type {string} */
        this.ETIQUETA_PENDIENTE = ETIQUETA_PENDIENTE;
        /** @type {string} */
        this.ETIQUETA_OK_DESC = ETIQUETA_OK_DESC;
        /** @type {string} */
        this.ETIQUETA_NOK_DESC = ETIQUETA_NOK_DESC;

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

        AplicacionesService.obtenerTodos(true)
            .then(aplicaciones => {
                /** @type {Aplicacion[]} */
                this.aplicaciones = aplicaciones;

                if (this.modoEdicion) {
                    const aplicacionCorrespondiente = find(this.aplicaciones, ['id', this.entidad.aplicacion.id]);
                    if (isNil(aplicacionCorrespondiente)) {
                        this.aplicaciones.push(this.entidad.aplicacion);
                    }
                }
            });

        const deregisterFn = $scope.$watch('$modal.entidad.descripcionEstado.nombre', (newValue) => {
            if (newValue === ETIQUETA_PENDIENTE) {
                this.desactivarActividad = true;
                this.entidad.descripcionEstado.actividad = null;
            } else {
                this.desactivarActividad = false;
            }
        });
        $scope.$on('$destroy', () => {
            deregisterFn();
        });
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