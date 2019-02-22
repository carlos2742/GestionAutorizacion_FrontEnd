import isNil from 'lodash/isNil';
import isUndefined from 'lodash/isUndefined';
import startsWith from 'lodash/startsWith';
import includes from 'lodash/includes';

import {ERROR_GENERAL, ERROR_DE_VALIDACION, ELEMENTO_YA_EXISTE} from "../constantes";


/* @ngInject */
/**
 * Función que se utiliza para interceptar todos los requests y responses que hace Angular a través de su servicio
 * $http. Este interceptor tiene varias responsabilidades:
 *      - Inyectar la URL del API en cada request que tenga una URL relativa.
 *      - Agregar el header X-User nada más en modo DEBUG a todos los requests que se realizan al API.
 *      - Transformar el response que devuelve el API.
 *      - Manejar algunos de los errores que devuelve el API.
 *      - Emitir los siguientes eventos:
 *          - 'GestionAutorizacionAPI:request' cada vez que se hace un request al API.
 *          - 'GestionAutorizacionAPI:response' cada vez que se recibe un response del API.
 *          - 'GestionAutorizacionAPI:responseError' cada vez que se recibe una respuesta fallida del API.
 *
 * @param $rootScope
 * @param $q
 * @param $injector
 * @param $location
 * @param AppConfig
 */
export default function apiInterceptor($rootScope, $q, $injector, $location, AppConfig) {
    let toastr, sesionService;

    /**
     * Muestra un mensaje de alerta para algunos errores específicos del API. Propaga el response en todos los casos.
     *
     * @param rejection     - Response de error que devolvió el API
     * @private
     */
    function _manejarErroresBackend(rejection) {
        if (rejection.error.errorCode === ERROR_GENERAL) {
            toastr.warning(rejection.error.message, null, {
                closeButton: true,
                timeOut: 0,
                extendedTimeOut: 0
            });

        } else if (rejection.error.errorCode === ERROR_DE_VALIDACION) {
            toastr.warning('Se produjo un error mientras se validaba este elemento');
        } else if (rejection.error.errorCode === ELEMENTO_YA_EXISTE) {
            toastr.warning('No se pudo guardar este elemento en la base de datos porque ya existe otro igual');
        }

        return $q.reject(rejection);
    }

    /**
     * El header X-User se debe añadir siempre en modo DEBUG a los requests al API.
     *
     * @param config        - Configuración del request que se desea enviar.
     * @return {boolean}    - Devuelve true si se debe añadir este header, false en caso contrario.
     */
    function agregarHeaderXUser(config) {
        return isUndefined(config.headers['X-User'])
                && (DEBUG_MODE && startsWith(config.url, AppConfig.url));
    }

    return {
        request: (config) => {
            let url = config.url;

            // ignore template requests
            if (url.substr(url.length - 5) === '.html') {
                return config || $q.when(config);
            }

            $rootScope.$emit('GestionAutorizacionAPI:request', config.method);

            if (!isNil(AppConfig.url)) {
                if (!startsWith(url, 'http://') && !startsWith(url, 'https://') ) {
                    config.url = AppConfig.url + config.url;
                }

                // En modo Debug, manda el nInterno de un usuario en el header 'X-User'
                // En modo producción coge las credenciales de la autenticación de Windows
                if (agregarHeaderXUser(config)) {
                    if (!sesionService) {
                        sesionService = $injector.get('SesionService');
                    }

                    return sesionService.obtenerUsuarioAutenticado()
                        .then(usuario => {
                            config.headers['X-User'] = usuario.nInterno;
                            return config || $q.when(config);
                        })
                        .catch(() => {
                            return config || $q.when(config);
                        });
                }
            }

            return config || $q.when(config);
        },

        response: (response) => {
            let url = response.config.url;
            // ignore template requests
            if (url.substr(url.length - 5) !== '.html') {
                if (response.data && response.data.data) {
                    response.metadata = response.data.metadata;
                    response.data = response.data.data;
                }

                $rootScope.$emit('GestionAutorizacionAPI:response', response.config.method);
            }
            return response;
        },

        responseError: (rejection) => {
            rejection.error = rejection.data;
            rejection.data = null;

            $rootScope.$emit('GestionAutorizacionAPI:responseError', rejection.config.method);

            if (!toastr) {
                // Es necesario instanciarlo aquí para que no dé un problema de dependencia circular
                toastr = $injector.get('toastr');
            }

            if (rejection.status === -1) {
                let msg = 'No se pudo establecer una conexión con el servidor';
                toastr.error(msg, null, {
                    closeButton: true,
                    timeOut: 0,
                    extendedTimeOut: 0
                });
            } else if (rejection.status === 401|| rejection.status === 403) {
                if (!(includes(rejection.config.url, '/peticiones/') && rejection.config.method === "PUT")
                    && !includes(rejection.config.url, '/peticiones_adjuntos')
                    && !includes(rejection.config.url, '/mensajes')) {

                    $location.path('/acceso-denegado');
                    return rejection;
                }
            } else if (rejection.status === 404 && startsWith(rejection.config.url, AppConfig.url)) {
                if (!(includes(rejection.config.url, '/peticiones/') && rejection.config.method === "GET")) {
                    toastr.warning('Lo sentimos, este elemento no fue encontrado en la base de datos');
                }
            } else if (rejection.status === 500) {
                if (!(includes(rejection.config.url, '/etiquetas') && (rejection.config.method === "POST" || rejection.config.method === "PUT"))) {
                    return _manejarErroresBackend(rejection);
                }
            }

            return $q.reject(rejection);
        }
    }
}