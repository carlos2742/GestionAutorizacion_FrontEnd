import angular from 'angular';
import scrollGlue from 'angularjs-scroll-glue';

import ConversacionController from './conversacion.controller';

import html from './conversacion.html';
import './conversacion.scss';

/**
 * Contiene el componente <conversacion> que se usa para mostrar todas las tablas de la aplicación.
 * @typedef {Object} Componentes.conversacion
 * @property {Object[]} mensajes               -  Arreglo con los mensajes que pertenecen a la conversación.
 *
 * @example
 * <conversacion mensajes="vm.mensajes"></conversacion>
 */
export default angular.module('conversacion', [
    scrollGlue
])
    .component('conversacion', {
        bindings: {
            mensajes: '<',
        },
        template: html,
        controller: ['$attrs', ConversacionController]
    });