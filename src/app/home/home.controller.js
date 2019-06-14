

/* @ngInject */
/**
 * Esta clase representa un controlador de Angular usado en la vista inicial de la aplicación.
 */
export default class HomeController {

    /**
     * En modo producción, redirige al usuario autenticado a la vista de central de actividades. En modo DEBUG, muestra un
     * formulario donde se puede insertar el id del usuario que se desea simular que está autenticado.
     *
     * @param $location
     * @param {SesionService} SesionService
     */
    constructor($location, SesionService) {
        /** @type {boolean} */
        this.DEBUG_MODE = DEBUG_MODE;
        /** @private */
        this.$location = $location;

        if (!DEBUG_MODE) {
            this.$location.path('/central-autorizaciones');
        }
    }

    /**
     * Método usado en modo DEBUG para simular que un determinado usuario está autenticado, pasando su nInterno.
     * @param inicioSesionForm      -  Formulario donde se inserta el nInterno del usuario que se desea simular.
     */
    cambiarUsuarioAutenticado(inicioSesionForm) {
        if (DEBUG_MODE) {
            if (inicioSesionForm.$invalid) { return }

            sessionStorage.setItem('nInternoUsuarioAutenticado', this.nInternoUsuarioAutenticado);
            location.reload();
        }
    }
}