import map from 'lodash/map';
import get from 'lodash/get';
import format from 'date-fns/format';
import differenceInCalendarDays from 'date-fns/differenceInCalendarDays';

import template from './modal-mensajes.html';


/* @ngInject */
/**
 * Esta clase representa el servicio de Angular que gestiona los mensajes de una petición.
 */
export default class MensajesService {
    /**
     * Representa un mensaje relacionado con una petición
     * @typedef {Object} Mensaje
     * @property {number} id                        -  Identificador del mensaje. Autogenerado en la Base de Datos para mensajes nuevos.
     * @property {number} codigo                    -  Lo mismo que 'id', se añade para mantener consistencia con otras entidades.
     * @property {string} texto                     -  Contenido del mensaje.
     * @property {Object} fechaEnvio                -  Fecha en que se envió el mensaje.
     * @property {Date} fechaEnvio.valor            -  Su valor actual.
     * @property {string} fechaEnvio.display        -  Cómo debe representarse esta fecha.
     * @property {Object} enviadoPor                -  Persona que envió el mensaje.
     * @property {Persona} enviadoPor.valor         -  Su valor actual.
     * @property {string} enviadoPor.display        -  Cómo debe ser representado.
     * @property {boolean} enviadoPorUsuarioActivo  -  Verdadero si el mensaje lo mandó el usuario logueado en ese momento en el sistema.
     */

    /**
     * @param $q
     * @param $http
     * @param $uibModal
     * @param {PeticionesService} PeticionesService
     * @param {PersonalService} PersonalService
     * @param {SesionService} SesionService
     * @param AppConfig                 -  Contiene la configuración del app.
     **/
    constructor($q, $http, $uibModal, PeticionesService, PersonalService, SesionService, AppConfig) {
        // Constantes del servicio
        /** @type {string} */
        this.ENDPOINT = '/mensajes';

        this.MENSAJE_NUEVO_ADJUNTO = 'Se ha subido el adjunto';

        /** @private */
        this.$q = $q;
        /** @private */
        this.$http = $http;
        /** @private */
        this.$uibModal = $uibModal;
        /** @private */
        this.peticionesService = PeticionesService;
        /** @private */
        this.personalService = PersonalService;
        /** @private */
        this.AppConfig = AppConfig;

        SesionService.obtenerUsuarioAutenticado()
            .then(usuario => {
                /** @private */
                this.usuario = usuario;
            });
    }

    /**
     * Le aplica algunas transformaciones a un mensaje recibido del API. Añade una propiedad para facilitar la visualización
     * de varias de sus propiedaddes.
     *
     * @param {Object} entidad          -  Representa un mensaje recibido del API.
     * @returns {Mensaje}               -  La misma entidad, con las transformaciones mencionadas.
     */
    procesarEntidadRecibida(entidad) {
        let mensajeProcesado = {
            codigo: entidad.id
        };

        for (let prop in entidad) {
            if (prop === 'enviadoPor') {
                const personaProcesada = entidad[prop] ? this.personalService.procesarPersonaRecibida(entidad[prop]) : null;
                let display = '';
                if (personaProcesada) {
                    display = personaProcesada.nombreApellidos;
                }
                mensajeProcesado[prop] = {
                    valor: personaProcesada,
                    display
                };
            } else if (prop === 'fechaEnvio') {
                const fechaNecesariaObj = entidad[prop] ? new Date(Date.parse(entidad[prop])) : null;
                let display = '';
                if (fechaNecesariaObj) {
                    const diferencia = differenceInCalendarDays(new Date(), fechaNecesariaObj);
                    if (diferencia === 0) {
                        display = 'Hoy';
                    } else if (diferencia === 1) {
                        display = 'Ayer';
                    } else {
                        display = format(fechaNecesariaObj, this.AppConfig.formatoFechas);
                    }
                }

                mensajeProcesado[prop] = {
                    valor: fechaNecesariaObj,
                    display,
                    displayHora: fechaNecesariaObj ? format(fechaNecesariaObj, 'hh:mm a') : '',
                };
            } else {
                mensajeProcesado[prop] = entidad[prop];
            }

            mensajeProcesado.enviadoPorUsuarioActivo = entidad.enviadoPor.nInterno === this.usuario.nInterno;
        }

        return mensajeProcesado;
    }

    obtenerTodos(idPeticion) {
        return this.$http.get(this.ENDPOINT, { params: { idPeticion, elementosPorPagina: 0 } })
            .then(response => {
                return map(response.data, mensaje => {
                    return this.procesarEntidadRecibida(mensaje);
                });
            });
    }

    enviarMensaje(mensaje, peticion) {
        return this.$http.post(this.ENDPOINT, {
            texto: mensaje,
            peticion: peticion.id
        }).then(response => {
            const mensajeCreado = response.data;
            mensajeCreado.enviadoPor = this.usuario;
            const mensajeProcesado = this.procesarEntidadRecibida(mensajeCreado, peticion);
            peticion.mensajes.push(mensajeProcesado);
            peticion.cantidadMensajes += 1;
            return mensajeProcesado;
        });
    }

    /**
     * Muestra el modal que contiene la lista de mensajes de una petición determinada.
     * @param {Peticion} entidad
     * @param {Object} conf                 -  Objeto que contiene la configuración del modal.
     * @param {Object} conf.contenedor      -  Elemento del DOM que va a contener el modal.
     * @return {Promise}                    -  Se resuelve cuando el usuario cierra el modal de mensajes.
     */
    mostrar(entidad, conf) {
        return this.$q((resolve, reject) => {
            this.$uibModal.open({
                template,
                appendTo: conf.contenedor,
                size: 'dialog-centered',    // hack para que el modal salga centrado verticalmente
                controller: 'ModalMensajesController',
                controllerAs: '$modal',
                resolve: {
                    peticion: () => { return entidad },
                    fnEnvioMensaje: () => {
                        return (mensaje) => {
                            return this.enviarMensaje(mensaje, entidad);
                        };
                    },
                    fnResolucion: () => {
                        return (resultado) => { resolve(resultado) }
                    }
                }
            }).result.catch(() => {
                // Es necesario añadir este catch para que la biblioteca 'ui-bootstrap4' no muestre la siguiente excepción en consola:
                // Possibly unhandled rejection: backdrop click
                // cuando se cierra el modal haciendo click fuera del mismo
            });
        });
    }
}