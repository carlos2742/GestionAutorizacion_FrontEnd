import isNil from 'lodash/isNil';
import clone from 'lodash/clone';


/* @ngInject */
/**
 * Esta clase es un servicio de Angular que se utiliza para almacenar información sobre el usuario logueado.
 */
export default class SesionService {

    /**
     * @param $http                               -  Servicio de Angular para hacer llamadas HTTP
     * @param $q                                  -  Servicio de Angular para utilizar Promesas
     * @param {PersonalService} PersonalService   -  Servicio que almacena los empleados
     */
    constructor($http, $q, PersonalService) {
        // Constantes del servicio
        /** @private */
        this.ENDPOINT = '/sesion';

        /** @private */
        this.$http = $http;
        /** @private */
        this.$q = $q;
        /** @private */
        this.personalService = PersonalService;

        /** @type {Persona} */
        this.usuario = null;
    }

    /**
     * Hace una llamada al API para obtener los datos del usuario autenticado. En modo DEBUG, se simula el usuario autenticado
     * obteniendo su id de una variable en SessionStorage. En producción, se usa la autenticación de Windows.
     */
    obtenerUsuarioAutenticado() {
        if (isNil(this.usuario)) {
            let config = {};

            // Esta variable está definida estáticamente en webpack.config. En producción toma el valor false, por lo que
            // esta sección del código no se añade al bundle.
            if (DEBUG_MODE) {
                // Se coge el nInterno de sessionStorage
                config.headers = {
                    'X-User': sessionStorage.getItem('nInternoUsuarioAutenticado')
                }
            }

            return this.$http.get(this.ENDPOINT, config)
                .then(response => {
                    this.usuario = this.personalService.procesarPersonaRecibida(response.data);
                    return clone(this.usuario);
                });
        } else {
            return this.$q.resolve( clone(this.usuario) );
        }
    }


}