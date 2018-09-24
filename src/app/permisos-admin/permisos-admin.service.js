/* @ngInject */
/**
 * Esta clase representa un servicio de Angular usado para agregar o quitar el rol de administrador al personal.
 */
export default class PermisosAdminService {

    /**
     * @param $q            -  Servicio de Angular para utilizar Promesas
     * @param $http         -  Servicio de Angular para hacer llamadas HTTP
     **/
    constructor($q, $http) {
        // Constantes del servicio
        /** @private */
        this.ENDPOINT = '/permisos';

        /** @private */
        this.$q = $q;
        /** @private */
        this.$http = $http;
    }

    /**
     * Añade o quita el permiso de administración a una persona.
     * @param {Persona} persona
     */
    cambiarPermisoAdministracion(persona) {
        return this.$http.post(this.ENDPOINT, {
            administrador: persona.esGestor,
            nInterno: persona.nInterno
        });
    }
}