import map from 'lodash/map';
import forEach from 'lodash/forEach';
import fill from 'lodash/fill';
import isNil from 'lodash/isNil';
import assign from 'lodash/assign';


/* @ngInject */
/**
 * Esta clase es un servicio de Angular donde se almacena la lista de todas las personas.
 */
export default class PersonalService {
    /**
     * Representa a un empleado
     * @typedef {Object} Persona
     * @property {number} nInterno          -  De sólo lectura. Número que identifica a un empleado.
     * @property {number} codigo            -  Lo mismo que nInterno, se añade para mantener consistencia con otras entidades.
     * @property {string} nombre            -  Nombre del empleado
     * @property {string} apellidos         -  Apellidos del empleado.
     * @property {string} nombreApellidos   -  Equivale a: <nombre> <apellidos>. Usado para visualización.
     * @property {string} apellidosNombre   -  Equivale a: <apellidos>, <nombre>. Usado para visualización.
     * @property {Object[]} especialidades  -  Listado de especialidades que posee el empleado.
     * @property {Object[]} rolesTrabajo    -  Listado de roles que posee el empleado.
     * @property {Object} puesto            -  Puesto que desempeña el empleado en la actualidad.
     * @property {boolean} esGestor         -  Verdadero si tiene permisos de administración.
     */

    /**
     * @param $http         -  Servicio de Angular para hacer llamadas HTTP
     * @param $q            -  Servicio de Angular para utilizar Promesas
     * @param AppConfig     -  Constante que almacena la configuración de la aplicación
     **/
    constructor($http, $q, AppConfig) {
        // Constantes del servicio
        /** @private */
        this.ENDPOINT = '/personas';

        /** @private */
        this.$http = $http;
        /** @private */
        this.$q = $q;
        /** @private */
        this.appConfig = AppConfig;

        /** @type {Persona[]}*/
        this.personas = [];
    }

    /**
     * Le aplica algunas transformaciones a una persona recibida del API.
     *
     * @param {Object} persona      -  Representa una persona recibida del API.
     * @return {Persona}
     */
    procesarPersonaRecibida(persona) {
        return {
            codigo: persona.nInterno,
            nInterno: persona.nInterno,
            usuarioRed: persona.usuarioRed,
            nombre: persona.nombre,
            apellidos: persona.apellidos,
            nombreApellidos: `${persona.nombre} ${persona.apellidos}`,
            apellidosNombre: `${persona.apellidos}, ${persona.nombre}`,

            esGestor: persona.roles ? persona.roles.esGestor : undefined
        }
    }

    /**
     * Devuelve una persona dado su id.
     * @param {number} nInterno
     * @return {Promise.<Persona>}       -  Se resuelve con la persona correspondiente a ese id.
     */
    obtener(nInterno) {
        return this.$http.get(`${this.ENDPOINT}/${nInterno}`)
            .then(response => {
                return this.procesarPersonaRecibida(response.data);
            });
    }

    /**
     * Devuelve una lista de personas. Utiliza paginación porque la cantidad de personas es considerable (alrededor de
     * 3000).
     *
     * @param {number} pagina               -  Página que se desea
     * @param {[string, string]} orden      -  Cómo deben estar ordenados los resultados.
     * @param {Object} filtro               -  Se puede usar para filtrar las personas por nombre, apellidos y si son gestores
     *                                          o no.
     * @param {number} elementosPorPagina   -  Cantidad de personas que se desea recibir en una página.
     * @param {boolean} incluirRol          -  Si es verdadero, se añade información a cada persona sobre si es gestor.
     *                                         Sólo los gestores pueden solicitar esta información.
     * @return {Promise<Persona[]>}         -  Se resuelve con el arreglo de personas que corresponden a una página determinada.
     */
    obtenerTodos(pagina, orden, filtro, elementosPorPagina, incluirRol) {
        let totalPersonas = 0;
        const paginaActual = !isNil(pagina) ? pagina : 1;
        const fin = paginaActual * this.appConfig.elementosPorPagina;
        const inicio = fin - this.appConfig.elementosPorPagina;

        let ordenarPor;
        if (!isNil(orden)) {
            // El API interpreta como orden descendente si se pasa el parámetros con un - delante, ejemplo: -nombre
            ordenarPor = `${orden[1] === 'desc' ? '-' : ''}${orden[0]}`;
        }
        let params = {
            incluirRol,
            paginaActual,
            elementosPorPagina: !isNil(elementosPorPagina) ? elementosPorPagina : this.appConfig.elementosPorPagina,
            ordenarPor,
        };


        return this.$http.get(this.ENDPOINT, {
            params: assign(params, filtro)
        }).then(response => {
            totalPersonas = response.metadata.cantidadTotal;
            return this.$q.all(
                map(response.data, persona => {
                    return this.procesarPersonaRecibida(persona);
                })
            );
        }).then(personas => {
            this._procesarResultadosPaginados(personas, totalPersonas, inicio);
            return personas;
        });
    }

    /**
     * Añade una página de personas obtenidas del API al arreglo total de personas, en la posición que le corresponde.
     *
     * @param {Persona[]} resultados        -  Representa una página de personas.
     * @param {number} total                -  Total de personas existentes.
     * @param {number} inicio               -  Posición inicial del arreglo donde se debe insertar la página.
     * @private
     */
    _procesarResultadosPaginados(resultados, total, inicio) {
        this.personas = [];
        this.personas.push(... fill(Array(total), undefined));
        forEach(resultados, (persona, index) => {
            this.personas[index+inicio] = persona;
        });
    }
}