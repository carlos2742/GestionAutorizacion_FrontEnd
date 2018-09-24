/* @ngInject */
/**
 * Esta clase contiene un controlador de Angular del modal de confirmación que sale antes de eliminar una entidad.
 */
export default class ModalEliminarEntidadController {

    /**
     * @param $uibModalInstance
     * @param toastr
     * @param nombre
     * @param elemento
     * @param entidad
     * @param fnEliminacion
     *
     */
    constructor($uibModalInstance, toastr, nombre, elemento, entidad, fnEliminacion) {
        /** @private */
        this.$uibModalInstance = $uibModalInstance;
        /** @private */
        this.toastr = toastr;
        /** @type {string} */
        this.nombre = nombre;
        /** @type {Object} */
        this.elemento = elemento;
        /** @type {Object} */
        this.entidad = entidad;
        /** @private */
        this.fnEliminacion = fnEliminacion;
    }

    /**
     * Cierra el modal de confirmación.
     */
    cancelar() {
        this.$uibModalInstance.close(false);
    };

    /**
     * Ejecuta la función que se pasó como parámetro al modal para eliminar la entidad. La función de eliminación debe
     * devolver una promesa. El modal se cierra cuando la promesa se resuelve o se rechaza.
     */
    eliminar() {
        this.fnEliminacion({entidad: this.elemento})
            .then(() => {
                this.$uibModalInstance.close(true);
                this.toastr.info(`${this.entidad} ${this.nombre}`, 'Se ha eliminado');
            })
            .catch(response => {
                if (response && response.status === 404) {
                    this.$uibModalInstance.close(true);
                } else {
                    this.$uibModalInstance.close(false);
                }
            });
    }
}